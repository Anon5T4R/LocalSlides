// Local, persisted preferences (theme, recents, AI model dir for Fase 5).
// Same shape and localStorage approach as the Writer/Sheets.

export type Theme = "auto" | "light" | "dark";

export interface Settings {
  theme: Theme;
  modelsDir: string;
  lastModelPath: string;
  ngl: number;
  ctx: number;
  /** Onda 16 — dismissed the first-run onboarding tip. */
  onboardingSeen: boolean;
}

const DEFAULTS: Settings = {
  theme: "auto",
  modelsDir: "D:\\LocalAIModels\\.lmstudio\\hub\\models",
  lastModelPath: "",
  ngl: 0,
  ctx: 4096,
  onboardingSeen: false,
};

const SETTINGS_KEY = "localslides.settings";
const RECENTS_KEY = "localslides.recents";
const MAX_RECENTS = 10;

export function loadSettings(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(patch: Partial<Settings>): Settings {
  const next = { ...loadSettings(), ...patch };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  return next;
}

/** Apply the chosen theme to the document root. */
export function applyTheme(theme: Theme): void {
  const el = document.documentElement;
  if (theme === "auto") delete el.dataset.theme;
  else el.dataset.theme = theme;
}

export interface Recent {
  path: string;
  name: string;
  ts: number;
}

export function loadRecents(): Recent[] {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function addRecent(path: string): Recent[] {
  const name = path.split(/[\\/]/).pop() || path;
  const list = loadRecents().filter((r) => r.path !== path);
  list.unshift({ path, name, ts: Date.now() });
  const trimmed = list.slice(0, MAX_RECENTS);
  localStorage.setItem(RECENTS_KEY, JSON.stringify(trimmed));
  return trimmed;
}
