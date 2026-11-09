import { describe, expect, it } from "vitest";
import { generateFromValue } from "./index.js";
import { pyFieldName } from "./pydantic.js";

const py = (value, opts) => generateFromValue("pydantic", value, opts);

describe("Pydantic emitter", () => {
  it("emits models in dependency order with only the imports it needs", () => {
    expect(py({ id: 1, price: 2.5, ok: true, owner: { name: "a" } })).toBe(
      [
        "from pydantic import BaseModel",
        "",
        "",
        "class Owner(BaseModel):",
        "    name: str",
        "",
        "",
        "class Root(BaseModel):",
        "    id: int",
        "    price: float",
        "    ok: bool",
        "    owner: Owner",
        "",
      ].join("\n")
    );
  });

  it("detects ints vs floats across samples", () => {
    const out = py([{ a: 1, b: 1 }, { a: 2, b: 2.5 }]);
    expect(out).toContain("    a: int");
    expect(out).toContain("    b: float");
  });

  it("uses `| None` for nullable and `= None` for optional fields", () => {
    const out = py([{ a: "x", b: 1 }, { a: null }]);
    expect(out).toContain("    a: str | None\n");
    expect(out).toContain("    b: int | None = None\n");
  });

  it("maps ISO date-times to datetime", () => {
    const out = py({ created_at: "2024-01-02T03:04:05Z" });
    expect(out).toMatch(/^from datetime import datetime\n\nfrom pydantic import BaseModel/);
    expect(out).toContain("    created_at: datetime");
  });

  it("handles empty arrays, empty objects and unions", () => {
    const out = py({ e: [], m: {}, u: [1, "a", null], n: null });
    expect(out).toContain("from typing import Any");
    expect(out).toContain("    e: list[Any]");
    expect(out).toContain("    m: dict[str, Any]");
    expect(out).toContain("    u: list[str | int | None]");
    expect(out).toContain("    n: None");
  });

  it("handles nested arrays of objects", () => {
    const out = py({ matrix: [[{ x: 1 }], [{ x: 2, y: 3 }]] });
    expect(out).toContain("class MatrixItem(BaseModel):\n    x: int\n    y: int | None = None");
    expect(out).toContain("    matrix: list[list[MatrixItem]]");
  });

  it("wraps top-level arrays and primitives in RootModel", () => {
    expect(py([{ id: 1 }], { rootName: "Users" })).toBe(
      [
        "from pydantic import BaseModel, RootModel",
        "",
        "",
        "class User(BaseModel):",
        "    id: int",
        "",
        "",
        "class Users(RootModel[list[User]]):",
        "    pass",
        "",
      ].join("\n")
    );
    expect(py([])).toContain("class Root(RootModel[list[Any]]):");
    expect(py("x")).toBe("from pydantic import RootModel\n\n\nclass Root(RootModel[str]):\n    pass\n");
  });

  it("aliases keys that aren't usable field names", () => {
    const out = py({ "first-name": "a", class: "b", _id: "c", "2fa": true, json: 1, ok: 1 });
    expect(out).toContain("from pydantic import BaseModel, ConfigDict, Field");
    expect(out).toContain("    model_config = ConfigDict(populate_by_name=True)\n\n");
    expect(out).toContain('    first_name: str = Field(alias="first-name")');
    expect(out).toContain('    class_: str = Field(alias="class")');
    expect(out).toContain('    id: str = Field(alias="_id")');
    expect(out).toContain('    field_2fa: bool = Field(alias="2fa")');
    expect(out).toContain('    json_: int = Field(alias="json")');
    expect(out).toContain("    ok: int\n");
  });

  it("keeps the alias on optional aliased fields", () => {
    expect(py([{ "a-b": 1 }, {}])).toContain('    a_b: int | None = Field(default=None, alias="a-b")');
  });

  it("doesn't let field names shadow model classes", () => {
    const out = py({ Address: { city: "x" } });
    expect(out).toContain('    address: Address = Field(alias="Address")');
  });
});

describe("pyFieldName", () => {
  it("dedupes against names already taken", () => {
    expect(pyFieldName("a-b", new Set(["a_b"]))).toBe("a_b_");
    expect(pyFieldName("a_b", new Set(["a_b"]))).toBe("a_b_");
    expect(pyFieldName("", new Set())).toBe("field");
  });
});
