import BrandMark from "./BrandMark.jsx";

// App header: brand, ⌘K search trigger, GitHub link and light/dark toggle.
export default function TopBar({ themeMode, onOpenPalette, onToggleTheme }) {
  return (
    <header className="topbar">
      <div className="brand">
        <BrandMark size={28} />
        <span className="brand-name">
          <span className="brace">{"{"}</span> Pretty Lush{" "}
          <span className="brace">{"}"}</span>
        </span>
        <span
          className="privacy-pill"
          title="All formatting runs locally in your browser. Nothing is uploaded."
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span>Runs locally · nothing uploaded</span>
        </span>
      </div>

      <button
        type="button"
        className="cmd-search"
        onClick={onOpenPalette}
        aria-label="Search commands"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <span className="cmd-search-text">Search commands, tools, languages…</span>
        <kbd>⌘K</kbd>
      </button>

      <div className="top-actions">
        <a
          className="gh-link"
          href="https://github.com/selamet/pretty-lush"
          target="_blank"
          rel="noopener noreferrer"
          title="Source on GitHub — give it a ★"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          <span>Star on GitHub</span>
        </a>
        <button
          type="button"
          className="icon-btn"
          onClick={onToggleTheme}
          aria-label={
            themeMode === "dark" ? "Switch to light theme" : "Switch to dark theme"
          }
          title={themeMode === "dark" ? "Light theme" : "Dark theme"}
        >
          {themeMode === "dark" ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
      </div>
    </header>
  );
}
