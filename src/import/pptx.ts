// ---------------------------------------------------------------------------
// PPTX import — the reverse of export/pptx.ts.
//
// A .pptx is an OPC package (a zip). Mirroring the project's "no native zip"
// rule, ALL parsing happens here in the webview with JSZip + DOMParser; Rust
// only hands us the raw bytes. We walk the slide shape trees and map them onto
// the positional model: EMU geometry → logical px (1px@96dpi = 9525 EMU),
// DrawingML text → ProseMirror, p:pic → ImageEl (media inlined as data URLs),
// a:tbl → TableEl, prstGeom shapes → ShapeEl.
//
// This is intentionally pragmatic, not a full OOXML implementation: theme/
// scheme colors fall back to sane defaults, layout-inherited placeholder
// geometry is approximated, and exotic shapes degrade to rectangles. The goal
// is a faithful-enough editable deck, not a pixel-perfect round trip.
// ---------------------------------------------------------------------------

import JSZip from "jszip";
import {
  Deck,
  Element,
  Fill,
  Geom,
  ImageEl,
  ProseMirrorJSON,
  ShapeEl,
  ShapeKind,
  Slide,
  TableCell,
  TableEl,
  TextBox,
  DEFAULT_THEME,
  makeId,
  plainTextToPM,
} from "../model/deck";

const EMU = 9525; // EMU per logical px (914400/in ÷ 96 px/in)
const R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

const EXT_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  emf: "image/emf",
  wmf: "image/wmf",
  tiff: "image/tiff",
};

// --- DOM helpers (namespace-agnostic: match on localName) -------------------

function parseXml(text: string): Document {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("XML inválido");
  return doc;
}

function kids(el: Element_ | undefined, local: string): Element_[] {
  if (!el) return [];
  return Array.from(el.children).filter((c) => c.localName === local) as Element_[];
}
function kid(el: Element_ | undefined, local: string): Element_ | undefined {
  return kids(el, local)[0];
}
/** First descendant (any depth) with this localName. */
function desc(el: Element_ | undefined, local: string): Element_ | undefined {
  if (!el) return undefined;
  const list = el.getElementsByTagNameNS("*", local);
  return list.length ? (list[0] as Element_) : undefined;
}

type Element_ = globalThis.Element;

const numAttr = (el: Element_ | undefined, name: string): number => {
  const v = el?.getAttribute(name);
  const n = v == null ? NaN : Number(v);
  return Number.isFinite(n) ? n : NaN;
};

// --- Geometry & transforms ---------------------------------------------------

/** Affine in px space: global = (t + local·s). Composes group nesting. */
interface Xform {
  tx: number;
  ty: number;
  sx: number;
  sy: number;
}
const IDENTITY: Xform = { tx: 0, ty: 0, sx: 1, sy: 1 };

interface LocalRect {
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
}

/** Read an <a:xfrm>/<p:xfrm> into a px-space local rect. */
function readXfrm(xf: Element_ | undefined): LocalRect | null {
  if (!xf) return null;
  const off = kid(xf, "off");
  const ext = kid(xf, "ext");
  if (!off || !ext) return null;
  const x = numAttr(off, "x");
  const y = numAttr(off, "y");
  const cx = numAttr(ext, "cx");
  const cy = numAttr(ext, "cy");
  if (![x, y, cx, cy].every(Number.isFinite)) return null;
  const rot = numAttr(xf, "rot");
  return { x: x / EMU, y: y / EMU, w: cx / EMU, h: cy / EMU, rot: Number.isFinite(rot) ? rot / 60000 : 0 };
}

function applyXform(t: Xform, r: LocalRect): Geom {
  return {
    x: Math.round(t.tx + r.x * t.sx),
    y: Math.round(t.ty + r.y * t.sy),
    w: Math.round(r.w * t.sx),
    h: Math.round(r.h * t.sy),
    rotation: Math.round(r.rot * 10) / 10,
  };
}

