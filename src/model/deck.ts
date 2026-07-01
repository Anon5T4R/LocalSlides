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

/** One color stop in a multi-stop gradient (pos is a 0..100 percentage). */
export interface GradientStop {
  color: string;
  pos: number;
}

export type Fill =
  | { kind: "solid"; color: string }
  | {
      kind: "gradient";
      /** Legacy 2-color endpoints; used when `stops` is absent. */
      from: string;
      to: string;
      /** Linear angle in degrees (ignored when radial). */
      angle: number;
      /** Radial instead of linear. */
      radial?: boolean;
      /** 3+ color stops; when present these win over from/to. */
      stops?: GradientStop[];
    }
  | { kind: "image"; src: string; fit?: "cover" | "contain" }
  | { kind: "none" };

/** Visual style of a line/stroke: plain, dashed, dotted, chalky, or smudged. */
export type StrokeStyle = "solid" | "dash" | "dot" | "chalk" | "smudge";

export interface Stroke {
  color: string;
  width: number;
  /** @deprecated kept for old files; superseded by `style`. */
  dash?: "solid" | "dash" | "dot";
  style?: StrokeStyle;
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
export type AnimKind = "none" | "fadeIn" | "slideUp" | "slideLeft" | "zoomIn" | "bounceIn" | "flipIn";

export interface Anim {
  kind: AnimKind;
  /** seconds */
  duration: number;
  /** seconds */
  delay: number;
}

export interface Shadow {
  color: string;
  blur: number;
  x: number;
  y: number;
}

export interface Base {
  id: string;
  geom: Geom;
  locked?: boolean;
  /** Hidden from the canvas/present/export (toggle via the Layers panel). */
  hidden?: boolean;
  /** 0..1 */
  opacity?: number;
  /** Decorative ring drawn around the element ("contorno"). */
  outline?: Stroke;
  /** Drop shadow. */
  shadow?: Shadow;
  /** Entrance animation for present mode. */
  anim?: Anim;
  /** Elements sharing a groupId select and move together (flat grouping). */
  groupId?: string;
  /** Mirror horizontally / vertically (visual only; geometry unchanged). */
  flipH?: boolean;
  flipV?: boolean;
}

/** Canva-style text effect presets, applied to the whole box (Onda 10). */
export type TextEffectKind = "none" | "shadow" | "lift" | "hollow" | "splice" | "echo" | "neon" | "glow";

export interface TextEffect {
  kind: TextEffectKind;
  /** Accent color used by splice/echo/neon/glow (defaults to the theme accent). */
  color?: string;
  /** 0..100, controls offset/blur strength. */
  intensity?: number;
}

export interface TextBox extends Base {
  type: "text";
  content: ProseMirrorJSON;
  vAlign?: "top" | "middle" | "bottom";
  /** placeholder kind, when this box came from a layout (drives AI fill & theme). */
  placeholder?: "title" | "body";
  /** Shrink the text to never overflow the box. Undefined = on (only shrinks on overflow). */
  autoFit?: boolean;
  /** Background fill for the text box. */
  fill?: Fill;
  /** Canva-style whole-box text effect (shadow/hollow/neon/…). */
  effect?: TextEffect;
}

/** Crop rectangle as fractions (0..1) of the natural image. Undefined = full. */
export interface Crop {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Photographic adjustments applied as a CSS `filter` to an image. Percent values
 * are 0..200 with 100 = neutral; grayscale/sepia are 0..100; hueRotate in deg;
 * blur in px. Undefined fields mean "neutral".
 */
export interface ImageAdjust {
  brightness?: number;
  contrast?: number;
  saturate?: number;
  grayscale?: number;
  sepia?: number;
  hueRotate?: number;
  blur?: number;
}

export interface ImageEl extends Base {
  type: "image";
  /** "media/img1.png" inside the zip, or a data URL. */
  src: string;
  fit?: "contain" | "cover";
  /** Visible region of the source image; the element box shows only this. */
  crop?: Crop;
  /** Photographic adjustments (brightness/contrast/saturation/blur/…). */
  adjust?: ImageAdjust;
  /** Clip the image to a shape silhouette (Canva "mascarar"). */
  maskShape?: ShapeKind;
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
  /** Alternate a light tint on odd body rows (Onda 13.2). */
  zebra?: boolean;
}

/** A single freehand stroke: flat [x0,y0,x1,y1,…] points in the ink base coords. */
export interface InkStroke {
  points: number[];
  color: string;
  width: number;
  style?: StrokeStyle;
}

/** A freehand drawing layer. Points live in `base` coords; geom scales/positions it. */
export interface InkEl extends Base {
  type: "ink";
  base: Size;
  strokes: InkStroke[];
}

export type ChartKind = "bar" | "line" | "pie" | "donut" | "area" | "stackedBar";

export interface ChartSeries {
  name: string;
  values: number[];
}

export interface ChartEl extends Base {
  type: "chart";
  chart: ChartKind;
  /** X-axis / slice labels. */
  categories: string[];
  /** One or more data series (pie uses only the first). */
  series: ChartSeries[];
  /** Colors per series (bar/line) or per slice (pie); falls back to theme accents. */
  palette?: string[];
  showLegend?: boolean;
  showValues?: boolean;
  title?: string;
}

/** A vector icon from the built-in pack: an SVG path on a 0 0 24 24 viewBox. */
export interface IconEl extends Base {
  type: "icon";
  path: string;
  color?: string;
}

export type Element = TextBox | ImageEl | VideoEl | ShapeEl | TableEl | InkEl | ChartEl | IconEl;

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

/** An authoring comment pinned to a point on the slide (not shown when presenting). */
export interface Comment {
  id: string;
  x: number;
  y: number;
  text: string;
  resolved?: boolean;
}

/** Manual ruler guides for a slide: vertical lines at x[], horizontal at y[] (logical px). */
export interface SlideGuides {
  x: number[];
  y: number[];
}

export interface Slide {
  id: string;
  /** Overrides the theme/layout background for this slide. */
  background?: Fill;
  /** ORDER = z-order (last element is on top). */
  elements: Element[];
  notes?: ProseMirrorJSON;
  transition?: Transition;
  /** Authoring comments (editor-only). */
  comments?: Comment[];
  /** User-placed ruler guides (editor-only; elements snap to them). */
  guides?: SlideGuides;
}

/** A reusable media asset uploaded once and inserted many times. */
export interface Asset {
  id: string;
  kind: "image" | "video";
  name: string;
  /** Data URL in memory; externalized to media/ on disk (see serialize.ts). */
  src: string;
}

/** A font imported from the user's machine, embedded so the deck stays portable. */
export interface EmbeddedFont {
  /** CSS family name registered via FontFace, e.g. "My Font". */
  family: string;
  /** Display label shown in the font picker. */
  label: string;
  /** Full CSS font-family value, e.g. "'My Font', sans-serif". */
  value: string;
  /** Font file as a data URL in memory; externalized to fonts/ on disk. */
  src: string;
}

export interface Deck {
  version: 1;
  size: Size;
  theme: Theme;
  slides: Slide[];
  /** Deck-level library of uploaded media, for quick reuse. */
  assets?: Asset[];
  /** Fonts imported from disk and embedded so the deck renders anywhere. */
  fonts?: EmbeddedFont[];
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

/**
 * True when any run in the doc carries an explicit fontSize (textStyle mark).
 * Used to let an explicit size win over shrink-to-fit: once the user has picked
 * a size, the box stops auto-shrinking and respects it.
 */
export function pmHasExplicitFontSize(doc: ProseMirrorJSON | undefined): boolean {
  if (!doc) return false;
  const walk = (node: ProseMirrorJSON): boolean => {
    if (node.marks?.some((m) => m.type === "textStyle" && m.attrs?.fontSize)) return true;
    return (node.content ?? []).some(walk);
  };
  return walk(doc);
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

/** Default chart palette derived from the deck theme (accents + a few extras). */
export function chartPalette(deck: Deck): string[] {
  return [
    deck.theme.colors.accent1,
    deck.theme.colors.accent2,
    "#f59e0b",
    "#ef4444",
    "#10b981",
    "#8b5cf6",
    "#ec4899",
    "#14b8a6",
  ];
}

export function newChart(deck: Deck, kind: ChartKind = "bar"): ChartEl {
  const w = Math.min(720, deck.size.w * 0.6);
  const h = Math.min(440, deck.size.h * 0.6);
  return {
    id: makeId("chart"),
    type: "chart",
    geom: { x: (deck.size.w - w) / 2, y: (deck.size.h - h) / 2, w, h, rotation: 0 },
    chart: kind,
    categories: ["Jan", "Fev", "Mar", "Abr"],
    series: [
      { name: "Série 1", values: [12, 19, 9, 17] },
      { name: "Série 2", values: [8, 11, 14, 6] },
    ],
    showLegend: true,
    showValues: false,
    title: "",
  };
}

export function newIcon(deck: Deck, path: string, color?: string): IconEl {
  const s = 120;
  return {
    id: makeId("icon"),
    type: "icon",
    geom: { x: (deck.size.w - s) / 2, y: (deck.size.h - s) / 2, w: s, h: s, rotation: 0 },
    path,
    color: color ?? deck.theme.colors.accent1,
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
