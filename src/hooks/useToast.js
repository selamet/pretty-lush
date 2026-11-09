import { useEffect, useState } from "react";

// Transient status message `{ kind: "ok"|"warn"|"err", message }` that clears
// itself after `duration` ms.
export function useToast(duration = 2200) {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), duration);
    return () => clearTimeout(t);
  }, [toast, duration]);

  return [toast, setToast];
}
