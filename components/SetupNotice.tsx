export default function SetupNotice() {
  return (
    <div className="card" style={{ maxWidth: 760, margin: "60px auto" }}>
      <h2>Supabase setup baaki hai</h2>
      <p className="sm mut" style={{ marginTop: 8 }}>
        App ko chalane ke liye Supabase project chahiye. Steps:
      </p>

      <ol className="sm" style={{ margin: "12px 0 0 20px", lineHeight: 1.9 }}>
        <li>
          <a href="https://supabase.com/dashboard" target="_blank" rel="noopener">
            supabase.com/dashboard
          </a>{" "}
          pe free project banao
        </li>
        <li>
          <b>SQL Editor</b> me <code className="mono">supabase/schema.sql</code> paste karke{" "}
          <b>Run</b> karo — ye pehle karna zaroori hai (tables + private storage bucket isse bante
          hain)
        </li>
        <li>
          Project Settings → <b>API Keys</b> (alag “API” page ab nahi hai). Project URL bhi wahi
          milta hai
        </li>
        <li>
          Do keys chahiye — <b>public</b> (publishable <code className="mono">sb_publishable_…</code>{" "}
          ya legacy anon <code className="mono">eyJ…</code>) aur <b>secret</b> (secret{" "}
          <code className="mono">sb_secret_…</code> ya legacy service_role{" "}
          <code className="mono">eyJ…</code>)
        </li>
        <li>
          Teen values <code className="mono">.env.local</code> me daalo (file ready hai — sirf{" "}
          <code className="mono">=</code> ke baad values likhni hain)
        </li>
        <li>
          Phir ek command: <code className="mono">npm run setup</code> — ye credentials check karke,
          manifest banake, files upload karke, poora backend verify kar dega
        </li>
        <li>
          <code className="mono">npm run dev</code> chalao aur email + password se account banao
        </li>
      </ol>

      <p className="sm mut" style={{ marginTop: 14 }}>
        Detail <code className="mono">README.md</code> me hai.
      </p>
    </div>
  );
}
