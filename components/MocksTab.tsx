"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { netScore } from "@/lib/progress";
import { nice, todayStr } from "@/lib/dates";

export default function MocksTab() {
  const { state, addMock, deleteMock } = useStore();
  const [form, setForm] = useState({
    date: todayStr(),
    section: "A+B",
    attempted: 50,
    correct: 0,
    wrong: 0,
    note: "",
  });
  const [busy, setBusy] = useState(false);

  const mocks = state.mocks;
  const totalNet = mocks.reduce((a, m) => a + netScore(m), 0);
  const attempted = mocks.reduce((a, m) => a + m.attempted, 0);
  const correct = mocks.reduce((a, m) => a + m.correct, 0);
  const liveNet = netScore({ correct: form.correct, wrong: form.wrong });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await addMock({
        date: form.date,
        section: form.section,
        attempted: Number(form.attempted) || 0,
        correct: Number(form.correct) || 0,
        wrong: Number(form.wrong) || 0,
        note: form.note,
      });
      setForm({ ...form, correct: 0, wrong: 0, note: "" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2>Mock test log</h2>
      <div className="sm mut" style={{ marginBottom: 12 }}>
        Net score = (correct × 3) − (wrong × 1). This is the actual C-CAT formula — only guess when you can eliminate 2 options.
      </div>

      <div className="grid g3" style={{ marginBottom: 14 }}>
        <div className="kpi">
          <span>Total net score</span>
          <b>{totalNet}</b>
        </div>
        <div className="kpi">
          <span>Accuracy</span>
          <b>{attempted ? Math.round((correct / attempted) * 100) : 0}%</b>
        </div>
        <div className="kpi">
          <span>Mocks taken</span>
          <b>{mocks.length}</b>
        </div>
      </div>

      <form className="row" onSubmit={submit}>
        <div>
          <label className="f">Date</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </div>
        <div>
          <label className="f">Section</label>
          <select value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })}>
            <option>A</option>
            <option>B</option>
            <option>A+B</option>
            <option>Full</option>
          </select>
        </div>
        <div>
          <label className="f">Attempted</label>
          <input
            type="number"
            min={0}
            max={200}
            value={form.attempted}
            onChange={(e) => setForm({ ...form, attempted: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className="f">Correct</label>
          <input
            type="number"
            min={0}
            value={form.correct}
            onChange={(e) => setForm({ ...form, correct: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className="f">Wrong</label>
          <input
            type="number"
            min={0}
            value={form.wrong}
            onChange={(e) => setForm({ ...form, wrong: Number(e.target.value) })}
          />
        </div>
        <div style={{ flex: "2 1 180px" }}>
          <label className="f">Note</label>
          <input
            placeholder="e.g. got 4 wrong in pointers"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
        </div>
        <div style={{ flex: "0 0 auto" }}>
          <label className="f">
            Net: <b style={{ color: liveNet >= 0 ? "var(--ok)" : "var(--bad)" }}>{liveNet}</b>
          </label>
          <button className="act" type="submit" disabled={busy}>
            {busy ? "…" : "Add"}
          </button>
        </div>
      </form>

      {mocks.length === 0 ? (
        <div className="empty">No mocks yet. Take 2 mocks in Week 8 (Nov 6–7).</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Sec</th>
              <th>Att</th>
              <th>✓</th>
              <th>✗</th>
              <th>Net</th>
              <th>Note</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {[...mocks].reverse().map((m) => {
              const n = netScore(m);
              return (
                <tr key={m.id}>
                  <td>{nice(m.date)}</td>
                  <td>{m.section}</td>
                  <td>{m.attempted}</td>
                  <td style={{ color: "var(--ok)" }}>{m.correct}</td>
                  <td style={{ color: "var(--bad)" }}>{m.wrong}</td>
                  <td>
                    <b style={{ color: n >= 0 ? "var(--ok)" : "var(--bad)" }}>{n}</b>
                  </td>
                  <td className="sm mut">{m.note}</td>
                  <td>
                    <button className="x" type="button" onClick={() => void deleteMock(m.id)}>
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
