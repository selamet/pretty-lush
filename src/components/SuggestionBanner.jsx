import { getLanguage } from "../languages/groups.js";

// "Looks like <Language>. Switch?" banner shown when detection disagrees
// with the selected language.
export default function SuggestionBanner({ suggestion, onAccept, onDismiss }) {
  if (!suggestion) return null;
  return (
    <div className="suggestion">
      <span>
        Looks like{" "}
        <b>{getLanguage(suggestion.lang)?.label || suggestion.lang}</b>
        . Switch?
      </span>
      <button type="button" className="suggestion-btn" onClick={onAccept}>
        Switch
      </button>
      <button
        type="button"
        className="suggestion-dismiss"
        aria-label="Dismiss"
        onClick={onDismiss}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
