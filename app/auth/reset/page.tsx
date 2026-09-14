"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isConfigured } from "@/lib/env";
import SetupNotice from "@/components/SetupNotice";

const MIN_PASSWORD = 6;

/**
 * Reached after clicking the reset link in the email. /auth/callback has already
 * exchanged the code for a session, so we only need to set the new password.
 */
export default function ResetPage() {
  const [ready, setReady] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!isConfigured) return;
    (async () => {
      try {
        const {
          data: { user },
        } = await createClient().auth.getUser();
        setReady(Boolean(user));
      } catch {
        setReady(false);
      }
    })();
  }, []);

  if (!isConfigured) return <SetupNotice />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      setTimeout(() => window.location.assign("/"), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (ready === null) {
    return (
      <div className="card" style={{ maxWidth: 460, margin: "80px auto" }}>
        <h2>Checking…</h2>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="card" style={{ maxWidth: 460, margin: "80px auto" }}>
        <h2>Link expired</h2>
        <p className="sm mut" style={{ marginTop: 8 }}>
          Reset links are single-use and expire quickly. Request a new one.
        </p>
        <p className="sm" style={{ marginTop: 14 }}>
          <Link href="/login">← Login page</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ maxWidth: 460, margin: "80px auto" }}>
      <h2>Set new password</h2>
      {done ? (
        <div
          className="hint"
          style={{
            marginTop: 12,
            color: "var(--ok)",
            borderLeftColor: "var(--ok)",
            background: "rgba(46,204,143,.08)",
          }}
        >
          Password changed. Opening dashboard…
        </div>
      ) : (
        <form onSubmit={submit}>
          <label className="f" style={{ marginTop: 12 }}>
            New password
          </label>
          <input
            type="password"
            required
            autoFocus
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={`at least ${MIN_PASSWORD} characters`}
          />
          <label className="f" style={{ marginTop: 10 }}>
            Confirm password
          </label>
          <input
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="retype password"
          />
          {error ? (
            <div className="hint" style={{ marginTop: 12 }}>
              ⚠️ {error}
            </div>
          ) : null}
          <button className="act" type="submit" disabled={busy} style={{ marginTop: 16, width: "100%" }}>
            {busy ? "Saving…" : "Save password"}
          </button>
        </form>
      )}
    </div>
  );
}
