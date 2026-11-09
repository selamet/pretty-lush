// Request model → Python `requests`.
import { jsonBody, pyLiteral, pyString } from "./literals.js";

const METHOD_FUNCS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);
const LINE_WIDTH = 88;

function pyDict(pairs) {
  if (!pairs.length) return "{}";
  return `{\n${pairs.map(([k, v]) => `    ${pyString(k)}: ${pyString(v)},`).join("\n")}\n}`;
}

function filesDict(fields) {
  const lines = fields.map((f) => {
    if (f.file === undefined) {
      // Plain parts go in `files` too, as (None, value), to keep their order
      // in one multipart body.
      const tuple = f.type
        ? `(None, ${pyString(f.value)}, ${pyString(f.type)})`
        : `(None, ${pyString(f.value)})`;
      return `    ${pyString(f.name)}: ${tuple},`;
    }
    if (f.inline) {
      return `    ${pyString(f.name)}: (None, open(${pyString(f.file)}, "rb").read()),`;
    }
    const filename = f.filename ?? f.file.replace(/^.*[\\/]/, "");
    const parts = [pyString(filename), `open(${pyString(f.file)}, "rb")`];
    if (f.type) parts.push(pyString(f.type));
    return `    ${pyString(f.name)}: (${parts.join(", ")}),`;
  });
  return `{\n${lines.join("\n")}\n}`;
}

export function emitRequests(req) {
  const blocks = [];
  const args = [];
  blocks.push(`url = ${pyString(req.url)}`);

  if (req.headers.length) {
    blocks.push(`headers = ${pyDict(req.headers)}`);
    args.push("headers=headers");
  }
  if (req.cookies.length) {
    blocks.push(`cookies = ${pyDict(req.cookies)}`);
    args.push("cookies=cookies");
  }

  if (req.body) {
    if (req.body.kind === "form") {
      blocks.push(`files = ${filesDict(req.body.fields)}`);
      args.push("files=files");
    } else if (req.body.kind === "file") {
      blocks.push(`with open(${pyString(req.body.path)}, "rb") as f:\n    data = f.read()`);
      args.push("data=data");
    } else {
      const json = jsonBody(req);
      if (json !== undefined) {
        blocks.push(`json_data = ${pyLiteral(json)}`);
        args.push("json=json_data");
      } else {
        blocks.push(`data = ${pyString(req.body.text)}`);
        args.push("data=data");
      }
    }
  }

  if (req.auth) args.push(`auth=(${pyString(req.auth.user)}, ${pyString(req.auth.password)})`);
  if (req.insecure) args.push("verify=False");
  if (req.timeout) args.push(`timeout=${req.timeout}`);

  let fn;
  let callArgs;
  if (METHOD_FUNCS.has(req.method)) {
    fn = `requests.${req.method.toLowerCase()}`;
    callArgs = ["url", ...args];
  } else {
    fn = "requests.request";
    callArgs = [pyString(req.method), "url", ...args];
  }
  const oneLine = `response = ${fn}(${callArgs.join(", ")})`;
  const call =
    oneLine.length <= LINE_WIDTH
      ? oneLine
      : `response = ${fn}(\n${callArgs.map((a) => `    ${a},`).join("\n")}\n)`;

  const read = req.method === "HEAD" ? "print(response.status_code, response.headers)" : "print(response.text)";
  return ["import requests", "", ...blocks.flatMap((b) => [b, ""]), call, read, ""].join("\n");
}
