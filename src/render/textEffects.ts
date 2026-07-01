// CSS for the Canva-style whole-box text effect presets (Onda 10). Pure
// function of (effect, base text color) → a style patch merged into the text
// box's own style object, so it composes with the theme font/color/bg as-is.

import type { CSSProperties } from "react";
import type { TextEffect } from "../model/deck";

export const TEXT_EFFECT_PRESETS: { kind: TextEffect["kind"]; label: string }[] = [
  { kind: "none", label: "Nenhum" },
  { kind: "shadow", label: "Sombra" },
  { kind: "lift", label: "Elevação" },
  { kind: "hollow", label: "Contorno" },
  { kind: "splice", label: "Divisão" },
  { kind: "echo", label: "Eco" },
  { kind: "neon", label: "Neon" },
  { kind: "glow", label: "Brilho" },
];

export function textEffectStyle(effect: TextEffect | undefined, baseColor: string): CSSProperties {
  if (!effect || effect.kind === "none") return {};
  const t = (effect.intensity ?? 50) / 100; // 0..1
  const color = effect.color ?? baseColor;

  switch (effect.kind) {
    case "shadow": {
      const d = 1 + t * 6;
      return { textShadow: `${d}px ${d}px ${d * 1.6}px rgba(0,0,0,${0.35 + t * 0.35})` };
    }
    case "lift":
      return { textShadow: `0 ${2 + t * 10}px ${8 + t * 18}px rgba(0,0,0,${0.25 + t * 0.25})` };
    case "hollow":
      return {
        color: "transparent",
        WebkitTextStroke: `${1 + t * 2}px ${baseColor}`,
      } as CSSProperties;
    case "splice":
      return { textShadow: `${2 + t * 6}px 0 0 ${color}` };
    case "echo":
      return { textShadow: `${2 + t * 8}px ${2 + t * 8}px 0 ${color}` };
    case "neon": {
      const r1 = 4 + t * 6, r2 = 8 + t * 12, r3 = 16 + t * 20;
      return {
        color: "#fff",
        textShadow: `0 0 ${r1}px ${color}, 0 0 ${r2}px ${color}, 0 0 ${r3}px ${color}`,
      };
    }
    case "glow":
      return { textShadow: `0 0 ${6 + t * 18}px ${color}` };
    default:
      return {};
  }
}
