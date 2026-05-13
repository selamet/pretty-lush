// Convert between a Python literal (the kind you get from `print(my_dict)` or
// `repr(obj)`) and JSON. This is NOT a full Python parser — it walks the
// literal subset (dicts, lists, tuples, sets, strings, numbers,
// True/False/None) and rewrites it.
//
// Why not regex: single-quote strings can contain `True`, commas can sit
// inside nested brackets, and `'` vs `"` matters. A tiny tokenizer is the
// only way to be correct without pulling in a parser.

function parsePythonLiteral(src) {
  let i = 0;
  const s = src;

  function skipWs() {
    while (i < s.length) {
      const c = s[i];
      if (c === " " || c === "\t" || c === "\n" || c === "\r") {
        i++;
      } else if (c === "#") {
        while (i < s.length && s[i] !== "\n") i++;
      } else {
        break;
      }
    }
  }

  function fail(msg) {
    const line = (s.slice(0, i).match(/\n/g) || []).length + 1;
    const lastNl = s.lastIndexOf("\n", i - 1);
    const col = i - (lastNl + 1) + 1;
    throw new Error(`${msg} at line ${line}, column ${col}`);
  }

  function parseString() {
    // Optional prefix: r, b, u, rb, br — we accept and strip (b/u become regular strings).
    let raw = false;
    if (/[rbuRBU]/.test(s[i])) {
      let j = i;
      let p1 = s[j++];
      let p2 = s[j];
      if (/[rbuRBU]/.test(p2) && (p1.toLowerCase() + p2.toLowerCase()).match(/^(rb|br)$/)) {
        if (p1.toLowerCase() === "r" || p2.toLowerCase() === "r") raw = true;
        i = j + 1;
      } else if ((p1 === "'" || p1 === '"') === false) {
        if (p1.toLowerCase() === "r") raw = true;
        i = j;
      }
    }
    const quote = s[i];
    if (quote !== "'" && quote !== '"') fail("Expected string literal");
    const triple = s.slice(i, i + 3) === quote.repeat(3);
    if (triple) i += 3; else i++;
    let out = "";
    while (i < s.length) {
      if (triple) {
        if (s.slice(i, i + 3) === quote.repeat(3)) {
          i += 3;
          return out;
        }
      } else if (s[i] === quote) {
        i++;
        return out;
      }
      const c = s[i];
      if (c === "\\" && !raw) {
        const n = s[i + 1];
        i += 2;
        switch (n) {
          case "n": out += "\n"; break;
          case "t": out += "\t"; break;
          case "r": out += "\r"; break;
          case "b": out += "\b"; break;
          case "f": out += "\f"; break;
          case "v": out += "\v"; break;
          case "0": out += "\0"; break;
          case "\\": out += "\\"; break;
          case "'": out += "'"; break;
          case '"': out += '"'; break;
          case "\n": break;
          case "x": {
            const hex = s.slice(i, i + 2);
            i += 2;
            out += String.fromCharCode(parseInt(hex, 16));
            break;
          }
          case "u": {
            const hex = s.slice(i, i + 4);
            i += 4;
            out += String.fromCharCode(parseInt(hex, 16));
            break;
          }
          default:
            out += n;
        }
      } else {
        out += c;
        i++;
      }
    }
    fail("Unterminated string");
  }

  function parseNumber() {
    const start = i;
    if (s[i] === "+" || s[i] === "-") i++;
    if (s[i] === "0" && /[xXoObB]/.test(s[i + 1])) {
      const base = { x: 16, X: 16, o: 8, O: 8, b: 2, B: 2 }[s[i + 1]];
      i += 2;
      const digitStart = i;
      while (i < s.length && /[0-9a-fA-F_]/.test(s[i])) i++;
      const raw = s.slice(digitStart, i).replace(/_/g, "");
      return parseInt(raw, base);
    }
    while (i < s.length && /[0-9_]/.test(s[i])) i++;
    if (s[i] === ".") {
      i++;
      while (i < s.length && /[0-9_]/.test(s[i])) i++;
    }
    if (s[i] === "e" || s[i] === "E") {
      i++;
      if (s[i] === "+" || s[i] === "-") i++;
      while (i < s.length && /[0-9_]/.test(s[i])) i++;
    }
    if (s[i] === "j" || s[i] === "J") {
      fail("Complex numbers cannot be converted to JSON");
    }
    const raw = s.slice(start, i).replace(/_/g, "");
    const n = Number(raw);
    if (Number.isNaN(n)) fail(`Invalid number '${raw}'`);
    return n;
  }

  function parseIdentifier() {
    const start = i;
    while (i < s.length && /[A-Za-z0-9_]/.test(s[i])) i++;
    return s.slice(start, i);
  }

  function parseValue() {
    skipWs();
    if (i >= s.length) fail("Unexpected end of input");
    const c = s[i];

    if (c === "{") return parseDictOrSet();
    if (c === "[") return parseList();
    if (c === "(") return parseTuple();
    if (c === "'" || c === '"') return parseString();
    if (/[rbuRBU]/.test(c) && (s[i + 1] === "'" || s[i + 1] === '"' ||
        (/[rbuRBU]/.test(s[i + 1]) && (s[i + 2] === "'" || s[i + 2] === '"')))) {
      return parseString();
    }
    if (/[0-9]/.test(c) || ((c === "+" || c === "-") && /[0-9.]/.test(s[i + 1])) || c === ".") {
      return parseNumber();
    }
    if (/[A-Za-z_]/.test(c)) {
      const id = parseIdentifier();
      switch (id) {
        case "True": return true;
        case "False": return false;
        case "None": return null;
        case "nan": case "NaN": return NaN;
        case "inf": case "Infinity": return Infinity;
        default:
          fail(`Unknown identifier '${id}' (only True/False/None are supported)`);
      }
    }
    fail(`Unexpected character '${c}'`);
  }

  function parseList() {
    i++;
    const out = [];
    skipWs();
    if (s[i] === "]") { i++; return out; }
    while (i < s.length) {
      out.push(parseValue());
      skipWs();
      if (s[i] === ",") { i++; skipWs(); if (s[i] === "]") { i++; return out; } continue; }
      if (s[i] === "]") { i++; return out; }
      fail("Expected ',' or ']' in list");
    }
    fail("Unterminated list");
  }

  function parseTuple() {
    i++;
    const out = [];
    skipWs();
    if (s[i] === ")") { i++; return out; }
    while (i < s.length) {
      out.push(parseValue());
      skipWs();
      if (s[i] === ",") { i++; skipWs(); if (s[i] === ")") { i++; return out; } continue; }
      if (s[i] === ")") { i++; return out; }
      fail("Expected ',' or ')' in tuple");
    }
    fail("Unterminated tuple");
  }

  function parseDictOrSet() {
    i++;
    skipWs();
    if (s[i] === "}") { i++; return {}; }
    const first = parseValue();
    skipWs();
    if (s[i] === ":") {
      i++;
      const dict = {};
      const val = parseValue();
      dict[String(first)] = val;
      skipWs();
      while (s[i] === ",") {
        i++; skipWs();
        if (s[i] === "}") { i++; return dict; }
        const k = parseValue();
        skipWs();
        if (s[i] !== ":") fail("Expected ':' in dict");
        i++;
        const v = parseValue();
        dict[String(k)] = v;
        skipWs();
      }
      if (s[i] === "}") { i++; return dict; }
      fail("Expected ',' or '}' in dict");
    }
    // Set — JSON has no set type, so we emit an array.
    const out = [first];
    while (s[i] === ",") {
      i++; skipWs();
      if (s[i] === "}") { i++; return out; }
      out.push(parseValue());
      skipWs();
    }
    if (s[i] === "}") { i++; return out; }
    fail("Expected ',' or '}' in set");
  }

  skipWs();
  const value = parseValue();
  skipWs();
  if (i < s.length) {
    fail("Unexpected trailing content");
  }
  return value;
}

