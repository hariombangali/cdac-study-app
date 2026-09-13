"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { overallProgress } from "@/lib/progress";
import { daysBetween, nice, todayStr } from "@/lib/dates";
import { TOTAL_FILES, TOTAL_FOLDERS } from "@/lib/manifest";
import TodayTab from "./TodayTab";
import PlanTab from "./PlanTab";
import RevisionTab from "./RevisionTab";
import MocksTab from "./MocksTab";
import WeakTab from "./WeakTab";
import FilesTab from "./FilesTab";

const TABS = [
  { id: "today", label: "Aaj" },
  { id: "plan", label: "8-Week Plan" },
  { id: "revision", label: "Revision Queue" },
  { id: "mocks", label: "Mock Log" },
  { id: "weak", label: "Weak Topics" },
  { id: "files", label: "File Index" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function Dashboard() {
  const { status, error, state, setExamDate, resetAll, signOut, email, saveError } = useStore();
  const [tab, setTab] = useState<TabId>("today");

  if (status === "loading") {
    return (
      <div className="card" style={{ maxWidth: 520, margin: "80px auto", textAlign: "center" }}>
        <h2>Progress load ho rahi hai…</h2>
        <p className="sm mut" style={{ marginTop: 8 }}>
          Supabase se tumhara data aa raha hai.
        </p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="card" style={{ maxWidth: 620, margin: "80px auto" }}>
        <h2>Data load nahi hua</h2>
        <div className="hint" style={{ marginTop: 10 }}>
          ⚠️ {error}
        </div>
        <p className="sm mut" style={{ marginTop: 12 }}>
          Check karo ki <code className="mono">supabase/schema.sql</code> chala hua hai aur{" "}
          <code className="mono">.env.local</code> me sahi keys hain.
        </p>
      </div>
    );
  }

  const today = todayStr();
  const left = daysBetween(today, state.examDate);
  const prog = overallProgress(state);

  return (
    <>
      <header>
        <div className="hrow">
          <div>
            <h1>CDAC C-CAT · Study Dashboard</h1>
            <div className="sm mut">
              Sunbeam PreCAT material · Section A + B · {TOTAL_FILES} files across {TOTAL_FOLDERS}{" "}
              folders
            </div>
          </div>
          <div className="count">
            <div>
              <b>{left >= 0 ? left : 0}</b>
              <div className="sm mut">din bache</div>
            </div>
            <div>
              <label className="f">Exam date</label>
              <input
                type="date"
                className="cddate"
                value={state.examDate}
                onChange={(e) => setExamDate(e.target.value)}
              />
              <div className="sm mut" style={{ marginTop: 4 }}>
                {nice(state.examDate)}
              </div>
            </div>
          </div>
        </div>

        <div className="hrow" style={{ marginTop: 14 }}>
          <div className="wrap-prog">
            <div className="two" style={{ justifyContent: "space-between", marginBottom: 5 }}>
              <span className="sm mut">Overall progress</span>
              <span className="sm">{prog.pct}%</span>
            </div>
            <div className="bar">
              <i style={{ width: `${prog.pct}%` }} />
            </div>
            <div className="sm mut" style={{ marginTop: 5 }}>
              {prog.done} / {prog.total} tasks · {prog.daysDone} / {prog.daysTotal} din complete
            </div>
          </div>
          <div className="two">
            <span className="sm mut">{email}</span>
            <button className="ghost" onClick={signOut} type="button">
              Sign out
            </button>
            <button
              className="ghost"
              type="button"
              onClick={() => {
                if (confirm("Saara progress delete ho jayega (cloud se bhi). Sure?")) void resetAll();
              }}
            >
              Reset
            </button>
          </div>
        </div>
      </header>

      {saveError ? (
        <div className="hint" style={{ marginBottom: 12 }}>
          ⚠️ {saveError} — change local me dikha hai par cloud me save nahi hua. Internet/Supabase keys
          check karo.
        </div>
      ) : null}

      <nav>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? "on" : ""}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main>
        {tab === "today" ? <TodayTab /> : null}
        {tab === "plan" ? <PlanTab /> : null}
        {tab === "revision" ? <RevisionTab /> : null}
        {tab === "mocks" ? <MocksTab /> : null}
        {tab === "weak" ? <WeakTab /> : null}
        {tab === "files" ? <FilesTab /> : null}
      </main>
    </>
  );
}
