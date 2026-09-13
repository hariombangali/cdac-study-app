"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { EMPTY_PROGRESS, withSyncedCompletion } from "@/lib/progress";
import { todayStr } from "@/lib/dates";
import type { MockRow, ProgressState, WeakRow } from "@/lib/types";

type Status = "loading" | "anon" | "ready" | "error";

type StoreValue = {
  status: Status;
  error: string | null;
  userId: string | null;
  email: string | null;
  state: ProgressState;
  saveError: string | null;
  toggleCheck: (key: string, on: boolean) => void;
  setManyChecks: (keys: string[], on: boolean) => void;
  toggleRevision: (key: string, on: boolean) => void;
  setExamDate: (date: string) => void;
  addMock: (row: Omit<MockRow, "id">) => Promise<void>;
  deleteMock: (id: string) => Promise<void>;
  addWeak: (row: Omit<WeakRow, "id" | "fixed">) => Promise<void>;
  toggleWeakFixed: (id: string) => Promise<void>;
  deleteWeak: (id: string) => Promise<void>;
  resetAll: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<StoreValue | null>(null);

/** "w1d1::3" -> ["w1d1", 3] */
function splitKey(key: string): [string, number] {
  const i = key.lastIndexOf("::");
  return [key.slice(0, i), Number(key.slice(i + 2))];
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [state, setStateInternal] = useState<ProgressState>(EMPTY_PROGRESS);

  // Latest state, so async mutations never read a stale closure.
  const ref = useRef<ProgressState>(EMPTY_PROGRESS);
  const setState = useCallback((next: ProgressState) => {
    ref.current = next;
    setStateInternal(next);
  }, []);

  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  const sb = () => (supabaseRef.current ??= createClient());

  const fail = useCallback((e: unknown, what: string) => {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[store] ${what}:`, e);
    setSaveError(`${what}: ${msg}`);
  }, []);

  /* ------------------------------------------------------------ load ---- */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const client = sb();
        const {
          data: { user },
        } = await client.auth.getUser();

        if (!alive) return;
        if (!user) {
          setStatus("anon");
          return;
        }
        setUserId(user.id);
        setEmail(user.email ?? null);

        const [settings, tasks, days, revs, mocks, weak] = await Promise.all([
          client.from("user_settings").select("exam_date").maybeSingle(),
          client.from("task_progress").select("day_id, item_index"),
          client.from("day_completion").select("day_id, completed_at"),
          client.from("revision_done").select("day_id, gap_index"),
          client.from("mocks").select("*").order("date", { ascending: true }),
          client.from("weak_topics").select("*").order("created_at", { ascending: true }),
        ]);

        const firstErr = [settings, tasks, days, revs, mocks, weak].find((r) => r.error)?.error;
        if (firstErr) throw new Error(firstErr.message);

        const next: ProgressState = {
          checks: {},
          dayCompletedAt: {},
          revDone: {},
          examDate: settings.data?.exam_date ?? "2026-11-08",
          mocks: (mocks.data ?? []) as MockRow[],
          weak: (weak.data ?? []) as WeakRow[],
        };
        for (const t of tasks.data ?? []) {
          next.checks[`${t.day_id}::${t.item_index}`] = true;
        }
        for (const d of days.data ?? []) {
          next.dayCompletedAt[d.day_id] = d.completed_at;
        }
        for (const r of revs.data ?? []) {
          next.revDone[`${r.day_id}::${r.gap_index}`] = true;
        }
        if (!alive) return;
        setState(next);
        setStatus("ready");
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : String(e));
        setStatus("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [setState]);

  /* --------------------------------------------- progress persistence ---- */
  /** Writes only what changed: the ticked boxes + any day that flipped to/from complete. */
  const persistProgress = useCallback(
    (prev: ProgressState, next: ProgressState, changedKeys: string[], on: boolean) => {
      const uid = userId;
      if (!uid) return;
      const client = sb();

      const rows = changedKeys.map((key) => {
        const [day_id, item_index] = splitKey(key);
        return { user_id: uid, day_id, item_index };
      });

      void (async () => {
        try {
          if (rows.length) {
            const res = on
              ? await client
                  .from("task_progress")
                  .upsert(rows, { onConflict: "user_id,day_id,item_index" })
              : await client
                  .from("task_progress")
                  .delete()
                  .eq("user_id", uid)
                  .or(rows.map((r) => `and(day_id.eq.${r.day_id},item_index.eq.${r.item_index})`).join(","));
            if (res.error) throw new Error(res.error.message);
          }

          const turnedOn = Object.entries(next.dayCompletedAt).filter(
            ([id, at]) => prev.dayCompletedAt[id] !== at,
          );
          const turnedOff = Object.keys(prev.dayCompletedAt).filter((id) => !next.dayCompletedAt[id]);

          if (turnedOn.length) {
            const res = await client.from("day_completion").upsert(
              turnedOn.map(([day_id, completed_at]) => ({ user_id: uid, day_id, completed_at })),
              { onConflict: "user_id,day_id" },
            );
            if (res.error) throw new Error(res.error.message);
          }
          if (turnedOff.length) {
            const res = await client
              .from("day_completion")
              .delete()
              .eq("user_id", uid)
              .in("day_id", turnedOff);
            if (res.error) throw new Error(res.error.message);
          }
          setSaveError(null);
        } catch (e) {
          fail(e, "Progress save failed");
        }
      })();
    },
    [userId, fail],
  );

  const applyChecks = useCallback(
    (keys: string[], on: boolean) => {
      const prev = ref.current;
      const checks = { ...prev.checks };
      for (const key of keys) {
        if (on) checks[key] = true;
        else delete checks[key];
      }
      const next = withSyncedCompletion({ ...prev, checks });
      setState(next);
      persistProgress(prev, next, keys, on);
    },
    [persistProgress, setState],
  );

  const toggleCheck = useCallback(
    (key: string, on: boolean) => applyChecks([key], on),
    [applyChecks],
  );

  const setManyChecks = useCallback(
    (keys: string[], on: boolean) => applyChecks(keys, on),
    [applyChecks],
  );

  const toggleRevision = useCallback(
    (key: string, on: boolean) => {
      const prev = ref.current;
      const revDone = { ...prev.revDone };
      if (on) revDone[key] = true;
      else delete revDone[key];
      setState({ ...prev, revDone });

      const uid = userId;
      if (!uid) return;
      const [day_id, gap_index] = splitKey(key);
      void (async () => {
        try {
          const res = on
            ? await sb()
                .from("revision_done")
                .upsert({ user_id: uid, day_id, gap_index }, { onConflict: "user_id,day_id,gap_index" })
            : await sb()
                .from("revision_done")
                .delete()
                .eq("user_id", uid)
                .eq("day_id", day_id)
                .eq("gap_index", gap_index);
          if (res.error) throw new Error(res.error.message);
        } catch (e) {
          fail(e, "Revision save failed");
        }
      })();
    },
    [userId, fail, setState],
  );

  const setExamDate = useCallback(
    (date: string) => {
      const prev = ref.current;
      setState({ ...prev, examDate: date });
      const uid = userId;
      if (!uid) return;
      void (async () => {
        try {
          const res = await sb()
            .from("user_settings")
            .upsert({ user_id: uid, exam_date: date }, { onConflict: "user_id" });
          if (res.error) throw new Error(res.error.message);
        } catch (e) {
          fail(e, "Exam date save failed");
        }
      })();
    },
    [userId, fail, setState],
  );

  /* ------------------------------------------------- mocks + weak rows ---- */
  const addMock = useCallback(
    async (row: Omit<MockRow, "id">) => {
      const uid = userId;
      if (!uid) return;
      const res = await sb().from("mocks").insert({ ...row, user_id: uid }).select("*").single();
      if (res.error) return fail(new Error(res.error.message), "Mock add failed");
      setState({ ...ref.current, mocks: [...ref.current.mocks, res.data as MockRow] });
    },
    [userId, fail, setState],
  );

  const deleteMock = useCallback(
    async (id: string) => {
      const uid = userId;
      if (!uid) return;
      const res = await sb().from("mocks").delete().eq("user_id", uid).eq("id", id);
      if (res.error) return fail(new Error(res.error.message), "Mock delete failed");
      setState({ ...ref.current, mocks: ref.current.mocks.filter((m) => m.id !== id) });
    },
    [userId, fail, setState],
  );

  const addWeak = useCallback(
    async (row: Omit<WeakRow, "id" | "fixed">) => {
      const uid = userId;
      if (!uid) return;
      const res = await sb()
        .from("weak_topics")
        .insert({ ...row, fixed: false, user_id: uid })
        .select("*")
        .single();
      if (res.error) return fail(new Error(res.error.message), "Weak topic add failed");
      setState({ ...ref.current, weak: [...ref.current.weak, res.data as WeakRow] });
    },
    [userId, fail, setState],
  );

  const toggleWeakFixed = useCallback(
    async (id: string) => {
      const uid = userId;
      if (!uid) return;
      const row = ref.current.weak.find((w) => w.id === id);
      if (!row) return;
      const fixed = !row.fixed;
      setState({
        ...ref.current,
        weak: ref.current.weak.map((w) => (w.id === id ? { ...w, fixed } : w)),
      });
      const res = await sb().from("weak_topics").update({ fixed }).eq("user_id", uid).eq("id", id);
      if (res.error) fail(new Error(res.error.message), "Weak topic update failed");
    },
    [userId, fail, setState],
  );

  const deleteWeak = useCallback(
    async (id: string) => {
      const uid = userId;
      if (!uid) return;
      const res = await sb().from("weak_topics").delete().eq("user_id", uid).eq("id", id);
      if (res.error) return fail(new Error(res.error.message), "Weak topic delete failed");
      setState({ ...ref.current, weak: ref.current.weak.filter((w) => w.id !== id) });
    },
    [userId, fail, setState],
  );

  const resetAll = useCallback(async () => {
    const uid = userId;
    if (!uid) return;
    const client = sb();
    for (const table of ["task_progress", "day_completion", "revision_done", "mocks", "weak_topics"]) {
      const res = await client.from(table).delete().eq("user_id", uid);
      if (res.error) return fail(new Error(res.error.message), "Reset failed");
    }
    setState({ ...EMPTY_PROGRESS, examDate: ref.current.examDate });
  }, [userId, fail, setState]);

  const signOut = useCallback(async () => {
    await sb().auth.signOut();
    window.location.href = "/login";
  }, []);

  const value: StoreValue = {
    status,
    error,
    userId,
    email,
    state,
    saveError,
    toggleCheck,
    setManyChecks,
    toggleRevision,
    setExamDate,
    addMock,
    deleteMock,
    addWeak,
    toggleWeakFixed,
    deleteWeak,
    resetAll,
    signOut,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore must be used inside <StoreProvider>");
  return v;
}

/** Convenience: today as YYYY-MM-DD, stable across a render. */
export const TODAY = todayStr();
