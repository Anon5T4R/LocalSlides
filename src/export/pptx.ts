// PPTX export. Mirrors the sibling apps' rule: ALL packaging happens in the
// webview (PptxGenJS bundles its own JSZip and builds the .pptx zip in JS), and
// Rust only writes the finished bytes via `write_file_base64`. Nothing native is
// needed, so the Linux AppImage — which can't shell out to a zip tool — works.
//
// The mapping is intentionally pragmatic: a positional deck (absolute px geom on
// a fixed canvas) maps cleanly onto PowerPoint's inch grid (1px@96dpi = 1/96in).
// The lossy point is rich text: ProseMirror marks → PptxGenJS runs, flattening
// per-paragraph structure (alignment, bullets) onto the text box.

import PptxGenJS from "pptxgenjs";
import { invoke } from "@tauri-apps/api/core";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import type {
  Deck,
  Slide,
  Element,
  ProseMirrorJSON,
  TextBox,
  ShapeEl,
  TableEl,
  Fill,
  Stroke,
} from "../model/deck";
import { pmToPlainText } from "../model/deck";
import { inTauri } from "../lib/env";

const PX_PER_IN = 96;
const px = (v: number) => v / PX_PER_IN;

/** PptxGenJS wants 6-hex colors with no leading '#'. Falls back to a default. */
function hex(color: string | undefined, fallback = "000000"): string {
  if (!color) return fallback;
  let c = color.trim().replace(/^#/, "");
  if (c.length === 3) c = c.split("").map((ch) => ch + ch).join("");
  return /^[0-9a-fA-F]{6}$/.test(c) ? c.toUpperCase() : fallback;
}

function fillColor(fill: Fill | undefined): string | null {
  if (!fill || fill.kind === "none") return null;
  return hex(fill.color);
}

const DASH: Record<NonNullable<Stroke["dash"]>, "solid" | "dash" | "sysDot"> = {
  solid: "solid",
  dash: "dash",
  dot: "sysDot",
};

function strokeLine(s: Stroke | undefined) {
  if (!s) return undefined;
  return {
    color: hex(s.color),
    width: Math.max(0.5, s.width * 0.75), // px → pt
    dashType: DASH[s.dash ?? "solid"],
  };
}

// --- ProseMirror → PptxGenJS text runs --------------------------------------

type Run = {
  text: string;
  options: Record<string, unknown>;
};

const HEADING_PT: Record<number, number> = { 1: 32, 2: 28, 3: 24, 4: 20 };

/** Flatten a ProseMirror doc into PptxGenJS text runs (lossy: paragraph props
 *  collapse onto runs via breakLine/align/bullet). */
function pmToRuns(doc: ProseMirrorJSON | undefined): Run[] {
  if (!doc?.content?.length) return [{ text: "", options: {} }];
  const runs: Run[] = [];

  const blockRuns = (block: ProseMirrorJSON, bullet: boolean) => {
    const align = (block.attrs?.textAlign as string) || undefined;
    const isHeading = block.type === "heading";
    const level = (block.attrs?.level as number) || 1;
    const inlines = block.content ?? [];

    const start = runs.length;
    for (const node of inlines) {
      if (node.type !== "text" || !node.text) continue;
      const o: Record<string, unknown> = {};
      let color: string | undefined;
      for (const mark of node.marks ?? []) {
        if (mark.type === "bold") o.bold = true;
        else if (mark.type === "italic") o.italic = true;
        else if (mark.type === "underline") o.underline = { style: "sng" };
        else if (mark.type === "strike") o.strike = true;
        else if (mark.type === "textStyle") {
          if (mark.attrs?.color) color = hex(mark.attrs.color as string);
          if (mark.attrs?.fontSize) {
            const px = parseInt(String(mark.attrs.fontSize), 10);
            if (Number.isFinite(px)) o.fontSize = Math.round(px * 0.75); // px → pt
          }
          if (mark.attrs?.fontFamily) {
            o.fontFace = String(mark.attrs.fontFamily).split(",")[0].replace(/['"]/g, "").trim();
          }
        }
      }
      if (color) o.color = color;
      if (isHeading) {
        o.bold = true;
        o.fontSize = HEADING_PT[level] ?? 24;
      }
      if (align) o.align = align;
      if (bullet) o.bullet = true;
      runs.push({ text: node.text, options: o });
    }

    // Empty paragraph → still emit a line so spacing survives.
    if (runs.length === start) {
      const o: Record<string, unknown> = {};
      if (align) o.align = align;
      runs.push({ text: "", options: o });
    }
    // Terminate the paragraph.
    runs[runs.length - 1].options.breakLine = true;
  };

  const walk = (node: ProseMirrorJSON, bullet: boolean) => {
    switch (node.type) {
      case "paragraph":
      case "heading":
        blockRuns(node, bullet);
        break;
      case "bulletList":
      case "orderedList":
        (node.content ?? []).forEach((li) => walk(li, true));
        break;
      case "listItem":
        (node.content ?? []).forEach((child) => walk(child, bullet));
        break;
      default:
        (node.content ?? []).forEach((child) => walk(child, bullet));
    }
  };

  (doc.content ?? []).forEach((node) => walk(node, false));
  return runs.length ? runs : [{ text: "", options: {} }];
}

// --- Element renderers -------------------------------------------------------

type AnySlide = ReturnType<PptxGenJS["addSlide"]>;

function geomOpts(el: Element) {
  const { x, y, w, h, rotation } = el.geom;
  const o: Record<string, unknown> = { x: px(x), y: px(y), w: px(w), h: px(h) };
  if (rotation) o.rotate = rotation;
  if (el.opacity != null && el.opacity < 1)
    o.transparency = Math.round((1 - el.opacity) * 100);
  return o;
}

const VALIGN: Record<string, "top" | "middle" | "bottom"> = {
  top: "top",
  middle: "middle",
  bottom: "bottom",
};

function addText(s: AnySlide, el: TextBox) {
  const runs = pmToRuns(el.content);
  s.addText(
    runs.map((r) => ({ text: r.text, options: r.options })),
    {
      ...geomOpts(el),
      valign: VALIGN[el.vAlign ?? "top"],
      fontSize: 18,
      color: "000000",
      autoFit: true,
      ...(el.outline ? { line: strokeLine(el.outline) } : {}),
    }
  );
}

const SHAPE_TYPE: Record<ShapeEl["shape"], string> = {
  rect: "rect",
  roundRect: "roundRect",
  ellipse: "ellipse",
  triangle: "triangle",
  line: "line",
  arrow: "rightArrow",
  doubleArrow: "leftRightArrow",
  chevron: "chevron",
  diamond: "diamond",
  pentagon: "pentagon",
  hexagon: "hexagon",
  star: "star5",
  speech: "wedgeRectCallout",
  thought: "cloudCallout",
};

function addShape(s: AnySlide, el: ShapeEl) {
  const fill = fillColor(el.fill);
  const opts: Record<string, unknown> = {
    ...geomOpts(el),
    ...(fill ? { fill: { color: fill } } : { fill: { type: "none" } }),
    ...(el.stroke ? { line: strokeLine(el.stroke) } : {}),
  };
  if (el.text && pmToPlainText(el.text).trim()) {
    const runs = pmToRuns(el.text);
    s.addText(
      runs.map((r) => ({ text: r.text, options: r.options })),
      { ...opts, shape: SHAPE_TYPE[el.shape] as never, align: "center", valign: "middle" }
    );
  } else {
    s.addShape(SHAPE_TYPE[el.shape] as never, opts);
  }
}

function addTable(s: AnySlide, el: TableEl) {
  const border = el.border
    ? { type: "solid" as const, pt: Math.max(0.5, el.border.width * 0.75), color: hex(el.border.color) }
    : undefined;
  const rows = el.rows.map((row, r) =>
    row.map((cell) => ({
      text: pmToPlainText(cell.content),
      options: {
        ...(border ? { border } : {}),
        ...(r === 0 && el.headerFill
          ? { fill: { color: hex(el.headerFill) }, bold: true, color: "FFFFFF" }
          : {}),
        valign: "middle" as const,
      },
    }))
  );
  const { x, y, w, h, rotation } = el.geom;
  s.addTable(rows, {
    x: px(x),
    y: px(y),
    w: px(w),
    h: px(h),
    ...(rotation ? { rotate: rotation } : {}),
    fontSize: 14,
    autoPage: false,
  });
}

function addImageEl(s: AnySlide, el: { type: "image"; src: string; fit?: string; geom: Element["geom"]; opacity?: number }) {
  const g = geomOpts(el as Element);
  s.addImage({
    data: el.src,
    ...g,
    sizing: { type: el.fit === "cover" ? "cover" : "contain", w: px(el.geom.w), h: px(el.geom.h) },
  } as never);
}

function addVideoEl(s: AnySlide, el: { type: "video"; src: string; geom: Element["geom"] }) {
  const { x, y, w, h } = el.geom;
  try {
    s.addMedia({ type: "video", data: el.src, x: px(x), y: px(y), w: px(w), h: px(h) } as never);
  } catch {
    // Some data URLs / codecs aren't embeddable — leave a labeled placeholder.
    s.addText("[vídeo]", { x: px(x), y: px(y), w: px(w), h: px(h), align: "center", valign: "middle", fill: { color: "1E293B" }, color: "FFFFFF" });
  }
}

function renderSlide(pptx: PptxGenJS, deck: Deck, slide: Slide) {
  const s = pptx.addSlide();
  const bg = fillColor(slide.background) ?? hex(deck.theme.colors.bg, "FFFFFF");
  s.background = { color: bg };

  for (const el of slide.elements) {
    switch (el.type) {
      case "text": addText(s, el); break;
      case "shape": addShape(s, el); break;
      case "table": addTable(s, el); break;
      case "image": addImageEl(s, el); break;
      case "video": addVideoEl(s, el); break;
    }
  }
}

/** Build a .pptx for the whole deck and return its bytes as a base64 string. */
export async function deckToPptxBase64(deck: Deck): Promise<string> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "LOCAL", width: px(deck.size.w), height: px(deck.size.h) });
  pptx.layout = "LOCAL";

  for (const slide of deck.slides) renderSlide(pptx, deck, slide);

  // base64 keeps us on the webview→Rust bytes bridge (no native zip needed).
  return (await pptx.write({ outputType: "base64" })) as string;
}

const PPTX_MIME =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

/** Export the deck as a .pptx, saving via native dialog (Tauri) or download. */
export async function exportDeckPptx(deck: Deck, suggestedName = "apresentacao.pptx"): Promise<void> {
  const b64 = await deckToPptxBase64(deck);
  if (inTauri()) {
    const path = await saveDialog({
      defaultPath: suggestedName,
      filters: [{ name: "PowerPoint", extensions: ["pptx"] }],
    });
    if (!path) return;
    await invoke("write_file_base64", { path, base64Data: b64 });
  } else {
    const a = document.createElement("a");
    a.href = `data:${PPTX_MIME};base64,${b64}`;
    a.download = suggestedName;
    a.click();
  }
}
