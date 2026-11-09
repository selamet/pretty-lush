import { describe, expect, it } from "vitest";
import { LANGUAGES } from "../languages/registry.js";
import { TEXT_TOOLS } from "../commands/text-tools.js";
import {
  HOME_ROUTE,
  LANGUAGE_ROUTES,
  POPULAR_ROUTES,
  ROUTES,
  TOOL_ROUTES,
  canonicalUrl,
  getRouteBySlug,
  hasShareHash,
  pathForLang,
  routeForPath,
  titleForLang,
} from "./routes.js";

const ALL = [HOME_ROUTE, ...ROUTES];

describe("route table", () => {
  it("has a landing page for every language", () => {
    for (const lang of LANGUAGES) {
      const route = LANGUAGE_ROUTES.find((r) => r.lang === lang.id);
      expect(route, lang.id).toBeTruthy();
      expect(route.path).toBe(`/${lang.id}-formatter`);
    }
    expect(LANGUAGE_ROUTES).toHaveLength(LANGUAGES.length);
  });

  it("maps every tool page to a real feature", () => {
    const known = new Set(["regex", "typegen-typescript", "schema", "curl", "jwt", "cron"]);
    for (const r of TOOL_ROUTES) {
      expect(known.has(r.tool), r.slug).toBe(true);
      if (r.lang) expect(LANGUAGES.some((l) => l.id === r.lang), r.slug).toBe(true);
    }
    expect(TEXT_TOOLS.some((t) => t.id === "util-jwt" && t.modal === "jwt")).toBe(true);
    expect(TEXT_TOOLS.some((t) => t.id === "util-cron" && t.modal === "cron")).toBe(true);
    expect(getRouteBySlug("curl-converter").sample).toMatch(/^curl /);
  });

  it("uses valid, unique slugs", () => {
    const slugs = ROUTES.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const r of ROUTES) {
      expect(r.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(r.path).toBe(`/${r.slug}`);
      // Must not shadow built files or the API.
      expect(["api", "assets", "index"]).not.toContain(r.slug);
    }
  });

  it("has unique, reasonably sized titles and descriptions", () => {
    const titles = ALL.map((r) => r.title);
    const descriptions = ALL.map((r) => r.description);
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(descriptions).size).toBe(descriptions.length);
    for (const r of ALL) {
      expect(r.title.length, r.title).toBeLessThanOrEqual(75);
      expect(r.description.length, r.slug).toBeGreaterThanOrEqual(80);
      expect(r.description.length, r.slug).toBeLessThanOrEqual(170);
      expect(r.heading && r.intro, r.slug).toBeTruthy();
    }
  });

  it("lists only existing routes as popular", () => {
    expect(POPULAR_ROUTES.every(Boolean)).toBe(true);
  });
});

describe("routeForPath", () => {
  it("resolves landing paths with or without trailing slash / index.html", () => {
    expect(routeForPath("/json-formatter").lang).toBe("json");
    expect(routeForPath("/json-formatter/").lang).toBe("json");
    expect(routeForPath("/json-formatter/index.html").lang).toBe("json");
    expect(routeForPath("/Regex-Tester").tool).toBe("regex");
  });

  it("returns null for home and unknown paths", () => {
    expect(routeForPath("/")).toBeNull();
    expect(routeForPath("")).toBeNull();
    expect(routeForPath("/nope")).toBeNull();
    expect(routeForPath(undefined)).toBeNull();
  });
});

describe("language helpers", () => {
  it("maps languages to their landing path and title", () => {
    expect(pathForLang("python")).toBe("/python-formatter");
    expect(pathForLang("unknown")).toBe("/");
    expect(titleForLang("yaml")).toBe(getRouteBySlug("yaml-formatter").title);
    expect(titleForLang("unknown")).toBe(HOME_ROUTE.title);
  });

  it("builds canonical URLs without trailing slashes", () => {
    expect(canonicalUrl(HOME_ROUTE)).toBe("https://pretty-lush.selamet.dev/");
    expect(canonicalUrl(getRouteBySlug("jwt-decoder"))).toBe(
      "https://pretty-lush.selamet.dev/jwt-decoder"
    );
  });

  it("detects share hashes", () => {
    expect(hasShareHash("#s=abc")).toBe(true);
    expect(hasShareHash("#p=abcd.key")).toBe(true);
    expect(hasShareHash("#section")).toBe(false);
    expect(hasShareHash("")).toBe(false);
  });
});
