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
import { t, type MessageKey } from "../lib/i18n";

export interface ThemePreset {
  id: string;
  name: string;
  theme: Theme;
}

// Pilhas das fontes embutidas (OFL via @fontsource — lib/embeddedFonts.ts).
// Cada tema agora tem um par heading/body próprio, estilo "font pairing" de
// template de design, em vez de Inter para tudo.
const SANS = "Inter, system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, 'SFMono-Regular', monospace";
const POPPINS = "Poppins, system-ui, sans-serif";
const MONTSERRAT = "Montserrat, system-ui, sans-serif";
const DMSANS = "'DM Sans', system-ui, sans-serif";
const NUNITO = "Nunito, system-ui, sans-serif";
const RALEWAY = "Raleway, system-ui, sans-serif";
const GROTESK = "'Space Grotesk', system-ui, sans-serif";
const OSWALD = "Oswald, Impact, sans-serif";
const PLAYFAIR = "'Playfair Display', Georgia, serif";
const LORA = "Lora, Georgia, serif";
const CAVEAT = "Caveat, 'Comic Sans MS', cursive";

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "claro",
    name: "Claro",
    theme: {
      colors: { bg: "#ffffff", text: "#1e293b", accent1: "#2563eb", accent2: "#0ea5e9" },
      fonts: { heading: POPPINS, body: SANS },
    },
  },
  {
    id: "escuro",
    name: "Escuro",
    theme: {
      colors: { bg: "#0f172a", text: "#e2e8f0", accent1: "#38bdf8", accent2: "#818cf8" },
      fonts: { heading: MONTSERRAT, body: SANS },
    },
  },
  {
    id: "carvao",
    name: "Carvão",
    theme: {
      colors: { bg: "#1c1917", text: "#f5f5f4", accent1: "#f59e0b", accent2: "#fb7185" },
      fonts: { heading: OSWALD, body: SANS },
    },
  },
  {
    id: "oceano",
    name: "Oceano",
    theme: {
      colors: { bg: "#ecfeff", text: "#0e3a4a", accent1: "#0891b2", accent2: "#2563eb" },
      fonts: { heading: NUNITO, body: NUNITO },
    },
  },
  {
    id: "startup",
    name: "Startup",
    theme: {
      colors: { bg: "#fafafa", text: "#111827", accent1: "#7c3aed", accent2: "#06b6d4" },
      fonts: { heading: GROTESK, body: DMSANS },
    },
  },
  {
    id: "elegante",
    name: "Elegante",
    theme: {
      colors: { bg: "#171717", text: "#fafafa", accent1: "#d4af37", accent2: "#a3a3a3" },
      fonts: { heading: PLAYFAIR, body: RALEWAY },
    },
  },
  {
    id: "manuscrito",
    name: "Manuscrito",
    theme: {
      colors: { bg: "#fffbeb", text: "#44403c", accent1: "#d97706", accent2: "#65a30d" },
      fonts: { heading: CAVEAT, body: NUNITO },
    },
  },
  {
    id: "por-do-sol",
    name: "Pôr do sol",
    theme: {
      colors: { bg: "#fff7ed", text: "#7c2d12", accent1: "#ea580c", accent2: "#db2777" },
      fonts: { heading: RALEWAY, body: NUNITO },
    },
  },
  {
    id: "floresta",
    name: "Floresta",
    theme: {
      colors: { bg: "#f0fdf4", text: "#14532d", accent1: "#16a34a", accent2: "#0d9488" },
      fonts: { heading: LORA, body: SANS },
    },
  },
  {
    id: "ameixa",
    name: "Ameixa",
    theme: {
      colors: { bg: "#1e1b2e", text: "#ede9fe", accent1: "#a78bfa", accent2: "#f472b6" },
      fonts: { heading: PLAYFAIR, body: DMSANS },
    },
  },
  {
    id: "editorial",
    name: "Editorial",
    theme: {
      colors: { bg: "#faf8f5", text: "#292524", accent1: "#b45309", accent2: "#1d4ed8" },
      fonts: { heading: PLAYFAIR, body: LORA },
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

/** Localized display name for a theme preset, keyed by its stable `id`. */
export function themeName(id: string): string {
  return t(`dtheme.${id}` as MessageKey);
}

export function findThemePreset(theme: Theme): ThemePreset | undefined {
  return THEME_PRESETS.find(
    (p) =>
      p.theme.colors.bg === theme.colors.bg &&
      p.theme.colors.text === theme.colors.text &&
      p.theme.colors.accent1 === theme.colors.accent1 &&
      p.theme.fonts.heading === theme.fonts.heading
  );
}
