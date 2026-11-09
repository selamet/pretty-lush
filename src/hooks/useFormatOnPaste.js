import { useRef } from "react";

// True when a CodeMirror update came from a paste (CodeMirror tags paste
// transactions with the "input.paste" user event).
export function isPasteUpdate(viewUpdate) {
  return !!viewUpdate?.transactions?.some((tr) => tr.isUserEvent("input.paste"));
}

// Format-on-paste for the input editor.
//
// The format is started from the editor's change handler, with the editor's
// full new value passed explicitly: a DOM `paste` handler runs before the
// pasted text is in state, so a format scheduled from there formatted the
// pre-paste input (#22). The value comes from the same update, so it is
// right whatever the cursor / selection was, and the handler belongs to the
// active tab's render, so results land in that tab.
//
// `format({ silent, input })` formats `input` (App's handleFormat).
// `formatKey` identifies everything else that shapes the output (tab,
// language, format settings, JSONPath): auto-format asks
// `takePasteFormatted(input, formatKey)` before its debounced run and skips
// it, once, when that exact content was just formatted on paste — no
// double format when both options are on.
export function useFormatOnPaste({ enabled, setInput, format, formatKey }) {
  const lastPaste = useRef(null);

  function onInputChange(text, viewUpdate) {
    setInput(text);
    if (!enabled || !isPasteUpdate(viewUpdate) || !text.trim()) return;
    const entry = { text, key: formatKey };
    lastPaste.current = entry;
    // Not formatted after all (busy, or invalid input): let auto-format try.
    Promise.resolve(format({ silent: true, input: text })).then((ok) => {
      if (!ok && lastPaste.current === entry) lastPaste.current = null;
    });
  }

  function takePasteFormatted(text, key) {
    const last = lastPaste.current;
    lastPaste.current = null;
    return !!last && last.text === text && last.key === key;
  }

  return { onInputChange, takePasteFormatted };
}
