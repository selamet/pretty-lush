import { useState } from "react";
import { filterLanguageGroups } from "../languages/groups.js";
import RecentHistory from "./RecentHistory.jsx";
import PopularTools from "./PopularTools.jsx";

// Left sidebar: filterable language list grouped by LANGUAGE_GROUPS, the
// "Popular tools" landing-page links and the recent-format history.
export default function Sidebar({
  lang,
  onSelectLang,
  onOpenRoute,
  history,
  onRestoreHistory,
  onClearHistory,
}) {
  const [langFilter, setLangFilter] = useState("");

  return (
    <aside className="sidebar">
      <label className="side-filter">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="text"
          placeholder="Filter languages"
          aria-label="Filter languages"
          spellCheck={false}
          autoComplete="off"
          value={langFilter}
          onChange={(e) => setLangFilter(e.target.value)}
        />
      </label>

      <nav className="lang-nav" aria-label="Languages">
        {filterLanguageGroups(langFilter).map((g) => (
          <div className="lang-group" key={g.name}>
            <div className="side-label">{g.name}</div>
            {g.items.map((l) => (
              <button
                type="button"
                key={l.id}
                className={`file-row ${l.id === lang ? "active" : ""}`}
                aria-current={l.id === lang ? "page" : undefined}
                onClick={() => onSelectLang(l.id)}
              >
                {l.label}
                {l.ext && <span className="file-ext">.{l.ext}</span>}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <PopularTools onOpenRoute={onOpenRoute} />

      <RecentHistory
        history={history}
        onRestore={onRestoreHistory}
        onClear={onClearHistory}
      />
    </aside>
  );
}
