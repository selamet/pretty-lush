import { describe, expect, it } from "vitest";
import { parseCurl } from "./parse.js";
import { emitFetch } from "./fetch.js";
import { emitAxios } from "./axios.js";
import { emitRequests } from "./requests.js";
import { jsString, pyLiteral, pyString } from "./literals.js";

// Chrome DevTools → Network → Copy → Copy as cURL (bash).
const CHROME_BASH = `curl 'https://api.example.com/v1/orders?page=2' \\
  -H 'accept: application/json, text/plain, */*' \\
  -H 'accept-language: en-US,en;q=0.9' \\
  -H 'authorization: Bearer eyJhbGciOi.x.y' \\
  -H 'content-type: application/json' \\
  -b 'sid=abc123; theme=dark' \\
  -H 'origin: https://app.example.com' \\
  -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' \\
  --data-raw '{"items":[{"sku":"A-1","qty":2}],"note":"it\\u0027s \\"gift\\"","express":true}'`;

// Chrome → Copy as cURL (cmd).
const CHROME_CMD = `curl ^"https://api.example.com/v1/search?q=a^&limit=5^" ^
  -H ^"accept: */*^" ^
  -H ^"content-type: application/json^" ^
  --data-raw ^"^{^\\^"query^\\^":^\\^"shoes^\\^"^}^"`;

// Firefox → Copy as cURL (POSIX).
const FIREFOX = `curl 'https://example.com/login' -X POST -H 'User-Agent: Mozilla/5.0' -H 'Accept: text/html' -H 'Content-Type: application/x-www-form-urlencoded' --data-raw 'user=ada&pass=s%26cret'`;

// Postman code snippet.
const POSTMAN = `curl --location 'https://api.example.com/upload' \\
--header 'X-Api-Key: k' \\
--form 'title="Q3 report"' \\
--form 'file=@"/Users/ada/report.pdf"'`;

describe("literals", () => {
  it("jsString picks single quotes to avoid escaping", () => {
    expect(jsString("a")).toBe('"a"');
    expect(jsString('{"a":"b\\n"}')).toBe(`'{"a":"b\\\\n"}'`);
    expect(jsString(`it's "x"`)).toBe(`"it's \\"x\\""`);
  });

  it("pyString escapes for Python", () => {
    expect(pyString('a"b\\c\n\t\x01é')).toBe('"a\\"b\\\\c\\n\\t\\x01é"');
  });

  it("pyLiteral prints Python values", () => {
    expect(pyLiteral({ a: [1, true, null], b: { c: false }, d: [] })).toBe(
      '{\n    "a": [1, True, None],\n    "b": {\n        "c": False,\n    },\n    "d": [],\n}'
    );
  });
});

