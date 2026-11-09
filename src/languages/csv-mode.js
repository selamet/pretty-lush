// Minimal CodeMirror stream mode for CSV: the header row is shown as a
// heading, quoted fields (which may span lines) as strings, commas as
// punctuation, and numbers / true / false / null like JSON scalars.

const NUMBER_RE = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?(?=,|$)/;
const ATOM_RE = /^(true|false|null)(?=,|$)/;

function quotedField(stream, state) {
  while (!stream.eol()) {
    if (stream.next() === '"') {
      if (stream.peek() === '"') {
        stream.next();
      } else {
        state.inQuote = false;
        break;
      }
    }
  }
  return state.row === 0 ? "heading" : "string";
}

export const csv = {
  name: "csv",
  startState: () => ({ inQuote: false, row: 0, seenLine: false }),
  copyState: (s) => ({ ...s }),
  blankLine(state) {
    if (!state.inQuote && state.seenLine) state.row++;
  },
  token(stream, state) {
    if (stream.sol()) {
      if (state.seenLine && !state.inQuote) state.row++;
      state.seenLine = true;
    }
    if (state.inQuote) return quotedField(stream, state);
    if (stream.eat(",")) return "punctuation";
    if (stream.eat('"')) {
      state.inQuote = true;
      return quotedField(stream, state);
    }
    if (state.row === 0) {
      stream.eatWhile((c) => c !== ",");
      return "heading";
    }
    if (stream.match(NUMBER_RE)) return "number";
    if (stream.match(ATOM_RE)) return "atom";
    stream.eatWhile((c) => c !== ",");
    return null;
  },
};
