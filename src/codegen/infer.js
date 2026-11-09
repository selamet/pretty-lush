// Schema inference for "Generate types": a JSON sample → a merged type
// description that the emitters (./typescript.js, ./zod.js, ./pydantic.js)
// turn into code.
//
// A type is a *TypeSet* — every kind of value seen at one position in the
// sample, merged:
//
//   { nullable, boolean, integer, number, string: { dateTime } | null,
//     array: TypeSet | null,   // merged element type ("unknown" if all empty)
//     object: Shape | null }   // merged object shape
//
//   Shape = { count, fields: Map<key, { type: TypeSet, count }> }
//
// Merging two samples unions the flags, merges object shapes field by field
// and merges array element types. A field is optional when it appears in
// fewer objects than the shape was built from; integers seen together with
// floats collapse to `number`. A TypeSet with no flags set is "unknown"
// (e.g. the elements of an array that was always empty).

const ISO_DATE_TIME =
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/i;

export function isIsoDateTime(s) {
  return ISO_DATE_TIME.test(s) && !Number.isNaN(Date.parse(s.replace(" ", "T")));
}

export function emptyType() {
  return {
    nullable: false,
    boolean: false,
    integer: false,
    number: false,
    string: null,
    array: null,
    object: null,
  };
}

function emptyShape() {
  return { count: 0, fields: new Map() };
}

function addValue(t, value) {
  if (value === null || value === undefined) {
    t.nullable = true;
  } else if (typeof value === "boolean") {
    t.boolean = true;
  } else if (typeof value === "number") {
    if (Number.isInteger(value)) t.integer = true;
    else t.number = true;
  } else if (typeof value === "string") {
    const dt = isIsoDateTime(value);
    t.string = t.string ? { dateTime: t.string.dateTime && dt } : { dateTime: dt };
  } else if (Array.isArray(value)) {
    if (!t.array) t.array = emptyType();
    for (const item of value) addValue(t.array, item);
  } else if (typeof value === "object") {
    if (!t.object) t.object = emptyShape();
    addObject(t.object, value);
  }
  return t;
}

function addObject(shape, obj) {
  shape.count += 1;
  for (const [key, v] of Object.entries(obj)) {
    let field = shape.fields.get(key);
    if (!field) {
      field = { type: emptyType(), count: 0 };
      shape.fields.set(key, field);
    }
    field.count += 1;
    addValue(field.type, v);
  }
}

// JSON value → TypeSet.
export function inferType(value) {
  return normalize(addValue(emptyType(), value));
}

// int + float → float, recursively.
function normalize(t) {
  if (t.integer && t.number) t.integer = false;
  if (t.array) normalize(t.array);
  if (t.object) for (const f of t.object.fields.values()) normalize(f.type);
  return t;
}

export function isUnknown(t) {
  return (
    !t.nullable && !t.boolean && !t.integer && !t.number &&
    !t.string && !t.array && !t.object
  );
}

// Object shape with at least one field → a named type. `{}` samples carry no
// field information and are emitted as a free-form map instead.
export function isNamedObject(t) {
  return !!t.object && t.object.fields.size > 0;
}

export function isOptional(field, shape) {
  return field.count < shape.count;
}

// Non-null members of a TypeSet in emit order. Each member is one of
// { kind: "object" | "map" | "array" | "string" | "integer" | "number" |
//   "boolean" } (+ `items` for arrays, `dateTime` for strings).
export function members(t) {
  const out = [];
  if (t.object) out.push({ kind: t.object.fields.size ? "object" : "map" });
  if (t.array) out.push({ kind: "array", items: t.array });
  if (t.string) out.push({ kind: "string", dateTime: t.string.dateTime });
  if (t.integer) out.push({ kind: "integer" });
  if (t.number) out.push({ kind: "number" });
  if (t.boolean) out.push({ kind: "boolean" });
  return out;
}

// ── naming ──────────────────────────────────────────────

// Names that would shadow a global / import in one of the targets.
const RESERVED_TYPE_NAMES = new Set([
  "Object", "Array", "String", "Number", "Boolean", "Date", "Record",
  "Promise", "Map", "Set", "Symbol", "Error", "Function", "Partial",
  "BaseModel", "RootModel", "Field", "ConfigDict", "Any", "Optional",
  "Union", "List", "Dict", "Literal", "Infer",
]);

function words(s) {
  return String(s)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
}

