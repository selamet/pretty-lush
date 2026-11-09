import { describe, expect, it } from "vitest";
import { HOME_ROUTE, ROUTES, getRouteBySlug } from "./routes.js";
import { buildSitemap, escapeHtml, renderLandingHtml, structuredData } from "./render.js";

const TEMPLATE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Old title</title>
    <meta
      name="description"
      content="Old description"
    />
    <meta name="theme-color" content="#1f6f4a" />
    <meta property="og:title" content="Old" />
    <meta name="twitter:title" content="Old" />
    <script type="module" crossorigin src="/assets/index-abc.js"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

function count(html, needle) {
  return html.split(needle).length - 1;
}

describe("renderLandingHtml", () => {
  const route = getRouteBySlug("json-formatter");
  const html = renderLandingHtml(TEMPLATE, route);

  it("replaces title, description and social tags exactly once", () => {
    expect(html).not.toContain("Old");
    expect(count(html, "<title>")).toBe(1);
    expect(html).toContain(`<title>${escapeHtml(route.title)}</title>`);
    expect(count(html, 'name="description"')).toBe(1);
    expect(count(html, 'property="og:title"')).toBe(1);
    expect(count(html, 'name="twitter:title"')).toBe(1);
    expect(html).toContain('<link rel="canonical" href="https://pretty-lush.selamet.dev/json-formatter" />');
    expect(html).toContain('content="https://pretty-lush.selamet.dev/json-formatter"');
  });

  it("keeps unrelated head tags and the app script", () => {
    expect(html).toContain('name="theme-color"');
    expect(html).toContain('src="/assets/index-abc.js"');
  });

  it("puts crawlable content and links in #root", () => {
    expect(html).toMatch(/<div id="root"><main class="seo-static">/);
    expect(html).toContain("<h1>JSON Formatter</h1>");
    for (const r of ROUTES) expect(html).toContain(`href="${r.path}"`);
    expect(html).toContain('href="/json-formatter" aria-current="page"');
  });

  it("embeds parseable JSON-LD", () => {
    const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    const data = JSON.parse(m[1]);
    const app = data["@graph"].find((n) => n["@type"] === "WebApplication");
    expect(app.url).toBe("https://pretty-lush.selamet.dev/json-formatter");
    expect(data["@graph"].some((n) => n["@type"] === "FAQPage")).toBe(true);
  });

  it("is idempotent when rendered over its own output", () => {
    const once = renderLandingHtml(TEMPLATE, HOME_ROUTE);
    expect(once).toContain('href="https://pretty-lush.selamet.dev/"');
    expect(() => renderLandingHtml(once, route)).toThrow(/root/);
  });

  it("produces unique heads for every route", () => {
    const heads = ROUTES.map((r) => renderLandingHtml(TEMPLATE, r).split("</head>")[0]);
    expect(new Set(heads).size).toBe(ROUTES.length);
  });
});

describe("structuredData", () => {
  it("escapes < so JSON-LD can't close its script tag", () => {
    const route = { ...HOME_ROUTE, description: "</script><b>" };
    const html = renderLandingHtml(TEMPLATE, route);
    expect(html).not.toContain("</script><b>");
    expect(structuredData(route)["@graph"][0].description).toBe("</script><b>");
  });
});

describe("buildSitemap", () => {
  it("lists home and every route once", () => {
    const xml = buildSitemap();
    expect(count(xml, "<url>")).toBe(ROUTES.length + 1);
    expect(xml).toContain("<loc>https://pretty-lush.selamet.dev/</loc>");
    for (const r of ROUTES) {
      expect(count(xml, `<loc>https://pretty-lush.selamet.dev${r.path}</loc>`)).toBe(1);
    }
  });
});
