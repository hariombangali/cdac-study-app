"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const FOCUS_MIN = 25;
const SHORT_BREAK_MIN = 5;
const LONG_BREAK_MIN = 15;
const SESSIONS_BEFORE_LONG = 4;

type Mode = "focus" | "short" | "long";
type Status = "idle" | "running" | "paused";

const DURATIONS: Record<Mode, number> = {
  focus: FOCUS_MIN * 60,
  short: SHORT_BREAK_MIN * 60,
  long: LONG_BREAK_MIN * 60,
};

const MODE_LABELS: Record<Mode, string> = {
  focus: "Focus",
  short: "Short Break",
  long: "Long Break",
};

const MODE_COLORS: Record<Mode, string> = {
  focus: "var(--acc)",
  short: "var(--ok)",
  long: "var(--warn)",
};

/* ------------------------------------------------------------------ */
/*  Audio beep via Web Audio API — no file needed                      */
/* ------------------------------------------------------------------ */

function beep() {
  try {
    const ctx = new AudioContext();
    [0, 0.2, 0.4].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.value = 0.3;
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.15);
    });
    // close after beeps finish
    setTimeout(() => ctx.close(), 1000);
  } catch {
    /* audio not available — ignore */
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function PomodoroTab() {
  const [mode, setMode] = useState<Mode>("focus");
  const [status, setStatus] = useState<Status>("idle");
  const [total, setTotal] = useState(DURATIONS.focus);
  const [remaining, setRemaining] = useState(DURATIONS.focus);
  const [sessions, setSessions] = useState(0);
  const [todayPomodoros, setTodayPomodoros] = useState(0);
  const [todayMinutes, setTodayMinutes] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clear interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  /* Tick every second when running */
  useEffect(() => {
    if (status !== "running") {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          handleComplete();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const handleComplete = useCallback(() => {
    setStatus("idle");
    beep();

    if (mode === "focus") {
      setSessions((s) => {
        const next = s + 1;
        return next;
      });
      setTodayPomodoros((p) => p + 1);
      setTodayMinutes((m) => m + FOCUS_MIN);

      // Auto-switch to break
      const nextSessions = sessions + 1;
      if (nextSessions % SESSIONS_BEFORE_LONG === 0) {
        switchMode("long");
      } else {
        switchMode("short");
      }
    } else {
      // After break, go to focus
      switchMode("focus");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, sessions]);

  function switchMode(m: Mode) {
    setMode(m);
    setTotal(DURATIONS[m]);
    setRemaining(DURATIONS[m]);
    setStatus("idle");
  }

  function toggleStart() {
    if (status === "running") {
      setStatus("paused");
    } else {
      setStatus("running");
    }
  }

  function reset() {
    setStatus("idle");
    setRemaining(total);
  }

  function skip() {
    if (status === "running") {
      // Count partial focus if skipped early
      if (mode === "focus") {
        const elapsed = total - remaining;
        if (elapsed > 60) {
          setTodayMinutes((m) => m + Math.round(elapsed / 60));
        }
      }
    }
    handleComplete();
  }

  /* Circular progress calculations */
  const pct = total > 0 ? ((total - remaining) / total) * 100 : 0;
  const radius = 100;
  const circumference = 2 * Math.PI * radius;
  const dashoffset = circumference - (pct / 100) * circumference;

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const timeStr = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  // Update page title with timer
  useEffect(() => {
    if (status === "running") {
      document.title = `${timeStr} — ${MODE_LABELS[mode]} | CDAC Study`;
    } else {
      document.title = "CDAC C-CAT · Study Dashboard";
    }
  }, [timeStr, status, mode]);

  const circumferenceTicks = 60;

  return (
    <>
      {/* Main timer card */}
      <div className="card" style={{ textAlign: "center", padding: "28px 16px" }}>
        {/* Mode selector */}
        <div className="pomo-modes">
          {(["focus", "short", "long"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              className={`pomo-mode-btn${mode === m && status !== "running" ? " active" : ""}`}
              onClick={() => {
                if (status !== "running") switchMode(m);
              }}
              disabled={status === "running"}
              style={
                mode === m
                  ? { borderColor: MODE_COLORS[m], color: MODE_COLORS[m] }
                  : undefined
              }
            >
              {m === "focus" ? "🎯 Focus" : m === "short" ? "☕ Short Break" : "🌴 Long Break"}
            </button>
          ))}
        </div>

        {/* Circular timer */}
        <div className="pomo-ring-wrap">
          <svg viewBox="0 0 240 240" className="pomo-ring">
            {/* Background circle */}
            <circle
              cx="120"
              cy="120"
              r={radius}
              fill="none"
              stroke="#1b2440"
              strokeWidth="8"
            />
            {/* Tick marks */}
            {Array.from({ length: circumferenceTicks }).map((_, i) => {
              const angle = (i / circumferenceTicks) * 360 - 90;
              const rad = (angle * Math.PI) / 180;
              const isHour = i % 5 === 0;
              const innerR = isHour ? 110 : 113;
              const outerR = 117;
              return (
                <line
                  key={i}
                  x1={120 + innerR * Math.cos(rad)}
                  y1={120 + innerR * Math.sin(rad)}
                  x2={120 + outerR * Math.cos(rad)}
                  y2={120 + outerR * Math.sin(rad)}
                  stroke={isHour ? "#3d4b78" : "#2a3556"}
                  strokeWidth={isHour ? 1.5 : 0.8}
                />
              );
            })}
            {/* Progress arc */}
            <circle
              cx="120"
              cy="120"
              r={radius}
              fill="none"
              stroke={MODE_COLORS[mode]}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashoffset}
              transform="rotate(-90 120 120)"
              style={{ transition: "stroke-dashoffset 0.4s ease, stroke 0.3s ease" }}
            />
          </svg>
          {/* Time display centered in the ring */}
          <div className="pomo-time">
            <div className="pomo-digits">{timeStr}</div>
            <div className="pomo-label" style={{ color: MODE_COLORS[mode] }}>
              {MODE_LABELS[mode]}
              {status === "paused" ? " — paused" : ""}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="pomo-controls">
          <button
            type="button"
            className="pomo-ctrl-btn"
            onClick={reset}
            title="Reset"
          >
            ↺
          </button>
          <button
            type="button"
            className="pomo-main-btn"
            onClick={toggleStart}
            style={{ background: MODE_COLORS[mode] }}
          >
            {status === "running" ? "⏸ Pause" : status === "paused" ? "▶ Resume" : "▶ Start"}
          </button>
          <button
            type="button"
            className="pomo-ctrl-btn"
            onClick={skip}
            title="Skip"
          >
            ⏭
          </button>
        </div>

        <div className="sm mut" style={{ marginTop: 10 }}>            {mode === "focus"
            ? `${FOCUS_MIN} min focus → ${SHORT_BREAK_MIN} min break`
            : mode === "short"
              ? `${SHORT_BREAK_MIN} min break → back to focus`
              : `${LONG_BREAK_MIN} min long break — great job, ${SESSIONS_BEFORE_LONG} sessions done!`}
        </div>
      </div>

      {/* Session stats */}
      <div className="grid g3">
        <div className="kpi">
          <span>Today's Pomodoros</span>
          <b>{todayPomodoros}</b>
          <div className="sm mut" style={{ marginTop: 2 }}>
            focus sessions complete
          </div>
        </div>
        <div className="kpi">
          <span>Study time</span>
          <b>{todayMinutes}m</b>
          <div className="sm mut" style={{ marginTop: 2 }}>
            = {Math.floor(todayMinutes / 60)}h {todayMinutes % 60}m
          </div>
        </div>
        <div className="kpi">
          <span>Sessions counter</span>
          <b>{sessions}</b>
          <div className="sm mut" style={{ marginTop: 2 }}>
            total (next long break in {SESSIONS_BEFORE_LONG - (sessions % SESSIONS_BEFORE_LONG)})
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="card">
        <h2>Pomodoro Tips</h2>
        <ul className="tasks">
          <li>
            <label>
              <span>
                🎯 Take a 5 min break after every 25 min — your brain needs rest
              </span>
            </label>
          </li>
          <li>
            <label>
              <span>
                🚫 Don't use your phone during breaks — rest your eyes, take a walk
              </span>
            </label>
          </li>
          <li>
            <label>
              <span>
                📝 Focus on one topic per session — avoid multitasking
              </span>
            </label>
          </li>
          <li>
            <label>
              <span>
                🎵 You'll hear a sound when the timer completes — stay focused
              </span>
            </label>
          </li>
        </ul>
      </div>
    </>
  );
}
