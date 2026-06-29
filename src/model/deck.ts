// ---------------------------------------------------------------------------
// LocalSlides data model
//
// A Deck is a positional document: every element carries absolute geometry
// (x, y, w, h, rotation) in *logical pixels* on a fixed-size slide. This is the
// fundamental difference from the Writer (text flow). Rich text lives only
// *inside* text boxes as ProseMirror JSON.
//
// Geometry is stored in logical px (floats). Zoom is a CSS scale on the slide
// container; children keep logical coordinates. PPTX boundary: 1px(96dpi) = 9525 EMU.
// ---------------------------------------------------------------------------

/** A ProseMirror document (same serialization the Writer/Sheets use for TipTap). */
export type ProseMirrorJSON = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: ProseMirrorJSON[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
};

export interface Size {
  w: number;
  h: number;
}

/** 16:9 (default) and 4:3 logical sizes. 1280×720 → 13.333"×7.5" → exact in EMU. */
export const SLIDE_SIZES = {
  "16:9": { w: 1280, h: 720 },
  "4:3": { w: 960, h: 720 },
} as const;

export type AspectRatio = keyof typeof SLIDE_SIZES;

// --- Fills & strokes ---------------------------------------------------------

export type Fill =
  | { kind: "solid"; color: string }
  | { kind: "none" };

export interface Stroke {
  color: string;
  width: number;
  dash?: "solid" | "dash" | "dot";
}

// --- Geometry & elements -----------------------------------------------------

export interface Geom {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
}

/** Entrance animation played in present mode when a slide reveals an element. */
export type AnimKind = "none" | "fadeIn" | "slideUp" | "slideLeft" | "zoomIn";

export interface Anim {
  kind: AnimKind;
  /** seconds */
  duration: number;
  /** seconds */
  delay: number;
}

export interface Base {
  id: string;
  geom: Geom;
  locked?: boolean;
  /** 0..1 */
  opacity?: number;
  /** Decorative ring drawn around the element ("contorno"). */
  outline?: Stroke;
  /** Entrance animation for present mode. */
  anim?: Anim;
  /** Elements sharing a groupId select and move together (flat grouping). */
  groupId?: string;
}

export interface TextBox extends Base {
  type: "text";
  content: ProseMirrorJSON;
  vAlign?: "top" | "middle" | "bottom";
  /** placeholder kind, when this box came from a layout (drives AI fill & theme). */
  placeholder?: "title" | "body";
}

