// Request model → `fetch` (async/await).
import { expectsJson, jsKey, jsLiteral, jsString, jsonBody } from "./literals.js";

// Shared by the fetch and axios emitters: `const form = new FormData()` lines
// for a multipart body. Files become a Blob placeholder to fill in.
export function formDataLines(fields) {
  const lines = ["const form = new FormData();"];
  for (const f of fields) {
    if (f.file === undefined) {
      lines.push(`form.append(${jsString(f.name)}, ${jsString(f.value)});`);
      continue;
    }
    const type = f.type ? `, { type: ${jsString(f.type)} }` : "";
    if (f.inline) {
      lines.push(`// TODO: replace with the contents of ${jsString(f.file)} (curl -F ${f.name}=<${f.file})`);
      lines.push(`form.append(${jsString(f.name)}, "");`);
      continue;
    }
    const filename = f.filename ?? f.file.replace(/^.*[\\/]/, "");
    lines.push(`// TODO: replace the empty Blob with the contents of ${jsString(f.file)}`);
    lines.push(
      `form.append(${jsString(f.name)}, new Blob([]${type}), ${jsString(filename)});`
    );
  }
  return lines;
}

export function fileBodyLines(path) {
  return [`// TODO: replace with the contents of ${jsString(path)} (curl -d @${path})`, `const body = "";`];
}

function headerEntries(req) {
  const entries = req.headers.map(([n, v]) => [n, jsString(v)]);
  if (req.cookies.length) {
    entries.push(["Cookie", jsString(req.cookies.map(([n, v]) => `${n}=${v}`).join("; "))]);
  }
  if (req.auth) {
    entries.push(["Authorization", `"Basic " + btoa(${jsString(`${req.auth.user}:${req.auth.password}`)})`]);
  }
  return entries;
}

export function emitFetch(req) {
  const pre = [];
  const opts = [];
  if (req.method !== "GET") opts.push(`method: ${jsString(req.method)}`);

  const headers = headerEntries(req);
  if (headers.length) {
    opts.push(`headers: {\n${headers.map(([n, v]) => `    ${jsKey(n)}: ${v},`).join("\n")}\n  }`);
  }

  if (req.body) {
    if (req.body.kind === "form") {
      pre.push(...formDataLines(req.body.fields), "");
      opts.push("body: form");
    } else if (req.body.kind === "file") {
      pre.push(...fileBodyLines(req.body.path), "");
      opts.push("body");
    } else {
      const json = jsonBody(req);
      opts.push(
        json !== undefined
          ? `body: JSON.stringify(${jsLiteral(json, 1)})`
          : `body: ${jsString(req.body.text)}`
      );
    }
  }
  if (req.timeout) opts.push(`signal: AbortSignal.timeout(${Math.round(req.timeout * 1000)})`);

  if (req.insecure) {
    pre.push("// curl -k: fetch can't skip TLS certificate checks; the request will fail on an invalid certificate.");
  }

  const call = opts.length
    ? `const response = await fetch(${jsString(req.url)}, {\n${opts.map((o) => `  ${o},`).join("\n")}\n});`
    : `const response = await fetch(${jsString(req.url)});`;

  const read = req.method === "HEAD"
    ? "console.log(response.status, Object.fromEntries(response.headers));"
    : expectsJson(req)
      ? "const data = await response.json();\nconsole.log(data);"
      : "const data = await response.text();\nconsole.log(data);";

  return [...pre, call, "", read, ""].join("\n");
}
