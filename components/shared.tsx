"use client";

import type { ReactNode } from "react";
import { dirFiles, exists, fileName, filesIn, normPath, subDirs } from "@/lib/manifest";
import { dayCheckedCount, dayDone, filesForItem, itemKey, itemsFor, type Item } from "@/lib/progress";
import { useStore } from "@/lib/store";
import { nice } from "@/lib/dates";
import type { Day } from "@/lib/types";

/* ------------------------------------------------------------ file links -- */

export function FileLink({ path, label }: { path: string; label?: string }) {
  const name = label ?? fileName(path);
  if (!exists(path)) {
    return (
      <span className="miss" title="this file is not in the manifest">
        {name} ⚠
      </span>
    );
  }
  return (
    <a
      className="fil"
      href={`/api/material?path=${encodeURIComponent(path)}`}
      target="_blank"
      rel="noopener noreferrer"
    >
      {name}
    </a>
  );
}

export function FileChips({ dir, filter }: { dir: string; filter?: string }) {
  const files = dirFiles(dir, filter);
  if (!files.length) return <span className="plain sm">(no files found in this folder)</span>;
  return (
    <span className="chips">
      {files.map((f) => (
        <FileLink key={f} path={dir === "." ? f : `${dir}/${f}`} label={f} />
      ))}
    </span>
  );
}

/* ----------------------------------------------------- detail text lines -- */

/** Resolve a free-text detail line to a real file, if one matches. */
function matchPath(day: Day, line: string): { path: string; head: string; rest: string } | null {
  const folder = day.folder ?? "";
  const cands: { t: string; cut: number }[] = [{ t: line, cut: line.length }];

  const m = line.search(/\s{2,}\(|\s—\s|\s\(/);
  if (m > 0) cands.push({ t: line.slice(0, m).replace(/\s+$/, ""), cut: m });

  const dash = line.indexOf(" – ");
  if (dash > 0) cands.push({ t: line.slice(0, dash), cut: dash });

  for (const c of cands) {
    const a = normPath(`${folder}/${c.t}`);
    if (exists(a)) return { path: a, head: c.t, rest: line.slice(c.cut) };
    const b = normPath(c.t);
    if (exists(b)) return { path: b, head: c.t, rest: line.slice(c.cut) };
  }
  return null;
}

export function DetailText({ day, detail }: { day: Day; detail: string }) {
  const lines = detail.split("\n");
  const nodes: ReactNode[] = [];
  lines.forEach((line, i) => {
    if (i > 0) nodes.push("\n");
    if (!line.trim()) return;
    const hit = matchPath(day, line);
    nodes.push(
      hit ? (
        <span key={i}>
          <FileLink path={hit.path} label={hit.head} />
          {hit.rest}
        </span>
      ) : (
        <span key={i} className="plain">
          {line}
        </span>
      ),
    );
  });
  return <div className="det">{nodes}</div>;
}

/* --------------------------------------------------------------- task row -- */

export function ItemRow({ day, item, index }: { day: Day; item: Item; index: number }) {
  const { state, toggleCheck } = useStore();
  const key = itemKey(day.id, index);
  const on = Boolean(state.checks[key]);
  const count = filesForItem(item).length;

  return (
    <li className={on ? "done" : ""}>
      <input type="checkbox" checked={on} onChange={(e) => toggleCheck(key, e.target.checked)} />
      <label>
        <span>
          {item.label}
          {count ? <span className="sm mut"> ({count} files)</span> : null}
        </span>
        {item.dirs?.length ? (
          <div className="det">
            {item.dirs.map((d) => (
              <div key={d}>
                <div className="sm mut" style={{ margin: "6px 0 2px" }}>
                  {d}
                </div>
                <FileChips dir={d} filter={item.filter} />
              </div>
            ))}
          </div>
        ) : item.dir ? (
          <div className="det">
            <FileChips dir={item.dir} filter={item.filter} />
          </div>
        ) : item.detail ? (
          <DetailText day={day} detail={item.detail} />
        ) : null}
      </label>
    </li>
  );
}

export function TaskList({ day }: { day: Day }) {
  return (
    <ul className="tasks">
      {itemsFor(day).map((item, i) => (
        <ItemRow key={i} day={day} item={item} index={i} />
      ))}
    </ul>
  );
}

/* --------------------------------------------------- every file in a day -- */

export function FolderBlock({ day }: { day: Day }) {
  if (!day.folder) return null;
  const folder = day.folder;
  const dirs = subDirs(folder);
  const total = dirs.reduce((n: number, k) => n + filesIn(k).length, 0);
  if (!total) return null;

  return (
    <details className="doc" style={{ marginTop: 10 }}>
      <summary>📂 all files for this day ({total})</summary>
      <div style={{ marginTop: 7 }}>
        {dirs.map((k) => {
          const rel = k === folder ? "" : k.slice(folder.length + 1);
          return (
            <div key={k}>
              <div className="sm mut" style={{ margin: "7px 0 3px" }}>
                {rel ? `${rel}/` : "(folder root)"}
              </div>
              <span className="chips">
                {filesIn(k).map((f) => (
                  <FileLink key={f} path={`${k}/${f}`} label={f} />
                ))}
              </span>
            </div>
          );
        })}
      </div>
    </details>
  );
}

/* --------------------------------------------------------------- day card -- */

export function DayCard({ day, isToday }: { day: Day; isToday?: boolean }) {
  const { state, setManyChecks } = useStore();
  const items = itemsFor(day);
  const done = dayDone(day, state);
  const count = dayCheckedCount(day, state);
  const all = count === items.length && items.length > 0;

  return (
    <div className={`card${isToday ? " today" : ""}`}>
      <div className="two" style={{ justifyContent: "space-between" }}>
        <div>
          <span className={`chip ${day.subject}`}>{day.subject}</span> <b>{day.topic}</b>
          <div className="sm mut" style={{ marginTop: 3 }}>
            {day.dow} · {nice(day.date)}
            {done ? (
              <>
                {" · "}
                <span style={{ color: "var(--ok)" }}>✓ complete</span>
              </>
            ) : null}
          </div>
        </div>
        <div className="two" style={{ gap: 8 }}>
          <span className="sm mut">
            {count}/{items.length}
          </span>
          <button
            className="ghost"
            type="button"
            onClick={() => setManyChecks(items.map((_, i) => itemKey(day.id, i)), !all)}
          >
            {all ? "Clear" : "Check all"}
          </button>
        </div>
      </div>

      {day.folder ? (
        <div className="fold" style={{ marginTop: 7 }}>
          📁 {day.folder}
        </div>
      ) : null}
      {day.note ? (
        <div className="det" style={{ marginTop: 5 }}>
          📝 {day.note}
        </div>
      ) : null}
      {day.hint ? <div className="hint">⚠️ {day.hint}</div> : null}

      <TaskList day={day} />
      <FolderBlock day={day} />
    </div>
  );
}
