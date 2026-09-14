export default function SetupNotice() {
  return (
    <div className="card" style={{ maxWidth: 760, margin: "60px auto" }}>
      <h2>Supabase setup required</h2>
      <p className="sm mut" style={{ marginTop: 8 }}>
        A Supabase project is needed to run the app. Steps:
      </p>

      <ol className="sm" style={{ margin: "12px 0 0 20px", lineHeight: 1.9 }}>
        <li>
          <a href="https://supabase.com/dashboard" target="_blank" rel="noopener">
            supabase.com/dashboard
          </a>{" "}
          to create a free project
        </li>
        <li>
          Paste <code className="mono">supabase/schema.sql</code> into the <b>SQL Editor</b> and click <b>Run</b> — this must be done first (creates tables + private storage bucket)
        </li>
        <li>
          Project Settings → <b>API Keys</b> (there's no separate "API" page anymore). Project URL is found there too
        </li>
        <li>
          Two keys needed — <b>public</b> (publishable <code className="mono">sb_publishable_…</code>{" "}
          or legacy anon <code className="mono">eyJ…</code>) and <b>secret</b> (secret{" "}
          <code className="mono">sb_secret_…</code> or legacy service_role{" "}
          <code className="mono">eyJ…</code>)
        </li>
        <li>
          Put three values in <code className="mono">.env.local</code> (file is ready — just add values after the <code className="mono">=</code> signs)
        </li>
        <li>
          Then run: <code className="mono">npm run setup</code> — this verifies credentials, builds the manifest, uploads files, and validates the full backend
        </li>
        <li>
          Run <code className="mono">npm run dev</code> and create an account with email + password
        </li>
      </ol>

      <p className="sm mut" style={{ marginTop: 14 }}>
        Detailed instructions are in <code className="mono">README.md</code>.
      </p>
    </div>
  );
}
