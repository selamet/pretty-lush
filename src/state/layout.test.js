import { describe, it, expect } from "vitest";
import {
  DEFAULT_LAYOUT,
  INPUT_FR_MAX,
  INPUT_FR_MIN,
  SIDEBAR_MAX,
  SIDEBAR_MIN,
  clampSidebarWidth,
  inputFrFromDrag,
  inputPxFromFr,
  loadLayout,
} from "./layout.js";
import { STORAGE_KEYS } from "./storage.js";
import { fakeStorage, throwingStorage } from "../test/fake-storage.js";

const stored = (v) => fakeStorage({ [STORAGE_KEYS.layout]: JSON.stringify(v) });

describe("loadLayout", () => {
  it("returns the default layout when empty, corrupt or unavailable", () => {
    expect(loadLayout(fakeStorage())).toEqual(DEFAULT_LAYOUT);
    expect(loadLayout(fakeStorage({ [STORAGE_KEYS.layout]: "x" }))).toEqual(DEFAULT_LAYOUT);
    expect(loadLayout(throwingStorage)).toEqual(DEFAULT_LAYOUT);
  });

  it("clamps stored values into range", () => {
    expect(loadLayout(stored({ sidebarW: 9999, inputFr: 99 }))).toEqual({
      sidebarW: SIDEBAR_MAX,
      inputFr: INPUT_FR_MAX,
    });
    expect(loadLayout(stored({ sidebarW: 10, inputFr: 0.01 }))).toEqual({
      sidebarW: SIDEBAR_MIN,
      inputFr: INPUT_FR_MIN,
    });
  });

  it("replaces invalid fields individually", () => {
    expect(loadLayout(stored({ sidebarW: "wide", inputFr: -1 }))).toEqual(DEFAULT_LAYOUT);
    expect(loadLayout(stored({ sidebarW: 300 }))).toEqual({ sidebarW: 300, inputFr: 1 });
  });
});

describe("layout math", () => {
  it("clamps the sidebar width", () => {
    expect(clampSidebarWidth(250)).toBe(250);
    expect(clampSidebarWidth(0)).toBe(SIDEBAR_MIN);
    expect(clampSidebarWidth(1e6)).toBe(SIDEBAR_MAX);
  });

  it("converts between ratio and pixels", () => {
    expect(inputPxFromFr(1, 1000)).toBe(500);
    expect(inputFrFromDrag(1000, 500, 0)).toBe(1);
    expect(inputFrFromDrag(1000, 500, 100)).toBeCloseTo(600 / 400);
  });

  it("keeps both panes at least 80px wide", () => {
    expect(inputFrFromDrag(1000, 500, -1000)).toBe(INPUT_FR_MIN);
    expect(inputFrFromDrag(200, 100, 1000)).toBe(120 / 80);
    expect(inputFrFromDrag(1000, 500, 1000)).toBe(INPUT_FR_MAX);
  });
});
