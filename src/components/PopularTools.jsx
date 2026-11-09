import { POPULAR_ROUTES } from "../seo/routes.js";

// "Popular tools" in the sidebar: real links to the landing pages (crawl
// paths for search engines). A plain click switches in place instead of
// reloading; modified clicks (new tab / window) keep the browser default.
export default function PopularTools({ onOpenRoute }) {
  function onClick(e, route) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onOpenRoute(route);
  }

  return (
    <details className="side-tools">
      <summary className="side-label side-tools-summary">
        <span>Popular tools</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <nav aria-label="Popular tools">
        <ul className="side-tools-list">
          {POPULAR_ROUTES.map((r) => (
            <li key={r.slug}>
              <a className="file-row side-tool-link" href={r.path} onClick={(e) => onClick(e, r)}>
                {r.name}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </details>
  );
}
