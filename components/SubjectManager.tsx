"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { allDays, dayCheckedCount, itemsFor, itemKey } from "@/lib/progress";
import { dirFiles, exists, fileName, normPath } from "@/lib/manifest";
import { MATERIAL } from "@/lib/material";
import { FileLink, FileChips } from "./shared";
import type { Day, Subject } from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  Subject definitions with metadata                                  */
/* ------------------------------------------------------------------ */

type SubjectInfo = {
  id: Subject;
  label: string;
  icon: string;
  color: string;
  description: string;
};

const SUBJECTS: SubjectInfo[] = [
  { id: "C", label: "C Programming", icon: "🔤", color: "var(--c)", description: "Basics to advanced: variables, pointers, structures, file handling" },
  { id: "DS", label: "Data Structures", icon: "🏗️", color: "var(--ds)", description: "Sorting, searching, linked lists, trees, graphs, hashing" },
  { id: "CPP", label: "C++ / OOP", icon: "⚙️", color: "var(--cpp)", description: "Classes, inheritance, polymorphism, templates, STL" },
  { id: "OS", label: "Operating Systems", icon: "💻", color: "var(--os)", description: "Processes, scheduling, memory management, deadlocks, file systems" },
  { id: "DCN", label: "Computer Networks", icon: "🌐", color: "var(--dcn)", description: "OSI model, TCP/IP, IP addressing, protocols" },
  { id: "Aptitude", label: "Aptitude & English", icon: "🧮", color: "var(--apt)", description: "Quantitative aptitude, reasoning, English grammar" },
  { id: "BigData", label: "Big Data", icon: "📊", color: "var(--bd)", description: "Hadoop, Hive, Spark, data engineering concepts" },
  { id: "AI", label: "Artificial Intelligence", icon: "🤖", color: "var(--ai)", description: "AI agents, neural networks, fuzzy logic, ML vs DL" },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function SubjectManager() {
  const { state } = useStore();
  const [activeSubject, setActiveSubject] = useState<Subject>("C");
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());

  const days = allDays();

  // Group days by subject
  const subjectDays = useMemo(() => {
    const map: Record<string, Day[]> = {};
    for (const d of days) {
      if (!map[d.subject]) map[d.subject] = [];
      map[d.subject].push(d);
    }
    return map;
  }, [days]);

  // Calculate progress per subject
  const subjectProgress = useMemo(() => {
    const map: Record<string, { done: number; total: number; pct: number; filesCount: number }> = {};
    for (const [subject, subjectDaysList] of Object.entries(subjectDays)) {
      let done = 0;
      let total = 0;
      let filesCount = 0;
      for (const d of subjectDaysList) {
        const items = itemsFor(d);
        done += dayCheckedCount(d, state);
        total += items.length;
        if (d.folder) {
          filesCount += dirFiles(d.folder).length;
        }
      }
      map[subject] = {
        done,
        total,
        pct: total ? Math.round((done / total) * 100) : 0,
        filesCount,
      };
    }
    return map;
  }, [subjectDays, state]);

  // Get material notes for a folder
  function getMaterialNote(folder: string | null) {
    if (!folder) return null;
    return MATERIAL.find((m) => m.name === folder) ?? null;
  }

  // Count files in a day's folder
  function countDayFiles(day: Day): number {
    if (!day.folder) return 0;
    let count = 0;
    if (exists(day.folder)) {
      count += dirFiles(day.folder).length;
    }
    if (day.codeDir) {
      const codePath = normPath(`${day.folder}/${day.codeDir}`);
      count += dirFiles(codePath).length;
    }
    if (day.extraDir) {
      const extraPath = normPath(`${day.folder}/${day.extraDir}`);
      count += dirFiles(extraPath).length;
    }
    return count;
  }

  function toggleTopic(id: string) {
    setExpandedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const activeInfo = SUBJECTS.find((s) => s.id === activeSubject)!;
  const activeDays = subjectDays[activeSubject] ?? [];
  const activeProgress = subjectProgress[activeSubject] ?? { done: 0, total: 0, pct: 0, filesCount: 0 };

  // Overall stats
  const totalDays = Object.values(subjectDays).reduce((a, d) => a + d.length, 0);
  const totalDone = Object.values(subjectProgress).reduce((a, p) => a + p.done, 0);
  const totalTasks = Object.values(subjectProgress).reduce((a, p) => a + p.total, 0);
  const overallPct = totalTasks ? Math.round((totalDone / totalTasks) * 100) : 0;

  return (
    <>
      {/* Overall progress */}
      <div className="card">
        <h2>Subject-wise Progress</h2>
        <div className="bar" style={{ marginBottom: 10 }}>
          <i style={{ width: `${overallPct}%` }} />
        </div>
        <div className="sm mut" style={{ marginBottom: 14 }}>
          {totalDone} / {totalTasks} tasks completed across {SUBJECTS.length} subjects
        </div>

        {/* Subject selector cards */}
        <div className="grid g3">
          {SUBJECTS.map((s) => {
            const p = subjectProgress[s.id] ?? { done: 0, total: 0, pct: 0 };
            return (
              <button
                key={s.id}
                type="button"
                className={`kpi${activeSubject === s.id ? " today" : ""}`}
                onClick={() => setActiveSubject(s.id)}
                style={{
                  cursor: "pointer",
                  border: activeSubject === s.id ? `2px solid ${s.color}` : undefined,
                  textAlign: "left",
                }}
              >
                <span>
                  {s.icon} {s.label}
                </span>
                <b style={{ color: s.color }}>{p.pct}%</b>
                <div className="bar" style={{ marginTop: 5 }}>
                  <i
                    style={{
                      width: `${p.pct}%`,
                      background: s.color,
                    }}
                  />
                </div>
                <div className="sm mut" style={{ marginTop: 4 }}>
                  {p.done}/{p.total} tasks
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active subject detail */}
      <div className="card">
        <div className="two" style={{ justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <h2>
              {activeInfo.icon} {activeInfo.label}
            </h2>
            <div className="sm mut">{activeInfo.description}</div>
          </div>
          <span className="chip" style={{ color: activeInfo.color, borderColor: activeInfo.color, fontSize: 14, padding: "4px 12px" }}>
            {activeProgress.pct}% complete
          </span>
        </div>

        {/* Material notes if any */}
        {(() => {
          const firstDay = activeDays[0];
          const note = getMaterialNote(firstDay?.folder ?? null);
          if (note) {
            return (
              <div className="sm" style={{ marginBottom: 10, padding: "8px 12px", background: "var(--card2)", borderRadius: 8, border: "1px solid var(--line)" }}>
                📁 <b>{note.name}</b> — {note.note}
                {note.gotcha ? (
                  <div className="hint" style={{ marginTop: 6 }}>⚠️ {note.gotcha}</div>
                ) : null}
              </div>
            );
          }
          return null;
        })()}

        {/* Topic list */}
        {activeDays.length === 0 ? (
          <div className="empty">No topics found for this subject.</div>
        ) : (
          activeDays.map((day) => {
            const items = itemsFor(day);
            const doneCount = dayCheckedCount(day, state);
            const isExpanded = expandedTopics.has(day.id);
            const fileCount = countDayFiles(day);
            const pct = items.length ? Math.round((doneCount / items.length) * 100) : 0;

            return (
              <details
                key={day.id}
                className="wk fold-wrap"
                open={isExpanded}
                onToggle={() => toggleTopic(day.id)}
              >
                <summary>
                  <div style={{ flex: 1 }}>
                    <div className="two" style={{ justifyContent: "space-between" }}>
                      <span>
                        <b>{day.topic}</b>
                        <span className="sm mut" style={{ marginLeft: 8 }}>
                          {day.dow} {day.date}
                        </span>
                      </span>
                      <div className="two" style={{ gap: 8 }}>
                        <span className="sm">
                          {doneCount}/{items.length}
                        </span>
                        {fileCount > 0 ? (
                          <span className="sm mut">📎 {fileCount} files</span>
                        ) : null}
                        <div
                          style={{
                            width: 40,
                            height: 4,
                            background: "#1b2440",
                            borderRadius: 99,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${pct}%`,
                              height: "100%",
                              background: activeInfo.color,
                              borderRadius: 99,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </summary>

                <div className="wkbody">
                  {/* Folder path */}
                  {day.folder ? (
                    <div className="fold" style={{ marginBottom: 8 }}>
                      📁 {day.folder}
                    </div>
                  ) : null}

                  {/* Hint / Note */}
                  {day.hint ? <div className="hint">⚠️ {day.hint}</div> : null}
                  {day.note ? <div className="det">📝 {day.note}</div> : null}

                  {/* PDFs */}
                  {day.pdf && day.pdf.length > 0 ? (
                    <div style={{ marginBottom: 8 }}>
                      <div className="sm" style={{ fontWeight: 600, marginBottom: 4 }}>
                        📄 Lecture PDFs
                      </div>
                      <span className="chips">
                        {day.pdf.map((f) => {
                          const path = day.folder ? `${day.folder}/${f}` : f;
                          return <FileLink key={f} path={path} label={f} />;
                        })}
                      </span>
                    </div>
                  ) : null}

                  {/* Images */}
                  {day.img && day.img.length > 0 ? (
                    <div style={{ marginBottom: 8 }}>
                      <div className="sm" style={{ fontWeight: 600, marginBottom: 4 }}>
                        🖼️ Diagrams / Images
                      </div>
                      <span className="chips">
                        {day.img.map((f) => {
                          const path = day.folder ? `${day.folder}/${f}` : f;
                          return <FileLink key={f} path={path} label={f} />;
                        })}
                      </span>
                    </div>
                  ) : null}

                  {/* Code files */}
                  {day.codeDir ? (
                    <div style={{ marginBottom: 8 }}>
                      <div className="sm" style={{ fontWeight: 600, marginBottom: 4 }}>
                        💻 Demo Code
                      </div>
                      <FileChips
                        dir={normPath(`${day.folder ?? ""}/${day.codeDir}`)}
                        filter={day.codeFilter}
                      />
                    </div>
                  ) : null}

                  {/* Extra diagrams */}
                  {day.extraDir ? (
                    <div style={{ marginBottom: 8 }}>
                      <div className="sm" style={{ fontWeight: 600, marginBottom: 4 }}>
                        📊 Extra Diagrams
                      </div>
                      <FileChips dir={normPath(`${day.folder ?? ""}/${day.extraDir}`)} />
                    </div>
                  ) : null}

                  {/* MCQs */}
                  {day.mcq && day.mcq.length > 0 ? (
                    <div style={{ marginBottom: 8 }}>
                      <div className="sm" style={{ fontWeight: 600, marginBottom: 4 }}>
                        ✅ MCQs
                      </div>
                      <span className="chips">
                        {day.mcq.map((f) => {
                          const path = day.folder ? normPath(`${day.folder}/${f}`) : f;
                          return <FileLink key={f} path={path} label={fileName(f)} />;
                        })}
                      </span>
                    </div>
                  ) : null}

                  {/* Polls */}
                  {day.poll && day.poll.length > 0 ? (
                    <div style={{ marginBottom: 8 }}>
                      <div className="sm" style={{ fontWeight: 600, marginBottom: 4 }}>
                        📋 Poll Questions
                      </div>
                      <span className="chips">
                        {day.poll.map((f) => {
                          const path = day.folder ? normPath(`${day.folder}/${f}`) : f;
                          return <FileLink key={f} path={path} label={fileName(f)} />;
                        })}
                      </span>
                    </div>
                  ) : null}

                  {/* Tasks (for Practice days) */}
                  {day.tasks && day.tasks.length > 0 ? (
                    <div style={{ marginBottom: 8 }}>
                      <div className="sm" style={{ fontWeight: 600, marginBottom: 4 }}>
                        📝 Tasks
                      </div>
                      <ul className="tasks">
                        {day.tasks.map((t, i) => (
                          <li key={i}>
                            <label>
                              <input type="checkbox" checked={Boolean(state.checks[itemKey(day.id, i)])} readOnly />
                              <span>{t.label}</span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </details>
            );
          })
        )}
      </div>
    </>
  );
}