/** Compose the child transform for a group from its xfrm (off/ext vs chOff/chExt). */
function groupXform(grpSp: Element_, parent: Xform): Xform {
  const xf = kid(kid(grpSp, "grpSpPr"), "xfrm");
  if (!xf) return parent;
  const off = kid(xf, "off");
  const ext = kid(xf, "ext");
  const choff = kid(xf, "chOff");
  const chext = kid(xf, "chExt");
  if (!off || !ext || !choff || !chext) return parent;
  const ox = numAttr(off, "x") / EMU, oy = numAttr(off, "y") / EMU;
  const ew = numAttr(ext, "cx") / EMU, eh = numAttr(ext, "cy") / EMU;
  const cox = numAttr(choff, "x") / EMU, coy = numAttr(choff, "y") / EMU;
  const cew = numAttr(chext, "cx") / EMU, ceh = numAttr(chext, "cy") / EMU;
  if (![ox, oy, ew, eh, cox, coy, cew, ceh].every(Number.isFinite) || cew === 0 || ceh === 0) return parent;
  const gx = parent.tx + ox * parent.sx;
  const gy = parent.ty + oy * parent.sy;
  const sx = (ew * parent.sx) / cew;
  const sy = (eh * parent.sy) / ceh;
  return { tx: gx - cox * sx, ty: gy - coy * sy, sx, sy };
}

// --- Color & fill ------------------------------------------------------------

/** First solid color under an element, as #rrggbb, or null (noFill / scheme). */
function solidColor(container: Element_ | undefined): string | null {
  const fill = kid(container, "solidFill");
  if (!fill) return null;
  const srgb = kid(fill, "srgbClr");
  if (srgb) {
    const v = srgb.getAttribute("val");
    if (v && /^[0-9a-fA-F]{6}$/.test(v)) return "#" + v.toLowerCase();
  }
  return null; // schemeClr / other → caller decides a fallback
}

function shapeFill(spPr: Element_ | undefined): Fill {
  if (kid(spPr, "noFill")) return { kind: "none" };
  const c = solidColor(spPr);
  if (c) return { kind: "solid", color: c };
  return { kind: "solid", color: "#cbd5e1" };
}

// --- Text: DrawingML <a:txBody> → ProseMirror -------------------------------

const ALGN: Record<string, string> = { l: "left", ctr: "center", r: "right", just: "justify" };

function parseRun(r: Element_): ProseMirrorJSON | null {
  const t = kid(r, "t");
  const text = t?.textContent ?? "";
  if (!text) return null;
  const rPr = kid(r, "rPr");
  const marks: NonNullable<ProseMirrorJSON["marks"]> = [];
  if (rPr) {
    if (rPr.getAttribute("b") === "1") marks.push({ type: "bold" });
    if (rPr.getAttribute("i") === "1") marks.push({ type: "italic" });
    const u = rPr.getAttribute("u");
    if (u && u !== "none") marks.push({ type: "underline" });
    const strike = rPr.getAttribute("strike");
    if (strike && strike !== "noStrike") marks.push({ type: "strike" });
    const color = solidColor(rPr);
    if (color) marks.push({ type: "textStyle", attrs: { color } });
  }
  return { type: "text", text, ...(marks.length ? { marks } : {}) };
}

interface ParaBlock {
  bullet: boolean;
  para: ProseMirrorJSON;
}

function parseParagraph(p: Element_): ParaBlock {
  const pPr = kid(p, "pPr");
  const algn = pPr?.getAttribute("algn") ?? undefined;
  const hasBuChar = !!kid(pPr, "buChar") || !!kid(pPr, "buAutoNum");
  const buNone = !!kid(pPr, "buNone");
  const bullet = hasBuChar && !buNone;

  const inlines: ProseMirrorJSON[] = [];
  for (const c of Array.from(p.children)) {
    if (c.localName === "r") {
      const run = parseRun(c);
      if (run) inlines.push(run);
    } else if (c.localName === "br") {
      // hard line break inside a paragraph; ProseMirror paragraphs are single-line,
      // so we just keep the runs flowing (lossy but readable).
    }
  }
  const attrs = algn && ALGN[algn] ? { textAlign: ALGN[algn] } : undefined;
  const para: ProseMirrorJSON = {
    type: "paragraph",
    ...(attrs ? { attrs } : {}),
    ...(inlines.length ? { content: inlines } : {}),
  };
  return { bullet, para };
}

