import { useState } from "react";
import { t, type MessageKey } from "../lib/i18n";
import { THEMES, applyTheme, loadSettings, saveSettings, type Theme } from "../lib/settings";

/** Small interface-theme dropdown for the top bar (auto/light/dark + named themes). */
export function ThemePicker() {
  const [theme, setTheme] = useState<Theme>(() => loadSettings().theme);
  return (
    <select
      className="lang-select"
      value={theme}
      onChange={(e) => {
        const next = e.target.value as Theme;
        setTheme(next);
        saveSettings({ theme: next });
        applyTheme(next);
      }}
      title={t("uitheme.title")}
      aria-label={t("uitheme.title")}
    >
      {THEMES.map((k) => (
        <option key={k} value={k}>
          {t(`uitheme.${k}` as MessageKey)}
        </option>
      ))}
    </select>
  );
}
