import { useEffect, useState } from "react";
import { encryptShare, decryptShare } from "../share/crypto.js";
import { encodeShare, decodeShare } from "../share/url-share.js";
import { isKnownLang } from "../state/workspace.js";
import { readBookmarkletPayload } from "../bookmarklet/index.js";

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// Share dialog + incoming share links.
//
// Creating: URL-only links (`#s=…`, snippet in the fragment) or encrypted
// server pastes (`#p=<id>.<key>`). Loading: on mount, a `#s=` / `#p=` hash is
// consumed and its snippet handed to `openSnippet(lang, input)` (App opens it
// in a new tab), prompting for a password when the paste has one. A `#s=`
// link made by the bookmarklet (no language, `via: "bookmarklet"`) goes to
// `openBookmarklet({ input, truncated })` instead.
export function useShare({ lang, input, openSnippet, openBookmarklet, notify }) {
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState(null);
  const [pwPrompt, setPwPrompt] = useState(null);

  // restore from URL share hash on mount (one-shot)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith("#s=")) {
      const decoded = decodeShare(hash.slice(3));
      if (!decoded) return;
      const fromBookmarklet = readBookmarkletPayload(decoded);
      if (fromBookmarklet) {
        openBookmarklet(fromBookmarklet);
      } else if (typeof decoded.input === "string") {
        openSnippet(
          decoded.lang && isKnownLang(decoded.lang) ? decoded.lang : lang,
          decoded.input
        );
      }
      window.history.replaceState(null, "", window.location.pathname);
    } else if (hash.startsWith("#p=")) {
      const rest = hash.slice(3);
      const dot = rest.indexOf(".");
      if (dot < 4) return;
      const id = rest.slice(0, dot);
      const urlKey = rest.slice(dot + 1);
      if (!/^[A-Za-z0-9]{4,16}$/.test(id) || !urlKey) return;
      window.history.replaceState(null, "", window.location.pathname);
      loadServerPaste(id, urlKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadServerPaste(id, urlKey, password = null) {
    try {
      const res = await fetch(`/api/paste/${encodeURIComponent(id)}`);
      if (!res.ok) {
        const msg =
          res.status === 404
            ? "This share link has expired or does not exist."
            : `Could not load shared snippet (HTTP ${res.status}).`;
        notify({ kind: "err", message: msg });
        return;
      }
      const record = await res.json();

      if (record.hasPassword && !password) {
        setPwPrompt({ id, urlKey, record, busy: false, error: null });
        return;
      }

      try {
        const plaintext = await decryptShare({
          ciphertext: record.ciphertext,
          iv: record.iv,
          salt: record.salt,
          hasPassword: record.hasPassword,
          urlKey,
          password,
        });
        const targetLang =
          record.lang && isKnownLang(record.lang) ? record.lang : lang;
        openSnippet(targetLang, plaintext);
        setPwPrompt(null);
        notify({ kind: "ok", message: "Shared snippet loaded" });
      } catch (e) {
        if (record.hasPassword) {
          setPwPrompt((p) => ({
            ...(p || { id, urlKey, record }),
            busy: false,
            error: e.message || "Wrong password",
          }));
        } else {
          notify({ kind: "err", message: e.message || "Decryption failed" });
        }
      }
    } catch (e) {
      notify({ kind: "err", message: "Network error loading snippet" });
    }
  }

  function openShareDialog() {
    if (!input.trim()) return;
    setShareError(null);
    setShareDialogOpen(true);
  }

  function closeShareDialog() {
    if (!shareBusy) {
      setShareDialogOpen(false);
      setShareError(null);
    }
  }

  async function createShare({ mode, password, ttl, burnAfterRead }) {
    setShareBusy(true);
    setShareError(null);
    try {
      if (mode === "url") {
        const payload = encodeShare({ lang, input });
        const url = `${window.location.origin}${window.location.pathname}#s=${payload}`;
        const sizeKB = (url.length / 1024).toFixed(1);
        const ok = await copyToClipboard(url);
        setShareDialogOpen(false);
        if (!ok) {
          notify({ kind: "err", message: "Could not copy link" });
        } else if (url.length > 8192) {
          notify({
            kind: "warn",
            message: `Link copied (${sizeKB} KB — some chat apps may reject it)`,
          });
        } else {
          notify({ kind: "ok", message: "Share link copied" });
        }
      } else {
        const enc = await encryptShare(input, password);
        const res = await fetch("/api/paste", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ciphertext: enc.ciphertext,
            iv: enc.iv,
            salt: enc.salt,
            hasPassword: enc.hasPassword,
            lang,
            ttl,
            burnAfterRead: !!burnAfterRead,
          }),
        });
        if (!res.ok) {
          let msg = `Server rejected the snippet (HTTP ${res.status})`;
          let code = null;
          try {
            const body = await res.json();
            if (body?.error) msg = body.error;
            if (body?.code) code = body.code;
          } catch {}
          setShareError({
            message: msg,
            code,
            suggestUrl: res.status === 503 || code === "STORE_UNAVAILABLE",
          });
          return;
        }
        const { id } = await res.json();
        const url = `${window.location.origin}${window.location.pathname}#p=${id}.${enc.urlKey}`;
        const ok = await copyToClipboard(url);
        setShareDialogOpen(false);
        notify({
          kind: ok ? "ok" : "warn",
          message: ok
            ? password
              ? "Encrypted link copied. Share the password separately."
              : "Encrypted link copied"
            : "Link created but clipboard write failed",
        });
      }
    } catch (e) {
      setShareError(e?.message || "Something went wrong");
    } finally {
      setShareBusy(false);
    }
  }

  async function submitPassword(password) {
    if (!pwPrompt) return;
    setPwPrompt((p) => ({ ...p, busy: true, error: null }));
    await loadServerPaste(pwPrompt.id, pwPrompt.urlKey, password);
  }

  function cancelPassword() {
    setPwPrompt(null);
  }

  return {
    shareDialogOpen,
    shareBusy,
    shareError,
    openShareDialog,
    closeShareDialog,
    createShare,
    pwPrompt,
    submitPassword,
    cancelPassword,
  };
}