describe("emitFetch", () => {
  it("emits a bare GET", () => {
    expect(emitFetch(parseCurl("curl https://a.io"))).toBe(
      'const response = await fetch("https://a.io");\n\nconst data = await response.text();\nconsole.log(data);\n'
    );
  });

  it("converts Chrome's Copy as cURL (bash) with a pretty JSON body", () => {
    expect(emitFetch(parseCurl(CHROME_BASH))).toBe(`const response = await fetch("https://api.example.com/v1/orders?page=2", {
  method: "POST",
  headers: {
    accept: "application/json, text/plain, */*",
    "accept-language": "en-US,en;q=0.9",
    authorization: "Bearer eyJhbGciOi.x.y",
    "content-type": "application/json",
    origin: "https://app.example.com",
    "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    Cookie: "sid=abc123; theme=dark",
  },
  body: JSON.stringify({
    items: [
      {
        sku: "A-1",
        qty: 2,
      },
    ],
    note: "it's \\"gift\\"",
    express: true,
  }),
});

const data = await response.json();
console.log(data);
`);
  });

  it("converts Chrome's Copy as cURL (cmd)", () => {
    const code = emitFetch(parseCurl(CHROME_CMD));
    expect(code).toContain('fetch("https://api.example.com/v1/search?q=a&limit=5", {');
    expect(code).toContain('body: JSON.stringify({\n    query: "shoes",\n  }),');
  });

  it("keeps a non-JSON body as a string", () => {
    const code = emitFetch(parseCurl(FIREFOX));
    expect(code).toContain('body: "user=ada&pass=s%26cret",');
    expect(code).toContain('"Content-Type": "application/x-www-form-urlencoded",');
  });

  it("keeps invalid JSON as a string", () => {
    expect(emitFetch(parseCurl(`curl --json '{bad' https://a.io`))).toContain(`body: "{bad",`);
  });

  it("emits basic auth, timeout and an insecure note", () => {
    const code = emitFetch(parseCurl("curl -k -u bob:pw -m 1.5 https://a.io"));
    expect(code).toContain('Authorization: "Basic " + btoa("bob:pw"),');
    expect(code).toContain("signal: AbortSignal.timeout(1500),");
    expect(code).toMatch(/^\/\/ curl -k: fetch can't skip TLS/);
  });

  it("builds FormData with file placeholders", () => {
    const code = emitFetch(parseCurl(POSTMAN));
    expect(code).toContain(`const form = new FormData();
form.append("title", "Q3 report");
// TODO: replace the empty Blob with the contents of "/Users/ada/report.pdf"
form.append("file", new Blob([]), "report.pdf");`);
    expect(code).toContain("body: form,");
    expect(code).toContain('"X-Api-Key": "k",');
  });

  it("passes a part's content type to the Blob", () => {
    expect(emitFetch(parseCurl("curl -F 'a=@x.png;type=image/png' https://a.io"))).toContain(
      'form.append("a", new Blob([], { type: "image/png" }), "x.png");'
    );
  });

  it("uses a placeholder for a file body", () => {
    const code = emitFetch(parseCurl("curl -d @payload.json https://a.io"));
    expect(code).toContain('// TODO: replace with the contents of "payload.json" (curl -d @payload.json)\nconst body = "";');
    expect(code).toContain("  body,\n");
  });

  it("reads headers for HEAD", () => {
    const code = emitFetch(parseCurl("curl -I https://a.io"));
    expect(code).toContain('method: "HEAD",');
    expect(code).toContain("Object.fromEntries(response.headers)");
  });
});

describe("emitAxios", () => {
  it("converts Chrome's Copy as cURL with a JSON data object", () => {
    const code = emitAxios(parseCurl(CHROME_BASH));
    expect(code.startsWith('import axios from "axios";\n\nconst response = await axios({\n  method: "post",\n  url: "https://api.example.com/v1/orders?page=2",\n')).toBe(true);
    expect(code).toContain('  data: {\n    items: [\n      {\n        sku: "A-1",');
    expect(code).toContain('    Cookie: "sid=abc123; theme=dark",');
    expect(code.endsWith("console.log(response.data);\n")).toBe(true);
  });

  it("emits auth, timeout and an https agent for -k", () => {
    const code = emitAxios(parseCurl("curl -k -u bob:pw -m 3 https://a.io"));
    expect(code).toContain('import https from "node:https";');
    expect(code).toContain('  auth: {\n    username: "bob",\n    password: "pw",\n  },');
    expect(code).toContain("  timeout: 3000,");
    expect(code).toContain("  httpsAgent: new https.Agent({ rejectUnauthorized: false }),");
  });

  it("sends a string body and form data", () => {
    expect(emitAxios(parseCurl(FIREFOX))).toContain('  data: "user=ada&pass=s%26cret",');
    const form = emitAxios(parseCurl(POSTMAN));
    expect(form).toContain("const form = new FormData();");
    expect(form).toContain("  data: form,");
  });

  it("uses the lowercase method", () => {
    expect(emitAxios(parseCurl("curl -X PURGE https://a.io"))).toContain('method: "purge",');
  });
});

describe("emitRequests", () => {
  it("emits a bare GET", () => {
    expect(emitRequests(parseCurl("curl https://a.io"))).toBe(
      'import requests\n\nurl = "https://a.io"\n\nresponse = requests.get(url)\nprint(response.text)\n'
    );
  });

  it("converts Chrome's Copy as cURL with json= and cookies=", () => {
    expect(emitRequests(parseCurl(CHROME_BASH))).toBe(`import requests

url = "https://api.example.com/v1/orders?page=2"

headers = {
    "accept": "application/json, text/plain, */*",
    "accept-language": "en-US,en;q=0.9",
    "authorization": "Bearer eyJhbGciOi.x.y",
    "content-type": "application/json",
    "origin": "https://app.example.com",
    "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
}

cookies = {
    "sid": "abc123",
    "theme": "dark",
}

json_data = {
    "items": [
        {
            "sku": "A-1",
            "qty": 2,
        },
    ],
    "note": "it's \\"gift\\"",
    "express": True,
}

response = requests.post(url, headers=headers, cookies=cookies, json=json_data)
print(response.text)
`);
  });

  it("uses data= for non-JSON bodies", () => {
    const code = emitRequests(parseCurl(FIREFOX));
    expect(code).toContain('data = "user=ada&pass=s%26cret"');
    expect(code).toContain("response = requests.post(url, headers=headers, data=data)");
  });

  it("emits auth=, verify=False and timeout=", () => {
    expect(emitRequests(parseCurl("curl -k -u bob:pw -m 5 https://a.io"))).toContain(
      'response = requests.get(url, auth=("bob", "pw"), verify=False, timeout=5)'
    );
  });

  it("wraps long calls one argument per line", () => {
    const code = emitRequests(parseCurl("curl -k -u some-long-user:some-long-password -m 30 -b a=1 -H 'x: y' https://a.io"));
    expect(code).toContain(
      'response = requests.get(\n    url,\n    headers=headers,\n    cookies=cookies,\n    auth=("some-long-user", "some-long-password"),\n    verify=False,\n    timeout=30,\n)'
    );
  });

  it("emits files= for multipart forms", () => {
    const code = emitRequests(parseCurl(`${POSTMAN} -F 'logo=@a.png;type=image/png' -F 'bio=<bio.txt'`));
    expect(code).toContain(`files = {
    "title": (None, "Q3 report"),
    "file": ("report.pdf", open("/Users/ada/report.pdf", "rb")),
    "logo": ("a.png", open("a.png", "rb"), "image/png"),
    "bio": (None, open("bio.txt", "rb").read()),
}`);
    expect(code).toContain("files=files");
  });

  it("reads a file body", () => {
    expect(emitRequests(parseCurl("curl --data-binary @img.bin https://a.io"))).toContain(
      'with open("img.bin", "rb") as f:\n    data = f.read()'
    );
  });

  it("uses requests.request for non-standard methods and head for -I", () => {
    expect(emitRequests(parseCurl("curl -X PURGE https://a.io"))).toContain('requests.request("PURGE", url)');
    expect(emitRequests(parseCurl("curl -I https://a.io"))).toContain(
      "response = requests.head(url)\nprint(response.status_code, response.headers)"
    );
  });

  it("emits --json bodies as json=", () => {
    const code = emitRequests(parseCurl(`curl --json '[1, 2]' https://a.io`));
    expect(code).toContain("json_data = [1, 2]");
    expect(code).toContain("json=json_data");
  });
});
