import { useEffect, useState } from "react";

// Transient status message `{ kind: "ok"|"warn"|"err", message, action? }`
// that clears itself after `duration` ms (or the toast's own `duration`).
// `action` is `{ label, run }`, rendered as a button (e.g. "Undo").
export function useToast(duration = 2200) {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.duration ?? duration);
    return () => clearTimeout(t);
  }, [toast, duration]);

  return [toast, setToast];
}
