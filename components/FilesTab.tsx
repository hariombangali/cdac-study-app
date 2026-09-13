"use client";

import { useMemo, useState } from "react";
import { MANIFEST, TOTAL_FILES, folderLabel } from "@/lib/manifest";
import { MATERIAL } from "@/lib/material";
import { FileLink } from "./shared";

export default function FilesTab() {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();

  const { blocks, shown } = useMemo(() => {
    let shownCount = 0;
    const out: { dir: string; files: string[]; note?: (typeof MATERIAL)[number] }[] = [];

    for (const dir of Object.keys(MANIFEST).sort()) {
      const dirHit = !query || dir.toLowerCase().includes(query);
      let files = MANIFEST[dir];
      if (query && !dirHit) files = files.filter((f) => f.toLowerCase().includes(query));
      if (!files.length) continue;
      shownCount += files.length;
      out.push({
        dir,
        files,
        note: MATERIAL.find((m) => m.name === dir),
      });
    }
    return { blocks: out, shown: shownCount };
  }, [query]);

  const all = shown === TOTAL_FILES;

  return (
    <>
      <div className="card">
        <h2>Complete file index</h2>
        <div className="sm mut" style={{ marginBottom: 10 }}>
          Vault ka <b>har ek file</b> — exact naam ke saath. Login hone par har naam clickable hai aur
          file private storage se khulti hai (signed URL).
        </div>
        <div className="two" style={{ gap: 10 }}>
          <input
            className="search"
            placeholder="kisi bhi file ka naam search karo…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <span className="sm" style={{ color: all ? "var(--ok)" : "var(--warn)" }}>
            {shown} / {TOTAL_FILES} files listed{all ? " ✓" : ""}
          </span>
        </div>
      </div>

      {blocks.length === 0 ? (
        <div className="empty">Kuch nahi mila — search clear karo.</div>
      ) : (
        blocks.map((b) => (
          <details className="wk fold-wrap" key={b.dir} open={Boolean(query) || Boolean(b.note)}>
            <summary>
              <span className="fold">{folderLabel(b.dir)}</span>
              <span className="sm mut">
                {b.files.length} file{b.files.length > 1 ? "s" : ""}
              </span>
            </summary>
            <div className="wkbody">
              {b.note ? (
                <div className="sm" style={{ marginBottom: 7 }}>
                  {b.note.note}
                </div>
              ) : null}
              {b.note?.gotcha ? (
                <div className="hint" style={{ margin: "0 0 8px" }}>
                  ⚠️ {b.note.gotcha}
                </div>
              ) : null}
              <span className="chips">
                {b.files.map((f) => (
                  <FileLink key={f} path={b.dir === "." ? f : `${b.dir}/${f}`} label={f} />
                ))}
              </span>
            </div>
          </details>
        ))
      )}
    </>
  );
}
