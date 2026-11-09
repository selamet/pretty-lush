import { describe, expect, it } from "vitest";
import {
  toLowerCase,
  toTitleCase,
  toUpperCase,
  splitWords,
  toCamelCase,
  toPascalCase,
  toSnakeCase,
  toScreamingSnakeCase,
  toKebabCase,
  toDotCase,
  toSentenceCase,
} from "./case.js";

describe("case transforms", () => {
  it("upper- and lower-cases text", () => {
    expect(toUpperCase("Hello, world")).toBe("HELLO, WORLD");
    expect(toLowerCase("Hello, WORLD")).toBe("hello, world");
  });

  it("title-cases each word and lowercases the rest", () => {
    expect(toTitleCase("the QUICK brown fox")).toBe("The Quick Brown Fox");
  });

  it("keeps apostrophes inside words and treats hyphens as word breaks", () => {
    expect(toTitleCase("don't stop rock-n-roll")).toBe("Don't Stop Rock-N-Roll");
  });

  it("returns empty input unchanged", () => {
    expect(toTitleCase("")).toBe("");
    expect(toUpperCase("")).toBe("");
  });
});


describe("splitWords", () => {
  it.each([
    ["hello world", ["hello", "world"]],
    ["helloWorld", ["hello", "World"]],
    ["HelloWorld", ["Hello", "World"]],
    ["hello_world", ["hello", "world"]],
    ["HELLO_WORLD", ["HELLO", "WORLD"]],
    ["hello-world", ["hello", "world"]],
    ["hello.world", ["hello", "world"]],
    ["src/hello/world", ["src", "hello", "world"]],
    ["  --hello__world..  ", ["hello", "world"]],
    ["mixed_case-and.more/separators here", ["mixed", "case", "and", "more", "separators", "here"]],
  ])("separators and boundaries: %s", (input, words) => {
    expect(splitWords(input)).toEqual(words);
  });

  it.each([
    ["parseHTTPResponse", ["parse", "HTTP", "Response"]],
    ["XMLHttpRequest", ["XML", "Http", "Request"]],
    ["getURL", ["get", "URL"]],
    ["HTTPSConnection", ["HTTPS", "Connection"]],
    ["userID", ["user", "ID"]],
    ["ABC", ["ABC"]],
  ])("acronyms: %s", (input, words) => {
    expect(splitWords(input)).toEqual(words);
  });

  it.each([
    ["version2Update", ["version2", "Update"]],
    ["utf8", ["utf8"]],
    ["base64Encode", ["base64", "Encode"]],
    ["HTML5Parser", ["HTML5", "Parser"]],
    ["getHTTP2Stream", ["get", "HTTP2", "Stream"]],
    ["v2 api", ["v2", "api"]],
    ["123abc", ["123abc"]],
    ["1st_place", ["1st", "place"]],
  ])("digits stay attached to the preceding word: %s", (input, words) => {
    expect(splitWords(input)).toEqual(words);
  });

  it("handles unicode letters", () => {
    expect(splitWords("çalışmaZamanı ÖzelDurum")).toEqual(["çalışma", "Zamanı", "Özel", "Durum"]);
    expect(splitWords("ΑλφαΒήτα")).toEqual(["Αλφα", "Βήτα"]);
    expect(splitWords("straßeName")).toEqual(["straße", "Name"]);
    expect(splitWords("日本語_テキスト")).toEqual(["日本語", "テキスト"]);
    expect(splitWords("café_menu")).toEqual(["café", "menu"]);
  });

  it("drops apostrophes inside words and ignores punctuation", () => {
    expect(splitWords("don't stop")).toEqual(["dont", "stop"]);
    expect(splitWords("Hello, world!")).toEqual(["Hello", "world"]);
    expect(splitWords("")).toEqual([]);
    expect(splitWords("--- !!")).toEqual([]);
  });
});

