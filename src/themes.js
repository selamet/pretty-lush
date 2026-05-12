// Editor theme registry. Built-in themes are inlined; external themes lazy-load on demand.

// Each external theme also describes its chrome colors so the surrounding panes,
// sidebar and status bar match the editor's background instead of clashing with it.
export const THEMES = [
  { id: "pretty-lush-light", label: "Pretty Lush — Light", mode: "light", builtin: true },
  { id: "pretty-lush-dark", label: "Pretty Lush — Dark", mode: "dark", builtin: true },
  {
    id: "github-light",
    label: "GitHub Light",
    mode: "light",
    bg: "#ffffff",
    chrome: "#f6f8fa",
    line: "#d0d7de",
    fg: "#24292f",
    muted: "#6e7781",
    accent: "#218bff",
    accentSoft: "rgba(33, 139, 255, 0.10)",
    load: () => import("@uiw/codemirror-theme-github").then((m) => m.githubLight),
  },
  {
    id: "github-dark",
    label: "GitHub Dark",
    mode: "dark",
    bg: "#0d1117",
    chrome: "#161b22",
    line: "#30363d",
    fg: "#c9d1d9",
    muted: "#8b949e",
    accent: "#58a6ff",
    accentSoft: "rgba(88, 166, 255, 0.14)",
    load: () => import("@uiw/codemirror-theme-github").then((m) => m.githubDark),
  },
  {
    id: "one-dark",
    label: "One Dark",
    mode: "dark",
    bg: "#282c34",
    chrome: "#21252b",
    line: "#3e4451",
    fg: "#abb2bf",
    muted: "#5c6370",
    accent: "#61afef",
    accentSoft: "rgba(97, 175, 239, 0.14)",
    load: () => import("@uiw/codemirror-theme-atomone").then((m) => m.atomone),
  },
  {
    id: "dracula",
    label: "Dracula",
    mode: "dark",
    bg: "#282a36",
    chrome: "#21222c",
    line: "#44475a",
    fg: "#f8f8f2",
    muted: "#6272a4",
    accent: "#bd93f9",
    accentSoft: "rgba(189, 147, 249, 0.16)",
    load: () => import("@uiw/codemirror-theme-dracula").then((m) => m.dracula),
  },
  {
    id: "tokyo-night",
    label: "Tokyo Night",
    mode: "dark",
    bg: "#1a1b26",
    chrome: "#16161e",
    line: "#2a2b3a",
    fg: "#c0caf5",
    muted: "#565f89",
    accent: "#7aa2f7",
    accentSoft: "rgba(122, 162, 247, 0.14)",
    load: () => import("@uiw/codemirror-theme-tokyo-night").then((m) => m.tokyoNight),
  },
  {
    id: "tokyo-night-day",
    label: "Tokyo Night Day",
    mode: "light",
    bg: "#e1e2e7",
    chrome: "#d5d6db",
    line: "#a8aecb",
    fg: "#3760bf",
    muted: "#848cb5",
    accent: "#34548a",
    accentSoft: "rgba(52, 84, 138, 0.12)",
    load: () =>
      import("@uiw/codemirror-theme-tokyo-night-day").then((m) => m.tokyoNightDay),
  },
  {
    id: "solarized-light",
    label: "Solarized Light",
    mode: "light",
    bg: "#fdf6e3",
    chrome: "#eee8d5",
    line: "#d8d2bf",
    fg: "#586e75",
    muted: "#93a1a1",
    accent: "#268bd2",
    accentSoft: "rgba(38, 139, 210, 0.10)",
    load: () =>
      import("@uiw/codemirror-theme-solarized").then((m) => m.solarizedLight),
  },
  {
    id: "solarized-dark",
    label: "Solarized Dark",
    mode: "dark",
    bg: "#002b36",
    chrome: "#073642",
    line: "#0a4250",
    fg: "#93a1a1",
    muted: "#586e75",
    accent: "#268bd2",
    accentSoft: "rgba(38, 139, 210, 0.16)",
    load: () =>
      import("@uiw/codemirror-theme-solarized").then((m) => m.solarizedDark),
  },
];

const THEME_BY_ID = Object.fromEntries(THEMES.map((t) => [t.id, t]));

export function getThemeMeta(id) {
  return THEME_BY_ID[id] || THEMES[0];
}

// Find the opposite-mode sibling of a theme. Falls back to pretty-lush variants.
export function flipTheme(id) {
  const meta = getThemeMeta(id);
  const family = id.replace(/-(light|dark|day)$/, "");
  const sibling = THEMES.find(
    (t) => t.id !== id && t.mode !== meta.mode && t.id.startsWith(family)
  );
  if (sibling) return sibling.id;
  return meta.mode === "dark" ? "pretty-lush-light" : "pretty-lush-dark";
}
