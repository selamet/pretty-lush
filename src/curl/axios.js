// Request model → axios (async/await).
import { fileBodyLines, formDataLines } from "./fetch.js";
import { jsKey, jsLiteral, jsString, jsonBody } from "./literals.js";

export function emitAxios(req) {
  const imports = ['import axios from "axios";'];
  const pre = [];
  const opts = [`method: ${jsString(req.method.toLowerCase())}`, `url: ${jsString(req.url)}`];

  const headers = req.headers.map(([n, v]) => [n, jsString(v)]);
  if (req.cookies.length) {
    headers.push(["Cookie", jsString(req.cookies.map(([n, v]) => `${n}=${v}`).join("; "))]);
  }
  if (headers.length) {
    opts.push(`headers: {\n${headers.map(([n, v]) => `    ${jsKey(n)}: ${v},`).join("\n")}\n  }`);
  }

  if (req.body) {
    if (req.body.kind === "form") {
      pre.push(...formDataLines(req.body.fields), "");
      opts.push("data: form");
    } else if (req.body.kind === "file") {
      pre.push(...fileBodyLines(req.body.path), "");
      opts.push("data: body");
    } else {
      const json = jsonBody(req);
      opts.push(`data: ${json !== undefined ? jsLiteral(json, 1) : jsString(req.body.text)}`);
    }
  }

  if (req.auth) {
    opts.push(
      `auth: {\n    username: ${jsString(req.auth.user)},\n    password: ${jsString(req.auth.password)},\n  }`
    );
  }
  if (req.timeout) opts.push(`timeout: ${Math.round(req.timeout * 1000)}`);
  if (req.insecure) {
    imports.push('import https from "node:https";');
    opts.push("// curl -k: skip TLS certificate checks (Node.js only)");
    opts.push("httpsAgent: new https.Agent({ rejectUnauthorized: false })");
  }

  const body = opts.map((o) => (o.startsWith("//") ? `  ${o}` : `  ${o},`)).join("\n");
  const read = req.method === "HEAD"
    ? "console.log(response.status, response.headers);"
    : "console.log(response.data);";
  return [...imports, "", ...pre, `const response = await axios({\n${body}\n});`, "", read, ""].join("\n");
}
