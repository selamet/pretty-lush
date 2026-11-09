// Quick reference shown in the Regex tester's "Cheat sheet" popover.
// `insert` is what clicking an entry puts at the cursor of `target`.
export const CHEAT_SHEET = [
  {
    title: "Characters",
    target: "pattern",
    items: [
      [".", "any char except newline"],
      ["\\d", "digit"],
      ["\\w", "word char [A-Za-z0-9_]"],
      ["\\s", "whitespace"],
      ["\\D \\W \\S", "not digit / word / space", "\\D"],
      ["[abc]", "any of a, b, c"],
      ["[^abc]", "none of a, b, c"],
      ["[a-z]", "range"],
      ["\\p{L}", "Unicode letter (u / v)"],
    ],
  },
  {
    title: "Anchors",
    target: "pattern",
    items: [
      ["^ $", "start / end (of line with m)", "^"],
      ["\\b", "word boundary"],
      ["\\B", "not a word boundary"],
    ],
  },
  {
    title: "Groups",
    target: "pattern",
    items: [
      ["(…)", "capture group", "()"],
      ["(?<name>…)", "named group", "(?<name>)"],
      ["(?:…)", "non-capturing", "(?:)"],
      ["\\1", "back-reference"],
      ["\\k<name>", "named back-reference"],
      ["a|b", "a or b", "|"],
    ],
  },
  {
    title: "Quantifiers",
    target: "pattern",
    items: [
      ["*", "0 or more"],
      ["+", "1 or more"],
      ["?", "0 or 1"],
      ["{n,m}", "n to m times"],
      ["*? +?", "lazy (as few as possible)", "*?"],
    ],
  },
  {
    title: "Lookaround",
    target: "pattern",
    items: [
      ["(?=…)", "followed by", "(?=)"],
      ["(?!…)", "not followed by", "(?!)"],
      ["(?<=…)", "preceded by", "(?<=)"],
      ["(?<!…)", "not preceded by", "(?<!)"],
    ],
  },
  {
    title: "Replacement",
    target: "replacement",
    items: [
      ["$&", "whole match"],
      ["$1", "group 1"],
      ["$<name>", "named group"],
      ["$`  $'", "text before / after the match", "$`"],
      ["$$", "a literal $"],
    ],
  },
];
