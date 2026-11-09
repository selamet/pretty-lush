import { useEffect, useState } from "react";
import { looksLikeCurl } from "../curl/index.js";

const DETECT_DELAY_MS = 600;

// Suggests "cURL → code" when the input is a cURL command and the
// conversion isn't shown. A dismissed suggestion stays dismissed for the
// same command.
export function useCurlSuggestion(input, enabled) {
  const [suggestion, setSuggestion] = useState(null);
  const [dismissed, setDismissed] = useState("");

  useEffect(() => {
    if (!enabled) {
      setSuggestion(null);
      return undefined;
    }
    const t = setTimeout(() => {
      const key = input.trim().slice(0, 200);
      setSuggestion(looksLikeCurl(input) && dismissed !== key ? { key } : null);
    }, DETECT_DELAY_MS);
    return () => clearTimeout(t);
  }, [input, enabled, dismissed]);

  // Also called when the user opens the conversion, so closing it again
  // doesn't bring the banner back for the same command.
  function dismissCurlSuggestion() {
    setDismissed(input.trim().slice(0, 200));
    setSuggestion(null);
  }

  return { curlSuggestion: suggestion, dismissCurlSuggestion };
}