// "first_name" / "first-name" / "firstName" → "FirstName". Always returns a
// valid identifier (non-empty, not starting with a digit, not reserved).
export function pascalCase(s, fallback = "Type") {
  let name = words(s)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join("");
  if (!name) name = fallback;
  if (/^\d/.test(name)) name = `T${name}`;
  if (RESERVED_TYPE_NAMES.has(name)) name = `${name}Type`;
  return name;
}

// Simple English plurals: "categories" → "category", "addresses" →
// "address", "users" → "user". Returns the input unchanged when it doesn't
// look like a plural.
export function singularize(name) {
  if (/[^aeiou]ies$/i.test(name)) return name.slice(0, -3) + (/IES$/.test(name) ? "Y" : "y");
  if (/(ss|x|z|ch|sh)es$/i.test(name)) return name.slice(0, -2);
  if (/[^su]s$/i.test(name) && !/(is|ss|us)$/i.test(name)) return name.slice(0, -1);
  return name;
}

// Name for the element type of an array stored under `name`.
export function itemName(name) {
  const single = singularize(name);
  return single !== name && single.length > 1 ? single : `${name}Item`;
}

// Structural signature of a TypeSet (names excluded), used to give identical
// object shapes one shared type.
function signature(t, shapeOnly = false) {
  const parts = [];
  if (t.nullable && !shapeOnly) parts.push("null");
  if (t.boolean) parts.push("bool");
  if (t.integer) parts.push("int");
  if (t.number) parts.push("num");
  if (t.string) parts.push(t.string.dateTime ? "datetime" : "str");
  if (t.array) parts.push(`[${signature(t.array)}]`);
  if (t.object) {
    const fields = [...t.object.fields.entries()]
      .map(([k, f]) => `${JSON.stringify(k)}${f.count < t.object.count ? "?" : ""}:${signature(f.type)}`)
      .sort();
    parts.push(`{${fields.join(",")}}`);
  }
  return parts.join("|");
}

/**
 * Infers a schema and assigns a unique name to every object shape.
 *
 * @returns {{ root: TypeSet, rootName: string,
 *   names: Map<Shape, string>,
 *   declarations: { name: string, type: TypeSet }[] }}
 *   `declarations` is in dependency order (a type comes after every type it
 *   references); the root object, if any, is last.
 */
export function buildSchema(value, { rootName = "Root" } = {}) {
  const root = inferType(value);
  const name = pascalCase(rootName, "Root");
  const used = new Set([name]);
  const names = new Map(); // Shape → name
  const bySignature = new Map(); // signature → name
  const declarations = [];

  function unique(base) {
    let n = base;
    for (let i = 2; used.has(n); i++) n = `${base}${i}`;
    used.add(n);
    return n;
  }

  // `hint` is the name this position's object would get; `inArray` stops
  // nested arrays from singularizing twice ([[{…}]] under "rows" → "Row").
  function visit(t, hint, inArray, fixedName) {
    if (t.array) visit(t.array, inArray ? hint : itemName(hint), true);
    if (!isNamedObject(t)) return;
    const shape = t.object;
    // Children first, so declarations come out in dependency order.
    for (const [key, f] of shape.fields) visit(f.type, pascalCase(key), false);
    const sig = signature(t, true);
    let n = fixedName || bySignature.get(sig);
    if (!n) {
      n = unique(hint);
      bySignature.set(sig, n);
      declarations.push({ name: n, type: t });
    } else if (fixedName) {
      declarations.push({ name: n, type: t });
    }
    names.set(shape, n);
  }

  if (isNamedObject(root)) {
    visit(root, name, false, name);
  } else {
    // The root itself is an alias (array / primitive); nested objects get
    // names derived from the root name ("Root" → "RootItem", "Users" → "User").
    visit(root, name, false);
  }

  return { root, rootName: name, names, declarations };
}

// Declarations in reading order: the root first, then every type right
// after the first type that references it (depth-first, field order).
export function topDownDeclarations({ root, names, declarations }) {
  const byName = new Map(declarations.map((d) => [d.name, d]));
  const out = [];
  const seen = new Set();
  function walk(t) {
    if (t.array) walk(t.array);
    if (!isNamedObject(t)) return;
    const name = names.get(t.object);
    if (seen.has(name)) return;
    seen.add(name);
    out.push(byName.get(name));
    for (const f of t.object.fields.values()) walk(f.type);
  }
  walk(root);
  return out;
}

// Quote helpers shared by the JS-flavoured emitters.
export function isJsIdentifier(key) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key);
}

export function jsKey(key) {
  return isJsIdentifier(key) ? key : JSON.stringify(key);
}
