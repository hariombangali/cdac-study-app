import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Minimal .env loader for the plain-node scripts. Next.js loads .env.local on its
 * own; the scripts run outside Next, so they need this.
 * process.env wins, so `FOO=bar npm run upload` still overrides the file.
 */
export function loadEnv(appRoot) {
  const out = {};

  for (const name of [".env.local", ".env"]) {
    let text;
    try {
      text = readFileSync(path.join(appRoot, name), "utf8");
    } catch {
      continue;
    }
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const m = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
      if (!m) continue;
      let value = m[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      out[m[1]] = value;
    }
  }

  return { ...out, ...process.env };
}

/** Supabase's two key generations. */
export const KEY_FORMATS = {
  PUBLISHABLE: "publishable", // sb_publishable_... — replaces anon
  SECRET: "secret", // sb_secret_...      — replaces service_role
  LEGACY_JWT: "legacy-jwt", // eyJ...            — anon / service_role
  UNKNOWN: "unknown",
  MISSING: "missing",
};

export function keyFormat(value) {
  const v = (value ?? "").trim();
  if (!v) return KEY_FORMATS.MISSING;
  if (v.startsWith("sb_publishable_")) return KEY_FORMATS.PUBLISHABLE;
  if (v.startsWith("sb_secret_")) return KEY_FORMATS.SECRET;
  if (v.startsWith("eyJ")) return KEY_FORMATS.LEGACY_JWT;
  return KEY_FORMATS.UNKNOWN;
}

export function isUsableKey(value) {
  const f = keyFormat(value);
  return f === KEY_FORMATS.PUBLISHABLE || f === KEY_FORMATS.SECRET || f === KEY_FORMATS.LEGACY_JWT;
}

/**
 * Resolve the Supabase config from whichever variable names the user set.
 * Supabase renamed these in 2025:
 *   anon key         -> publishable key  (NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
 *   service_role key -> secret key       (SUPABASE_SECRET_KEY)
 * Both generations work, so accept either set of names.
 */
export function resolveSupabase(env) {
  const pick = (...names) => {
    for (const n of names) {
      const v = (env[n] ?? "").trim();
      if (v) return v;
    }
    return "";
  };

  const url = pick("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL").replace(/\/$/, "");
  const publicKey = pick(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_ANON_KEY",
  );
  const secretKey = pick(
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SECRET_KEY",
    "SUPABASE_SERVICE_KEY",
  );

  return {
    url,
    publicKey,
    secretKey,
    publicFormat: keyFormat(publicKey),
    secretFormat: keyFormat(secretKey),
    isNewStyle: keyFormat(publicKey) === KEY_FORMATS.PUBLISHABLE,
  };
}
