import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getLanguage } from "../languages/groups.js";

const DRAG_THRESHOLD_PX = 5;
const EDGE_SCROLL_PX = 32;

// Short language badge shown before each tab name (sidebar-style extension).
function badgeFor(lang) {
  const l = getLanguage(lang);
  return (l?.ext || (lang === "dockerfile" ? "dkr" : lang.slice(0, 3))).toLowerCase();
}

function isMac() {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || "");
}

// Inline rename field; Enter / blur commits, Escape cancels.
function RenameInput({ initial, onCommit, onCancel }) {
  const ref = useRef(null);
  const done = useRef(false);

  useLayoutEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  function finish(commit) {
    if (done.current) return;
    done.current = true;
    if (commit) onCommit(ref.current.value);
    else onCancel();
  }

  return (
    <input
      ref={ref}
      className="tab-rename"
      defaultValue={initial}
      maxLength={40}
      aria-label="Tab name"
      spellCheck={false}
      autoComplete="off"
      size={Math.max(4, Math.min(24, initial.length + 1))}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          finish(true);
        } else if (e.key === "Escape") {
          e.preventDefault();
          finish(false);
        }
      }}
      onBlur={() => finish(true)}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    />
  );
}

// Right-click / Shift+F10 menu of a tab.
function TabMenu({ menu, items, onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: menu.x, top: menu.y });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      left: Math.max(8, Math.min(menu.x, window.innerWidth - r.width - 8)),
      top: Math.max(8, Math.min(menu.y, window.innerHeight - r.height - 8)),
    });
    el.querySelector("button:not(:disabled)")?.focus();
  }, [menu.x, menu.y]);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    function onDown(e) {
      if (!ref.current?.contains(e.target)) onCloseRef.current(false);
    }
    function onKey(e) {
      if (e.key === "Escape" || e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current(true);
      }
    }
    function onResize() {
      onCloseRef.current(false);
    }
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  function onKeyDown(e) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const buttons = [...ref.current.querySelectorAll("button:not(:disabled)")];
    const i = buttons.indexOf(document.activeElement);
    const next = (i + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  }

  return createPortal(
    <div
      ref={ref}
      className="tab-menu"
      role="menu"
      aria-label="Tab actions"
      style={pos}
      onKeyDown={onKeyDown}
    >
      {items.map((item) =>
        item.separator ? (
          <div key={item.key} className="tab-menu-sep" role="separator" />
        ) : (
          <button
            key={item.key}
            type="button"
            role="menuitem"
            className="tab-menu-item"
            disabled={item.disabled}
            onClick={() => {
              onClose(true);
              item.run();
            }}
          >
            <span>{item.label}</span>
            {item.hint && <kbd>{item.hint}</kbd>}
          </button>
        )
      )}
    </div>,
    document.body
  );
}

/**
 * Snippet tab strip above the input / output split.
 *
 * Mouse: click to switch, double-click to rename, middle-click or × to
 * close, drag to reorder, right-click for the menu. Keyboard (tab focused):
 * ←/→ Home/End switch, Alt+Shift+←/→ (⌘⌥←/→ on macOS) move, F2 rename,
 * Delete close, Shift+F10 / Menu key for the menu. Touch: the strip scrolls
 * horizontally; reorder via the menu (long-press) or keyboard.
 */
