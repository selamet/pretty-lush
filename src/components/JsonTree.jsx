import { useMemo, useState } from "react";

// Collapsible tree view for JSON output. Every object / array is a row with a
// type badge and size; leaves are colored by type. Clicking a row selects it
// and shows its JSONPath in the footer, where it can be copied or used as the
// JSONPath filter.

const AUTO_COLLAPSE_DEPTH = 3;

function isContainer(v) {
  return v !== null && typeof v === "object";
}

function childPath(parent, key, isIndex) {
  if (isIndex) return `${parent}[${key}]`;
  return /^[A-Za-z_$][\w$]*$/.test(key)
    ? `${parent}.${key}`
    : `${parent}[${JSON.stringify(key)}]`;
}

function children(v, path) {
  if (Array.isArray(v)) return v.map((c, i) => [i, c, childPath(path, i, true), true]);
  return Object.keys(v).map((k) => [k, v[k], childPath(path, k, false), false]);
}

function collectContainers(data, { minDepth = 1 } = {}) {
  const out = {};
  const walk = (v, path, depth) => {
    if (!isContainer(v)) return;
    if (depth >= minDepth) out[path] = true;
    for (const [, c, p] of children(v, path)) walk(c, p, depth + 1);
  };
  walk(data, "$", 0);
  return out;
}

function peek(v) {
  if (Array.isArray(v)) {
    const head = v
      .slice(0, 3)
      .map((x) => (isContainer(x) ? (Array.isArray(x) ? "[…]" : "{…}") : JSON.stringify(x)))
      .join(", ");
    return v.length > 3 ? `${head}, …` : head;
  }
  const keys = Object.keys(v);
  const head = keys.slice(0, 3).join(", ");
  return keys.length > 3 ? `${head}, …` : head;
}

function leafClass(v) {
  if (v === null) return "null";
  if (typeof v === "string") return "str";
  if (typeof v === "number") return "num";
  if (typeof v === "boolean") return "bool";
  return "";
}

export default function JsonTree({ data, onUsePath }) {
  const [collapsed, setCollapsed] = useState(() =>
    collectContainers(data, { minDepth: AUTO_COLLAPSE_DEPTH })
  );
  const [selected, setSelected] = useState("$");
  const [copied, setCopied] = useState(false);

  const rows = useMemo(() => {
    const out = [];
    const walk = (v, key, isIndex, path, depth) => {
      const container = isContainer(v);
      const open = container && !collapsed[path];
      out.push({ v, key, isIndex, path, depth, container, open });
      if (open) {
        for (const [k, c, p, idx] of children(v, path)) walk(c, k, idx, p, depth + 1);
      }
    };
    walk(data, null, false, "$", 0);
    return out;
  }, [data, collapsed]);

  function toggle(path) {
    setCollapsed((c) => ({ ...c, [path]: !c[path] }));
  }

  async function copyPath() {
    try {
      await navigator.clipboard.writeText(selected);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  }

  return (
    <div className="json-tree">
      <div className="json-tree-bar">
        <button type="button" className="tree-btn" onClick={() => setCollapsed({})}>
          Expand all
        </button>
        <button
          type="button"
          className="tree-btn"
          onClick={() => setCollapsed(collectContainers(data))}
        >
          Collapse all
        </button>
        <span className="spacer" />
        <span className="tree-legend" aria-hidden="true">
          <span><b className="obj">{"{ }"}</b> object</span>
          <span><b className="arr">[ ]</b> array</span>
        </span>
      </div>

      <div className="json-tree-body" role="tree" aria-label="JSON tree">
        {rows.map((r) => {
          const n = r.container
            ? Array.isArray(r.v)
              ? r.v.length
              : Object.keys(r.v).length
            : 0;
          return (
            <button
              key={r.path}
              type="button"
              role="treeitem"
              aria-expanded={r.container ? r.open : undefined}
              aria-selected={selected === r.path}
              className={`tree-row ${selected === r.path ? "selected" : ""}`}
              style={{ paddingLeft: 8 + r.depth * 18 }}
              onClick={() => {
                setSelected(r.path);
                if (r.container) toggle(r.path);
              }}
              title={r.path}
            >
              <svg
                className={`tree-caret ${r.container ? "" : "hidden"} ${r.open ? "open" : ""}`}
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="9 6 15 12 9 18" />
              </svg>
              {r.key !== null && (
                <>
                  <span className={r.isIndex ? "tree-idx" : "tree-key"}>{String(r.key)}</span>
                  <span className="tree-colon">:</span>
                </>
              )}
              {r.container ? (
                <>
                  <span className={`tree-badge ${Array.isArray(r.v) ? "arr" : "obj"}`}>
                    <b>{Array.isArray(r.v) ? "[ ]" : "{ }"}</b>
                    <span>
                      {n}{" "}
                      {Array.isArray(r.v)
                        ? n === 1 ? "item" : "items"
                        : n === 1 ? "key" : "keys"}
                    </span>
                  </span>
                  {!r.open && n > 0 && <span className="tree-peek">{peek(r.v)}</span>}
                </>
              ) : (
                <span className={`tree-val ${leafClass(r.v)}`}>
                  {typeof r.v === "string" ? `"${r.v}"` : String(r.v)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="json-tree-foot">
        <span className="lbl">Path</span>
        <code>{selected}</code>
        <button type="button" className="tree-btn" onClick={copyPath}>
          {copied ? "Copied" : "Copy path"}
        </button>
        {onUsePath && (
          <button type="button" className="tree-btn" onClick={() => onUsePath(selected)}>
            Filter by this
          </button>
        )}
      </div>
    </div>
  );
}