/** Build a ProseMirror doc, grouping runs of bullet paragraphs into bulletLists. */
function parseTextBody(txBody: Element_): { doc: ProseMirrorJSON; text: string } {
  const blocks = kids(txBody, "p").map(parseParagraph);
  const content: ProseMirrorJSON[] = [];
  let i = 0;
  while (i < blocks.length) {
    if (blocks[i].bullet) {
      const items: ProseMirrorJSON[] = [];
      while (i < blocks.length && blocks[i].bullet) {
        items.push({ type: "listItem", content: [blocks[i].para] });
        i++;
      }
      content.push({ type: "bulletList", content: items });
    } else {
      content.push(blocks[i].para);
      i++;
    }
  }
  const doc: ProseMirrorJSON = { type: "doc", content: content.length ? content : [{ type: "paragraph" }] };
  const text = (txBody.textContent ?? "").trim();
  return { doc, text };
}

// --- Shape kind --------------------------------------------------------------

const PRST_MAP: Record<string, ShapeKind> = {
  rect: "rect",
  roundRect: "roundRect",
  round1Rect: "roundRect",
  round2SameRect: "roundRect",
  ellipse: "ellipse",
  oval: "ellipse",
  triangle: "triangle",
  isoscelesTriangle: "triangle",
  rtTriangle: "triangle",
};

// --- Per-shape parsing -------------------------------------------------------

interface SlideCtx {
  zip: JSZip;
  rels: Map<string, string>; // rId → absolute zip path
  size: { w: number; h: number };
  mediaCache: Map<string, string>;
}

function phType(sp: Element_): string | undefined {
  const ph = desc(kid(kid(sp, "nvSpPr"), "nvPr"), "ph");
  return ph?.getAttribute("type") ?? (ph ? "body" : undefined);
}

/** Default geometry for a placeholder that inherited geometry from the layout. */
function placeholderGeom(kind: "title" | "body", size: { w: number; h: number }): Geom {
  const m = Math.round(size.w * 0.06);
  return kind === "title"
    ? { x: m, y: Math.round(size.h * 0.07), w: size.w - 2 * m, h: Math.round(size.h * 0.18), rotation: 0 }
    : { x: m, y: Math.round(size.h * 0.3), w: size.w - 2 * m, h: Math.round(size.h * 0.6), rotation: 0 };
}

function parseSp(sp: Element_, t: Xform, ctx: SlideCtx): Element | null {
  const spPr = kid(sp, "spPr");
  const txBody = kid(sp, "txBody");
  const parsed = txBody ? parseTextBody(txBody) : null;
  const hasText = !!parsed && parsed.text.length > 0;

  const ph = phType(sp);
  const isTitle = ph === "title" || ph === "ctrTitle";
  const isBody = ph === "body" || ph === "subTitle";
  const txBox = kid(sp, "nvSpPr") && desc(sp, "cNvSpPr")?.getAttribute("txBox") === "1";

  const prst = kid(spPr, "prstGeom")?.getAttribute("prst") ?? undefined;
  const shapeKind = prst ? PRST_MAP[prst] : undefined;

  const rect = readXfrm(kid(spPr, "xfrm"));
  let geom: Geom;
  if (rect) geom = applyXform(t, rect);
  else if (isTitle) geom = placeholderGeom("title", ctx.size);
  else if (isBody || hasText) geom = placeholderGeom("body", ctx.size);
  else return null; // no geometry and nothing to salvage

  const opacity = undefined;
  void opacity;

  // Decide concrete element type.
  if (isTitle) {
    return mkText(parsed?.doc, geom, "title");
  }
  if (txBox || isBody) {
    return mkText(parsed?.doc, geom, "body");
  }
  const treatAsShape =
    (shapeKind && shapeKind !== "rect") ||
    (prst === "rect" && !hasText) ||
    (!!prst && !hasText);
  if (treatAsShape) {
    const el: ShapeEl = {
      id: makeId("shape"),
      type: "shape",
      geom,
      shape: shapeKind ?? "rect",
      fill: shapeFill(spPr),
      ...(hasText && parsed ? { text: parsed.doc } : {}),
    };
    const stroke = strokeOf(spPr);
    if (stroke) el.stroke = stroke;
    return el;
  }
  if (hasText) return mkText(parsed!.doc, geom, "body");
  return null;
}

