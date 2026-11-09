// Build-time rendering of the landing pages: takes the built index.html and
// returns a copy with route-specific <title>, meta description, canonical,
// Open Graph / Twitter tags, JSON-LD and a static, crawlable intro inside
// #root (React replaces it on mount). Also builds sitemap.xml.
// Pure string functions so they can be unit-tested without a build.
import {
  HOME_ROUTE,
  LANGUAGE_ROUTES,
  ROUTES,
  SITE_NAME,
  SITE_URL,
  TOOL_ROUTES,
  canonicalUrl,
  routeForPath,
} from "./routes.js";

const OG_IMAGE = `${SITE_URL}/og.svg`;

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// JSON for a <script type="application/ld+json"> block; `<` is escaped so the
// content can never close the script element.
function jsonLd(data) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function structuredData(route) {
  const url = canonicalUrl(route);
  const graph = [
    {
      "@type": "WebApplication",
      "@id": `${url}#app`,
      name: route.kind === "home" ? SITE_NAME : `${route.name} — ${SITE_NAME}`,
      url,
      description: route.description,
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Any",
      browserRequirements: "Requires JavaScript",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      image: OG_IMAGE,
    },
  ];
  if (route.faq.length > 0) {
    graph.push({
      "@type": "FAQPage",
      "@id": `${url}#faq`,
      mainEntity: route.faq.map(({ q, a }) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}

export function headTags(route) {
  const url = canonicalUrl(route);
  const title = escapeHtml(route.title);
  const description = escapeHtml(route.description);
  return [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${OG_IMAGE}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${OG_IMAGE}" />`,
    `<script type="application/ld+json">${jsonLd(structuredData(route))}</script>`,
  ].join("\n    ");
}

function linkList(routes, current) {
  return routes
    .map((r) => {
      const here = r.slug === current.slug ? ' aria-current="page"' : "";
      return `<li><a href="${r.path}"${here}>${escapeHtml(r.name)}</a></li>`;
    })
    .join("");
}

// Crawlable content shown until the app mounts (and to clients without JS).
export function staticBody(route) {
  const faq = route.faq.length
    ? `<section><h2>FAQ</h2><dl>${route.faq
        .map(({ q, a }) => `<dt>${escapeHtml(q)}</dt><dd>${escapeHtml(a)}</dd>`)
        .join("")}</dl></section>`
    : "";
  return [
    `<main class="seo-static">`,
    `<p class="seo-static-brand"><a href="/">${SITE_NAME}</a></p>`,
    `<h1>${escapeHtml(route.heading)}</h1>`,
    `<p>${escapeHtml(route.intro)}</p>`,
    `<noscript><p class="seo-static-note">The editor needs JavaScript. Enable it to format code in your browser.</p></noscript>`,
    faq,
    `<nav aria-label="All tools"><h2>Formatters</h2><ul>${linkList(LANGUAGE_ROUTES, route)}</ul>`,
    `<h2>Tools</h2><ul>${linkList(TOOL_ROUTES, route)}</ul></nav>`,
    `</main>`,
  ].join("");
}

// Tags in index.html that headTags() replaces.
const REPLACED_HEAD = [
  /\s*<title>[\s\S]*?<\/title>/g,
  /\s*<meta\s+(?:name|property)="(?:description|og:[\w:]+|twitter:[\w:]+)"[\s\S]*?\/?>/g,
  /\s*<link\s+rel="canonical"[\s\S]*?\/?>/g,
  /\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/g,
];

export function renderLandingHtml(template, route) {
  let html = template;
  for (const re of REPLACED_HEAD) html = html.replace(re, "");
  if (!html.includes("</head>") || !/<div id="root"><\/div>/.test(html)) {
    throw new Error("index.html template must contain </head> and an empty <div id=\"root\"></div>");
  }
  html = html.replace("</head>", `    ${headTags(route)}\n  </head>`);
  html = html.replace(/<div id="root"><\/div>/, `<div id="root">${staticBody(route)}</div>`);
  return html;
}

export function buildSitemap() {
  const urls = [HOME_ROUTE, ...ROUTES].map((r) => {
    const priority = r.kind === "home" ? "1.0" : r.kind === "language" ? "0.8" : "0.7";
    return [
      "  <url>",
      `    <loc>${canonicalUrl(r)}</loc>`,
      "    <changefreq>weekly</changefreq>",
      `    <priority>${priority}</priority>`,
      "  </url>",
    ].join("\n");
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
    "",
  ].join("\n");
}

// Vite plugins: the build one rewrites the built index.html for the home
// page and emits `<slug>/index.html` for every landing route plus
// sitemap.xml; the preview one serves those files for `/<slug>` (no
// trailing slash), like the production host does.
export function landingPagesPlugin() {
  return [landingBuildPlugin(), landingPreviewPlugin()];
}

function landingPreviewPlugin() {
  return {
    name: "pretty-lush-landing-pages-preview",
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        const [pathname, query = ""] = (req.url || "").split("?");
        const route = routeForPath(pathname);
        if (route && pathname === route.path) {
          req.url = `${route.path}/index.html${query ? `?${query}` : ""}`;
        }
        next();
      });
    },
  };
}

function landingBuildPlugin() {
  return {
    name: "pretty-lush-landing-pages",
    apply: "build",
    enforce: "post",
    generateBundle(_options, bundle) {
      const index = bundle["index.html"];
      if (!index || index.type !== "asset") {
        this.error("landing pages: index.html missing from the bundle");
      }
      const template = String(index.source);
      index.source = renderLandingHtml(template, HOME_ROUTE);
      for (const route of ROUTES) {
        this.emitFile({
          type: "asset",
          fileName: `${route.slug}/index.html`,
          source: renderLandingHtml(template, route),
        });
      }
      this.emitFile({ type: "asset", fileName: "sitemap.xml", source: buildSitemap() });
    },
  };
}

// Built landing files, for the service worker's precache ignore list.
export const LANDING_PAGE_FILES = ROUTES.map((r) => `${r.slug}/index.html`);
