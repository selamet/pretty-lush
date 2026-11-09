// Minimal CodeMirror stream mode for GraphQL (queries and SDL). The legacy
// modes package has no GraphQL grammar and the official `cm6-graphql` pulls
// in graphql-js, so this small tokenizer covers highlighting only:
// keywords, strings (incl. """block strings"""), comments, $variables,
// @directives, numbers, type names and field names.

const KEYWORDS = new Set([
  "query", "mutation", "subscription", "fragment", "on",
  "type", "interface", "union", "enum", "input", "scalar", "schema",
  "extend", "directive", "implements", "repeatable",
]);
const ATOMS = new Set(["true", "false", "null"]);

function blockString(stream, state) {
  while (!stream.eol()) {
    if (stream.match('"""')) {
      state.inBlockString = false;
      return "string";
    }
    if (stream.next() === "\\") stream.next();
  }
  return "string";
}

export const graphql = {
  name: "graphql",
  startState: () => ({ inBlockString: false }),
  token(stream, state) {
    if (state.inBlockString) return blockString(stream, state);
    if (stream.eatSpace()) return null;

    if (stream.peek() === "#") {
      stream.skipToEnd();
      return "comment";
    }
    if (stream.match('"""')) {
      state.inBlockString = true;
      return blockString(stream, state);
    }
    if (stream.eat('"')) {
      while (!stream.eol()) {
        const c = stream.next();
        if (c === "\\") stream.next();
        else if (c === '"') break;
      }
      return "string";
    }
    if (stream.match(/^\$[_A-Za-z][_0-9A-Za-z]*/)) return "variableName.special";
    if (stream.match(/^@[_A-Za-z][_0-9A-Za-z]*/)) return "meta";
    if (stream.match(/^-?\d+(\.\d+)?([eE][+-]?\d+)?/)) return "number";

    const word = stream.match(/^[_A-Za-z][_0-9A-Za-z]*/);
    if (word) {
      const w = word[0];
      if (KEYWORDS.has(w)) return "keyword";
      if (ATOMS.has(w)) return "atom";
      if (/^[A-Z]/.test(w)) return "typeName";
      return "propertyName";
    }

    if (stream.match("...")) return "operator";
    const c = stream.next();
    if ("!=|&:".includes(c)) return "operator";
    return "punctuation";
  },
  languageData: {
    commentTokens: { line: "#" },
    closeBrackets: { brackets: ["(", "[", "{", '"'] },
  },
};