function strokeOf(spPr: Element_ | undefined): ShapeEl["stroke"] | undefined {
  const ln = kid(spPr, "ln");
  if (!ln) return undefined;
  if (kid(ln, "noFill")) return undefined;
  const color = solidColor(ln);
  if (!color) return undefined;
  const wEmu = numAttr(ln, "w");
  const width = Number.isFinite(wEmu) ? Math.max(1, Math.round(wEmu / EMU)) : 1;
  return { color, width };
}

function mkText(doc: ProseMirrorJSON | undefined, geom: Geom, placeholder: "title" | "body"): TextBox {
  return {
    id: makeId("text"),
    type: "text",
    geom,
    vAlign: placeholder === "title" ? "middle" : "top",
    placeholder,
    content: doc ?? plainTextToPM(""),
  };
}

async function parsePic(pic: Element_, t: Xform, ctx: SlideCtx): Promise<ImageEl | null> {
  const spPr = kid(pic, "spPr");
  const rect = readXfrm(kid(spPr, "xfrm"));
  if (!rect) return null;
  const blip = desc(kid(pic, "blipFill"), "blip");
  const embed = blip?.getAttributeNS(R_NS, "embed") ?? blip?.getAttribute("r:embed") ?? undefined;
  if (!embed) return null;
  const path = ctx.rels.get(embed);
  if (!path) return null;
  const src = await loadMedia(path, ctx);
  if (!src) return null;
  return { id: makeId("image"), type: "image", geom: applyXform(t, rect), fit: "contain", src };
}

function parseGraphicFrame(gf: Element_, t: Xform, ctx: SlideCtx): TableEl | null {
  const tbl = desc(gf, "tbl");
  if (!tbl) return null; // charts/SmartArt/etc. are not imported
  const rect = readXfrm(kid(gf, "xfrm"));
  const geom = rect
    ? applyXform(t, rect)
    : { x: Math.round(ctx.size.w * 0.1), y: Math.round(ctx.size.h * 0.25), w: Math.round(ctx.size.w * 0.8), h: Math.round(ctx.size.h * 0.5), rotation: 0 };

  const rows: TableCell[][] = kids(tbl, "tr").map((tr) =>
    kids(tr, "tc").map((tc) => {
      const tb = kid(tc, "txBody");
      return { content: tb ? parseTextBody(tb).doc : plainTextToPM("") };
    })
  );
  if (!rows.length) return null;
  // Pad ragged rows so the grid stays rectangular.
  const cols = Math.max(...rows.map((r) => r.length));
  for (const r of rows) while (r.length < cols) r.push({ content: plainTextToPM("") });

  return { id: makeId("table"), type: "table", geom, rows, border: { color: "#94a3b8", width: 1 } };
}

// --- Media -------------------------------------------------------------------

async function loadMedia(path: string, ctx: SlideCtx): Promise<string | null> {
  if (ctx.mediaCache.has(path)) return ctx.mediaCache.get(path)!;
  const f = ctx.zip.file(path);
  if (!f) return null;
  const bytes = await f.async("uint8array");
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const mime = EXT_MIME[ext] ?? "application/octet-stream";
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  const url = `data:${mime};base64,${btoa(bin)}`;
  ctx.mediaCache.set(path, url);
  return url;
}

// --- Path & relationship resolution -----------------------------------------

/** Resolve an OPC-relative target ("../media/x.png") against a base dir. */
function resolvePath(baseDir: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const parts = (baseDir ? baseDir.split("/") : []).filter(Boolean);
  for (const seg of target.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg !== "." && seg !== "") parts.push(seg);
  }
  return parts.join("/");
}

async function readRels(zip: JSZip, partPath: string): Promise<Map<string, string>> {
  const dir = partPath.includes("/") ? partPath.slice(0, partPath.lastIndexOf("/")) : "";
  const relsPath = `${dir}/_rels/${partPath.slice(dir.length + (dir ? 1 : 0))}.rels`;
  const map = new Map<string, string>();
  const f = zip.file(relsPath);
  if (!f) return map;
  const doc = parseXml(await f.async("string"));
  for (const rel of Array.from(doc.getElementsByTagName("*")).filter((e) => e.localName === "Relationship")) {
    const id = rel.getAttribute("Id");
    const target = rel.getAttribute("Target");
    const mode = rel.getAttribute("TargetMode");
    if (!id || !target || mode === "External") continue;
    map.set(id, resolvePath(dir, target));
  }
  return map;
}

