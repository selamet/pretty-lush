import { describe, expect, it } from "vitest";
import {
  BOOKMARKLET_MAX_CHARS,
  bookmarkletSource,
  buildBookmarklet,
  readBookmarkletPayload,
} from "./index.js";
import { decodeShare } from "../share/url-share.js";

const ORIGIN = "https://pretty-lush.selamet.dev";

// Runs the bookmarklet the way a browser would (percent-decoded `javascript:`
// URL) against a fake page and returns the URL it opened.
function runBookmarklet({ selection = "", active = null, pres = [], codes = [], popupBlocked = false } = {}) {
  const href = buildBookmarklet(ORIGIN);
  expect(href.startsWith("javascript:")).toBe(true);
  const code = decodeURIComponent(href.slice("javascript:".length));
  let opened = null;
  const location = { href: "https://example.com/page" };
  const window = {
    getSelection: () => ({ toString: () => selection }),
    open: (url, target) => {
      expect(target).toBe("_blank");
      opened = url;
      return popupBlocked ? null : {};
    },
  };
  const document = {
    activeElement: active,
    querySelectorAll: (sel) => (sel === "pre" ? pres : sel === "code" ? codes : []),
  };
  new Function("window", "document", "location", code)(window, document, location);
  return popupBlocked ? location.href : opened;
}

function payloadOf(url) {
  expect(url.startsWith(`${ORIGIN}/#s=`)).toBe(true);
  return readBookmarkletPayload(decodeShare(url.slice(`${ORIGIN}/#s=`.length)));
}

describe("bookmarklet builder", () => {
  it("stays small and loads no external script", () => {
    const href = buildBookmarklet(ORIGIN);
    expect(href.length).toBeLessThan(2048);
    expect(href).not.toMatch(/createElement|\.src\s*=|import\(|fetch\(/);
    // `#` would start a fragment of the javascript: URL.
    expect(href.slice(11)).not.toContain("#");
  });

  it("embeds the given origin so previews point at themselves", () => {
    expect(bookmarkletSource("http://localhost:5173")).toContain('"http://localhost:5173"');
    expect(() => bookmarkletSource("javascript:alert(1)")).toThrow();
    expect(() => bookmarkletSource('https://x.dev"+alert(1)+"')).toThrow();
  });
});

describe("bookmarklet round trip", () => {
  it("sends the page selection", () => {
    expect(payloadOf(runBookmarklet({ selection: '{"a":1}' }))).toEqual({
      input: '{"a":1}',
      truncated: false,
    });
  });

  it("keeps unicode and emoji intact", () => {
    const text = "const s = \"héllo wörld — 日本語 🎉👩‍💻\"; // ğüşıöç\n\ttab";
    expect(payloadOf(runBookmarklet({ selection: text })).input).toBe(text);
  });

  it("falls back to the focused textarea (its selection, then its value)", () => {
    const area = { tagName: "TEXTAREA", type: "textarea", value: "a: 1\nb: 2", selectionStart: 0, selectionEnd: 4 };
    expect(payloadOf(runBookmarklet({ active: area })).input).toBe("a: 1");
    expect(payloadOf(runBookmarklet({ active: { ...area, selectionEnd: 0 } })).input).toBe("a: 1\nb: 2");
  });

  it("never reads password fields", () => {
    const pw = { tagName: "INPUT", type: "password", value: "hunter2", selectionStart: 0, selectionEnd: 0 };
    expect(payloadOf(runBookmarklet({ active: pw })).input).toBe("");
  });

  it("falls back to the only <pre>, then the only <code>", () => {
    expect(payloadOf(runBookmarklet({ pres: [{ textContent: "SELECT 1" }] })).input).toBe("SELECT 1");
    expect(
      payloadOf(runBookmarklet({ pres: [{ textContent: "a" }, { textContent: "b" }], codes: [{ textContent: "x = 1" }] })).input
    ).toBe("x = 1");
    expect(
      payloadOf(runBookmarklet({ pres: [{ textContent: "a" }, { textContent: "b" }] })).input
    ).toBe("");
  });

  it("opens an empty snippet when there is nothing to send", () => {
    expect(payloadOf(runBookmarklet())).toEqual({ input: "", truncated: false });
  });

  it("caps large selections and flags the truncation", () => {
    const big = "x".repeat(BOOKMARKLET_MAX_CHARS + 10);
    const payload = payloadOf(runBookmarklet({ selection: big }));
    expect(payload.input.length).toBe(BOOKMARKLET_MAX_CHARS);
    expect(payload.truncated).toBe(true);
  });

  it("does not throw when the cap splits an emoji", () => {
    const big = "a".repeat(BOOKMARKLET_MAX_CHARS - 1) + "🎉";
    const payload = payloadOf(runBookmarklet({ selection: big }));
    expect(payload.truncated).toBe(true);
    expect(payload.input.length).toBe(BOOKMARKLET_MAX_CHARS);
  });

  it("navigates the current tab when the popup is blocked", () => {
    expect(payloadOf(runBookmarklet({ selection: "x", popupBlocked: true })).input).toBe("x");
  });
});

describe("readBookmarkletPayload", () => {
  it("ignores regular share links and garbage", () => {
    expect(readBookmarkletPayload({ lang: "json", input: "{}" })).toBeNull();
    expect(readBookmarkletPayload(null)).toBeNull();
    expect(readBookmarkletPayload({ via: "bookmarklet", input: 3 })).toBeNull();
  });

  it("re-applies the cap to hand-made links", () => {
    const payload = readBookmarkletPayload({
      via: "bookmarklet",
      input: "y".repeat(BOOKMARKLET_MAX_CHARS + 1),
    });
    expect(payload.input.length).toBe(BOOKMARKLET_MAX_CHARS);
    expect(payload.truncated).toBe(true);
  });
});
