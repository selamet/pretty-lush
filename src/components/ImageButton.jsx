import { useState } from "react";

// Exports the output pane as a PNG (html-to-image is lazy-loaded on click).
export default function ImageButton({ targetRef, language, disabled }) {
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    if (!targetRef?.current || disabled || busy) return;
    setBusy(true);
    const node = targetRef.current;
    node.classList.add("snapshot");
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(node, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor:
          getComputedStyle(document.documentElement)
            .getPropertyValue("--surface")
            .trim() || "#ffffff",
      });
      const a = document.createElement("a");
      a.download = `pretty-lush-${language.toLowerCase()}.png`;
      a.href = dataUrl;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      // swallow — fail silently is acceptable for an optional export
    } finally {
      node.classList.remove("snapshot");
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className="copy-btn"
      onClick={handleSave}
      disabled={disabled || busy}
      aria-label="Download as image"
      title="Download as PNG"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
      {busy ? "…" : "PNG"}
    </button>
  );
}
