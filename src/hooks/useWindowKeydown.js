import { useEffect, useRef } from "react";

// Subscribes `handler` to window keydown while `active` is true. The latest
// handler is always called, so callers can pass an inline function.
export function useWindowKeydown(handler, active = true) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!active) return;
    function onKey(e) {
      handlerRef.current(e);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);
}
