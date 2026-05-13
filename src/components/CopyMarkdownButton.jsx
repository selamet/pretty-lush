import { useEffect, useState } from "react";
import { MARKDOWN_LANG_TAGS } from "../languages/registry.js";

// Copies the current output wrapped in a fenced Markdown code block, with
// the language tag picked from `MARKDOWN_LANG_TAGS`. Falls back to no tag
// for unmapped languages.
export default function CopyMarkdownButton({ text, lang }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  async function handleCopy() {
    if (!text) return;
    const tag = MARKDOWN_LANG_TAGS[lang] || "";
    const body = text.replace(/\n+$/, "");
    const md = "```" + tag + "\n" + body + "\n```\n";
    try {
      await navigator.clipboard.writeText(md);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      className="copy-btn"
      onClick={handleCopy}
      disabled={!text}
      aria-label="Copy as Markdown code block"
      title="Copy as Markdown code block"
    >
      {copied ? (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          MD
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 6h16v12H4z" />
            <path d="M7 14V10l2 2 2-2v4M14 10v4h3M15 12l-1 2-1-2" />
          </svg>
          MD
        </>
      )}
    </button>
  );
}
