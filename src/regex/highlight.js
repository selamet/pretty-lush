// CodeMirror extension that paints regex matches and capture groups in the
// Regex tester's test editor. Marks are pushed in with `setRegexMarks` (from
// the worker's match model via core.js `highlightRanges`) and mapped through
// edits until the next result arrives.
import { StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView, WidgetType } from "@codemirror/view";
import { highlightRanges } from "./core.js";

const setRegexMarks = StateEffect.define();

class EmptyMatchWidget extends WidgetType {
  constructor(variant) {
    super();
    this.variant = variant;
  }
  eq(other) {
    return other.variant === this.variant;
  }
  toDOM() {
    const el = document.createElement("span");
    el.className = `cm-rx-empty cm-rx-v${this.variant}`;
    el.setAttribute("aria-hidden", "true");
    return el;
  }
  ignoreEvent() {
    return true;
  }
}

const MARKS = {
  match: [0, 1].map((v) => Decoration.mark({ class: `cm-rx-match cm-rx-v${v}` })),
  group: [0, 1, 2, 3].map((v) => Decoration.mark({ class: `cm-rx-group cm-rx-g${v}` })),
  empty: [0, 1].map((v) => Decoration.widget({ widget: new EmptyMatchWidget(v), side: 1 })),
};

const regexMarksField = StateField.define({
  create: () => Decoration.none,
  update(marks, tr) {
    let next = marks.map(tr.changes);
    for (const e of tr.effects) if (e.is(setRegexMarks)) next = e.value;
    return next;
  },
  provide: (f) => EditorView.decorations.from(f),
});

// Stable extension instance for <CodeEditor extraExtensions>.
export const regexHighlight = [regexMarksField];

// Replaces the marks of `view` with those of `matches`.
export function showRegexMatches(view, matches) {
  if (!view || view.destroyed) return;
  const ranges = highlightRanges(matches, view.state.doc.length).map((r) =>
    MARKS[r.kind][r.variant].range(r.from, r.to)
  );
  view.dispatch({ effects: setRegexMarks.of(Decoration.set(ranges, true)) });
}
