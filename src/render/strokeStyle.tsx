// Shared helpers for line/stroke styles: dashed, dotted, chalk and smudge.
//
// chalk/smudge are SVG filters (noise displacement / blur). Each <svg> that uses
// them inlines <StrokeDefs/> so the effect survives node-cloning during PNG/PDF
// export (cross-svg url(#id) refs would not). Image outlines instead use a CSS
// drop-shadow stack that follows the alpha silhouette (Canva "sticker" effect).

import type { Stroke, StrokeStyle } from "../model/deck";

export const CHALK_FILTER = "sk-chalk";
export const SMUDGE_FILTER = "sk-smudge";

/** Resolve the effective style (new `style`, falling back to the old `dash`). */
export function effectiveStyle(s: Stroke | undefined): StrokeStyle {
  if (!s) return "solid";
  return s.style ?? s.dash ?? "solid";
}

/** SVG stroke-dasharray for a style, scaled by width; undefined for continuous. */
export function dashArrayFor(style: StrokeStyle, width: number): string | undefined {
  const w = Math.max(1, width);
  if (style === "dash") return `${w * 3} ${w * 2}`;
  if (style === "dot") return `${w} ${w * 1.6}`;
  return undefined;
}

/** Filter id (within the same svg) for textured styles, or undefined. */
export function filterIdFor(style: StrokeStyle): string | undefined {
  if (style === "chalk") return CHALK_FILTER;
  if (style === "smudge") return SMUDGE_FILTER;
  return undefined;
}

/** Inline <defs> with the chalk + smudge filters. Drop into any svg that needs them. */
export function StrokeDefs() {
  return (
    <defs>
      <filter id={CHALK_FILTER} x="-25%" y="-25%" width="150%" height="150%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="4" xChannelSelector="R" yChannelSelector="G" />
      </filter>
      <filter id={SMUDGE_FILTER} x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="2.4" />
      </filter>
    </defs>
  );
}

/** Whether a style needs the filter defs inlined. */
export function needsDefs(...styles: StrokeStyle[]): boolean {
  return styles.some((s) => s === "chalk" || s === "smudge");
}

/**
 * CSS `filter` that draws an outline following an image's alpha silhouette
 * (transparent PNGs), like Canva's sticker outline / shadow. `solid`/`chalk`
 * stack sharp drop-shadows in 8 directions; `smudge` is a single soft glow.
 */
export function imageOutlineFilter(outline: Stroke): string {
  const c = outline.color;
  const w = Math.max(1, outline.width);
  const style = effectiveStyle(outline);
  if (style === "smudge") {
    return `drop-shadow(0 0 ${w * 1.5}px ${c}) drop-shadow(0 0 ${w * 1.5}px ${c})`;
  }
  // Sharp silhouette outline: 8 directions at distance w (repeat for opacity).
  const d = w;
  const dirs = [
    [d, 0], [-d, 0], [0, d], [0, -d],
    [d, d], [d, -d], [-d, d], [-d, -d],
  ];
  const shadows = dirs.map(([x, y]) => `drop-shadow(${x}px ${y}px 0 ${c})`).join(" ");
  return shadows;
}
