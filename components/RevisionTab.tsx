"use client";

import { useStore } from "@/lib/store";
import { GAPS, revKey, revisionDue } from "@/lib/progress";
import { daysBetween, nice, todayStr } from "@/lib/dates";

export default function RevisionTab() {
  const { state, toggleRevision } = useStore();
  const rows = revisionDue(state);
  const today = todayStr();
  const doneCount = Object.keys(state.revDone).length;

  return (
    <>
      <div className="card">
        <h2>Spaced revision queue</h2>
        <div className="sm mut">
          When you complete all tasks for a day, revision gets queued {GAPS.join(" / ")} days later
          automatically. This spaced repetition is the key to retaining everything for C-CAT.
        </div>
        <div className="grid g3" style={{ marginTop: 12 }}>
          <div className="kpi">
            <span>Due / overdue</span>
            <b>{rows.filter((r) => r.overdue).length}</b>
          </div>
          <div className="kpi">
            <span>Total queued</span>
            <b>{rows.length}</b>
          </div>
          <div className="kpi">
            <span>Revision done</span>
            <b>{doneCount}</b>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="empty">Revision queue is empty. Complete some days and the queue will fill up automatically.</div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Due</th>
                <th>Topic</th>
                <th>Subject</th>
                <th>Gap</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const cls = r.overdue ? "due" : daysBetween(today, r.due) <= 2 ? "soon" : "ok";
                const label = r.overdue ? "OVERDUE" : r.due === today ? "TODAY" : nice(r.due);
                const key = revKey(r.day.id, r.gapIndex);
                return (
                  <tr key={key}>
                    <td>
                      <span className={`pill ${cls}`}>{label}</span>
                    </td>
                    <td>{r.day.topic}</td>
                    <td>
                      <span className={`chip ${r.day.subject}`}>{r.day.subject}</span>
                    </td>
                    <td className="sm mut">+{r.gap}d</td>
                    <td>
                      <button className="ghost" type="button" onClick={() => toggleRevision(key, true)}>
                        Done ✓
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
