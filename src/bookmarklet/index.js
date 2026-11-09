// "Format in Pretty Lush" bookmarklet.
//
// The bookmarklet runs on any page, so it must stay tiny and self-contained:
// it never loads a script (pages with a strict CSP would block that), it only
// reads the page and opens Pretty Lush in a new tab. The snippet travels in
// the existing URL-only share hash (`#s=`, see ../share/url-share.js): url-safe
// base64 of UTF-8 JSON, no compression, so the bookmarklet can produce it with
// built-ins. Its payload is `{ input, via: "bookmarklet", truncated? }` — no
// `lang`, the app detects it — and `readBookmarkletPayload` recognises it.
//
// What gets sent, in order: the page selection; else the focused textarea /
// text input (its selection, else its whole value; never password fields);
// else the only <pre> on the page (or the only <code>); else nothing, which
// opens an empty tab.

// Selections longer than this are cut (and the app says so in a toast).
// Characters, not bytes: ~1 MB of ASCII, ~1.4 MB of URL after base64 —
// under Chrome's 2 MB URL limit.
export const BOOKMARKLET_MAX_CHARS = 1_000_000;
export const BOOKMARKLET_VIA = "bookmarklet";
export const BOOKMARKLET_LABEL = "Format in Pretty Lush";

// Hand-minified (a bundler must not rename or reorder it). `__ORIGIN__` is
// replaced with the JSON-quoted origin of the running app, so previews and
// local dev builds produce bookmarklets that point back at themselves.
const SOURCE =
  "(()=>{var w=window,d=document,s=String(w.getSelection()||''),a=d.activeElement,p,o,u,M=__MAX__;" +
  "if(!s.trim()&&a&&/^(TEXTAREA|INPUT)$/.test(a.tagName)&&a.type!='password'){" +
  "try{s=a.value.slice(a.selectionStart,a.selectionEnd)}catch(e){}if(!s.trim())s=a.value}" +
  "if(!s.trim()){p=d.querySelectorAll('pre');if(p.length!=1)p=d.querySelectorAll('code');" +
  "s=p.length==1?p[0].textContent:''}" +
  "o={input:s.slice(0,M),via:'bookmarklet'};if(s.length>M)o.truncated=1;" +
  "if(o.input.toWellFormed)o.input=o.input.toWellFormed();" +
  "u=__ORIGIN__+'/#s='+btoa(unescape(encodeURIComponent(JSON.stringify(o))))" +
  ".replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'');" +
  "w.open(u,'_blank')||(location.href=u)})()";

/** The bookmarklet's JavaScript (without the `javascript:` scheme). */
export function bookmarkletSource(origin) {
  if (typeof origin !== "string" || !/^https?:\/\/[^/\s"'\\]+$/.test(origin)) {
    throw new Error(`Invalid origin for bookmarklet: ${origin}`);
  }
  return SOURCE.replace("__MAX__", String(BOOKMARKLET_MAX_CHARS)).replace(
    "__ORIGIN__",
    JSON.stringify(origin)
  );
}

/**
 * `javascript:` URL for the bookmark. `%` and `#` are escaped: browsers
 * percent-decode the URL before running it, and a raw `#` would start a
 * fragment.
 */
export function buildBookmarklet(origin) {
  const code = bookmarkletSource(origin).replace(/%/g, "%25").replace(/#/g, "%23");
  return `javascript:${code}`;
}

/**
 * Recognises a decoded `#s=` payload sent by the bookmarklet. Returns
 * `{ input, truncated }` or null for regular share links / garbage. The
 * input is capped again here, so a hand-made link can't exceed the limit.
 */
export function readBookmarkletPayload(decoded) {
  if (!decoded || typeof decoded !== "object" || decoded.via !== BOOKMARKLET_VIA) return null;
  if (typeof decoded.input !== "string") return null;
  let input = decoded.input;
  let truncated = !!decoded.truncated;
  if (input.length > BOOKMARKLET_MAX_CHARS) {
    input = input.slice(0, BOOKMARKLET_MAX_CHARS);
    truncated = true;
  }
  return { input, truncated };
}
