import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { absolutePath, buildJsonPath } from "../output/json-path.js";
import {
  ancestorPaths,
  collectContainerPaths,
  computeMatches,
  containerSize,
  flattenRows,
  leafText,
  splitHighlight,
} from "../output/json-tree-model.js";

// Collapsible tree view for JSON output. Every object / array is a row with a
// type badge and size; leaves are colored by type.
//
//  - Search (keys + values, case-insensitive, debounced) highlights matches,
//    expands their ancestors and steps through them with Enter / Shift+Enter.
//  - Each node has Copy path / Copy value / Filter by this path actions
//    (hover / focus, the ⋮ button on touch, right-click or Shift+F10).
//  - Keyboard: arrows move / expand / collapse, Home / End, Enter toggles.
//
// Rows are virtualized (fixed height) so documents with tens of thousands of
// visible nodes stay responsive; collapsed subtrees are never walked.
//
// `filter` ({ expression, bases } | null) describes the JSONPath filter that
// produced the output, so copied paths point into the unfiltered input.

const AUTO_COLLAPSE_DEPTH = 3;
const SEARCH_DEBOUNCE_MS = 150;
const ROW_H = 28;
const ROW_STEP = ROW_H + 1;
const PAD = 6;
const OVERSCAN = 10;

function leafClass(v) {
  if (v === null) return "null";
  if (typeof v === "string") return "str";
  if (typeof v === "number") return "num";
  if (typeof v === "boolean") return "bool";
  return "";
}

function peek(v) {
  if (Array.isArray(v)) {
    const head = v
      .slice(0, 3)
      .map((x) =>
        x !== null && typeof x === "object" ? (Array.isArray(x) ? "[…]" : "{…}") : JSON.stringify(x)
      )
      .join(", ");
    return v.length > 3 ? `${head}, …` : head;
  }
  const keys = Object.keys(v);
  const head = keys.slice(0, 3).join(", ");
  return keys.length > 3 ? `${head}, …` : head;
}

function Highlight({ text, query }) {
  if (!query) return text;
  return splitHighlight(text, query).map((p, i) =>
    p.match ? (
      <mark key={i} className="tree-mark">
        {p.text}
      </mark>
    ) : (
      p.text
    )
  );
}

const Icon = {
  path: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  ),
  value: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </svg>
  ),
  filter: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="22 3 2 3 10 12.5 10 19 14 21 14 12.5 22 3" />
    </svg>
  ),
  more: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
    </svg>
  ),
  search: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <line x1="20" y1="20" x2="16.65" y2="16.65" />
    </svg>
  ),
  up: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  ),
  down: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
};

