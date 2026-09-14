import { PLAN } from "./plan";
import { dirFiles, filesIn, normPath, subDirs } from "./manifest";
import { addDays, daysBetween, todayStr } from "./dates";
import type { Day, ProgressState, Subject, Week } from "./types";

/** Spaced-repetition offsets, in days, from the moment a day is completed. */
export const GAPS = [1, 3, 7, 21] as const;

export const WEEKS: Week[] = PLAN;

export function allDays(): Day[] {
  return PLAN.flatMap((w) => w.days);
}

export function dayById(id: string): Day | undefined {
  return allDays().find((d) => d.id === id);
}

export type Item = {
  label: string;
  detail?: string;
  dir?: string;
  dirs?: string[];
  filter?: string;
};

export function itemsFor(d: Day): Item[] {
  if (d.tasks) {
    return d.tasks.map((t) => ({
      label: t.label,
      detail: t.detail ?? "",
      dir: t.dir,
      dirs: t.dirs,
      filter: t.filter,
    }));
  }
  const out: Item[] = [];
  if (d.pdf?.length) out.push({ label: "Read lecture PDF(s)", detail: d.pdf.join("\n") });
  if (d.img?.length) out.push({ label: "Review diagrams / images", detail: d.img.join("\n") });
  if (d.codeDir)
    out.push({
      label: "Type demo code from memory and run it",
      dir: normPath(`${d.folder ?? ""}/${d.codeDir}`),
      filter: d.codeFilter,
    });
  if (d.extraDir)
    out.push({ label: "Review extra diagrams / notes", dir: normPath(`${d.folder ?? ""}/${d.extraDir}`) });
  if (d.extra?.length) out.push({ label: "Review extra notes", detail: d.extra.join("\n") });
  if (d.mcq?.length) out.push({ label: "Solve MCQs", detail: d.mcq.join("\n") });
  if (d.poll?.length) out.push({ label: "Solve POLL questions", detail: d.poll.join("\n") });
  out.push({ label: "Write a 3-line summary in your own words" });
  return out;
}

export function itemKey(dayId: string, index: number): string {
  return `${dayId}::${index}`;
}

export function revKey(dayId: string, gapIndex: number): string {
  return `${dayId}::${gapIndex}`;
}

export function dayCheckedCount(d: Day, p: ProgressState): number {
  return itemsFor(d).filter((_, i) => p.checks[itemKey(d.id, i)]).length;
}

export function dayDone(d: Day, p: ProgressState): boolean {
  const items = itemsFor(d);
  return items.length > 0 && items.every((_, i) => p.checks[itemKey(d.id, i)]);
}

/** Derive day_completion from the ticked boxes — the same rule the HTML version used. */
export function withSyncedCompletion(p: ProgressState): ProgressState {
  const dayCompletedAt = { ...p.dayCompletedAt };
  for (const d of allDays()) {
    if (dayDone(d, p)) {
      if (!dayCompletedAt[d.id]) dayCompletedAt[d.id] = todayStr();
    } else {
      delete dayCompletedAt[d.id];
    }
  }
  return { ...p, dayCompletedAt };
}

export type RevisionRow = {
  day: Day;
  gap: number;
  gapIndex: number;
  due: string;
  overdue: boolean;
  soon: boolean;
};

export function revisionDue(p: ProgressState): RevisionRow[] {
  const today = todayStr();
  const rows: RevisionRow[] = [];
  for (const [dayId, completedAt] of Object.entries(p.dayCompletedAt)) {
    const day = dayById(dayId);
    if (!day) continue;
    GAPS.forEach((gap, gapIndex) => {
      if (p.revDone[revKey(dayId, gapIndex)]) return;
      const due = addDays(completedAt, gap);
      rows.push({
        day,
        gap,
        gapIndex,
        due,
        overdue: due < today,
        soon: due >= today && daysBetween(today, due) <= 2,
      });
    });
  }
  return rows.sort((a, b) => a.due.localeCompare(b.due));
}

export type SubjectStat = { done: number; total: number; days: number; daysDone: number };

export function subjectProgress(p: ProgressState): Record<string, SubjectStat> {
  const map: Record<string, SubjectStat> = {};
  for (const d of allDays()) {
    const items = itemsFor(d);
    const key: Subject = d.subject;
    map[key] ??= { done: 0, total: 0, days: 0, daysDone: 0 };
    map[key].done += dayCheckedCount(d, p);
    map[key].total += items.length;
    map[key].days += 1;
    if (dayDone(d, p)) map[key].daysDone += 1;
  }
  return map;
}

export function overallProgress(p: ProgressState) {
  let done = 0;
  let total = 0;
  for (const d of allDays()) {
    const items = itemsFor(d);
    done += dayCheckedCount(d, p);
    total += items.length;
  }
  return {
    done,
    total,
    pct: total ? Math.round((done / total) * 100) : 0,
    daysDone: Object.keys(p.dayCompletedAt).length,
    daysTotal: allDays().length,
  };
}

/** Days whose date has passed but are still incomplete. */
export function backlog(p: ProgressState): Day[] {
  const today = todayStr();
  return allDays().filter((d) => d.date < today && !dayDone(d, p));
}

export function netScore(m: { correct: number; wrong: number }): number {
  return m.correct * 3 - m.wrong;
}

export function filesForItem(item: Item): string[] {
  if (item.dirs?.length) return item.dirs.flatMap((d) => dirFiles(d, item.filter));
  if (item.dir) return dirFiles(item.dir, item.filter);
  return [];
}

export function itemFileCount(item: Item): number {
  return filesForItem(item).length;
}

export function dayFileCount(d: Day): number {
  if (!d.folder) return 0;
  return subDirs(d.folder).reduce((n, k) => n + filesIn(k).length, 0);
}

export const EMPTY_PROGRESS: ProgressState = {
  checks: {},
  dayCompletedAt: {},
  revDone: {},
  examDate: "2026-11-08",
  mocks: [],
  weak: [],
};
