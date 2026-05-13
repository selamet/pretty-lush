import { useState } from "react";

// Drag handle for resizing horizontal layout splits (sidebar width, input /
// output ratio). The component is intentionally stateless apart from a
// `dragging` flag for visual feedback — the parent owns the value being
// resized and applies the delta in `onDrag(deltaX, startValue, ctx)`.
export default function Resizer({ ariaLabel, onDrag, startValue, startContext }) {
  const [dragging, setDragging] = useState(false);

  function handlePointerDown(e) {
    e.preventDefault();
    const startX = e.clientX;
    const startVal = startValue;
    const ctx = startContext ? startContext() : null;
    setDragging(true);
    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    function onMove(ev) {
      onDrag(ev.clientX - startX, startVal, ctx);
    }
    function onUp() {
      setDragging(false);
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSelect;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function handleDoubleClick() {
    // Soft reset — emit a no-op delta. Callers that support reset (sidebar
    // width) listen for the zero-delta and snap back to a default.
    onDrag(0, startValue, startContext ? startContext() : null);
  }

  return (
    <div
      className={`resizer ${dragging ? "is-dragging" : ""}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      onPointerDown={handlePointerDown}
      onDoubleClick={handleDoubleClick}
    />
  );
}
