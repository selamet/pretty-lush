// URL-fragment share: encode a state object to a url-safe base64 string and
// decode it back. Used by the "Copy URL" share mode; the snippet lives
// entirely in the page fragment and never touches the server.

export function encodeShare(state) {
  const json = JSON.stringify(state);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeShare(hash) {
  try {
    let b64 = hash.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const json = decodeURIComponent(escape(atob(b64)));
    return JSON.parse(json);
  } catch {
    return null;
  }
}
