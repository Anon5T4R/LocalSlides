// Shared CSS helpers for the Fill model (solid / gradient / image / none).
// Used by every place that paints a fill as a CSS `background`: slide background,
// text-box background (static render + live editor), etc. SVG shapes build their
// own <linearGradient>/<radialGradient>, so they don't use this.

import type { Fill } from "../model/deck";

/** The CSS background value for a gradient fill (linear or radial, multi-stop). */
export function gradientCss(g: Extract<Fill, { kind: "gradient" }>): string {
  const stops =
    g.stops && g.stops.length >= 2 ? g.stops : [
      { color: g.from, pos: 0 },
      { color: g.to, pos: 100 },
    ];
  const list = stops.map((s) => `${s.color} ${s.pos}%`).join(", ");
  return g.radial
    ? `radial-gradient(circle at 50% 50%, ${list})`
    : `linear-gradient(${g.angle}deg, ${list})`;
}

/** CSS `background` value for any fill, or undefined for "none"/unset. */
export function fillToCss(fill: Fill | undefined): string | undefined {
  if (!fill || fill.kind === "none") return undefined;
  if (fill.kind === "solid") return fill.color;
  if (fill.kind === "gradient") return gradientCss(fill);
  // image
  const fit = fill.fit === "contain" ? "contain" : "cover";
  return `center / ${fit} no-repeat url(${fill.src})`;
}
