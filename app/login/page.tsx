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
        setInfo(`Login link ${email} pe bhej diya. Inbox (aur spam) check karo.`);
        return;
      }

      /* ------------------------------------------------------ create account -- */
      if (signup) {
        if (password.length < MIN_PASSWORD) {
          throw new Error(`Password kam se kam ${MIN_PASSWORD} characters ka hona chahiye.`);
        }
        if (password !== confirm) {
          throw new Error("Dono passwords match nahi kar rahe.");
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
          throw new Error("Ye email already registered hai. Sign in karo, ya password reset karo.");
        }
        setInfo(
          "Account ban gaya. Supabase ne confirm link email pe bheja hai — us link pe click karne ke baad sign in karo. (Chaho to Supabase me Confirm email band kar do, phir signup turant ho jayega.)",
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
          ? "Email ya password galat hai."
          : /email not confirmed/i.test(msg)
            ? "Pehle email confirm karo — jo link Supabase ne bheja tha."
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
      setError("Pehle email daalo, phir 'forgot password' dabao.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await createClient().auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset`,
      });
      if (error) throw error;
      setInfo(`Password reset link ${email} pe bhej diya.`);
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
        Pehli baar ho? <b>Create account</b> karo. Progress cloud me save hogi, to phone aur laptop
        dono sync rahenge.
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
              placeholder={signup ? `kam se kam ${MIN_PASSWORD} characters` : "••••••••"}
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
                  placeholder="dobara likho"
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
            ? "Ruko…"
            : mode === "magic"
              ? "Login link bhejo"
              : signup
                ? "Create account"
                : "Sign in"}
        </button>
      </form>

      <div className="two" style={{ justifyContent: "space-between", marginTop: 14 }}>
        {mode === "password" ? (
          <>
            <button className="ghost" type="button" onClick={() => switchTo("password", !signup)}>
              {signup ? "Pehle se account hai — sign in" : "Naya account banao"}
            </button>
            {!signup ? (
              <button className="ghost" type="button" onClick={forgotPassword} disabled={busy}>
                Forgot password?
              </button>
            ) : null}
          </>
        ) : (
          <span className="sm mut">Password yaad nahi? Password tab se reset kar lo.</span>
        )}
      </div>

      <p className="sm mut" style={{ marginTop: 18 }}>
        <Link href="/">← Dashboard</Link>
      </p>
    </div>
  );
}