export function pythonToJson(src, { indent = 2 } = {}) {
  if (!src.trim()) return "";
  const value = parsePythonLiteral(src);
  // JSON has no NaN/Infinity — fall back to null.
  const safe = JSON.stringify(value, (_, v) => {
    if (typeof v === "number" && !Number.isFinite(v)) return null;
    return v;
  }, indent);
  return safe + "\n";
}

export function jsonToPython(src, { indent = 4 } = {}) {
  if (!src.trim()) return "";
  let parsed;
  try {
    parsed = JSON.parse(src);
  } catch (e) {
    throw new Error(`Invalid JSON: ${e.message}`);
  }
  return emitPython(parsed, indent) + "\n";
}

function emitPython(v, indent, depth = 0) {
  const pad = " ".repeat(indent * depth);
  const innerPad = " ".repeat(indent * (depth + 1));
  if (v === null) return "None";
  if (v === true) return "True";
  if (v === false) return "False";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return v !== v ? "float('nan')" : (v > 0 ? "float('inf')" : "float('-inf')");
    return String(v);
  }
  if (typeof v === "string") return pythonStringLiteral(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return "[]";
    const parts = v.map((x) => innerPad + emitPython(x, indent, depth + 1));
    return "[\n" + parts.join(",\n") + ",\n" + pad + "]";
  }
  if (typeof v === "object") {
    const keys = Object.keys(v);
    if (keys.length === 0) return "{}";
    const parts = keys.map(
      (k) => innerPad + pythonStringLiteral(k) + ": " + emitPython(v[k], indent, depth + 1)
    );
    return "{\n" + parts.join(",\n") + ",\n" + pad + "}";
  }
  return "None";
}

function pythonStringLiteral(s) {
  // Prefer single quotes (Python convention) unless the string contains one
  // and no double quote — then double quotes avoid an escape.
  const hasSingle = s.includes("'");
  const hasDouble = s.includes('"');
  const quote = hasSingle && !hasDouble ? '"' : "'";
  const escaped = s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
    .replace(new RegExp(quote, "g"), "\\" + quote);
  return quote + escaped + quote;
}
