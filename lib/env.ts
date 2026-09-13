/**
 * Supabase config for the Next.js app.
 *
 * Supabase renamed its browser key in 2025:
 *   anon key (eyJ...)          ->  publishable key (sb_publishable_...)
 * Both work, so accept either variable name and either key format.
 */
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "";

/** True when the app has enough config to talk to Supabase. */
export const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const BUCKET = "material";
