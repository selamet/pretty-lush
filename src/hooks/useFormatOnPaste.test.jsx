// @vitest-environment jsdom
//
// Regression test for #22: Format-on-paste must format the pasted content
// (the editor's full new value), not the input from before the paste. Runs
// the real InputPane / CodeMirror editor and a real paste event.
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import InputPane from "../components/InputPane.jsx";
import { useFormatOnPaste } from "./useFormatOnPaste.js";

const LANGUAGE = { id: "plaintext", label: "Text" };

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  // CodeMirror measures layout; jsdom has no layout engine.
  const rect = { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 };
  Range.prototype.getClientRects ??= () => [];
  Range.prototype.getBoundingClientRect ??= () => rect;
});

let root = null;
let host = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

// Mirrors App: per-tab inputs, and a `format` that — like handleFormat —
// formats `opts.input` when given, else the input of the render it came from.
function Harness({ enabled, initialTabs, calls, api }) {
  const [tabs, setTabs] = useState(initialTabs);
  const [activeId, setActiveId] = useState(Object.keys(initialTabs)[0]);
  const input = tabs[activeId];
  const setInput = (text) => setTabs((t) => ({ ...t, [activeId]: text }));
  async function format({ input: override } = {}) {
    calls.push({ tab: activeId, input: override ?? input });
    return true;
  }
  const paste = useFormatOnPaste({ enabled, setInput, format, formatKey: `${activeId}|k` });
  api.current = { paste, input, activeId, switchTab: setActiveId };
  return (
    <InputPane
      language={LANGUAGE}
      input={input}
      onInputChange={paste.onInputChange}
      jsonPath=""
      onJsonPathChange={() => {}}
      onFormat={() => {}}
      editorKey={activeId}
      onViewReady={(view) => {
        api.view = view;
      }}
    />
  );
}

function mount(props) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  const calls = [];
  const api = { current: null, view: null };
  act(() => root.render(<Harness calls={calls} api={api} {...props} />));
  return { calls, api };
}

async function paste(view, text, { selectAll = false } = {}) {
  await act(async () => {
    if (selectAll) view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } });
    const event = new Event("paste", { bubbles: true, cancelable: true });
    event.clipboardData = { getData: (type) => (type === "text/plain" ? text : "") };
    view.contentDOM.dispatchEvent(event);
  });
  // Let any deferred (setTimeout) format run.
  await act(() => new Promise((r) => setTimeout(r, 20)));
}

describe("format on paste", () => {
  it("formats the pasted content when pasting into an empty editor", async () => {
    const { calls, api } = mount({ enabled: true, initialTabs: { a: "" } });
    await paste(api.view, '{"pasted":true}');
    expect(api.current.input).toBe('{"pasted":true}');
    expect(calls).toEqual([{ tab: "a", input: '{"pasted":true}' }]);
  });

  it("formats the full new value when pasting over a selection", async () => {
    const { calls, api } = mount({ enabled: true, initialTabs: { a: "old content" } });
    await paste(api.view, "new: 1", { selectAll: true });
    expect(calls).toEqual([{ tab: "a", input: "new: 1" }]);
  });

  it("formats the whole editor (not just the clipboard) when pasting into existing text", async () => {
    const { calls, api } = mount({ enabled: true, initialTabs: { a: "b: 2" } });
    await act(async () => api.view.dispatch({ selection: { anchor: 4 } }));
    await paste(api.view, "\nc: 3");
    expect(calls).toEqual([{ tab: "a", input: "b: 2\nc: 3" }]);
  });

  it("does nothing when Format-on-paste is off", async () => {
    const { calls, api } = mount({ enabled: false, initialTabs: { a: "" } });
    await paste(api.view, "x = 1");
    expect(api.current.input).toBe("x = 1");
    expect(calls).toEqual([]);
  });

  it("formats the active tab's new content after switching tabs", async () => {
    const { calls, api } = mount({ enabled: true, initialTabs: { a: "first", b: "second" } });
    await act(async () => api.current.switchTab("b"));
    await paste(api.view, "pasted ", { selectAll: false });
    expect(calls).toEqual([{ tab: "b", input: "pasted second" }]);
  });

  it("tells auto-format to skip the content it just formatted (no double format)", async () => {
    const { api } = mount({ enabled: true, initialTabs: { a: "" } });
    await paste(api.view, "a: 1");
    const { paste: hook } = api.current;
    expect(hook.takePasteFormatted("a: 1", "a|k")).toBe(true);
    // Only once, and never for other content or other format options.
    expect(hook.takePasteFormatted("a: 1", "a|k")).toBe(false);
    await paste(api.view, "b: 2", { selectAll: true });
    expect(api.current.paste.takePasteFormatted("b: 2", "a|other")).toBe(false);
  });
});