describe("identifier case conversions", () => {
  const all = (s) => [
    toCamelCase(s),
    toPascalCase(s),
    toSnakeCase(s),
    toScreamingSnakeCase(s),
    toKebabCase(s),
    toDotCase(s),
    toSentenceCase(s),
  ];

  it.each([
    ["hello world", ["helloWorld", "HelloWorld", "hello_world", "HELLO_WORLD", "hello-world", "hello.world", "Hello world"]],
    ["user_id", ["userId", "UserId", "user_id", "USER_ID", "user-id", "user.id", "User id"]],
    ["parseHTTPResponse", ["parseHttpResponse", "ParseHttpResponse", "parse_http_response", "PARSE_HTTP_RESPONSE", "parse-http-response", "parse.http.response", "Parse http response"]],
    ["XMLHttpRequest", ["xmlHttpRequest", "XmlHttpRequest", "xml_http_request", "XML_HTTP_REQUEST", "xml-http-request", "xml.http.request", "Xml http request"]],
    ["version2Update", ["version2Update", "Version2Update", "version2_update", "VERSION2_UPDATE", "version2-update", "version2.update", "Version2 update"]],
    ["utf8", ["utf8", "Utf8", "utf8", "UTF8", "utf8", "utf8", "Utf8"]],
    ["HTTP_STATUS_CODE", ["httpStatusCode", "HttpStatusCode", "http_status_code", "HTTP_STATUS_CODE", "http-status-code", "http.status.code", "Http status code"]],
    ["my-file.name", ["myFileName", "MyFileName", "my_file_name", "MY_FILE_NAME", "my-file-name", "my.file.name", "My file name"]],
    ["__private_var__", ["privateVar", "PrivateVar", "private_var", "PRIVATE_VAR", "private-var", "private.var", "Private var"]],
    ["çalışmaZamanı", ["çalışmaZamanı", "ÇalışmaZamanı", "çalışma_zamanı", "ÇALIŞMA_ZAMANI", "çalışma-zamanı", "çalışma.zamanı", "Çalışma zamanı"]],
  ])("%s", (input, expected) => {
    expect(all(input)).toEqual(expected);
  });

  it("is idempotent", () => {
    for (const f of [toCamelCase, toPascalCase, toSnakeCase, toScreamingSnakeCase, toKebabCase, toDotCase]) {
      const once = f("parse HTTP response v2");
      expect(f(once)).toBe(once);
    }
  });

  it("round-trips between styles", () => {
    expect(toCamelCase(toSnakeCase("getUserById"))).toBe("getUserById");
    expect(toPascalCase(toKebabCase("XMLParser"))).toBe("XmlParser");
    expect(toSnakeCase(toDotCase("api_v2_client"))).toBe("api_v2_client");
  });

  it("converts each line independently and keeps indentation", () => {
    const input = "first_name\n  lastName\n\n\tDate-Of-Birth  \r\nHTTPServer";
    expect(toCamelCase(input)).toBe("firstName\n  lastName\n\n\tdateOfBirth  \r\nhttpServer");
    expect(toScreamingSnakeCase(input)).toBe("FIRST_NAME\n  LAST_NAME\n\n\tDATE_OF_BIRTH  \r\nHTTP_SERVER");
    expect(toKebabCase("a b\nc d")).toBe("a-b\nc-d");
  });

  it("leaves lines without words untouched", () => {
    expect(toSnakeCase("---\nfooBar\n   \n// !!")).toBe("---\nfoo_bar\n   \n// !!");
    expect(toCamelCase("")).toBe("");
  });

  it("joins every word of a line, dropping punctuation", () => {
    expect(toSnakeCase("Hello, world! How are you?")).toBe("hello_world_how_are_you");
    expect(toCamelCase("don't stop")).toBe("dontStop");
  });
});

describe("toSentenceCase", () => {
  it("keeps punctuation in prose and capitalizes each sentence", () => {
    expect(toSentenceCase("the QUICK brown fox. it ran! ok?")).toBe("The quick brown fox. It ran! Ok?");
    expect(toSentenceCase("Hello, World!")).toBe("Hello, world!");
    expect(toSentenceCase("don't STOP me now")).toBe("Don't stop me now");
    expect(toSentenceCase("well-known fact")).toBe("Well-known fact");
  });

  it("does not split versions and numbers", () => {
    expect(toSentenceCase("Version 2.0 RELEASED")).toBe("Version 2.0 released");
    expect(toSentenceCase("v2.0")).toBe("V2.0");
  });

  it("splits identifiers into words", () => {
    expect(toSentenceCase("fooBar baz_qux")).toBe("Foo bar baz qux");
    expect(toSentenceCase("ÖzelDurum")).toBe("Özel durum");
  });

  it("works per line", () => {
    expect(toSentenceCase("first LINE. second\n  userName")).toBe("First line. Second\n  User name");
  });
});
