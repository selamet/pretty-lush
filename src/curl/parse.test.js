import { describe, expect, it } from "vitest";
import { getHeader, parseCurl } from "./parse.js";

describe("parseCurl", () => {
  it("parses a bare GET", () => {
    const r = parseCurl("curl https://api.example.com/users");
    expect(r).toMatchObject({
      method: "GET",
      url: "https://api.example.com/users",
      headers: [],
      body: null,
      auth: null,
      cookies: [],
      insecure: false,
      followRedirects: false,
      compressed: false,
      timeout: null,
      warnings: [],
    });
  });

  it("accepts a shell prompt and curl.exe", () => {
    expect(parseCurl("$ curl https://a.io").url).toBe("https://a.io");
    expect(parseCurl("curl.exe https://a.io").url).toBe("https://a.io");
  });

  it("defaults the scheme to http://", () => {
    expect(parseCurl("curl example.com/x").url).toBe("http://example.com/x");
  });

  it("rejects non-curl input and a missing URL", () => {
    expect(() => parseCurl("")).toThrow(/empty/);
    expect(() => parseCurl("wget https://a.io")).toThrow(/Not a cURL command/);
    expect(() => parseCurl("curl -H 'a: b'")).toThrow(/No URL/);
  });

  describe("-X / --request", () => {
    it("sets and uppercases the method", () => {
      expect(parseCurl("curl -X delete https://a.io").method).toBe("DELETE");
      expect(parseCurl("curl --request PATCH https://a.io").method).toBe("PATCH");
      expect(parseCurl("curl -XPUT https://a.io").method).toBe("PUT");
    });

    it("wins over the implicit POST", () => {
      expect(parseCurl("curl -X PUT -d a=1 https://a.io").method).toBe("PUT");
    });
  });

  describe("URL", () => {
    it("reads --url", () => {
      expect(parseCurl("curl --url https://a.io/x -s").url).toBe("https://a.io/x");
    });

    it("uses the first of several URLs with a warning", () => {
      const r = parseCurl("curl https://a.io https://b.io");
      expect(r.url).toBe("https://a.io");
      expect(r.warnings).toEqual(["Only the first URL is used (2 given)"]);
    });

    it("treats words after -- as URLs", () => {
      expect(parseCurl("curl -- https://a.io").url).toBe("https://a.io");
    });
  });

  describe("-H / --header", () => {
    it("keeps order and casing, trims values", () => {
      const r = parseCurl(`curl -H 'Accept: application/json' --header "X-Trace-Id:  42 " https://a.io`);
      expect(r.headers).toEqual([
        ["Accept", "application/json"],
        ["X-Trace-Id", "42"],
      ]);
    });

    it("keeps colons in values", () => {
      expect(parseCurl("curl -H 'Referer: https://x.io:8080/' https://a.io").headers).toEqual([
        ["Referer", "https://x.io:8080/"],
      ]);
    });

    it("sends `Name;` as an empty header and drops `Name:`", () => {
      expect(parseCurl("curl -H 'X-Empty;' -H 'Accept:' https://a.io").headers).toEqual([["X-Empty", ""]]);
    });

    it("warns about malformed headers", () => {
      expect(parseCurl("curl -H 'nonsense' https://a.io").warnings).toEqual(['Ignored malformed header "nonsense"']);
    });
  });

  describe("-d / --data*", () => {
    it("implies POST with a form content type", () => {
      const r = parseCurl("curl -d 'a=1' https://a.io");
      expect(r.method).toBe("POST");
      expect(r.body).toEqual({ kind: "raw", text: "a=1" });
      expect(r.headers).toEqual([["Content-Type", "application/x-www-form-urlencoded"]]);
    });

    it("joins multiple -d with &", () => {
      expect(parseCurl("curl -d a=1 --data b=2 --data-ascii c=3 https://a.io").body.text).toBe("a=1&b=2&c=3");
    });

    it("keeps an explicit content type", () => {
      const r = parseCurl(`curl -H 'Content-Type: application/json' -d '{"a":1}' https://a.io`);
      expect(r.headers).toEqual([["Content-Type", "application/json"]]);
    });

    it("--data-raw does not read files", () => {
      expect(parseCurl("curl --data-raw '@me' https://a.io").body).toEqual({ kind: "raw", text: "@me" });
    });

    it("-d @file and --data-binary @file read a file", () => {
      expect(parseCurl("curl -d @body.json https://a.io").body).toEqual({ kind: "file", path: "body.json" });
      expect(parseCurl("curl --data-binary @./img.bin https://a.io").body).toEqual({ kind: "file", path: "./img.bin" });
      expect(parseCurl("curl -d@x.txt https://a.io").body).toEqual({ kind: "file", path: "x.txt" });
    });

    it("--data-binary keeps the text as is", () => {
      expect(parseCurl("curl --data-binary $'a\\nb' https://a.io").body.text).toBe("a\nb");
    });

    it("warns when files and values are mixed", () => {
      const r = parseCurl("curl -d a=1 -d @b.txt https://a.io");
      expect(r.body).toEqual({ kind: "file", path: "b.txt" });
      expect(r.warnings[0]).toMatch(/mixes files/);
    });

    it("--data-urlencode encodes each form", () => {
      const r = parseCurl(
        "curl --data-urlencode 'hello world' --data-urlencode '=a&b' --data-urlencode 'q=x y/z' https://a.io"
      );
      expect(r.body.text).toBe("hello%20world&a%26b&q=x%20y%2Fz");
    });

    it("--data-urlencode name@file reads a file", () => {
      expect(parseCurl("curl --data-urlencode 'msg@note.txt' https://a.io").body).toEqual({
        kind: "file",
        path: "note.txt",
      });
    });
  });

  describe("--json", () => {
    it("sets content type and accept", () => {
      const r = parseCurl(`curl --json '{"a":1}' https://a.io`);
      expect(r.method).toBe("POST");
      expect(r.body).toEqual({ kind: "raw", text: '{"a":1}' });
      expect(r.headers).toEqual([
        ["Content-Type", "application/json"],
        ["Accept", "application/json"],
      ]);
    });

    it("does not override user headers", () => {
      const r = parseCurl(`curl -H 'accept: text/plain' --json '{}' https://a.io`);
      expect(r.headers).toEqual([
        ["accept", "text/plain"],
        ["Content-Type", "application/json"],
      ]);
    });

    it("concatenates several --json parts", () => {
      expect(parseCurl(`curl --json '{"a":' --json '1}' https://a.io`).body.text).toBe('{"a":1}');
    });
  });

  describe("-F / --form", () => {
    it("parses values, files, type and filename", () => {
      const r = parseCurl(
        "curl -F name=Ada -F 'avatar=@/tmp/me.png;type=image/png' -F 'doc=@a.pdf;filename=report.pdf' -F 'bio=<bio.txt' --form-string 'raw=@literal' https://a.io"
      );
      expect(r.method).toBe("POST");
      expect(r.body.kind).toBe("form");
      expect(r.body.fields).toEqual([
        { name: "name", value: "Ada", type: null },
        { name: "avatar", file: "/tmp/me.png", type: "image/png", filename: null },
        { name: "doc", file: "a.pdf", type: null, filename: "report.pdf" },
        { name: "bio", file: "bio.txt", type: null, filename: null, inline: true },
        { name: "raw", value: "@literal" },
      ]);
      expect(r.headers).toEqual([]);
    });

    it("unquotes Postman-style quoted values, paths and params", () => {
      const r = parseCurl(`curl -F 'title="Q3 \\"final\\" report"' -F 'f=@"/tmp/a b.pdf";filename="r;x.pdf"' -F 'plain=a;b' https://a.io`);
      expect(r.body.fields).toEqual([
        { name: "title", value: 'Q3 "final" report', type: null },
        { name: "f", file: "/tmp/a b.pdf", type: null, filename: "r;x.pdf" },
        { name: "plain", value: "a;b", type: null },
      ]);
    });

    it("drops an explicit multipart content type (the boundary is generated)", () => {
      const r = parseCurl("curl -H 'Content-Type: multipart/form-data; boundary=x' -F a=1 https://a.io");
      expect(r.headers).toEqual([]);
    });

    it("prefers -F over -d with a warning", () => {
      const r = parseCurl("curl -F a=1 -d b=2 https://a.io");
      expect(r.body.kind).toBe("form");
      expect(r.warnings[0]).toMatch(/Both -F and -d/);
    });
  });

  describe("-u / --user", () => {
    it("splits user and password at the first colon", () => {
      expect(parseCurl("curl -u bob:s3:cret https://a.io").auth).toEqual({ user: "bob", password: "s3:cret" });
      expect(parseCurl("curl --user 'a b:c' https://a.io").auth).toEqual({ user: "a b", password: "c" });
    });

    it("warns when the password is missing", () => {
      const r = parseCurl("curl -u bob https://a.io");
      expect(r.auth).toEqual({ user: "bob", password: "" });
      expect(r.warnings[0]).toMatch(/no password/);
    });
  });

  describe("-b / --cookie", () => {
    it("parses a cookie string", () => {
      expect(parseCurl("curl -b 'a=1; b=x=y;c' --cookie d=4 https://a.io").cookies).toEqual([
        ["a", "1"],
        ["b", "x=y"],
        ["c", ""],
        ["d", "4"],
      ]);
    });

    it("warns about cookie files", () => {
      const r = parseCurl("curl -b cookies.txt https://a.io");
      expect(r.cookies).toEqual([]);
      expect(r.warnings[0]).toMatch(/cookies from a file/);
    });
  });

  it("-A / --user-agent and -e / --referer become headers", () => {
    expect(parseCurl("curl -A 'Bot/1' -e https://r.io --user-agent X --referer 'https://s.io;auto' https://a.io").headers).toEqual([
      ["User-Agent", "Bot/1"],
      ["Referer", "https://r.io"],
      ["User-Agent", "X"],
      ["Referer", "https://s.io"],
    ]);
  });

  it("--oauth2-bearer becomes an Authorization header", () => {
    expect(parseCurl("curl --oauth2-bearer tok https://a.io").headers).toEqual([["Authorization", "Bearer tok"]]);
  });

  describe("-G / --get", () => {
    it("moves data to the query string", () => {
      const r = parseCurl("curl -G -d q=cats --data-urlencode 'tag=a b' https://a.io/search");
      expect(r.method).toBe("GET");
      expect(r.url).toBe("https://a.io/search?q=cats&tag=a%20b");
      expect(r.body).toBe(null);
      expect(r.headers).toEqual([]);
    });

    it("appends to an existing query and keeps the fragment", () => {
      expect(parseCurl("curl --get -d b=2 'https://a.io/?a=1#top'").url).toBe("https://a.io/?a=1&b=2#top");
      expect(parseCurl("curl -G -d b=2 'https://a.io/?'").url).toBe("https://a.io/?b=2");
    });

    it("works with -I as a HEAD request", () => {
      const r = parseCurl("curl -G -I -d a=1 https://a.io");
      expect(r.method).toBe("HEAD");
      expect(r.url).toBe("https://a.io?a=1");
    });
  });

  it("-I / --head makes a HEAD request", () => {
    expect(parseCurl("curl -I https://a.io").method).toBe("HEAD");
    expect(parseCurl("curl --head https://a.io").method).toBe("HEAD");
  });

  it("reads -L, -k, --compressed and -m", () => {
    const r = parseCurl("curl -L -k --compressed -m 2.5 https://a.io");
    expect(r).toMatchObject({ followRedirects: true, insecure: true, compressed: true, timeout: 2.5, warnings: [] });
    expect(parseCurl("curl --location --insecure --max-time 10 https://a.io")).toMatchObject({
      followRedirects: true,
      insecure: true,
      timeout: 10,
    });
  });

  it("splits short option clusters", () => {
    const r = parseCurl("curl -sSLk -XPOST -HAccept:x https://a.io");
    expect(r).toMatchObject({ method: "POST", followRedirects: true, insecure: true, headers: [["Accept", "x"]] });
    expect(r.warnings).toEqual([]);
  });

  it("silently ignores -s, -v and other output options with their values", () => {
    const r = parseCurl("curl -s -v -i -o out.json -w '%{http_code}' --retry 3 --http2 --no-progress-meter https://a.io");
    expect(r.url).toBe("https://a.io");
    expect(r.warnings).toEqual([]);
  });

  it("warns about unknown and inexpressible options", () => {
    const r = parseCurl("curl --frobnicate -Q -x http://proxy:8080 --digest https://a.io");
    expect(r.url).toBe("https://a.io");
    expect(r.warnings).toEqual([
      "Unsupported option --frobnicate ignored",
      "Unsupported option -Q ignored",
      "Ignored -x: a proxy can’t be expressed in the generated code",
      "Ignored --digest: Digest auth can’t be expressed in the generated code",
    ]);
  });

  it("warns about a missing option value", () => {
    expect(() => parseCurl("curl https://a.io -H")).not.toThrow();
    expect(parseCurl("curl https://a.io -H").warnings).toEqual(["Option -H is missing its value"]);
  });

  it("accepts --name=value for value options", () => {
    expect(parseCurl("curl --request=PUT --url=https://a.io").method).toBe("PUT");
  });

  it("warns about text after a pipe", () => {
    const r = parseCurl("curl https://a.io | jq .");
    expect(r.url).toBe("https://a.io");
    expect(r.warnings[0]).toMatch(/after the unquoted `\|`/);
  });

  it("getHeader is case-insensitive", () => {
    expect(getHeader([["Content-Type", "x"]], "content-type")).toBe("x");
    expect(getHeader([], "accept")).toBe(null);
  });
});