/** Crop rectangle as fractions (0..1) of the natural image. Undefined = full. */
export interface Crop {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ImageEl extends Base {
  type: "image";
  /** "media/img1.png" inside the zip, or a data URL. */
  src: string;
  fit?: "contain" | "cover";
  /** Visible region of the source image; the element box shows only this. */
  crop?: Crop;
}

export interface VideoEl extends Base {
  type: "video";
  /** "media/vid1.mp4" inside the zip, or a data URL. */
  src: string;
  fit?: "contain" | "cover";
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
}

export type ShapeKind =
  | "rect"
  | "roundRect"
  | "ellipse"
  | "triangle"
  | "line"
  | "arrow"
  | "doubleArrow"
  | "chevron"
  | "diamond"
  | "pentagon"
  | "hexagon"
  | "star"
  | "speech"
  | "thought";

export interface ShapeEl extends Base {
  type: "shape";
  shape: ShapeKind;
  fill?: Fill;
  stroke?: Stroke;
  text?: ProseMirrorJSON;
}

export interface TableCell {
  content: ProseMirrorJSON;
}

export interface TableEl extends Base {
  type: "table";
  /** rows[r][c] — rectangular grid. */
  rows: TableCell[][];
  /** Cell border. */
  border?: Stroke;
  /** Optional header-row tint. */
  headerFill?: string;
}

export type Element = TextBox | ImageEl | VideoEl | ShapeEl | TableEl;

/** Element types that reference a media file (image/video) in the zip. */
export type MediaEl = ImageEl | VideoEl;

// --- Theme, slide, deck ------------------------------------------------------

export interface Theme {
  colors: {
    bg: string;
    text: string;
    accent1: string;
    accent2: string;
  };
  fonts: {
    heading: string;
    body: string;
  };
}

/** How the *incoming* slide enters during present-mode navigation. */
export type TransitionKind = "none" | "fade" | "slide" | "push";

export interface Transition {
  kind: TransitionKind;
  /** seconds */
  duration: number;
}

export interface Slide {
  id: string;
  /** Overrides the theme/layout background for this slide. */
  background?: Fill;
  /** ORDER = z-order (last element is on top). */
  elements: Element[];
  notes?: ProseMirrorJSON;
  transition?: Transition;
}

/** A reusable media asset uploaded once and inserted many times. */
export interface Asset {
  id: string;
  kind: "image" | "video";
  name: string;
  /** Data URL in memory; externalized to media/ on disk (see serialize.ts). */
  src: string;
}

export interface Deck {
  version: 1;
  size: Size;
  theme: Theme;
  slides: Slide[];
  /** Deck-level library of uploaded media, for quick reuse. */
  assets?: Asset[];
}

export const DEFAULT_THEME: Theme = {
  colors: {
    bg: "#ffffff",
    text: "#1e293b",
    accent1: "#2563eb",
    accent2: "#0ea5e9",
  },
  fonts: {
    heading: "Inter, system-ui, sans-serif",
    body: "Inter, system-ui, sans-serif",
  },
};

// --- ProseMirror helpers (basic plain-text round-trip for the MVP) -----------

/** Wrap plain text into a minimal ProseMirror doc (one paragraph per line). */
export function plainTextToPM(text: string): ProseMirrorJSON {
  const lines = text.split("\n");
  return {
    type: "doc",
    content: lines.map((line) =>
      line
        ? { type: "paragraph", content: [{ type: "text", text: line }] }
        : { type: "paragraph" }
    ),
  };
}

/** Flatten a ProseMirror doc back to plain text (paragraphs joined by \n). */
export function pmToPlainText(doc: ProseMirrorJSON | undefined): string {
  if (!doc) return "";
  const out: string[] = [];
  const walk = (node: ProseMirrorJSON, isBlock: boolean) => {
    if (node.type === "text") {
      out.push(node.text ?? "");
      return;
    }
    if (isBlock && out.length && node.content) out.push("\n");
    (node.content ?? []).forEach((child) =>
      walk(child, child.type === "paragraph" || child.type === "heading")
    );
  };
  (doc.content ?? []).forEach((node, i) => {
    if (i > 0) out.push("\n");
    walk(node, false);
  });
  return out.join("");
}

// --- Factories ---------------------------------------------------------------

let idCounter = 0;
/** Compact, collision-resistant id (time + counter + random). */
export function makeId(prefix = "el"): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

export function newTextBox(partial: Partial<TextBox> = {}): TextBox {
  return {
    id: makeId("text"),
    type: "text",
    geom: { x: 160, y: 200, w: 960, h: 160, rotation: 0 },
    vAlign: "top",
    content: plainTextToPM("Texto"),
    ...partial,
  };
}

/** A free-floating text box, dropped near the slide center. */
export function newFreeTextBox(deck: Deck): TextBox {
  const w = 480;
  const h = 120;
  return newTextBox({
    geom: { x: (deck.size.w - w) / 2, y: (deck.size.h - h) / 2, w, h, rotation: 0 },
    vAlign: "top",
    content: plainTextToPM("Texto"),
  });
}

export function newImage(deck: Deck, src: string): ImageEl {
  const w = Math.min(640, deck.size.w * 0.6);
  const h = w * 0.62;
  return {
    id: makeId("image"),
    type: "image",
    geom: { x: (deck.size.w - w) / 2, y: (deck.size.h - h) / 2, w, h, rotation: 0 },
    fit: "contain",
    src,
  };
}

export function newVideo(deck: Deck, src: string): VideoEl {
  const w = Math.min(720, deck.size.w * 0.62);
  const h = (w * 9) / 16;
  return {
    id: makeId("video"),
    type: "video",
    geom: { x: (deck.size.w - w) / 2, y: (deck.size.h - h) / 2, w, h, rotation: 0 },
    fit: "contain",
    src,
    autoplay: false,
    loop: false,
    muted: false,
  };
}

export function newTable(deck: Deck, rows = 3, cols = 3): TableEl {
  const w = Math.min(880, deck.size.w * 0.7);
  const h = Math.min(360, deck.size.h * 0.5);
  const grid: TableCell[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ content: plainTextToPM("") }))
  );
  return {
    id: makeId("table"),
    type: "table",
    geom: { x: (deck.size.w - w) / 2, y: (deck.size.h - h) / 2, w, h, rotation: 0 },
    rows: grid,
    border: { color: "#94a3b8", width: 1 },
    headerFill: deck.theme.colors.accent1,
  };
}

export function newShape(deck: Deck, shape: ShapeKind): ShapeEl {
  const w = 320;
  const h = 220;
  return {
    id: makeId("shape"),
    type: "shape",
    geom: { x: (deck.size.w - w) / 2, y: (deck.size.h - h) / 2, w, h, rotation: 0 },
    shape,
    fill: { kind: "solid", color: deck.theme.colors.accent1 },
  };
}

export function newAsset(kind: "image" | "video", name: string, src: string): Asset {
  return { id: makeId("asset"), kind, name, src };
}

/** A blank slide with an optional title + body placeholder layout. */
export function newSlide(withLayout = true): Slide {
  const elements: Element[] = withLayout
    ? [
        newTextBox({
          geom: { x: 96, y: 80, w: 1088, h: 130, rotation: 0 },
          placeholder: "title",
          vAlign: "middle",
          content: plainTextToPM("Título do slide"),
        }),
        newTextBox({
          geom: { x: 96, y: 250, w: 1088, h: 390, rotation: 0 },
          placeholder: "body",
          vAlign: "top",
          content: plainTextToPM("Clique para editar"),
        }),
      ]
    : [];
  return { id: makeId("slide"), elements };
}

export function newDeck(aspect: AspectRatio = "16:9"): Deck {
  return {
    version: 1,
    size: { ...SLIDE_SIZES[aspect] },
    theme: structuredClone(DEFAULT_THEME),
    slides: [newSlide(true)],
  };
}

/** Lookup helpers used throughout the app. */
export function findSlide(deck: Deck, slideId: string): Slide | undefined {
  return deck.slides.find((s) => s.id === slideId);
}

export function findElement(slide: Slide, elementId: string): Element | undefined {
  return slide.elements.find((e) => e.id === elementId);
}
