// Single source of truth for "insertable" items: the topbar "Inserir ▾" menu
// and the InsertPanel (left rail, Onda 7) both consume this catalog so the
// list of shapes/icons/charts/tables never drifts between the two UIs.

import {
  makeId,
  newChart,
  newFreeTextBox,
  newIcon,
  newShape,
  newTable,
  newTextBox,
  plainTextToPM,
  type ChartKind,
  type Deck,
  type Element,
  type ShapeEl,
  type ShapeKind,
} from "../model/deck";
import { ICONS } from "../model/icons";

export type InsertTab = "elements" | "text" | "charts" | "tables";

export interface InsertItem {
  id: string;
  label: string;
  tab: InsertTab;
  tags: string[];
  /** Short glyph/emoji preview (shapes, charts, text). */
  glyph?: string;
  /** SVG path preview on a 0 0 24 24 viewBox (icons). */
  iconPath?: string;
  make: (deck: Deck) => Element;
}

export const SHAPE_PICKER: { kind: ShapeKind; label: string; glyph: string }[] = [
  { kind: "rect", label: "Retângulo", glyph: "▭" },
  { kind: "roundRect", label: "Arredondado", glyph: "▢" },
  { kind: "ellipse", label: "Elipse", glyph: "◯" },
  { kind: "triangle", label: "Triângulo", glyph: "△" },
  { kind: "diamond", label: "Losango", glyph: "◇" },
  { kind: "pentagon", label: "Pentágono", glyph: "⬠" },
  { kind: "hexagon", label: "Hexágono", glyph: "⬡" },
  { kind: "star", label: "Estrela", glyph: "☆" },
  { kind: "arrow", label: "Seta", glyph: "➜" },
  { kind: "doubleArrow", label: "Seta dupla", glyph: "↔" },
  { kind: "chevron", label: "Chevron", glyph: "❯" },
  { kind: "line", label: "Linha", glyph: "—" },
  { kind: "speech", label: "Balão de fala", glyph: "💬" },
  { kind: "thought", label: "Balão de pensamento", glyph: "💭" },
];

export const CHART_PICKER: { kind: ChartKind; label: string; glyph: string }[] = [
  { kind: "bar", label: "Barras", glyph: "📊" },
  { kind: "line", label: "Linhas", glyph: "📈" },
  { kind: "pie", label: "Pizza", glyph: "🥧" },
];

/**
 * "Frames" (Onda 8.3) reuse the plain shape + fill:image machinery instead of a
 * new element type: a dashed placeholder shape that fills with a photo the
 * moment one is dropped on it (see App.tsx `dropImageAt`, which already
 * targets any shape under the cursor).
 */
export const FRAME_PICKER: { kind: ShapeKind; label: string; w: number; h: number }[] = [
  { kind: "roundRect", label: "Moldura retangular", w: 320, h: 320 },
  { kind: "ellipse", label: "Moldura circular", w: 300, h: 300 },
];

function newFrame(deck: Deck, kind: ShapeKind, w: number, h: number): ShapeEl {
  return {
    id: makeId("shape"),
    type: "shape",
    geom: { x: (deck.size.w - w) / 2, y: (deck.size.h - h) / 2, w, h, rotation: 0 },
    shape: kind,
    fill: { kind: "solid", color: "#e2e8f0" },
    stroke: { color: "#94a3b8", width: 2, style: "dash" },
    text: plainTextToPM("Arraste uma foto aqui"),
  };
}

export const INSERT_CATALOG: InsertItem[] = [
  {
    id: "text:box",
    label: "Caixa de texto",
    tab: "text",
    tags: ["texto", "text", "caixa"],
    glyph: "T",
    make: (deck) => newFreeTextBox(deck),
  },
  {
    id: "text:title",
    label: "Adicionar título",
    tab: "text",
    tags: ["texto", "text", "título", "titulo", "heading"],
    glyph: "𝐓",
    make: (deck) => {
      const w = Math.min(880, deck.size.w * 0.7);
      const h = 110;
      return newTextBox({
        geom: { x: (deck.size.w - w) / 2, y: (deck.size.h - h) / 2, w, h, rotation: 0 },
        placeholder: "title",
        vAlign: "middle",
        content: plainTextToPM("Adicione um título"),
      });
    },
  },
  {
    id: "text:subtitle",
    label: "Adicionar subtítulo",
    tab: "text",
    tags: ["texto", "text", "subtítulo", "subtitulo"],
    glyph: "𝐭",
    make: (deck) => {
      const w = Math.min(720, deck.size.w * 0.6);
      const h = 70;
      return newTextBox({
        geom: { x: (deck.size.w - w) / 2, y: (deck.size.h - h) / 2, w, h, rotation: 0 },
        vAlign: "top",
        content: plainTextToPM("Adicione um subtítulo"),
      });
    },
  },
  {
    id: "text:body",
    label: "Adicionar corpo de texto",
    tab: "text",
    tags: ["texto", "text", "corpo", "parágrafo", "paragrafo"],
    glyph: "¶",
    make: (deck) => {
      const w = Math.min(880, deck.size.w * 0.7);
      const h = 200;
      return newTextBox({
        geom: { x: (deck.size.w - w) / 2, y: (deck.size.h - h) / 2, w, h, rotation: 0 },
        placeholder: "body",
        vAlign: "top",
        content: plainTextToPM("Adicione um pouco de texto ao seu design."),
      });
    },
  },
  ...SHAPE_PICKER.map((s): InsertItem => ({
    id: `shape:${s.kind}`,
    label: s.label,
    tab: "elements",
    tags: ["forma", "shape", s.label.toLowerCase()],
    glyph: s.glyph,
    make: (deck) => newShape(deck, s.kind),
  })),
  ...FRAME_PICKER.map((f): InsertItem => ({
    id: `frame:${f.kind}`,
    label: f.label,
    tab: "elements",
    tags: ["moldura", "frame", "foto", f.label.toLowerCase()],
    glyph: "🖼",
    make: (deck) => newFrame(deck, f.kind, f.w, f.h),
  })),
  ...ICONS.map((ic): InsertItem => ({
    id: `icon:${ic.name}`,
    label: ic.label,
    tab: "elements",
    tags: ["ícone", "icon", "adesivo", ic.name, ic.label.toLowerCase(), ic.category ?? "", ...(ic.tags ?? [])],
    iconPath: ic.path,
    make: (deck) => newIcon(deck, ic.path),
  })),
  {
    id: "table:3x3",
    label: "Tabela",
    tab: "tables",
    tags: ["tabela", "table", "grade"],
    glyph: "⊞",
    make: (deck) => newTable(deck, 3, 3),
  },
  ...CHART_PICKER.map((c): InsertItem => ({
    id: `chart:${c.kind}`,
    label: `Gráfico de ${c.label.toLowerCase()}`,
    tab: "charts",
    tags: ["gráfico", "chart", c.label.toLowerCase()],
    glyph: c.glyph,
    make: (deck) => newChart(deck, c.kind),
  })),
];

/** DataTransfer MIME used to drag catalog items / library assets onto the canvas. */
export const INSERT_MIME = "application/x-localslides-insert";

export type InsertDragPayload =
  | { kind: "catalog"; id: string }
  | { kind: "asset"; assetKind: "image" | "video"; src: string };
