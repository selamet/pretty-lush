import { useEffect } from "react";
import { usePersistentState } from "./usePersistentState.js";
import { STORAGE_KEYS, getStorage, writeText } from "../state/storage.js";
import { loadSettings } from "../state/settings.js";
import { getThemeMeta } from "../editor-themes.js";

// CSS custom properties that non-builtin editor themes override so the app
// chrome matches the editor background.
const CHROME_VARS = [
  "--bg",
  "--surface",
  "--surface-2",
  "--line",
  "--line-strong",
  "--ink",
  "--ink-2",
  "--muted",
  "--accent",
  "--accent-soft",
  "--primary-bg",
  "--primary-bg-hover",
  "--primary-fg",
];

// Persisted formatter / editor settings plus the resolved editor theme. Also
// keeps <html data-theme> and the chrome CSS variables in sync with the theme.
export function useSettings() {
  const [settings, setSettings] = usePersistentState(STORAGE_KEYS.settings, () =>
    loadSettings(getStorage())
  );
  const themeMeta = getThemeMeta(settings.editorTheme);
  useThemeChrome(themeMeta);
  return { settings, setSettings, themeMeta };
}

function useThemeChrome(themeMeta) {
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", themeMeta.mode);
    writeText(STORAGE_KEYS.theme, themeMeta.mode);
  }, [themeMeta.mode]);

  useEffect(() => {
    const root = document.documentElement;
    if (themeMeta.builtin) {
      CHROME_VARS.forEach((k) => root.style.removeProperty(k));
      return;
    }
    root.style.setProperty("--bg", themeMeta.chrome);
    root.style.setProperty("--surface", themeMeta.bg);
    root.style.setProperty("--surface-2", themeMeta.chrome);
    root.style.setProperty("--line", themeMeta.line);
    root.style.setProperty("--line-strong", themeMeta.line);
    root.style.setProperty("--ink", themeMeta.fg);
    root.style.setProperty("--ink-2", themeMeta.fg);
    root.style.setProperty("--muted", themeMeta.muted);
    root.style.setProperty("--accent", themeMeta.accent);
    root.style.setProperty("--accent-soft", themeMeta.accentSoft);
    root.style.setProperty("--primary-bg", themeMeta.accent);
    root.style.setProperty("--primary-bg-hover", themeMeta.accent);
    root.style.setProperty("--primary-fg", themeMeta.bg);
  }, [themeMeta]);
}
