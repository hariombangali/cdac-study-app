#!/usr/bin/env node
/**
 * Uploads every file in data/manifest.json into the PRIVATE Supabase Storage bucket.
 * Files keep their vault-relative path as the object key, so the app can look up
 * /api/material?path=<same path>.
 *
 *   npm run manifest      # refresh the index first
 *   npm run upload
 *   npm run upload -- --dry-run     # show what would upload, change nothing
 *   npm run upload -- --force       # re-upload files that already exist
 *
 * Needs SUPABASE_SERVICE_ROLE_KEY (Project Settings -> API). Keep it in .env.local
 * and never commit it — it bypasses row level security.
 */
import { createClient } from "@supabase/supabase-js";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isUsableKey, loadEnv, resolveSupabase } from "./load-env.mjs";

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BUCKET = "material";
const CONCURRENCY = 4;

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes("--dry-run");
const FORCE = argv.includes("--force");

const env = loadEnv(APP_ROOT);
const SOURCE = path.resolve(
  env.MATERIAL_SOURCE_DIR ? env.MATERIAL_SOURCE_DIR : path.resolve(APP_ROOT, ".."),
);
const cfg = resolveSupabase(env);

if (!DRY_RUN && (!cfg.url || !isUsableKey(cfg.secretKey))) {
  console.error(
    "Missing Supabase project URL or secret key in .env.local.\n" +
      "Run `npm run precheck` for details on which one and where to find it.",
  );
  process.exit(1);
}

const CONTENT_TYPES = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".c": "text/x-c; charset=utf-8",
  ".h": "text/x-c; charset=utf-8",
  ".cpp": "text/x-c++src; charset=utf-8",
  ".i": "text/plain; charset=utf-8",
  ".s": "text/plain; charset=utf-8",
  ".json": "application/json",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xopp": "application/octet-stream",
};

function contentType(file) {
  return CONTENT_TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream";
}

function human(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

/** Supabase Storage list() is per-prefix, so walk the tree to find what's already there. */
async function listExisting(supabase) {
  const found = new Set();

  async function walk(prefix) {
    let offset = 0;
    for (;;) {
      const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
        limit: 100,
        offset,
      });
      if (error) throw new Error(`list "${prefix}": ${error.message}`);
      if (!data?.length) return;

      for (const item of data) {
        const full = prefix ? `${prefix}/${item.name}` : item.name;
        // Folders come back with a null id and no metadata.
        if (!item.id || !item.metadata) await walk(full);
        else found.add(full);
      }

      if (data.length < 100) return;
      offset += data.length;
    }
  }

  await walk("");
  return found;
}

const manifest = JSON.parse(
  await readFile(path.join(APP_ROOT, "data", "manifest.json"), "utf8"),
);

const queue = [];
for (const [dir, files] of Object.entries(manifest)) {
  for (const f of files) {
    const key = dir === "." ? f : `${dir}/${f}`;
    queue.push({ key, abs: path.join(SOURCE, key) });
  }
}

// The worker pool below drains `queue` with shift(), so capture the size now —
// reading queue.length later reports what is LEFT to do, not the total, and the
// progress line collapses into nonsense (e.g. "475/13").
const TOTAL = queue.length;

console.log(`source   : ${SOURCE}`);
console.log(`bucket   : ${BUCKET} (private)`);
console.log(`queued   : ${TOTAL} files${DRY_RUN ? "  [DRY RUN]" : FORCE ? "  [FORCE]" : ""}`);
console.log("");

if (DRY_RUN) {
  let bytes = 0;
  for (const item of queue) {
    const { size } = await stat(item.abs).catch(() => ({ size: 0 }));
    bytes += size;
    console.log(`  ${human(size).padStart(9)}  ${item.key}`);
  }
  console.log("");
  console.log(`total    : ${human(bytes)} across ${queue.length} files`);
  process.exit(0);
}

const supabase = createClient(cfg.url, cfg.secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const existing = FORCE ? new Set() : await listExisting(supabase);
if (existing.size) console.log(`already in storage: ${existing.size} files (skipping)`);
console.log("");

let uploaded = 0;
let skipped = 0;
let failed = 0;
let bytes = 0;
const failures = [];

async function handle(item) {
  if (existing.has(item.key)) {
    skipped++;
    return;
  }
  const body = await readFile(item.abs);
  const { error } = await supabase.storage.from(BUCKET).upload(item.key, body, {
    contentType: contentType(item.abs),
    upsert: true,
  });
  if (error) {
    failed++;
    failures.push(`${item.key}: ${error.message}`);
  } else {
    uploaded++;
    bytes += body.byteLength;
  }
  const seen = uploaded + skipped + failed;
  if (seen % 25 === 0 || seen === TOTAL) {
    process.stdout.write(
      `\r  progress ${seen}/${TOTAL}  ·  uploaded ${uploaded}  ·  skipped ${skipped}  ·  failed ${failed}  ·  ${human(bytes)}   `,
    );
  }
}

// Small worker pool so we don't open 491 sockets at once.
const workers = Array.from({ length: CONCURRENCY }, async () => {
  for (;;) {
    const item = queue.shift();
    if (!item) return;
    await handle(item);
  }
});
await Promise.all(workers);

console.log("\n");
console.log(`uploaded : ${uploaded} (${human(bytes)})`);
console.log(`skipped  : ${skipped}`);
console.log(`failed   : ${failed}`);
if (failures.length) {
  console.log("\nfailures:");
  for (const f of failures) console.log("  ✗ " + f);
  process.exit(1);
}
