// cURL command → request model consumed by the emitters in this folder.
//
// The model:
//   {
//     method: "GET" | "POST" | …,
//     url: string,                  // query from -G data already appended
//     headers: [name, value][],     // in command order, original casing
//     body: null
//       | { kind: "raw", text }     // -d / --data-* / --json, joined
//       | { kind: "file", path }    // -d @file / --data-binary @file
//       | { kind: "form", fields }  // -F: { name, value } | { name, file, type?, filename? }
//     auth: null | { user, password },
//     cookies: [name, value][],     // -b "a=1; b=2"
//     insecure, followRedirects, compressed: boolean,
//     timeout: number | null,       // seconds (-m / --max-time)
//     warnings: string[],           // unsupported / ignored options
//   }
import { FormatError } from "../formatters/errors.js";
import { tokenizeShell } from "./tokenize.js";

// Options that take a value, by canonical name. Short aliases below.
const VALUE_OPTIONS = new Set([
  "request", "url", "header", "data", "data-ascii", "data-raw", "data-binary",
  "data-urlencode", "json", "form", "form-string", "user", "cookie", "user-agent",
  "referer", "max-time", "oauth2-bearer",
  // accepted and ignored, but their value must be skipped
  "output", "write-out", "connect-timeout", "retry", "retry-delay", "retry-max-time",
  "cookie-jar", "cacert", "capath", "cert", "cert-type", "key", "key-type", "pass",
  "proxy", "proxy-user", "resolve", "connect-to", "interface", "limit-rate",
  "max-redirs", "range", "upload-file", "config", "dump-header", "trace",
  "trace-ascii", "stderr", "local-port", "dns-servers", "ciphers", "tls-max",
  "expect100-timeout", "keepalive-time", "max-filesize", "speed-limit",
  "speed-time", "time-cond", "unix-socket", "abstract-unix-socket", "aws-sigv4",
  "request-target", "preproxy", "noproxy", "socks5", "socks5-hostname",
]);

const SHORT = {
  X: "request",
  H: "header",
  d: "data",
  F: "form",
  u: "user",
  b: "cookie",
  A: "user-agent",
  e: "referer",
  m: "max-time",
  G: "get",
  I: "head",
  L: "location",
  k: "insecure",
  s: "silent",
  S: "show-error",
  v: "verbose",
  i: "include",
  f: "fail",
  g: "globoff",
  N: "no-buffer",
  o: "output",
  O: "remote-name",
  w: "write-out",
  c: "cookie-jar",
  E: "cert",
  x: "proxy",
  U: "proxy-user",
  r: "range",
  T: "upload-file",
  K: "config",
  D: "dump-header",
  y: "speed-time",
  Y: "speed-limit",
  z: "time-cond",
  "#": "progress-bar",
  0: "http1.0",
  1: "tlsv1",
  4: "ipv4",
  6: "ipv6",
  // `-j` (junk session cookies), `-J` (remote header name), `-Z` (parallel)
  j: "junk-session-cookies",
  J: "remote-header-name",
  Z: "parallel",
};

// Long names of boolean options, for `--no-<name>` negations.
const BOOL_NAMES = new Set(Object.values(SHORT).filter((n) => !VALUE_OPTIONS.has(n)));

// Boolean options that change nothing in the generated code.
const SILENT_FLAGS = new Set([
  "silent", "show-error", "verbose", "include", "fail", "fail-with-body", "globoff",
  "no-buffer", "remote-name", "progress-bar", "http1.0", "http1.1", "http2",
  "http2-prior-knowledge", "http3", "tlsv1", "tlsv1.0", "tlsv1.1", "tlsv1.2",
  "tlsv1.3", "ipv4", "ipv6", "compressed", "location", "location-trusted",
  "path-as-is", "junk-session-cookies", "remote-header-name", "parallel",
  "no-keepalive", "tcp-nodelay", "tcp-fastopen", "no-progress-meter", "styled-output",
  "no-styled-output", "raw", "no-alpn", "no-npn", "no-sessionid", "ssl-reqd",
  "ssl", "create-dirs", "remote-time", "retry-connrefused", "retry-all-errors",
  "disable", "suppress-connect-headers", "basic", "anyauth",
]);

