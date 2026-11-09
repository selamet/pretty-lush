import { describe, expect, it } from "vitest";
import {
  buildSchema,
  inferType,
  isIsoDateTime,
  isOptional,
  itemName,
  members,
  pascalCase,
  singularize,
  topDownDeclarations,
} from "./infer.js";

describe("inferType", () => {
  it("merges object shapes across array elements", () => {
    const t = inferType([{ a: 1, b: "x" }, { a: 2 }, { a: 3, c: true }]);
    const shape = t.array.object;
    expect(shape.count).toBe(3);
    expect([...shape.fields.keys()]).toEqual(["a", "b", "c"]);
    expect(isOptional(shape.fields.get("a"), shape)).toBe(false);
    expect(isOptional(shape.fields.get("b"), shape)).toBe(true);
    expect(isOptional(shape.fields.get("c"), shape)).toBe(true);
  });

  it("marks null as nullable and keeps the other kinds", () => {
    const t = inferType([{ v: "x" }, { v: null }]);
    const v = t.array.object.fields.get("v");
    expect(v.type.nullable).toBe(true);
    expect(v.type.string).toEqual({ dateTime: false });
    expect(isOptional(v, t.array.object)).toBe(false);
  });

  it("collapses int + float to number but keeps pure ints", () => {
    expect(members(inferType([1, 2]).array)).toEqual([{ kind: "integer" }]);
    expect(members(inferType([1, 2.5]).array)).toEqual([{ kind: "number" }]);
  });

  it("produces a union for mixed primitives", () => {
    const kinds = members(inferType([1, "a", true]).array).map((m) => m.kind);
    expect(kinds).toEqual(["string", "integer", "boolean"]);
  });

  it("detects ISO date-times only when every sample is one", () => {
    expect(inferType(["2024-01-02T03:04:05Z", "2024-05-06 07:08"]).array.string).toEqual({ dateTime: true });
    expect(inferType(["2024-01-02T03:04:05Z", "hello"]).array.string).toEqual({ dateTime: false });
    expect(isIsoDateTime("2024-01-02T03:04:05.123+02:00")).toBe(true);
    expect(isIsoDateTime("2024-01-02")).toBe(false);
    expect(isIsoDateTime("2024-13-45T99:99")).toBe(false);
  });

  it("leaves empty arrays' element type unknown", () => {
    expect(members(inferType([]).array)).toEqual([]);
    expect(inferType([]).array.nullable).toBe(false);
  });
});

describe("naming helpers", () => {
  it("pascalCases keys and keeps identifiers valid", () => {
    expect(pascalCase("first_name")).toBe("FirstName");
    expect(pascalCase("first-name")).toBe("FirstName");
    expect(pascalCase("firstName")).toBe("FirstName");
    expect(pascalCase("HTTPResponse")).toBe("HTTPResponse");
    expect(pascalCase("1st place")).toBe("T1stPlace");
    expect(pascalCase("$$$")).toBe("Type");
    expect(pascalCase("date")).toBe("DateType");
  });

  it("singularizes simple plurals", () => {
    expect(singularize("Users")).toBe("User");
    expect(singularize("Categories")).toBe("Category");
    expect(singularize("Addresses")).toBe("Address");
    expect(singularize("Boxes")).toBe("Box");
    expect(singularize("Status")).toBe("Status");
    expect(singularize("Analysis")).toBe("Analysis");
    expect(singularize("Glass")).toBe("Glass");
    expect(singularize("Data")).toBe("Data");
  });

  it("derives array element names", () => {
    expect(itemName("Users")).toBe("User");
    expect(itemName("Data")).toBe("DataItem");
    expect(itemName("Root")).toBe("RootItem");
  });
});

describe("buildSchema", () => {
  it("names nested objects from their keys", () => {
    const s = buildSchema({ user: { address: { city: "x" } } });
    expect(s.declarations.map((d) => d.name)).toEqual(["Address", "User", "Root"]);
  });

  it("names array elements in singular and doesn't singularize twice", () => {
    const s = buildSchema({ items: [{ a: 1 }], rows: [[{ b: 1 }]] });
    expect(s.declarations.map((d) => d.name)).toEqual(["Item", "Row", "Root"]);
  });

  it("dedupes name collisions", () => {
    const s = buildSchema({ a: { node: { x: 1 } }, b: { node: { y: "s" } }, root: { z: 1 } });
    const names = s.declarations.map((d) => d.name);
    expect(names).toContain("Node");
    expect(names).toContain("Node2");
    expect(names).toContain("Root2");
    expect(new Set(names).size).toBe(names.length);
  });

  it("reuses one type for identical shapes", () => {
    const s = buildSchema({ billing: { street: "a" }, shipping: { street: "b" } });
    expect(s.declarations.map((d) => d.name)).toEqual(["Billing", "Root"]);
  });

  it("uses the sanitized root name", () => {
    expect(buildSchema({ a: 1 }, { rootName: "api response" }).rootName).toBe("ApiResponse");
    expect(buildSchema({ a: 1 }, { rootName: "" }).rootName).toBe("Root");
  });

  it("orders declarations top-down for reading", () => {
    const s = buildSchema({ user: { address: { city: "x" } }, tags: [{ n: 1 }] });
    expect(topDownDeclarations(s).map((d) => d.name)).toEqual(["Root", "User", "Address", "Tag"]);
  });
});
