"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { dayDone, WEEKS } from "@/lib/progress";
import { DayCard } from "./shared";

export default function PlanTab() {
  const { state } = useStore();
  // Open state lives in React so re-renders never snap a section shut.
  const [open, setOpen] = useState<Set<number>>(new Set([1]));

  function toggle(week: number, isOpen: boolean) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (isOpen) next.add(week);
      else next.delete(week);
      return next;
    });
  }

  return (
    <>
      {WEEKS.map((w) => {
        const done = w.days.filter((d) => dayDone(d, state)).length;
        const pct = Math.round((done / w.days.length) * 100);
        const isOpen = open.has(w.week);
        return (
          <details
            className="wk"
            key={w.week}
            open={isOpen}
            onToggle={(e) => toggle(w.week, (e.target as HTMLDetailsElement).open)}
          >
            <summary>
              <span>
                Week {w.week} — {w.title} <span className="sm mut">({w.range})</span>
              </span>
              <span className="sm">
                {done}/{w.days.length} · {pct}%
              </span>
            </summary>
            <div className="wkbody">
              <div className="bar" style={{ marginBottom: 10 }}>
                <i style={{ width: `${pct}%` }} />
              </div>
              {w.days.map((d) => (
                <div className="day" key={d.id}>
                  <DayCard day={d} />
                </div>
              ))}
            </div>
          </details>
        );
      })}
    </>
  );
}
