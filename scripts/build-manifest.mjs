#!/usr/bin/env node
/**
 * Scans the study vault and writes data/manifest.json — a {directory: [files]} map
 * of everything you own. This file is what makes the file index complete and makes
 * the "does this path exist?" checks authoritative.
 *
 *   npm run manifest
 *   MATERIAL_SOURCE_DIR=/some/other/vault npm run manifest
 *
 * Re-run it whenever you add or remove PDFs.
 */
import { readdir, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SOURCE = process.env.MATERIAL_SOURCE_DIR
  ? path.resolve(process.env.MATERIAL_SOURCE_DIR)
  : path.resolve(APP_ROOT, "..");

/** Never index tooling, VCS internals, or this app itself. */
const SKIP_DIRS = new Set([
  ".git",
  ".freebuff",
  ".next",
  "node_modules",
  "__pycache__",
  ".vscode",
  "study-app",
]);

const SKIP_FILES = new Set([".DS_Store", "Thumbs.db"]);

async function scan() {
  const manifest = {};

  async function walk(absDir, relDir) {
    const entries = await readdir(absDir, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        await walk(path.join(absDir, entry.name), relDir ? `${relDir}/${entry.name}` : entry.name);
      } else if (entry.isFile()) {
        if (SKIP_FILES.has(entry.name)) continue;
        files.push(entry.name);
      }
    }

    if (files.length) manifest[relDir || "."] = files.sort();
  }

  await walk(SOURCE, "");

  return Object.fromEntries(Object.entries(manifest).sort((a, b) => a[0].localeCompare(b[0])));
}

const manifest = await scan();
const dirs = Object.keys(manifest).length;
const files = Object.values(manifest).reduce((n, list) => n + list.length, 0);

await mkdir(path.join(APP_ROOT, "data"), { recursive: true });
await writeFile(
  path.join(APP_ROOT, "data", "manifest.json"),
  JSON.stringify(manifest, null, 0) + "\n",
  "utf8",
);

console.log(`scanned  : ${SOURCE}`);
console.log(`wrote    : data/manifest.json`);
console.log(`result   : ${files} files across ${dirs} folders`);