export default function TabBar({
  tabs,
  activeId,
  labels,
  renamingId,
  onRenamingChange,
  onActivate,
  onAdd,
  onClose,
  onRename,
  onMove,
  onDuplicate,
  onCloseOthers,
  panelId,
}) {
  const scrollRef = useRef(null);
  const tabRefs = useRef(new Map());
  const pendingFocus = useRef(null);
  const drag = useRef(null);
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const [draggingId, setDraggingId] = useState(null);
  const [fade, setFade] = useState({ start: false, end: false });
  const [menu, setMenu] = useState(null); // { id, x, y }

  function updateFade() {
    const el = scrollRef.current;
    if (!el) return;
    const start = el.scrollLeft > 1;
    const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setFade((f) => (f.start === start && f.end === end ? f : { start, end }));
  }

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(updateFade);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(updateFade, [tabs, labels]);

  // Keep the active tab in view (switching by keyboard / shortcuts / ⌘K).
  useEffect(() => {
    const el = scrollRef.current;
    const tab = tabRefs.current.get(activeId);
    if (!el || !tab) return;
    const left = tab.offsetLeft;
    const right = left + tab.offsetWidth;
    if (left < el.scrollLeft + EDGE_SCROLL_PX) {
      el.scrollLeft = Math.max(0, left - EDGE_SCROLL_PX);
    } else if (right > el.scrollLeft + el.clientWidth - EDGE_SCROLL_PX) {
      el.scrollLeft = right - el.clientWidth + EDGE_SCROLL_PX;
    }
  }, [activeId, tabs.length]);

  // Re-focus a tab after a keyboard action re-rendered (or moved) it.
  useEffect(() => {
    const id = pendingFocus.current;
    if (!id) return;
    pendingFocus.current = null;
    tabRefs.current.get(id)?.focus();
  });

  function focusTab(id) {
    pendingFocus.current = id;
  }

  function onPointerDown(e, id) {
    if (e.button !== 0 || e.pointerType === "touch" || renamingId === id) return;
    if (e.target.closest(".tab-close")) return;
    const startX = e.clientX;
    drag.current = { id, active: false };

    function onMovePointer(ev) {
      const d = drag.current;
      if (!d) return;
      if (!d.active) {
        if (Math.abs(ev.clientX - startX) < DRAG_THRESHOLD_PX) return;
        d.active = true;
        setDraggingId(id);
        onActivate(id);
        document.body.classList.add("is-tab-dragging");
      }
      const el = scrollRef.current;
      const box = el.getBoundingClientRect();
      if (ev.clientX < box.left + EDGE_SCROLL_PX) el.scrollLeft -= 12;
      else if (ev.clientX > box.right - EDGE_SCROLL_PX) el.scrollLeft += 12;
      // Target index: how many other tabs have their midpoint left of the pointer.
      let to = 0;
      for (const t of tabsRef.current) {
        if (t.id === id) continue;
        const r = tabRefs.current.get(t.id)?.getBoundingClientRect();
        if (r && ev.clientX > r.left + r.width / 2) to++;
      }
      if (tabsRef.current.findIndex((t) => t.id === id) !== to) onMove(id, to);
    }

    function onUp() {
      window.removeEventListener("pointermove", onMovePointer);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.body.classList.remove("is-tab-dragging");
      drag.current = null;
      setDraggingId(null);
    }

    window.addEventListener("pointermove", onMovePointer);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  function openMenuFor(id, x, y) {
    setMenu({ id, x, y });
  }

  function onTabKeyDown(e, id, index) {
    if (renamingId === id) return;
    const moveMod = isMac() ? e.metaKey && e.altKey : e.altKey && e.shiftKey;
    const altMove = e.altKey && e.shiftKey; // accepted on every platform
    if ((moveMod || altMove) && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      e.preventDefault();
      onMove(id, index + (e.key === "ArrowLeft" ? -1 : 1));
      focusTab(id);
      return;
    }
    if (e.altKey || e.metaKey || e.ctrlKey) return;
    let target = null;
    switch (e.key) {
      case "ArrowLeft":
        target = tabs[(index - 1 + tabs.length) % tabs.length];
        break;
      case "ArrowRight":
        target = tabs[(index + 1) % tabs.length];
        break;
      case "Home":
        target = tabs[0];
        break;
      case "End":
        target = tabs[tabs.length - 1];
        break;
      case "F2":
        e.preventDefault();
        onRenamingChange(id);
        return;
      case "Delete":
      case "Backspace": {
        e.preventDefault();
        const next = tabs[index + 1] || tabs[index - 1];
        onClose(id);
        if (next) focusTab(next.id);
        return;
      }
      case "ContextMenu":
        e.preventDefault();
        openFromKeyboard(id);
        return;
      default:
        if (e.key === "F10" && e.shiftKey) {
          e.preventDefault();
          openFromKeyboard(id);
        }
        return;
    }
    e.preventDefault();
    onActivate(target.id);
    focusTab(target.id);
  }

  function openFromKeyboard(id) {
    const r = tabRefs.current.get(id)?.getBoundingClientRect();
    if (r) openMenuFor(id, r.left, r.bottom + 4);
  }

  const menuTab = menu && tabs.find((t) => t.id === menu.id);
  const menuIndex = menuTab ? tabs.indexOf(menuTab) : -1;
  const menuItems = menuTab
    ? [
        { key: "rename", label: "Rename", hint: "F2", run: () => onRenamingChange(menuTab.id) },
        { key: "duplicate", label: "Duplicate", run: () => onDuplicate(menuTab.id) },
        { key: "s1", separator: true },
        {
          key: "left",
          label: "Move left",
          disabled: menuIndex === 0,
          run: () => onMove(menuTab.id, menuIndex - 1),
        },
        {
          key: "right",
          label: "Move right",
          disabled: menuIndex === tabs.length - 1,
          run: () => onMove(menuTab.id, menuIndex + 1),
        },
        { key: "s2", separator: true },
        { key: "close", label: "Close", hint: "Alt+W", run: () => onClose(menuTab.id) },
        {
          key: "others",
          label: "Close other tabs",
          disabled: tabs.length < 2,
          run: () => onCloseOthers(menuTab.id),
        },
      ]
    : [];

  return (
    <div className={`tabbar ${draggingId ? "is-dragging" : ""}`}>
      <div
        ref={scrollRef}
        className={`tabbar-scroll ${fade.start ? "fade-start" : ""} ${fade.end ? "fade-end" : ""}`}
        role="tablist"
        aria-label="Snippet tabs"
        onScroll={updateFade}
        onWheel={(e) => {
          const el = scrollRef.current;
          if (el && !e.deltaX && e.deltaY && el.scrollWidth > el.clientWidth) {
            el.scrollLeft += e.deltaY;
          }
        }}
      >
        {tabs.map((tab, index) => {
          const active = tab.id === activeId;
          const label = labels[tab.id];
          const renaming = renamingId === tab.id;
          return (
            <div
              key={tab.id}
              ref={(el) => {
                if (el) tabRefs.current.set(tab.id, el);
                else tabRefs.current.delete(tab.id);
              }}
              id={`tab-${tab.id}`}
              role="tab"
              aria-selected={active}
              aria-controls={active ? panelId : undefined}
              tabIndex={active ? 0 : -1}
              title={label}
              className={`tab ${active ? "is-active" : ""} ${
                draggingId === tab.id ? "is-dragging" : ""
              } ${renaming ? "is-renaming" : ""}`}
              onPointerDown={(e) => onPointerDown(e, tab.id)}
              onClick={() => onActivate(tab.id)}
              onAuxClick={(e) => {
                if (e.button === 1) {
                  e.preventDefault();
                  onClose(tab.id);
                }
              }}
              onDoubleClick={() => onRenamingChange(tab.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                onActivate(tab.id);
                openMenuFor(tab.id, e.clientX, e.clientY);
              }}
              onKeyDown={(e) => onTabKeyDown(e, tab.id, index)}
            >
              <span className="tab-badge" aria-hidden="true">
                {badgeFor(tab.lang)}
              </span>
              {renaming ? (
                <RenameInput
                  initial={label}
                  onCommit={(name) => {
                    onRename(tab.id, name);
                    onRenamingChange(null);
                    focusTab(tab.id);
                  }}
                  onCancel={() => {
                    onRenamingChange(null);
                    focusTab(tab.id);
                  }}
                />
              ) : (
                <span className="tab-name">{label}</span>
              )}
              <button
                type="button"
                className="tab-close"
                tabIndex={-1}
                aria-label={`Close ${label}`}
                title="Close tab (Alt+W)"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(tab.id);
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="18" y1="6" x2="6" y2="18" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        className="tabbar-add"
        aria-label="New tab"
        title="New tab (Alt+T)"
        onClick={onAdd}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
      {menuTab && (
        <TabMenu
          menu={menu}
          items={menuItems}
          onClose={(refocus) => {
            setMenu(null);
            if (refocus) tabRefs.current.get(menuTab.id)?.focus();
          }}
        />
      )}
    </div>
  );
}
