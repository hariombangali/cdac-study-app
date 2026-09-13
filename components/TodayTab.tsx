"use client";

import { useStore } from "@/lib/store";
import { allDays, backlog, itemsFor, revisionDue, revKey, subjectProgress } from "@/lib/progress";
import { nice, todayStr } from "@/lib/dates";
import { DayCard, TaskList } from "./shared";

export default function TodayTab() {
  const { state, toggleRevision } = useStore();
  const today = todayStr();
  const days = allDays();

  const exact = days.find((d) => d.date === today);
  const next = days.find((d) => d.date > today);
  const prev = [...days].reverse().find((d) => d.date < today);
  const day = exact ?? next ?? prev;

  const due = revisionDue(state).filter((r) => r.overdue || r.due === today);
  const past = backlog(state);
  const subjects = subjectProgress(state);

  return (
    <>
      {today < days[0].date ? (
        <div className="card today">
          <b>Plan kal se shuru hota hai — {nice(days[0].date)}</b>
          <div className="sm mut" style={{ marginTop: 4 }}>
            Aaj material ready karke rakh lo: folders check karo, VSCode + gcc set karo, aur neend
            poori lo 😄
          </div>
        </div>
      ) : null}

      {day ? (
        <div className="card today">
          <div className="two" style={{ justifyContent: "space-between" }}>
            <h2>
              Aaj ka focus — {day.dow} {nice(day.date)}
            </h2>
            {!exact ? (
              <span className="sm mut">
                {next ? "Aaj plan me koi din nahi hai. Agla din:" : "Plan khatam. Aakhri din:"}
              </span>
            ) : null}
          </div>

          {exact ? (
            <TaskList day={day} />
          ) : (
            <>
              <div className="sm mut" style={{ marginBottom: 6 }}>
                {day.subject} · {day.topic}
              </div>
              <TaskList day={day} />
            </>
          )}

          {day.folder ? (
            <div className="fold" style={{ marginTop: 8 }}>
              📁 {day.folder}
            </div>
          ) : null}
          {day.hint ? <div className="hint">⚠️ {day.hint}</div> : null}
        </div>
      ) : null}

      <div className="grid g2">
        <div className="card">
          <h2>Revision due</h2>
          {due.length ? (
            due.map((r) => (
              <div
                className="mrow two"
                key={revKey(r.day.id, r.gapIndex)}
                style={{ justifyContent: "space-between", padding: "6px 0" }}
              >
                <span className="sm">
                  <span className={`pill ${r.overdue ? "due" : "soon"}`}>
                    {r.overdue ? "OVERDUE" : "AAJ"}
                  </span>{" "}
                  {r.day.topic} <span className="mut">(+{r.gap} din revision)</span>
                </span>
                <button
                  className="ghost"
                  type="button"
                  onClick={() => toggleRevision(revKey(r.day.id, r.gapIndex), true)}
                >
                  Done
                </button>
              </div>
            ))
          ) : (
            <div className="empty">
              Koi revision due nahi. Ek din complete karo, phir yahan +1/+3/+7/+21 din ke revision aa
              jayenge.
            </div>
          )}
        </div>

        <div className="card">
          <h2>Backlog</h2>
          {past.length ? (
            past.map((d) => (
              <div className="sm" key={d.id} style={{ padding: "4px 0" }}>
                • {nice(d.date)} — {d.topic} (
                {itemsFor(d).filter((_, i) => state.checks[`${d.id}::${i}`]).length}/
                {itemsFor(d).length})
              </div>
            ))
          ) : (
            <div className="empty">Zero backlog. Shabaash 👏</div>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Subject-wise progress</h2>
        <div className="grid g3">
          {Object.entries(subjects).map(([name, s]) => {
            const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
            return (
              <div className="kpi" key={name}>
                <span>{name}</span>
                <b>{pct}%</b>
                <div className="bar" style={{ marginTop: 5 }}>
                  <i style={{ width: `${pct}%` }} />
                </div>
                <div className="sm mut" style={{ marginTop: 4 }}>
                  {s.daysDone}/{s.days} din
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {day && !exact ? <DayCard day={day} /> : null}
    </>
  );
}