const TreeRow = memo(function TreeRow({ row, index, selected, match, query, activeMatch, canFilter, act }) {
  const { v, key, depth, container, open } = row;
  const n = container ? containerSize(v) : 0;
  const isArr = Array.isArray(v);
  const keyQuery = match?.inKey ? query : "";
  const valueQuery = match?.inValue ? query : "";
  const stop = (fn) => (e) => {
    e.stopPropagation();
    fn(e);
  };
  return (
    <div
      role="treeitem"
      data-index={index}
      tabIndex={selected ? 0 : -1}
      aria-level={depth + 1}
      aria-expanded={container ? open : undefined}
      aria-selected={selected}
      className={`tree-row${selected ? " selected" : ""}${match ? " match" : ""}${
        activeMatch ? " match-active" : ""
      }`}
      style={{ top: PAD + index * ROW_STEP, paddingLeft: 8 + depth * 18 }}
      onClick={() => act.current.click(row)}
      onContextMenu={(e) => {
        e.preventDefault();
        act.current.openMenu(row, { x: e.clientX, y: e.clientY });
      }}
    >
      <svg
        className={`tree-caret ${container ? "" : "hidden"} ${open ? "open" : ""}`}
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
      {key !== null && (
        <>
          <span className={typeof key === "number" ? "tree-idx" : "tree-key"}>
            {typeof key === "number" ? key : <Highlight text={key} query={keyQuery} />}
          </span>
          <span className="tree-colon">:</span>
        </>
      )}
      {container ? (
        <>
          <span className={`tree-badge ${isArr ? "arr" : "obj"}`}>
            <b>{isArr ? "[ ]" : "{ }"}</b>
            <span>
              {n} {isArr ? (n === 1 ? "item" : "items") : n === 1 ? "key" : "keys"}
            </span>
          </span>
          {!open && n > 0 && <span className="tree-peek">{peek(v)}</span>}
        </>
      ) : (
        <span className={`tree-val ${leafClass(v)}`}>
          {typeof v === "string" && '"'}
          <Highlight text={leafText(v)} query={valueQuery} />
          {typeof v === "string" && '"'}
        </span>
      )}
      <span className="tree-actions">
        <button
          type="button"
          tabIndex={-1}
          className="tree-act tree-act-inline"
          title="Copy path"
          aria-label="Copy path"
          onClick={stop(() => act.current.copyPath(row))}
        >
          {Icon.path}
        </button>
        <button
          type="button"
          tabIndex={-1}
          className="tree-act tree-act-inline"
          title="Copy value"
          aria-label="Copy value"
          onClick={stop(() => act.current.copyValue(row))}
        >
          {Icon.value}
        </button>
        {canFilter && (
          <button
            type="button"
            tabIndex={-1}
            className="tree-act tree-act-inline"
            title="Filter by this path"
            aria-label="Filter by this path"
            onClick={stop(() => act.current.filter(row))}
          >
            {Icon.filter}
          </button>
        )}
        <button
          type="button"
          tabIndex={-1}
          className="tree-act tree-act-more"
          title="Node actions"
          aria-label="Node actions"
          aria-haspopup="menu"
          onClick={stop((e) => act.current.openMenu(row, { anchor: e.currentTarget }))}
        >
          {Icon.more}
        </button>
      </span>
    </div>
  );
});

function NodeMenu({ menu, hostRef, onClose, items }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: -9999, top: -9999 });

  useLayoutEffect(() => {
    const host = hostRef.current;
    const el = ref.current;
    if (!host || !el) return;
    const hr = host.getBoundingClientRect();
    let x;
    let y;
    if (menu.anchor) {
      const ar = menu.anchor.getBoundingClientRect();
      x = ar.right - el.offsetWidth;
      y = ar.bottom + 4;
    } else {
      x = menu.x;
      y = menu.y;
    }
    const left = Math.max(4, Math.min(x - hr.left, hr.width - el.offsetWidth - 4));
    let top = y - hr.top;
    if (top + el.offsetHeight > hr.height - 4) top = Math.max(4, top - el.offsetHeight - 36);
    setPos({ left, top });
    el.querySelector("[role=menuitem]")?.focus();
  }, [menu, hostRef]);

  useEffect(() => {
    const onDown = (e) => {
      if (!ref.current?.contains(e.target)) onClose(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [onClose]);

  function onKeyDown(e) {
    const list = [...ref.current.querySelectorAll("[role=menuitem]")];
    const i = list.indexOf(document.activeElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const d = e.key === "ArrowDown" ? 1 : -1;
      list[(i + d + list.length) % list.length]?.focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      list[e.key === "Home" ? 0 : list.length - 1]?.focus();
    } else if (e.key === "Escape" || e.key === "Tab") {
      e.preventDefault();
      e.stopPropagation();
      onClose(true);
    }
  }

  return (
    <div
      ref={ref}
      className="tree-menu"
      role="menu"
      aria-label="Node actions"
      style={pos}
      onKeyDown={onKeyDown}
    >
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          role="menuitem"
          tabIndex={-1}
          className="tree-menu-item"
          onClick={() => {
            onClose(true);
            it.run();
          }}
        >
          {it.icon}
          <span>{it.label}</span>
        </button>
      ))}
    </div>
  );
}

