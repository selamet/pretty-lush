// Full-window overlay shown while a file is dragged over the app.
export default function DropOverlay({ visible }) {
  if (!visible) return null;
  return (
    <div className="drop-overlay">
      <div className="drop-overlay-card">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <span>Drop file to format</span>
      </div>
    </div>
  );
}
