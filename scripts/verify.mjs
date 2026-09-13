#!/usr/bin/env node
/**
 * End-to-end verification of the Supabase backend.
 *
 *   npm run verify                 # read-only checks
 *   npm run verify -- --with-user  # + create a throwaway user, exercise login and
 *                                  #   every table through the anon key, then delete it
 *
 * Read-only checks prove: config, schema applied, storage populated, signed URLs work.
 * --with-user proves: password login, row level security, and the exact read/write
 * path the app's store uses.
 */
import { createClient } from "@supabase/supabase-js";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isUsableKey, loadEnv, resolveSupabase } from "./load-env.mjs";

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BUCKET = "material";
const WITH_USER = process.argv.includes("--with-user");
const KEEP_USER = process.argv.includes("--keep-user");
const VERIFY_EMAIL = "verify-endtoend@local.test";
const VERIFY_PASSWORD = `verify-${Math.random().toString(36).slice(2)}-A1!`;

const env = loadEnv(APP_ROOT);
const cfg = resolveSupabase(env);
const URL_ = cfg.url;
const ANON = cfg.publicKey;
const SERVICE = isUsableKey(cfg.secretKey) ? cfg.secretKey : "";
const SOURCE = path.resolve(env.MATERIAL_SOURCE_DIR ?? path.resolve(APP_ROOT, ".."));

let pass = 0;
let fail = 0;
const notes = [];

