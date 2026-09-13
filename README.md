# CDAC C-CAT Study App

A Next.js + Supabase version of the study dashboard: the same 8-week plan, spaced-revision
queue, mock log, weak-topic list and complete file index — but progress lives in Postgres
so it syncs across your phone and laptop instead of being trapped in one browser.

Deploys to Vercel as-is.

---

## Why the PDFs live in Supabase, not in the repo

The vault is **346 MB of content**. Vercel's documented limit for static file uploads via the
CLI is **100 MB on Hobby** (1 GB on Pro), so the PDFs physically cannot ship inside the
deployment. Proxying them through an API route is out too — a Vercel function response body
is capped at **4.5 MB**, and the largest PDF here is 29 MB.

So: files go to a **private Supabase Storage bucket**, and the app hands out **10-minute
signed URLs**. Object keys are the vault-relative paths, which is why
`/api/material?path=...` maps 1:1 onto your folder structure.

The bucket is private on purpose. It holds 491 files including your admit card and
copyrighted books (RS Aggarwal, Wren & Martin, Word Power); a public bucket would publish
those to anyone with the URL. Logged in, you see everything. Logged out, nothing.

---

## 1. Create the Supabase project

1. Sign in at <https://supabase.com/dashboard> and create a free project.
2. Open **SQL Editor → New query**, paste all of `supabase/schema.sql`, and click **Run**.
   This creates the tables, row-level security policies, and the private `material` bucket.
   Do this **before** the next step, or the tables and bucket will not exist.
3. Open **Project Settings → API Keys** (there is no separate “API” page any more; the
   **Project URL** is on that page too, and behind the **Connect** button). Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **secret key** → `SUPABASE_SERVICE_ROLE_KEY` (local upload/verify scripts only)

### Which key generation?

Supabase renamed these in 2025 and retires the old pair at the end of 2026. Both work here,
and `npm run precheck` accepts either:

| Purpose | Current key | Legacy key (deprecated end of 2026) |
| --- | --- | --- |
| Browser / public | publishable — `sb_publishable_…` | anon — `eyJ…` |
| Server / local scripts | secret — `sb_secret_…` | service_role — `eyJ…` |

The variable **names** are unchanged whichever pair you use, so nothing else needs editing.
If you prefer the current names, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and
`SUPABASE_SECRET_KEY` are also read.

> The secret / service_role key bypasses row-level security. Keep it in `.env.local` only.
> Never put it in Vercel's environment variables and never commit it. Current secret keys
> additionally refuse to work from a browser (Supabase returns 401 based on User-Agent).

## 2. Local setup

```bash
cd study-app
npm install

# .env.local already exists — paste the three values after the "=" signs

# one command does the whole backend bring-up:
#   precheck -> manifest -> upload -> verify (including login + RLS)
npm run setup

# start it
npm run dev
```

Step by step, if you prefer to see each stage:

```bash
npm run precheck            # credentials valid? project reachable? tables there?
npm run manifest            # scan the vault -> data/manifest.json
npm run upload -- --dry-run # exactly what would upload, changes nothing
npm run upload              # upload all 491 files (~346 MB) to the private bucket
npm run verify -- --with-user
npm run dev
```

`npm run setup` fails in about two seconds if a key is missing or malformed, rather than
200 files into an upload.

Open <http://localhost:3000>. There are two ways in:

- **Password** — click *Naya account banao*, pick an email + password, and you are in.
- **Magic link** — enter an email and click the link that arrives.

Forgot your password? The *Forgot password?* button emails a reset link that lands on
`/auth/reset`.

> **Want signup to work without email?** Supabase confirms email addresses by default, so a
> new password account has to click a confirmation link first. To skip that:
> **Authentication → Sign In / Providers → Email → turn off “Confirm email”**, then signup
> signs you straight in. Handy while setting things up on your own machine.

