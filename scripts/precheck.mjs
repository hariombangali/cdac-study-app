#!/usr/bin/env node
/**
 * Fast credential preflight. Runs first in `npm run setup` so you find out about a
 * missing or malformed key in two seconds, instead of 200 files into an upload.
 *
 * Accepts both Supabase key generations:
 *   publishable (sb_publishable_...) + secret (sb_secret_...)   <- current
 *   anon (eyJ...) + service_role (eyJ...)                       <- legacy, deprecated end of 2026
 *
 *   npm run precheck
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { KEY_FORMATS, isUsableKey, loadEnv, resolveSupabase } from "./load-env.mjs";

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cfg = resolveSupabase(loadEnv(APP_ROOT));

const problems = [];
const hints = [];

if (!cfg.url) {
  problems.push("NEXT_PUBLIC_SUPABASE_URL is empty");
} else if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(cfg.url)) {
  problems.push(
    `NEXT_PUBLIC_SUPABASE_URL does not look like a project URL (got "${cfg.url}") — expected https://<project-ref>.supabase.co`,
  );
}

if (!isUsableKey(cfg.publicKey)) {
  problems.push(
    cfg.publicFormat === KEY_FORMATS.MISSING
      ? "NEXT_PUBLIC_SUPABASE_ANON_KEY is empty"
      : `NEXT_PUBLIC_SUPABASE_ANON_KEY is not a recognisable key (looks like "${cfg.publicFormat}")`,
  );
}

if (!isUsableKey(cfg.secretKey)) {
  problems.push(
    cfg.secretFormat === KEY_FORMATS.MISSING
      ? "SUPABASE_SERVICE_ROLE_KEY is empty"
      : `SUPABASE_SERVICE_ROLE_KEY is not a recognisable key (looks like "${cfg.secretFormat}")`,
  );
} else if (
  cfg.secretFormat === KEY_FORMATS.PUBLISHABLE ||
  (cfg.secretKey && cfg.secretKey === cfg.publicKey)
) {
  problems.push(
    "SUPABASE_SERVICE_ROLE_KEY holds your PUBLIC key. The upload needs the secret/elevated key.",
  );
}

if (cfg.secretFormat === KEY_FORMATS.LEGACY_JWT || cfg.publicFormat === KEY_FORMATS.LEGACY_JWT) {
  hints.push(
    "You are on the legacy anon/service_role keys. They work, but Supabase retires them at the end of 2026 — migrate when convenient.",
  );
}

if (problems.length) {
  console.error("\nCannot start: fix these in study-app/.env.local\n");
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error(`
Where to find them (Supabase dashboard):

  1. https://supabase.com/dashboard  ->  create/open your project
  2. Project Settings -> API Keys   (there is no separate "API" page any more)
     - Project URL is shown there too
     - Create/copy a PUBLISHABLE key  -> NEXT_PUBLIC_SUPABASE_ANON_KEY
     - Create/copy a SECRET key       -> SUPABASE_SERVICE_ROLE_KEY

  Legacy projects: the "anon" and "service_role" keys on the same page work identically.

  3. Run supabase/schema.sql in the SQL Editor BEFORE this step, or the
     tables and the private storage bucket will not exist.
`);
  process.exit(1);
}

// Quick reachability + schema probe so a wrong project ref is caught here too.
try {
  const res = await fetch(`${cfg.url}/rest/v1/task_progress?select=day_id&limit=0`, {
    headers: { apikey: cfg.publicKey, Authorization: `Bearer ${cfg.publicKey}` },
  });
  if (res.status === 404) {
    const body = await res.text();
    if (/does not exist|Could not find the table|schema cache/i.test(body)) {
      console.error("\nThe project is reachable but the tables are missing.");
      console.error("Run supabase/schema.sql in the Supabase SQL Editor, then try again.\n");
      process.exit(1);
    }
  }
  if (res.status === 401) {
    console.error("\nThe public key was rejected (401). Double-check you copied the anon/publishable key.");
    console.error("Make sure it is not the secret key, and that you copied the whole value.\n");
    process.exit(1);
  }
} catch (e) {
  console.error(`\nCould not reach the project: ${e.message}`);
  console.error("Check NEXT_PUBLIC_SUPABASE_URL and your internet connection.\n");
  process.exit(1);
}

console.log(
  `✓ credentials look good (${cfg.publicFormat} public key, ${cfg.secretFormat} secret key, project reachable)`,
);
for (const h of hints) console.log(`  ! ${h}`);