export default function JsonTree({
  data,
  onUsePath,
  onNotify,
  filter = null,
  focusSearch = false,
  onSearchFocused,
}) {
  const [collapsed, setCollapsed] = useState(() =>
    collectContainerPaths(data, AUTO_COLLAPSE_DEPTH)
  );
  const [selectedPath, setSelectedPath] = useState("$");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeMatch, setActiveMatch] = useState(0);
  const [menu, setMenu] = useState(null); // { row, x, y } | { row, anchor }
  const [viewport, setViewport] = useState({ top: 0, height: 600 });

  const hostRef = useRef(null);
  const bodyRef = useRef(null);
  const searchRef = useRef(null);
  const pendingScroll = useRef(null); // path to scroll into view after render
  const pendingFocus = useRef(false); // move DOM focus to the selected row

  // ── search ──
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const matches = useMemo(() => computeMatches(data, debouncedQuery), [data, debouncedQuery]);
  const matchCount = matches.list.length;

  // New match set: expand every container holding a match, jump to the first.
  useEffect(() => {
    setActiveMatch(0);
    if (!matchCount) return;
    setCollapsed((c) => {
      let next = null;
      for (const p of matches.ancestors) {
        if (c[p]) {
          next ??= { ...c };
          delete next[p];
        }
      }
      return next ?? c;
    });
    const first = matches.list[0];
    setSelectedPath(first.path);
    pendingScroll.current = first.path;
  }, [matches, matchCount]);

  function goToMatch(i) {
    if (!matchCount) return;
    const idx = (i + matchCount) % matchCount;
    const m = matches.list[idx];
    setActiveMatch(idx);
    // The user may have collapsed an ancestor since the search ran.
    setCollapsed((c) => {
      const anc = ancestorPaths(m.segments);
      if (!anc.some((p) => c[p])) return c;
      const next = { ...c };
      for (const p of anc) delete next[p];
      return next;
    });
    setSelectedPath(m.path);
    pendingScroll.current = m.path;
  }

  useEffect(() => {
    if (!focusSearch) return;
    searchRef.current?.focus();
    searchRef.current?.select();
    onSearchFocused?.();
  }, [focusSearch, onSearchFocused]);

  // ── rows ──
  const rows = useMemo(() => flattenRows(data, collapsed), [data, collapsed]);
  const indexByPath = useMemo(() => {
    const m = new Map();
    rows.forEach((r, i) => m.set(r.path, i));
    return m;
  }, [rows]);
  const selectedIndex = indexByPath.get(selectedPath) ?? 0;
  const selectedRow = rows[selectedIndex];

  // ── viewport / virtualization ──
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const measure = () => setViewport({ top: el.scrollTop, height: el.clientHeight });
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function scrollIndexIntoView(i, center) {
    const el = bodyRef.current;
    if (!el) return;
    const top = PAD + i * ROW_STEP;
    const viewTop = el.scrollTop;
    const viewBottom = viewTop + el.clientHeight;
    if (top >= viewTop && top + ROW_H <= viewBottom) return;
    el.scrollTop = center
      ? top - (el.clientHeight - ROW_H) / 2
      : top < viewTop
        ? top - PAD
        : top + ROW_H + PAD - el.clientHeight;
    setViewport({ top: el.scrollTop, height: el.clientHeight });
  }

  useLayoutEffect(() => {
    const path = pendingScroll.current;
    if (path && indexByPath.has(path)) {
      pendingScroll.current = null;
      scrollIndexIntoView(indexByPath.get(path), true);
    }
    if (pendingFocus.current) {
      pendingFocus.current = false;
      bodyRef.current
        ?.querySelector(`[data-index="${selectedIndex}"]`)
        ?.focus({ preventScroll: true });
    }
  });

  const first = Math.max(0, Math.floor((viewport.top - PAD) / ROW_STEP) - OVERSCAN);
  const last = Math.min(
    rows.length - 1,
    Math.ceil((viewport.top + viewport.height) / ROW_STEP) + OVERSCAN
  );
  const visible = [];
  // Keep the selected row mounted so it always holds the tree's tab stop.
  if (selectedIndex < first) visible.push(selectedIndex);
  for (let i = first; i <= last; i++) visible.push(i);
  if (selectedIndex > last) visible.push(selectedIndex);

  // ── node actions ──
  const pathOf = (row) => absolutePath(row.segments, filter);

  async function copyText(text, message) {
    try {
      await navigator.clipboard.writeText(text);
      onNotify?.({ kind: "ok", message });
    } catch {
      onNotify?.({ kind: "warn", message: "Couldn't access the clipboard" });
    }
  }

  function copyPath(row) {
    const p = pathOf(row);
    if (p) copyText(p, `Copied path ${p}`);
    else copyText(buildJsonPath(row.segments), "Copied path (relative to the filtered output)");
  }

  function copyValue(row) {
    copyText(JSON.stringify(row.v, null, 2), "Copied value");
  }

  function filterBy(row) {
    const p = pathOf(row);
    if (p && onUsePath) onUsePath(p);
  }

  function toggle(path) {
    setCollapsed((c) => ({ ...c, [path]: !c[path] }));
  }

  function select(row, { focus = false, scroll = false } = {}) {
    setSelectedPath(row.path);
    if (focus) pendingFocus.current = true;
    if (scroll) pendingScroll.current = row.path;
  }

  function moveTo(i) {
    const row = rows[Math.max(0, Math.min(rows.length - 1, i))];
    if (!row) return;
    select(row, { focus: true });
    scrollIndexIntoView(indexByPath.get(row.path), false);
  }

  function openMenu(row, where) {
    select(row);
    setMenu({ row, ...where });
  }

  const closeMenu = useRef((refocus) => {
    setMenu(null);
    if (refocus) pendingFocus.current = true;
  }).current;

  const act = useRef(null);
  act.current = {
    click(row) {
      select(row);
      if (row.container) toggle(row.path);
    },
    openMenu,
    copyPath,
    copyValue,
    filter: filterBy,
  };

  function onTreeKeyDown(e) {
    if (!e.target.matches?.('[role="treeitem"]')) return;
    const row = selectedRow;
    if (!row) return;
    const i = selectedIndex;
    const page = Math.max(1, Math.floor(viewport.height / ROW_STEP) - 1);
    switch (e.key) {
      case "ArrowDown":
        moveTo(i + 1);
        break;
      case "ArrowUp":
        moveTo(i - 1);
        break;
      case "PageDown":
        moveTo(i + page);
        break;
      case "PageUp":
        moveTo(i - page);
        break;
      case "Home":
        moveTo(0);
        break;
      case "End":
        moveTo(rows.length - 1);
        break;
      case "ArrowRight":
        if (row.container && !row.open) toggle(row.path);
        else if (row.container && containerSize(row.v) > 0) moveTo(i + 1);
        else return;
        break;
      case "ArrowLeft":
        if (row.container && row.open) toggle(row.path);
        else if (row.segments.length) {
          const parent = ancestorPaths(row.segments).pop();
          moveTo(indexByPath.get(parent) ?? i);
        } else return;
        break;
      case "Enter":
      case " ":
        if (row.container) toggle(row.path);
        else return;
        break;
      case "ContextMenu":
        openMenu(row, { anchor: e.target.querySelector(".tree-act-more") || e.target });
        break;
      case "F10":
        if (!e.shiftKey) return;
        openMenu(row, { anchor: e.target.querySelector(".tree-act-more") || e.target });
        break;
      case "/":
        searchRef.current?.focus();
        break;
      default:
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c") {
          if (window.getSelection?.().toString()) return;
          copyPath(row);
          break;
        }
        return;
    }
    e.preventDefault();
  }

  function onSearchKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      // Flush a pending debounce so Enter right after typing still navigates.
      if (query !== debouncedQuery) setDebouncedQuery(query);
      else goToMatch(activeMatch + (e.shiftKey ? -1 : 1));
    } else if (e.key === "Escape" && query) {
      e.preventDefault();
      e.stopPropagation();
      setQuery("");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      select(selectedRow ?? rows[0], { focus: true, scroll: true });
    }
  }

  const pending = query.trim() !== debouncedQuery.trim();
  const countText = !debouncedQuery.trim()
    ? ""
    : matchCount === 0
      ? "No matches"
      : `${activeMatch + 1} of ${matchCount} ${matchCount === 1 ? "match" : "matches"}`;

  const activeMatchPath = matchCount ? matches.list[activeMatch]?.path : null;
  const selectedAbsPath = selectedRow ? pathOf(selectedRow) : null;
  const canFilter = !!onUsePath;

  const menuItems = menu
    ? [
        { id: "path", label: "Copy path", icon: Icon.path, run: () => copyPath(menu.row) },
        { id: "value", label: "Copy value", icon: Icon.value, run: () => copyValue(menu.row) },
        ...(canFilter && pathOf(menu.row)
          ? [{ id: "filter", label: "Filter by this path", icon: Icon.filter, run: () => filterBy(menu.row) }]
          : []),
      ]
    : [];

  return (
    <div className="json-tree" ref={hostRef}>
      <div className="json-tree-bar">
        <div className={`tree-search${query ? " has-query" : ""}`} role="search">
          <span className="tree-search-icon">{Icon.search}</span>
          <input
            ref={searchRef}
            type="text"
            className="tree-search-input"
            placeholder="Search keys & values"
            aria-label="Search keys and values"
            aria-describedby={query ? "tree-search-count" : undefined}
            spellCheck={false}
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onSearchKeyDown}
          />
          {query && (
            <>
              <span
                id="tree-search-count"
                className={`tree-search-count${pending ? " pending" : ""}${
                  debouncedQuery.trim() && !matchCount ? " none" : ""
                }`}
                aria-live="polite"
              >
                {countText}
              </span>
              <button
                type="button"
                className="tree-search-nav"
                onClick={() => goToMatch(activeMatch - 1)}
                disabled={!matchCount}
                title="Previous match (Shift+Enter)"
                aria-label="Previous match"
              >
                {Icon.up}
              </button>
              <button
                type="button"
                className="tree-search-nav"
                onClick={() => goToMatch(activeMatch + 1)}
                disabled={!matchCount}
                title="Next match (Enter)"
                aria-label="Next match"
              >
                {Icon.down}
              </button>
              <button
                type="button"
                className="tree-search-nav"
                onClick={() => {
                  setQuery("");
                  searchRef.current?.focus();
                }}
                title="Clear search"
                aria-label="Clear search"
              >
                ×
              </button>
            </>
          )}
        </div>
        <button type="button" className="tree-btn" onClick={() => setCollapsed({})}>
          Expand all
        </button>
        <button
          type="button"
          className="tree-btn"
          onClick={() => setCollapsed(collectContainerPaths(data))}
        >
          Collapse all
        </button>
        <span className="tree-legend" aria-hidden="true">
          <span><b className="obj">{"{ }"}</b> object</span>
          <span><b className="arr">[ ]</b> array</span>
        </span>
      </div>

      <div
        className="json-tree-body"
        ref={bodyRef}
        role="tree"
        aria-label="JSON tree"
        onScroll={(e) => {
          const el = e.currentTarget;
          setViewport((v) =>
            v.top === el.scrollTop && v.height === el.clientHeight
              ? v
              : { top: el.scrollTop, height: el.clientHeight }
          );
          if (menu) setMenu(null);
        }}
        onKeyDown={onTreeKeyDown}
      >
        <div className="tree-canvas" style={{ height: PAD * 2 + rows.length * ROW_STEP }}>
          {visible.map((i) => {
            const row = rows[i];
            const mi = matches.byPath.get(row.path);
            const match = mi === undefined ? undefined : matches.list[mi];
            return (
              <TreeRow
                key={row.path}
                row={row}
                index={i}
                selected={i === selectedIndex}
                match={match}
                query={match ? matches.query : ""}
                activeMatch={row.path === activeMatchPath}
                canFilter={canFilter && !!pathOf(row)}
                act={act}
              />
            );
          })}
        </div>
      </div>

      {menu && (
        <NodeMenu menu={menu} hostRef={hostRef} onClose={closeMenu} items={menuItems} />
      )}

      <div className="json-tree-foot">
        <span className="lbl">Path</span>
        <code title={selectedAbsPath || ""}>{selectedAbsPath ?? "—"}</code>
        <button
          type="button"
          className="tree-btn"
          onClick={() => selectedRow && copyPath(selectedRow)}
        >
          Copy path
        </button>
        {canFilter && (
          <button
            type="button"
            className="tree-btn"
            disabled={!selectedAbsPath}
            onClick={() => selectedRow && filterBy(selectedRow)}
          >
            Filter by this
          </button>
        )}
      </div>
    </div>
  );
}
