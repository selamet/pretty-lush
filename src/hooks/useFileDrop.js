import { useState } from "react";

// Whole-app file drag-and-drop. Returns the dragging flag (for the overlay)
// and handlers to spread on the drop target; `onFile` gets the first file.
export function useFileDrop(onFile) {
  const [isDragging, setIsDragging] = useState(false);

  function onDragOver(e) {
    if (e.dataTransfer?.types?.includes("Files")) {
      e.preventDefault();
      setIsDragging(true);
    }
  }

  function onDragLeave(e) {
    if (e.target === e.currentTarget) setIsDragging(false);
  }

  function onDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    return onFile(file);
  }

  return { isDragging, dropHandlers: { onDragOver, onDragLeave, onDrop } };
}