`npm run upload` is safe to re-run: it lists what is already in the bucket and skips those
files. Add `--force` to re-upload everything.

### Pointing at a different vault

```bash
MATERIAL_SOURCE_DIR=/path/to/material npm run manifest
MATERIAL_SOURCE_DIR=/path/to/material npm run upload
```

`study-app/` itself is always excluded from the scan, so the app never indexes its own source.

## 3. Deploy to Vercel

```bash
npm i -g vercel     # once
vercel              # first deploy, follow the prompts
vercel --prod       # promote to production
```

Set these in **Vercel → Project → Settings → Environment Variables** (Production + Preview):

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | your project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon key |

Do **not** set `SUPABASE_SERVICE_ROLE_KEY` on Vercel — uploads run from your machine.

Then in **Supabase → Authentication → URL Configuration**, set **Site URL** to your Vercel
domain and add these to **Redirect URLs**:

```
http://localhost:3000/auth/callback
https://<your-app>.vercel.app/auth/callback
```

Without this, magic-link and password-reset emails bounce back to localhost and the links
do not work.

`data/manifest.json` is committed, so the deploy has the file index without needing your
vault. Re-run `npm run manifest` and commit whenever you add PDFs, then
`npm run upload` to push the new files.

---

## How the pieces fit

```
lib/plan.ts          the 8-week plan (ported from Study_Dashboard.html, unchanged)
lib/material.ts      per-folder notes and known data problems
data/manifest.json   {folder: [files]} — generated by scripts/build-manifest.mjs
lib/progress.ts      pure logic: item lists, day completion, spaced revision, backlog
lib/store.tsx        loads state from Supabase, writes optimistic updates back
app/api/material     validates the path against the manifest, returns a signed URL
supabase/schema.sql  tables + RLS + private bucket
```

Progress writes are optimistic: the UI updates immediately, then the diff is flushed to
Postgres. If a write fails, the header shows a banner rather than silently dropping your
data.

### Tables

| Table | Holds |
| --- | --- |
| `task_progress` | one row per ticked checkbox (`day_id`, `item_index`) |
| `day_completion` | set when every task of a day is ticked; drives the revision queue |
| `revision_done` | which +1/+3/+7/+21-day revisions you have cleared |
| `user_settings` | exam date |
| `mocks` | mock test scores (net = correct×3 − wrong) |
| `weak_topics` | error log with priority and a fixed flag |

### Auth

| Route | Purpose |
| --- | --- |
| `/login` | password sign-in, sign-up, magic link, forgot-password |
| `/auth/callback` | exchanges the email link's code for a session, then honours `?next=` |
| `/auth/reset` | sets a new password after a reset link |

`middleware.ts` refreshes the auth cookie each request. It deliberately returns early when
Supabase is not configured, so an unconfigured install shows the setup instructions instead
of a 500.

Every table is scoped to `auth.uid()` by RLS, so one account can only ever touch its own rows.

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | local dev server |
| `npm run build` | production build (also typechecks) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run manifest` | rescan the vault → `data/manifest.json` |
| `npm run upload` | upload indexed files to the private bucket |
| `npm run precheck` | fast credential + reachability + schema check |
| `npm run setup` | precheck + manifest + upload + verify, in order |
| `npm run verify` | end-to-end backend check (add `-- --with-user` for login/RLS) |

> **Footgun:** `npm run build` and `npm run dev` share the same `.next` directory. Running a
> build while the dev server is up corrupts the running server (you get confusing
> `__webpack_modules__[moduleId] is not a function` errors and 500s). Stop the dev server
> first, or delete `.next` and restart it.

## Not done yet

- `Study_Dashboard.html` in the parent folder still exists and still works **offline with
  clickable local links**. It is the version to use on a train with no internet; this app is
  the version to use when you want your progress on every device.
- The file index trusts `data/manifest.json`. If you add PDFs and forget `npm run manifest`,
  the new files simply won't appear — the app never invents paths.
