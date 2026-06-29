// ---------------------------------------------------------------------------
// Theme presets ("temas ricos").
//
// A Theme is just colors + fonts (see model/deck.ts). Because the renderer
// (ElementView/SlideView) reads bg/text/fonts straight from `deck.theme`,
// swapping the theme re-paints the whole deck immediately — no per-element
// migration. Shapes/tables keep the explicit colors the user picked; themes
// drive the slide background, body/heading text color, and typography.
// ---------------------------------------------------------------------------

import type { Theme } from "./deck";

export interface ThemePreset {
  id: string;
  name: string;
  theme: Theme;
}

const SANS = "Inter, system-ui, sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";
const MONO = "'JetBrains Mono', ui-monospace, 'SFMono-Regular', monospace";
const ROUNDED = "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif";

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "claro",
    name: "Claro",
    theme: {
      colors: { bg: "#ffffff", text: "#1e293b", accent1: "#2563eb", accent2: "#0ea5e9" },
      fonts: { heading: SANS, body: SANS },
    },
  },
  {
    id: "escuro",
    name: "Escuro",
    theme: {
      colors: { bg: "#0f172a", text: "#e2e8f0", accent1: "#38bdf8", accent2: "#818cf8" },
      fonts: { heading: SANS, body: SANS },
    },
  },
  {
    id: "carvao",
    name: "Carvão",
    theme: {
      colors: { bg: "#1c1917", text: "#f5f5f4", accent1: "#f59e0b", accent2: "#fb7185" },
      fonts: { heading: SANS, body: SANS },
    },
  },
  {
    id: "oceano",
    name: "Oceano",
    theme: {
      colors: { bg: "#ecfeff", text: "#0e3a4a", accent1: "#0891b2", accent2: "#2563eb" },
      fonts: { heading: ROUNDED, body: SANS },
    },
  },
  {
    id: "por-do-sol",
    name: "Pôr do sol",
    theme: {
      colors: { bg: "#fff7ed", text: "#7c2d12", accent1: "#ea580c", accent2: "#db2777" },
      fonts: { heading: ROUNDED, body: SANS },
    },
  },
  {
    id: "floresta",
    name: "Floresta",
    theme: {
      colors: { bg: "#f0fdf4", text: "#14532d", accent1: "#16a34a", accent2: "#0d9488" },
      fonts: { heading: SANS, body: SANS },
    },
  },
  {
    id: "ameixa",
    name: "Ameixa",
    theme: {
      colors: { bg: "#1e1b2e", text: "#ede9fe", accent1: "#a78bfa", accent2: "#f472b6" },
      fonts: { heading: SANS, body: SANS },
    },
  },
  {
    id: "editorial",
    name: "Editorial",
    theme: {
      colors: { bg: "#faf8f5", text: "#292524", accent1: "#b45309", accent2: "#1d4ed8" },
      fonts: { heading: SERIF, body: SERIF },
    },
  },
  {
    id: "mono",
    name: "Mono",
    theme: {
      colors: { bg: "#f8fafc", text: "#0f172a", accent1: "#0f172a", accent2: "#64748b" },
      fonts: { heading: MONO, body: MONO },
    },
  },
];

export function findThemePreset(theme: Theme): ThemePreset | undefined {
  return THEME_PRESETS.find(
    (p) =>
      p.theme.colors.bg === theme.colors.bg &&
      p.theme.colors.text === theme.colors.text &&
      p.theme.colors.accent1 === theme.colors.accent1 &&
      p.theme.fonts.heading === theme.fonts.heading
  );
}
