// Transient status toast; `toast` is `{ kind, message, action? }` or null.
// `action` (`{ label, run }`) adds a button, e.g. "Undo" after closing a tab.
export default function Toast({ toast, onDismiss }) {
  if (!toast) return null;
  return (
    <div
      className={`toast toast-${toast.kind} ${toast.action ? "has-action" : ""}`}
      role="status"
    >
      <span className="toast-message">{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          className="toast-action"
          onClick={() => {
            toast.action.run();
            onDismiss?.();
          }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}