// --- Slide & deck assembly ---------------------------------------------------

async function walkTree(
  container: Element_,
  t: Xform,
  ctx: SlideCtx,
  out: Element[]
): Promise<void> {
  for (const node of Array.from(container.children) as Element_[]) {
    switch (node.localName) {
      case "sp": {
        const el = parseSp(node, t, ctx);
        if (el) out.push(el);
        break;
      }
      case "pic": {
        const el = await parsePic(node, t, ctx);
        if (el) out.push(el);
        break;
      }
      case "graphicFrame": {
        const el = parseGraphicFrame(node, t, ctx);
        if (el) out.push(el);
        break;
      }
      case "grpSp": {
        await walkTree(node, groupXform(node, t), ctx, out);
        break;
      }
      // cxnSp (connectors) and others are skipped.
    }
  }
}

async function parseSlide(zip: JSZip, slidePath: string, size: { w: number; h: number }): Promise<Slide> {
  const doc = parseXml(await zip.file(slidePath)!.async("string"));
  const rels = await readRels(zip, slidePath);
  const ctx: SlideCtx = { zip, rels, size, mediaCache: new Map() };

  const spTree = desc(doc.documentElement, "spTree");
  const elements: Element[] = [];
  if (spTree) await walkTree(spTree, IDENTITY, ctx, elements);

  // Slide background (solid only; theme/bgRef fallbacks are left to the deck theme).
  const bgColor = solidColor(desc(desc(doc.documentElement, "bg"), "bgPr"));
  const slide: Slide = { id: makeId("slide"), elements };
  if (bgColor) slide.background = { kind: "solid", color: bgColor };
  return slide;
}

/** Build the ordered list of slide part paths from presentation.xml + its rels. */
async function slideOrder(zip: JSZip): Promise<string[]> {
  const presPath = "ppt/presentation.xml";
  const presFile = zip.file(presPath);
  if (!presFile) throw new Error("presentation.xml ausente — arquivo PPTX inválido.");
  const doc = parseXml(await presFile.async("string"));
  const rels = await readRels(zip, presPath);
  const ids = Array.from(doc.getElementsByTagName("*")).filter((e) => e.localName === "sldId");
  const paths: string[] = [];
  for (const sld of ids) {
    const rid = sld.getAttributeNS(R_NS, "id") ?? sld.getAttribute("r:id");
    const p = rid ? rels.get(rid) : undefined;
    if (p && zip.file(p)) paths.push(p);
  }
  return paths;
}

function readSlideSize(doc: Document): { w: number; h: number } {
  const sz = Array.from(doc.getElementsByTagName("*")).find((e) => e.localName === "sldSz");
  const cx = numAttr(sz as Element_, "cx");
  const cy = numAttr(sz as Element_, "cy");
  if (Number.isFinite(cx) && Number.isFinite(cy)) {
    return { w: Math.round(cx / EMU), h: Math.round(cy / EMU) };
  }
  return { w: 1280, h: 720 };
}

/** Parse .pptx bytes into a positional Deck. Throws on a structurally invalid file. */
export async function importPptxToDeck(bytes: Uint8Array): Promise<Deck> {
  const zip = await JSZip.loadAsync(bytes);
  const presFile = zip.file("ppt/presentation.xml");
  if (!presFile) throw new Error("Não parece um arquivo PowerPoint (.pptx) válido.");

  const presDoc = parseXml(await presFile.async("string"));
  const size = readSlideSize(presDoc);
  const order = await slideOrder(zip);

  const slides: Slide[] = [];
  for (const path of order) {
    try {
      slides.push(await parseSlide(zip, path, size));
    } catch {
      slides.push({ id: makeId("slide"), elements: [] }); // keep deck length on a bad slide
    }
  }
  if (!slides.length) slides.push({ id: makeId("slide"), elements: [] });

  return {
    version: 1,
    size,
    theme: structuredClone(DEFAULT_THEME),
    slides,
  };
}
