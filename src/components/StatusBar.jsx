// Bottom status line: format state, language, indent / width summary.
export default function StatusBar({ error, isFormatting, output, langLabel, settings }) {
  return (
    <footer className="status">
      <span className={error ? "err" : isFormatting ? "" : "ok"}>●</span>
      <span>
        {isFormatting
          ? "formatting…"
          : error
            ? error.line
              ? `error · line ${error.line}`
              : "error"
            : output
              ? "formatted"
              : "idle"}
      </span>
      <span>{langLabel}</span>
      <span className="spacer" />
      <span>
        {settings.indent === "tab" ? "tabs" : `${settings.indent} spaces`} ·{" "}
        {settings.lineWidth} cols · utf-8 · lf
      </span>
      <span className="status-hint">
        <kbd>⌘K</kbd> commands
      </span>
    </footer>
  );
}
