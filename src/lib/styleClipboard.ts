// ---------------------------------------------------------------------------
// "Copiar/colar estilo" (Canva format painter).
//
// Captures the *visual* formatting of an element — fill, stroke, shadow,
// outline, opacity, image adjustments, vertical alignment — independent of its
// geometry/content, so it can be stamped onto other elements. For text boxes it
// ALSO captures the run formatting (font/size/color/weight, alignment, line
// height) and stamps it across the whole target doc, like Canva.
// ---------------------------------------------------------------------------

import type { Element, Fill, ImageAdjust, ProseMirrorJSON, Shadow, Stroke } from "../model/deck";

/** Text formatting snapshot applied uniformly across a target text box. */
export interface TextStyleSnapshot {
  textStyle?: Record<string, unknown>;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  textAlign?: string;
  lineHeight?: string;
}

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
  /** text run/paragraph formatting */
  text?: TextStyleSnapshot;
}

/** Read the first run's marks + first block's attrs from a ProseMirror doc. */
function extractTextStyle(doc: ProseMirrorJSON | undefined): TextStyleSnapshot {
  const snap: TextStyleSnapshot = {};
  if (!doc) return snap;
  let marks: NonNullable<ProseMirrorJSON["marks"]> = [];
  let block: Record<string, unknown> = {};
  let gotMarks = false;
  let gotBlock = false;
  const walk = (n: ProseMirrorJSON) => {
    if (!gotBlock && (n.type === "paragraph" || n.type === "heading")) {
      block = n.attrs ?? {};
      gotBlock = true;
    }
    if (!gotMarks && n.type === "text" && n.marks) {
      marks = n.marks;
      gotMarks = true;
    }
    (n.content ?? []).forEach(walk);
  };
  walk(doc);
  for (const m of marks) {
    if (m.type === "bold") snap.bold = true;
    else if (m.type === "italic") snap.italic = true;
    else if (m.type === "underline") snap.underline = true;
    else if (m.type === "strike") snap.strike = true;
    else if (m.type === "textStyle") snap.textStyle = { ...(m.attrs ?? {}) };
  }
  if (block.textAlign) snap.textAlign = String(block.textAlign);
  if (block.lineHeight) snap.lineHeight = String(block.lineHeight);
  return snap;
}

/** Stamp a text snapshot across every run/block of a target doc (mutates it). */
function applyTextStyle(doc: ProseMirrorJSON, snap: TextStyleSnapshot): void {
  const walk = (n: ProseMirrorJSON) => {
    if (n.type === "paragraph" || n.type === "heading") {
      const attrs = { ...(n.attrs ?? {}) };
      if (snap.textAlign != null) attrs.textAlign = snap.textAlign;
      if (snap.lineHeight != null) attrs.lineHeight = snap.lineHeight;
      n.attrs = attrs;
    }
    if (n.type === "text") {
      const marks: NonNullable<ProseMirrorJSON["marks"]> = [];
      if (snap.textStyle && Object.values(snap.textStyle).some((v) => v != null)) {
        marks.push({ type: "textStyle", attrs: { ...snap.textStyle } });
      }
      if (snap.bold) marks.push({ type: "bold" });
      if (snap.italic) marks.push({ type: "italic" });
      if (snap.underline) marks.push({ type: "underline" });
      if (snap.strike) marks.push({ type: "strike" });
      n.marks = marks.length ? marks : undefined;
    }
    (n.content ?? []).forEach(walk);
  };
  walk(doc);
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
  if (el.type === "text") {
    if (el.vAlign) s.vAlign = el.vAlign;
    s.text = extractTextStyle(el.content);
  }
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
    if (s.text) applyTextStyle(el.content, s.text);
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
