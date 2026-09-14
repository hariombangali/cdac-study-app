"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isConfigured } from "@/lib/env";
import SetupNotice from "@/components/SetupNotice";

type Mode = "password" | "magic";

/** Supabase's default minimum is 6 characters. */
const MIN_PASSWORD = 6;

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("password");
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Already signed in? Skip the form.
  useEffect(() => {
    if (!isConfigured) return;
    (async () => {
      try {
        const {
          data: { user },
        } = await createClient().auth.getUser();
        if (user) window.location.replace("/");
      } catch {
        // not signed in / unreachable — stay on the form
      }
    })();
  }, []);

  if (!isConfigured) return <SetupNotice />;

  function goHome() {
    // Hard navigation so the server components see the fresh auth cookie.
    window.location.assign("/");
  }

  function switchTo(next: Mode, isSignup = false) {
    setMode(next);
    setSignup(isSignup);
    setError(null);
    setInfo(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const supabase = createClient();
    setBusy(true);

    try {
      /* -------------------------------------------------------- magic link -- */
      if (mode === "magic") {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;
        setInfo(`Login link sent to ${email}. Check your inbox (and spam folder).`);
        return;
      }

      /* ------------------------------------------------------ create account -- */
      if (signup) {
        if (password.length < MIN_PASSWORD) {
          throw new Error(`Password must be at least ${MIN_PASSWORD} characters.`);
        }
        if (password !== confirm) {
          throw new Error("Passwords do not match.");
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;

        if (data.session) {
          // Email confirmation is switched off in Supabase — straight in.
          goHome();
          return;
        }
        if (data.user && (data.user.identities?.length ?? 0) === 0) {
          // Supabase returns a decoy user with no identities for an existing email.
          throw new Error("This email is already registered. Sign in or reset your password.");
        }
        setInfo(
          "Account created. Supabase sent a confirmation link to your email — click it to sign in. (You can disable email confirmation in Supabase for instant signup.)",
        );
        return;
      }

      /* --------------------------------------------------------- sign in -- */
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      goHome();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(
        /invalid login credentials/i.test(msg)
          ? "Invalid email or password."
          : /email not confirmed/i.test(msg)
            ? "Please confirm your email first — use the link Supabase sent."
            : msg,
      );
    } finally {
      setBusy(false);
    }
  }

  async function forgotPassword() {
    setError(null);
    setInfo(null);
    if (!email) {
      setError("Enter your email first, then click 'forgot password'.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await createClient().auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset`,
      });
      if (error) throw error;
      setInfo(`Password reset link sent to ${email}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 480, margin: "70px auto" }}>
      <h1 style={{ marginBottom: 6 }}>CDAC C-CAT · Study Dashboard</h1>
      <p className="sm mut" style={{ marginBottom: 16 }}>
        First time here? <b>Create an account</b>. Progress saves to the cloud, so your phone and laptop stay in sync.
      </p>

      <nav style={{ marginBottom: 16 }}>
        <button
          type="button"
          className={mode === "password" ? "on" : ""}
          onClick={() => switchTo("password")}
        >
          Password
        </button>
        <button type="button" className={mode === "magic" ? "on" : ""} onClick={() => switchTo("magic")}>
          Magic link
        </button>
      </nav>

      <form onSubmit={submit}>
        <label className="f">Email</label>
        <input
          type="email"
          required
          autoFocus
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />

        {mode === "password" ? (
          <>
            <label className="f" style={{ marginTop: 10 }}>
              Password
            </label>
            <input
              type="password"
              required
              autoComplete={signup ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={signup ? `at least ${MIN_PASSWORD} characters` : "••••••••"}
            />

            {signup ? (
              <>
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
              </>
            ) : null}
          </>
        ) : null}

        {error ? (
          <div className="hint" style={{ marginTop: 12 }}>
            ⚠️ {error}
          </div>
        ) : null}
        {info ? (
          <div
            className="hint"
            style={{
              marginTop: 12,
              color: "var(--ok)",
              borderLeftColor: "var(--ok)",
              background: "rgba(46,204,143,.08)",
            }}
          >
            {info}
          </div>
        ) : null}

        <button className="act" type="submit" disabled={busy} style={{ marginTop: 16, width: "100%" }}>
          {busy
            ? "Please wait…"
            : mode === "magic"
              ? "Send login link"
              : signup
                ? "Create account"
                : "Sign in"}
        </button>
      </form>

      <div className="two" style={{ justifyContent: "space-between", marginTop: 14 }}>
        {mode === "password" ? (
          <>
            <button className="ghost" type="button" onClick={() => switchTo("password", !signup)}>
              {signup ? "Already have an account — sign in" : "Create a new account"}
            </button>
            {!signup ? (
              <button className="ghost" type="button" onClick={forgotPassword} disabled={busy}>
                Forgot password?
              </button>
            ) : null}
          </>
        ) : (
          <span className="sm mut">Forgot password? Reset it from the Password tab.</span>
        )}
      </div>

      <p className="sm mut" style={{ marginTop: 18 }}>
        <Link href="/">← Dashboard</Link>
      </p>
    </div>
  );
}