function ok(label, detail = "") {
  pass++;
  console.log(`  \x1b[32m✓\x1b[0m ${label}${detail ? `  \x1b[2m${detail}\x1b[0m` : ""}`);
}
function bad(label, detail = "") {
  fail++;
  console.log(`  \x1b[31m✗\x1b[0m ${label}${detail ? `  \x1b[2m${detail}\x1b[0m` : ""}`);
}
function section(t) {
  console.log(`\n\x1b[1m${t}\x1b[0m`);
}

function human(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 ** 2).toFixed(1)} MB`;
}

/* ------------------------------------------------------------------ config -- */
section("1. Config");
if (!URL_ || !/^https:\/\/.+\.supabase\.co$/.test(URL_)) {
  bad("NEXT_PUBLIC_SUPABASE_URL", URL_ ? `not a supabase project URL: ${URL_}` : "missing");
} else {
  ok("NEXT_PUBLIC_SUPABASE_URL", URL_);
}
if (ANON) ok("public key", `${cfg.publicFormat}, ${ANON.length} chars`);
else bad("public key (anon / publishable)", "missing");
if (SERVICE) ok("secret key", `${cfg.secretFormat}, ${SERVICE.length} chars`);
else console.log("  \x1b[33m!\x1b[0m secret key (service_role / secret)  missing (needed for upload and storage checks)");

if (!URL_ || !ANON) {
  console.log("\nCannot continue without the project URL and anon key.");
  process.exit(1);
}
if (!SERVICE) console.log("  \x1b[33m!\x1b[0m service key missing — storage checks will be skipped");

/* ------------------------------------------------------------------ schema -- */
const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
const admin = SERVICE
  ? createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

const TABLES = [
  "task_progress",
  "day_completion",
  "revision_done",
  "user_settings",
  "mocks",
  "weak_topics",
];

section("2. Schema (run supabase/schema.sql if these fail)");
for (const table of TABLES) {
  const { error } = await anon.from(table).select("*").limit(0);
  if (!error) {
    ok(`${table} reachable`);
  } else if (/does not exist|Could not find the table|schema cache/i.test(error.message)) {
    bad(`${table} MISSING`, "run supabase/schema.sql");
  } else {
    bad(`${table}`, error.message);
  }
}

/* ----------------------------------------------------------------- storage -- */
section("3. Storage");
let stored = 0;
let storedBytes = 0;

if (!admin) {
  notes.push("storage checks skipped — no service role key");
  console.log("  (skipped)");
} else {
  async function walk(prefix) {
    let offset = 0;
    for (;;) {
      const { data, error } = await admin.storage.from(BUCKET).list(prefix, { limit: 100, offset });
      if (error) {
        bad(`list ${prefix || "/"}`, error.message);
        return;
      }
      if (!data?.length) return;
      for (const item of data) {
        const full = prefix ? `${prefix}/${item.name}` : item.name;
        if (!item.id || !item.metadata) {
          await walk(full);
        } else {
          stored++;
          storedBytes += item.metadata.size ?? 0;
        }
      }
      if (data.length < 100) return;
      offset += data.length;
    }
  }
  await walk("");

  const manifest = JSON.parse(await readFile(path.join(APP_ROOT, "data", "manifest.json"), "utf8"));
  const expected = Object.values(manifest).reduce((n, l) => n + l.length, 0);

  if (stored === 0) {
    bad("bucket is empty", "run: npm run upload");
  } else if (stored < expected) {
    bad(`only ${stored}/${expected} files uploaded`, `${human(storedBytes)} — re-run: npm run upload`);
  } else {
    ok(`${stored}/${expected} files in the private bucket`, human(storedBytes));
  }

  // signed URL round-trip on a real file
  const sampleKey = Object.entries(manifest)
    .flatMap(([dir, files]) => files.map((f) => (dir === "." ? f : `${dir}/${f}`)))
    .find((k) => k.toLowerCase().endsWith(".pdf"));

  if (sampleKey) {
    const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(sampleKey, 60);
    if (error || !data?.signedUrl) {
      bad("signed URL generation", error?.message ?? "no url returned");
    } else {
      const res = await fetch(data.signedUrl);
      const buf = await res.arrayBuffer();
      const local = await stat(path.join(SOURCE, sampleKey)).then((s) => s.size).catch(() => -1);
      if (res.status !== 200) {
        bad("signed URL fetch", `HTTP ${res.status}`);
      } else if (local >= 0 && buf.byteLength !== local) {
        bad("signed URL byte count mismatch", `remote ${buf.byteLength} vs local ${local}`);
      } else {
        ok("signed URL serves the real file", `${sampleKey} (${human(buf.byteLength)})`);
      }
    }
  }

  // the bucket must NOT be public
  const { data: buckets } = await admin.storage.listBuckets();
  const b = buckets?.find((x) => x.name === BUCKET || x.id === BUCKET);
  if (!b) bad("bucket 'material' not found", "run supabase/schema.sql");
  else if (b.public) bad("bucket is PUBLIC", "it must be private — check schema.sql");
  else ok("bucket is private");
}

/* ----------------------------------------------------- login + sync + RLS -- */
section("4. Login, progress sync and row level security");
if (!WITH_USER) {
  console.log("  (skipped — re-run with: npm run verify -- --with-user)");
  notes.push("login/sync/RLS not tested; re-run with --with-user");
} else if (!admin) {
  bad("cannot test login without the service role key");
} else {
  // throwaway user, idempotent across runs
  let userId = null;
  const created = await admin.auth.admin.createUser({
    email: VERIFY_EMAIL,
    password: VERIFY_PASSWORD,
    email_confirm: true,
  });
  if (created.error) {
    const list = await admin.auth.admin.listUsers();
    const existing = list.data?.users?.find((u) => u.email === VERIFY_EMAIL);
    if (!existing) {
      bad("could not create or find the verify user", created.error.message);
    } else {
      userId = existing.id;
      await admin.auth.admin.updateUserById(userId, { password: VERIFY_PASSWORD });
      ok("reusing existing verify user");
    }
  } else {
    userId = created.data.user?.id ?? null;
    ok("created throwaway verify user", VERIFY_EMAIL);
  }

  if (userId) {
    const userClient = createClient(URL_, ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const signIn = await userClient.auth.signInWithPassword({
      email: VERIFY_EMAIL,
      password: VERIFY_PASSWORD,
    });
    if (signIn.error || !signIn.data.session) {
      bad("password sign-in", signIn.error?.message ?? "no session");
    } else {
      ok("password sign-in works", `session for ${VERIFY_EMAIL}`);

      const uid = signIn.data.session.user.id;
      let crudFailures = 0;

      async function crud(label, fn) {
        const r = await fn();
        if (r?.error) {
          bad(label, r.error.message);
          crudFailures++;
        } else return r;
      }

      await crud("task_progress upsert", () =>
        userClient
          .from("task_progress")
          .upsert({ user_id: uid, day_id: "verify-day", item_index: 0 }, { onConflict: "user_id,day_id,item_index" }),
      );
      await crud("day_completion upsert", () =>
        userClient
          .from("day_completion")
          .upsert({ user_id: uid, day_id: "verify-day", completed_at: "2026-09-13" }, { onConflict: "user_id,day_id" }),
      );
      await crud("revision_done upsert", () =>
        userClient
          .from("revision_done")
          .upsert({ user_id: uid, day_id: "verify-day", gap_index: 0 }, { onConflict: "user_id,day_id,gap_index" }),
      );
      await crud("user_settings upsert", () =>
        userClient.from("user_settings").upsert({ user_id: uid, exam_date: "2026-11-08" }, { onConflict: "user_id" }),
      );
      const mock = await crud("mocks insert", () =>
        userClient
          .from("mocks")
          .insert({ user_id: uid, date: "2026-09-13", section: "A+B", attempted: 50, correct: 40, wrong: 5 })
          .select("*")
          .single(),
      );
      const weak = await crud("weak_topics insert", () =>
        userClient
          .from("weak_topics")
          .insert({ user_id: uid, topic: "verify", note: "temp", sev: "high" })
          .select("*")
          .single(),
      );

      // read back what we wrote
      const readBack = await userClient.from("task_progress").select("day_id").eq("user_id", uid);
      if (readBack.error) bad("read back", readBack.error.message);
      else if (!readBack.data?.some((r) => r.day_id === "verify-day")) bad("read back did not find the row");
      else ok("progress round-trip (write -> read)");

      /* RLS: an anonymous client must see NONE of the rows we just wrote. */
      const anonRead = await anon.from("task_progress").select("day_id").limit(5);
      if (anonRead.error) {
        // a hard permission error is also an acceptable outcome
        ok("anon cannot read task_progress", anonRead.error.message.slice(0, 60));
      } else if ((anonRead.data ?? []).length === 0) {
        ok("anon sees 0 rows — RLS is enforcing");
      } else {
        bad(
          "anon can READ other users' rows",
          `${anonRead.data.length} rows leaked — RLS is not enabled. Check schema.sql`,
        );
      }

      /* a signed-in user must not be able to write into someone else's account */
      const forged = await userClient
        .from("mocks")
        .insert({
          user_id: "00000000-0000-0000-0000-000000000000",
          date: "2026-09-13",
          section: "A",
          attempted: 1,
          correct: 1,
          wrong: 0,
        });
      if (forged.error) ok("forged user_id rejected", forged.error.message.slice(0, 48));
      else bad("a user could insert a row for another user_id", "RLS policy too loose");

      // cleanup
      await userClient.from("task_progress").delete().eq("user_id", uid).eq("day_id", "verify-day");
      await userClient.from("day_completion").delete().eq("user_id", uid).eq("day_id", "verify-day");
      await userClient.from("revision_done").delete().eq("user_id", uid).eq("day_id", "verify-day");
      if (mock?.data?.id) await userClient.from("mocks").delete().eq("id", mock.data.id);
      if (weak?.data?.id) await userClient.from("weak_topics").delete().eq("id", weak.data.id);
      ok("cleaned up the verify rows");

      if (crudFailures === 0) ok("all six tables accept the app's write path");

      await userClient.auth.signOut();
    }

    if (!KEEP_USER) {
      const del = await admin.auth.admin.deleteUser(userId);
      if (del.error) bad("could not delete the verify user", del.error.message);
      else ok("deleted the throwaway verify user");
    } else {
      notes.push(`verify user kept: ${VERIFY_EMAIL} (password not printed)`);
    }
  }
}

/* ------------------------------------------------------------------ report -- */
console.log(`\n\x1b[1mResult\x1b[0m  ${pass} passed, ${fail} failed`);
for (const n of notes) console.log(`  \x1b[33m!\x1b[0m ${n}`);
if (fail) {
  console.log("\nFix the ✗ items above, then run this again.");
  process.exit(1);
}
console.log("\nBackend is ready. Start the app with: npm run dev");
