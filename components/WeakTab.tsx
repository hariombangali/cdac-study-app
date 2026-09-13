"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";

const ORDER: Record<string, number> = { high: 0, med: 1, low: 2 };

export default function WeakTab() {
  const { state, addWeak, toggleWeakFixed, deleteWeak } = useStore();
  const [form, setForm] = useState({ topic: "", note: "", sev: "med" as "high" | "med" | "low" });
  const [busy, setBusy] = useState(false);

  const list = [...state.weak].sort(
    (a, b) => Number(a.fixed) - Number(b.fixed) || ORDER[a.sev] - ORDER[b.sev],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.topic.trim()) return;
    setBusy(true);
    try {
      await addWeak(form);
      setForm({ topic: "", note: "", sev: "med" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2>Weak topics / error log</h2>
      <div className="sm mut" style={{ marginBottom: 12 }}>
        Jo topic 2 baar galat ho, woh yahan likho. Exam se pehle sirf ye list padhni hai. Har galti ke
        saath <b>rule</b> likho, sirf topic naam nahi.
      </div>

      <form className="row" onSubmit={submit}>
        <div>
          <label className="f">Topic</label>
          <input
            required
            placeholder="e.g. pointer arithmetic"
            value={form.topic}
            onChange={(e) => setForm({ ...form, topic: e.target.value })}
          />
        </div>
        <div style={{ flex: "2 1 220px" }}>
          <label className="f">Kya galti hui / rule</label>
          <input
            placeholder="e.g. int* +1 = 4 bytes aage badhta hai"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
        </div>
        <div>
          <label className="f">Priority</label>
          <select
            value={form.sev}
            onChange={(e) => setForm({ ...form, sev: e.target.value as "high" | "med" | "low" })}
          >
            <option value="high">High</option>
            <option value="med">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <div style={{ flex: "0 0 auto" }}>
          <button className="act" type="submit" disabled={busy}>
            {busy ? "…" : "Add"}
          </button>
        </div>
      </form>

      {list.length === 0 ? (
        <div className="empty">List khali hai — jaisi galtiyan milengi, yahan add karte jao.</div>
      ) : (
        list.map((w) => {
          const col =
            w.sev === "high" ? "var(--bad)" : w.sev === "med" ? "var(--warn)" : "var(--mut)";
          return (
            <div
              className="mrow two"
              key={w.id}
              style={{ justifyContent: "space-between", padding: "8px 0" }}
            >
              <div>
                <b style={w.fixed ? { textDecoration: "line-through", color: "var(--mut)" } : undefined}>
                  {w.topic}
                </b>
                <span className="chip" style={{ marginLeft: 6, color: col, borderColor: col }}>
                  {w.sev}
                </span>
                {w.note ? <div className="sm mut">{w.note}</div> : null}
              </div>
              <div className="two">
                <button className="ghost" type="button" onClick={() => void toggleWeakFixed(w.id)}>
                  {w.fixed ? "Reopen" : "Fixed"}
                </button>
                <button className="x" type="button" onClick={() => void deleteWeak(w.id)}>
                  ×
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
