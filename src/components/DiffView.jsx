import { useMemo } from "react";
import { diffLines } from "diff";

export default function DiffView({ before, after }) {
  const rows = useMemo(() => buildDiffRows(before, after), [before, after]);
  const stats = useMemo(() => {
    let added = 0,
      removed = 0;
    for (const r of rows) {
      if (r.kind === "add") added++;
      else if (r.kind === "del") removed++;
    }
    return { added, removed };
  }, [rows]);

  return (
    <div className="diff">
      <div className="diff-head">
        <span className="diff-stat add">+{stats.added}</span>
        <span className="diff-stat del">−{stats.removed}</span>
        <span className="diff-stat eq">
          {rows.length - stats.added - stats.removed} unchanged
        </span>
      </div>
      <div className="diff-body">
        {rows.map((row, i) => (
          <div key={i} className={`diff-row ${row.kind}`}>
            <span className="diff-num">
              {row.kind === "add" ? "" : row.beforeNo || ""}
            </span>
            <span className="diff-num">
              {row.kind === "del" ? "" : row.afterNo || ""}
            </span>
            <span className="diff-sigil">
              {row.kind === "add" ? "+" : row.kind === "del" ? "−" : " "}
            </span>
            <span className="diff-text">{row.text || " "}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildDiffRows(before, after) {
  if (!before && !after) return [];
  const parts = diffLines(before || "", after || "");
  const rows = [];
  let beforeNo = 0;
  let afterNo = 0;
  for (const part of parts) {
    const lines = part.value.split("\n");
    if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
    for (const line of lines) {
      if (part.added) {
        afterNo++;
        rows.push({ kind: "add", text: line, afterNo });
      } else if (part.removed) {
        beforeNo++;
        rows.push({ kind: "del", text: line, beforeNo });
      } else {
        beforeNo++;
        afterNo++;
        rows.push({ kind: "eq", text: line, beforeNo, afterNo });
      }
    }
  }
  return rows;
}