// Ignored options whose value or effect matters enough to tell the user.
const WARN_IGNORED = {
  "proxy": "a proxy",
  "proxy-user": "proxy credentials",
  "upload-file": "uploading a file with -T",
  "range": "a byte range",
  "cert": "a client certificate",
  "key": "a client key",
  "cacert": "a CA certificate",
  "capath": "a CA certificate directory",
  "config": "a config file",
  "resolve": "a custom DNS resolve",
  "connect-to": "a connect-to override",
  "unix-socket": "a Unix socket",
  "abstract-unix-socket": "a Unix socket",
  "aws-sigv4": "AWS SigV4 signing",
  "request-target": "a custom request target",
  "time-cond": "a time condition",
  "cookie-jar": "a cookie jar",
  "digest": "Digest auth",
  "ntlm": "NTLM auth",
  "negotiate": "Negotiate auth",
};

function urlEncode(s) {
  // curl --data-urlencode: application/x-www-form-urlencoded, spaces → %20
  // (curl uses %20, not +).
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

const FORM_PARAM = /^;\s*(type|filename|headers|encoder)=/;

// Reads one `-F` word at `i`: a double-quoted string (with \" and \\
// escapes, as Postman emits them) or text up to the next `;param=`.
function readFormWord(s, i) {
  if (s[i] === '"') {
    let out = "";
    let j = i + 1;
    while (j < s.length) {
      const c = s[j];
      if (c === "\\" && (s[j + 1] === '"' || s[j + 1] === "\\")) {
        out += s[j + 1];
        j += 2;
        continue;
      }
      if (c === '"') return [out, j + 1];
      out += c;
      j++;
    }
    return [out, j];
  }
  let j = i;
  while (j < s.length && !(s[j] === ";" && FORM_PARAM.test(s.slice(j)))) j++;
  return [s.slice(i, j), j];
}

// Splits a `-F` value: `name=value`, `name=@file;type=x;filename=y`,
// `name=<file`, `name="quoted value"`, `name=@"quoted path"`.
function parseFormField(spec, literal) {
  const eq = spec.indexOf("=");
  if (eq < 0) return null;
  const name = spec.slice(0, eq);
  const rest = spec.slice(eq + 1);
  if (literal) return { name, value: rest };
  const prefix = rest[0] === "@" || rest[0] === "<" ? rest[0] : "";
  let [value, pos] = readFormWord(rest, prefix.length);
  let type = null;
  let filename = null;
  // `;type=` / `;filename=` params apply to file parts (and plain values).
  while (pos < rest.length) {
    const m = FORM_PARAM.exec(rest.slice(pos));
    if (!m) {
      value += rest.slice(pos);
      break;
    }
    const [v, next] = readFormWord(rest, pos + m[0].length);
    if (m[1] === "type") type = v;
    else if (m[1] === "filename") filename = v;
    pos = next;
  }
  if (prefix === "@") return { name, file: value, type, filename };
  if (prefix === "<") return { name, file: value, type, filename, inline: true };
  return { name, value, type };
}

function parseCookies(text) {
  return text
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((pair) => {
      const eq = pair.indexOf("=");
      return eq < 0 ? [pair, ""] : [pair.slice(0, eq).trim(), pair.slice(eq + 1).trim()];
    });
}

function hasHeader(headers, name) {
  const lower = name.toLowerCase();
  return headers.some(([n]) => n.toLowerCase() === lower);
}

export function getHeader(headers, name) {
  const lower = name.toLowerCase();
  const found = headers.find(([n]) => n.toLowerCase() === lower);
  return found ? found[1] : null;
}

// Expands the words of the command into [option, value] pairs and
// positionals. Short clusters (`-sSL`, `-XPOST`, `-d@file`) are split.
function* readOptions(words, warnings) {
  let i = 0;
  while (i < words.length) {
    const w = words[i++];
    if (w === "--") {
      while (i < words.length) yield { positional: words[i++] };
      return;
    }
    if (w.startsWith("--") && w.length > 2) {
      let name = w.slice(2);
      let inline = null;
      if (!VALUE_OPTIONS.has(name) && name.includes("=")) {
        const eq = name.indexOf("=");
        if (VALUE_OPTIONS.has(name.slice(0, eq))) {
          inline = name.slice(eq + 1);
          name = name.slice(0, eq);
        }
      }
      if (VALUE_OPTIONS.has(name)) {
        const value = inline ?? words[i++];
        if (value === undefined) {
          warnings.push(`Option --${name} is missing its value`);
          return;
        }
        yield { name, value, flag: w };
      } else {
        yield { name, flag: w };
      }
      continue;
    }
    if (w.startsWith("-") && w.length > 1) {
      // Short option cluster.
      for (let j = 1; j < w.length; j++) {
        const c = w[j];
        const name = SHORT[c];
        if (!name) {
          yield { name: null, flag: `-${c}` };
          continue;
        }
        if (VALUE_OPTIONS.has(name)) {
          const rest = w.slice(j + 1);
          const value = rest !== "" ? rest : words[i++];
          if (value === undefined) {
            warnings.push(`Option -${c} is missing its value`);
            return;
          }
          yield { name, value, flag: `-${c}` };
          break;
        }
        yield { name, flag: `-${c}` };
      }
      continue;
    }
    yield { positional: w };
  }
}

/**
 * Parses a cURL command line. Throws FormatError when the text is not a
 * cURL command or has no URL.
 */
export function parseCurl(text) {
  if (!text || !text.trim()) {
    throw new FormatError("Input is empty — paste a cURL command.");
  }
  const { words, stoppedAt } = tokenizeShell(text.trim());
  const warnings = [];
  let start = 0;
  if (words[0] === "$") start = 1; // copied with a shell prompt
  const cmd = (words[start] || "").replace(/^.*[\\/]/, "").toLowerCase();
  if (cmd !== "curl" && cmd !== "curl.exe") {
    throw new FormatError("Not a cURL command — it should start with `curl`.", {
      hint: "Paste a command like: curl https://api.example.com -H 'Accept: application/json'",
    });
  }
  if (stoppedAt) {
    warnings.push(
      `Ignored everything after the unquoted \`${stoppedAt}\` (quote URLs that contain & or ?)`
    );
  }

  let method = null;
  const urls = [];
  const headers = [];
  const dataParts = []; // { text } | { file }
  let jsonMode = false;
  const formFields = [];
  let auth = null;
  const cookies = [];
  let useGet = false;
  let head = false;
  let insecure = false;
  let followRedirects = false;
  let compressed = false;
  let timeout = null;

  for (const opt of readOptions(words.slice(start + 1), warnings)) {
    if ("positional" in opt) {
      urls.push(opt.positional);
      continue;
    }
    const { name, value, flag } = opt;
    switch (name) {
      case "request":
        method = value.toUpperCase();
        break;
      case "url":
        urls.push(value);
        break;
      case "header": {
        const colon = value.indexOf(":");
        if (colon < 0) {
          // `Name;` sends an empty header in curl.
          if (/;\s*$/.test(value)) headers.push([value.replace(/;\s*$/, "").trim(), ""]);
          else warnings.push(`Ignored malformed header "${value}"`);
          break;
        }
        const hName = value.slice(0, colon).trim();
        const hValue = value.slice(colon + 1).trim();
        // `Name:` with no value removes a curl-internal header — nothing to send.
        if (hValue !== "") headers.push([hName, hValue]);
        break;
      }
      case "data":
      case "data-ascii":
      case "data-binary":
        if (value.startsWith("@")) dataParts.push({ file: value.slice(1) });
        else dataParts.push({ text: value });
        break;
      case "data-raw":
        dataParts.push({ text: value });
        break;
      case "data-urlencode": {
        // content | =content | name=content | @file | name@file
        const eq = value.indexOf("=");
        const at = value.indexOf("@");
        if (at >= 0 && (eq < 0 || at < eq)) {
          dataParts.push({ file: value.slice(at + 1), urlencode: true, name: value.slice(0, at) });
        } else if (eq >= 0) {
          const n = value.slice(0, eq);
          const encoded = urlEncode(value.slice(eq + 1));
          dataParts.push({ text: n ? `${n}=${encoded}` : encoded });
        } else {
          dataParts.push({ text: urlEncode(value) });
        }
        break;
      }
      case "json":
        jsonMode = true;
        if (value.startsWith("@")) dataParts.push({ file: value.slice(1) });
        else dataParts.push({ text: value });
        break;
      case "form":
      case "form-string": {
        const field = parseFormField(value, name === "form-string");
        if (field) formFields.push(field);
        else warnings.push(`Ignored malformed form field "${value}"`);
        break;
      }
      case "user": {
        const colon = value.indexOf(":");
        if (colon < 0) {
          auth = { user: value, password: "" };
          warnings.push("-u has no password (curl would prompt for it) — fill it in");
        } else {
          auth = { user: value.slice(0, colon), password: value.slice(colon + 1) };
        }
        break;
      }
      case "oauth2-bearer":
        headers.push(["Authorization", `Bearer ${value}`]);
        break;
      case "cookie":
        if (value.includes("=")) cookies.push(...parseCookies(value));
        else warnings.push(`Ignored -b ${value}: reading cookies from a file isn’t supported`);
        break;
      case "user-agent":
        headers.push(["User-Agent", value]);
        break;
      case "referer":
        headers.push(["Referer", value.replace(/;auto$/, "")]);
        break;
      case "max-time": {
        const n = Number(value);
        if (Number.isFinite(n) && n > 0) timeout = n;
        break;
      }
      case "get":
        useGet = true;
        break;
      case "head":
        head = true;
        break;
      case "insecure":
        insecure = true;
        break;
      case "location":
      case "location-trusted":
        followRedirects = true;
        break;
      case "compressed":
        compressed = true;
        break;
      default:
        if (name && SILENT_FLAGS.has(name)) break;
        if (name && name.startsWith("no-") && (SILENT_FLAGS.has(name.slice(3)) || BOOL_NAMES.has(name.slice(3)))) break;
        if (name && name in WARN_IGNORED) {
          warnings.push(`Ignored ${flag}: ${WARN_IGNORED[name]} can’t be expressed in the generated code`);
          break;
        }
        if (name && VALUE_OPTIONS.has(name)) break; // e.g. -o out.json, -w, --retry
        warnings.push(`Unsupported option ${flag} ignored`);
    }
  }

  if (urls.length === 0) {
    throw new FormatError("No URL found in the cURL command.", {
      hint: "Add the URL as an argument or with --url",
    });
  }
  if (urls.length > 1) {
    warnings.push(`Only the first URL is used (${urls.length} given)`);
  }
  let url = urls[0];
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) url = `http://${url}`;

  // Body.
  let body = null;
  const fileParts = dataParts.filter((p) => p.file !== undefined);
  if (formFields.length && dataParts.length) {
    warnings.push("Both -F and -d given — only the -F form is used");
  }
  if (formFields.length) {
    body = { kind: "form", fields: formFields };
    // The library generates the multipart boundary itself.
    const ct = getHeader(headers, "content-type");
    if (ct && /multipart\/form-data/i.test(ct)) {
      for (let k = headers.length - 1; k >= 0; k--) {
        if (headers[k][0].toLowerCase() === "content-type") headers.splice(k, 1);
      }
    }
  } else if (dataParts.length) {
    if (fileParts.length) {
      if (dataParts.length > 1) {
        warnings.push("Data mixes files and literal values — only the first file is used");
      }
      body = { kind: "file", path: fileParts[0].file };
    } else {
      body = { kind: "raw", text: dataParts.map((p) => p.text).join(jsonMode ? "" : "&") };
    }
  }

  if (jsonMode) {
    if (!hasHeader(headers, "content-type")) headers.push(["Content-Type", "application/json"]);
    if (!hasHeader(headers, "accept")) headers.push(["Accept", "application/json"]);
  } else if (body && body.kind !== "form" && !useGet && !hasHeader(headers, "content-type")) {
    headers.push(["Content-Type", "application/x-www-form-urlencoded"]);
  }

  // -G: data goes to the query string.
  if (useGet && body && body.kind === "raw") {
    const hashAt = url.indexOf("#");
    const base = hashAt < 0 ? url : url.slice(0, hashAt);
    const hash = hashAt < 0 ? "" : url.slice(hashAt);
    const sep = !base.includes("?") ? "?" : /[?&]$/.test(base) ? "" : "&";
    url = base + sep + body.text + hash;
    body = null;
  } else if (useGet && body) {
    warnings.push("-G with a file or form body isn’t supported — the body is sent as is");
  }

  if (!method) {
    if (head) method = "HEAD";
    else method = body ? "POST" : "GET";
  }

  return {
    method,
    url,
    headers,
    body,
    auth,
    cookies,
    insecure,
    followRedirects,
    compressed,
    timeout,
    warnings,
  };
}
