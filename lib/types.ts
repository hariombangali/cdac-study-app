export type Subject =
  | "C"
  | "DS"
  | "CPP"
  | "OS"
  | "DCN"
  | "Aptitude"
  | "BigData"
  | "AI"
  | "Practice"
  | "Revision"
  | "Mock";

export type Task = {
  label: string;
  detail?: string;
  /** a single folder whose real files get listed under this task */
  dir?: string;
  /** several folders whose real files get listed under this task */
  dirs?: string[];
  /** only list files whose name starts with this (used for the CPP demo files) */
  filter?: string;
};

export type Day = {
  id: string;
  dow: string;
  /** YYYY-MM-DD */
  date: string;
  subject: Subject;
  topic: string;
  /** vault-relative folder, or null for rest / mock days */
  folder: string | null;
  /** paths relative to `folder` */
  pdf?: string[];
  img?: string[];
  codeDir?: string;
  codeFilter?: string;
  extraDir?: string;
  extra?: string[];
  mcq?: string[];
  poll?: string[];
  note?: string;
  hint?: string;
  tasks?: Task[];
};

export type Week = {
  week: number;
  title: string;
  range: string;
  days: Day[];
};

/** directory (vault-relative, "." for the root) -> file names */
export type Manifest = Record<string, string[]>;

export type MockRow = {
  id: string;
  date: string;
  section: string;
  attempted: number;
  correct: number;
  wrong: number;
  note: string;
};

export type WeakRow = {
  id: string;
  topic: string;
  note: string;
  sev: "high" | "med" | "low";
  fixed: boolean;
};

/** Everything that used to live in localStorage, now one row per user in Postgres. */
export type ProgressState = {
  /** "dayId::itemIndex" -> done */
  checks: Record<string, boolean>;
  /** dayId -> YYYY-MM-DD, set when every task of that day is ticked */
  dayCompletedAt: Record<string, string>;
  /** "dayId::gapIndex" -> revised */
  revDone: Record<string, boolean>;
  examDate: string;
  mocks: MockRow[];
  weak: WeakRow[];
};
