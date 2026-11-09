import { useEffect, useState } from "react";
import { detectLangFromContent } from "../languages/detect.js";

const DETECT_DELAY_MS = 600;

// Suggests switching language when the input looks like another language.
// A dismissed suggestion stays dismissed for the same lang/content pair.
export function useLanguageSuggestion(input, lang) {
  const [suggestion, setSuggestion] = useState(null);
  const [dismissedSuggestion, setDismissedSuggestion] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      const detected = detectLangFromContent(input);
      const key = `${lang}:${detected}:${input.slice(0, 200)}`;
      if (detected && detected !== lang && dismissedSuggestion !== key) {
        setSuggestion({ lang: detected, key });
      } else {
        setSuggestion(null);
      }
    }, DETECT_DELAY_MS);
    return () => clearTimeout(t);
  }, [input, lang, dismissedSuggestion]);

  function dismissSuggestion() {
    setDismissedSuggestion(suggestion.key);
    setSuggestion(null);
  }

  return { suggestion, setSuggestion, dismissSuggestion };
}
