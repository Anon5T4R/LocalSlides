// Single source of truth for "insertable" items: the topbar "Inserir ▾" menu
// and the InsertPanel (left rail, Onda 7) both consume this catalog so the
// list of shapes/icons/charts/tables never drifts between the two UIs.

import {
  newChart,
  newFreeTextBox,
  newIcon,
  newShape,
  newTable,
  type ChartKind,
  type Deck,
  type Element,
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

export const INSERT_CATALOG: InsertItem[] = [
  {
    id: "text:box",
    label: "Caixa de texto",
    tab: "text",
    tags: ["texto", "text", "caixa"],
    glyph: "T",
    make: (deck) => newFreeTextBox(deck),
  },
  ...SHAPE_PICKER.map((s): InsertItem => ({
    id: `shape:${s.kind}`,
    label: s.label,
    tab: "elements",
    tags: ["forma", "shape", s.label.toLowerCase()],
    glyph: s.glyph,
    make: (deck) => newShape(deck, s.kind),
  })),
  ...ICONS.map((ic): InsertItem => ({
    id: `icon:${ic.name}`,
    label: ic.label,
    tab: "elements",
    tags: ["ícone", "icon", "adesivo", ic.name, ic.label.toLowerCase()],
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
