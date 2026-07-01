// ---------------------------------------------------------------------------
// "Copiar/colar estilo" (Canva format painter).
//
// Captures the *visual* formatting of an element — fill, stroke, shadow,
// outline, opacity, image adjustments, vertical alignment — independent of its
// geometry/content, so it can be stamped onto other elements. Text run marks
// (font/size/color inside the ProseMirror doc) are intentionally NOT copied:
// those live in the rich-text model and belong to the text toolbar.
// ---------------------------------------------------------------------------

import type { Element, Fill, ImageAdjust, Shadow, Stroke } from "../model/deck";

export interface ElementStyle {
  opacity?: number;
  outline?: Stroke;
  shadow?: Shadow;
  /** shape & text background */
  fill?: Fill;
  /** shape border */
  stroke?: Stroke;
  /** image photographic adjustments */
  adjust?: ImageAdjust;
  /** text vertical alignment */
  vAlign?: "top" | "middle" | "bottom";
}

let stored: ElementStyle | null = null;

/** Extract a reusable visual style snapshot from an element. */
export function extractStyle(el: Element): ElementStyle {
  const s: ElementStyle = {};
  if (el.opacity != null) s.opacity = el.opacity;
  if (el.outline) s.outline = structuredClone(el.outline);
  if (el.shadow) s.shadow = structuredClone(el.shadow);
  if (el.type === "shape" || el.type === "text") {
    if (el.fill) s.fill = structuredClone(el.fill);
  }
  if (el.type === "shape" && el.stroke) s.stroke = structuredClone(el.stroke);
  if (el.type === "image" && el.adjust) s.adjust = structuredClone(el.adjust);
  if (el.type === "text" && el.vAlign) s.vAlign = el.vAlign;
  return s;
}

/** Apply a previously-copied style onto an element (mutates in place). */
export function applyStyle(el: Element, s: ElementStyle): void {
  el.opacity = s.opacity;
  el.outline = s.outline ? structuredClone(s.outline) : undefined;
  el.shadow = s.shadow ? structuredClone(s.shadow) : undefined;
  if (el.type === "shape") {
    el.fill = s.fill ? structuredClone(s.fill) : undefined;
    el.stroke = s.stroke ? structuredClone(s.stroke) : undefined;
  } else if (el.type === "text") {
    el.fill = s.fill ? structuredClone(s.fill) : undefined;
    if (s.vAlign) el.vAlign = s.vAlign;
  } else if (el.type === "image") {
    el.adjust = s.adjust ? structuredClone(s.adjust) : undefined;
  }
}

export function copyStyle(el: Element): void {
  stored = extractStyle(el);
}

export function getStyle(): ElementStyle | null {
  return stored;
}

export function hasStyle(): boolean {
  return stored !== null;
}
