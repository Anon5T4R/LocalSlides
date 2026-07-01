// Onda 9 — ready-made slide templates ("resultado profissional em 1 clique").
//
// Unlike model/layouts.ts (bare placeholder positions), a template renders a
// fully styled slide: background, accent shapes, icons, numbers. Each one is a
// `(deck) => { elements, background? }` builder so it adapts to the deck's own
// size and theme colors instead of baking in fixed pixels/hex.

import {
  Deck,
  Element,
  Fill,
  Geom,
  IconEl,
  ShapeEl,
  TextBox,
  makeId,
  newTextBox,
  plainTextToPM,
} from "../model/deck";
import { ICONS } from "../model/icons";

export interface TemplateResult {
  elements: Element[];
  background?: Fill;
}

export interface SlideTemplate {
  id: string;
  name: string;
  category: "Capa" | "Conteúdo" | "Dados" | "Encerramento";
  build: (deck: Deck) => TemplateResult;
}

function g(x: number, y: number, w: number, h: number): Geom {
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), rotation: 0 };
}

function title(text: string, geom: Geom, opts: Partial<TextBox> = {}): TextBox {
  return newTextBox({ geom, placeholder: "title", vAlign: "middle", content: plainTextToPM(text), ...opts });
}

function body(text: string, geom: Geom, opts: Partial<TextBox> = {}): TextBox {
  return newTextBox({ geom, placeholder: "body", vAlign: "top", content: plainTextToPM(text), ...opts });
}

function rect(geom: Geom, fill: Fill): ShapeEl {
  return { id: makeId("shape"), type: "shape", geom, shape: "rect", fill };
}

function icon(name: string, geom: Geom, color: string): IconEl {
  const path = ICONS.find((i) => i.name === name)?.path ?? ICONS[0].path;
  return { id: makeId("icon"), type: "icon", geom, path, color };
}

export const TEMPLATES: SlideTemplate[] = [
  {
    id: "capa-solida",
    name: "Capa",
    category: "Capa",
    build: (d) => {
      const W = d.size.w, H = d.size.h, m = W * 0.1;
      const c = d.theme.colors;
      return {
        background: { kind: "gradient", from: c.accent1, to: c.accent2, angle: 120 },
        elements: [
          rect(g(m, H * 0.28, W * 0.12, 6), { kind: "solid", color: "#ffffff" }),
          title("Título da apresentação", g(m, H * 0.34, W - 2 * m, H * 0.22), { fill: undefined }),
          body("Subtítulo · autor · data", g(m, H * 0.58, W - 2 * m, H * 0.12)),
        ],
      };
    },
  },
  {
    id: "agenda",
    name: "Agenda",
    category: "Conteúdo",
    build: (d) => {
      const W = d.size.w, H = d.size.h, m = W * 0.08;
      const c = d.theme.colors;
      const items = ["Introdução", "Contexto", "Proposta", "Próximos passos"];
      const rowH = (H * 0.6) / items.length;
      const elements: Element[] = [title("Agenda", g(m, H * 0.08, W - 2 * m, H * 0.14))];
      items.forEach((it, i) => {
        const y = H * 0.28 + i * rowH;
        elements.push(
          rect(g(m, y + rowH * 0.25, 34, 34), { kind: "solid", color: c.accent1 }),
          body(String(i + 1), g(m, y + rowH * 0.25, 34, 34), { vAlign: "middle", fill: undefined }),
          body(it, g(m + 50, y, W - 2 * m - 50, rowH * 0.8), { vAlign: "middle" })
        );
      });
      return { elements };
    },
  },
  {
    id: "secao",
    name: "Divisor de seção",
    category: "Conteúdo",
    build: (d) => {
      const W = d.size.w, H = d.size.h, m = W * 0.08;
      const c = d.theme.colors;
      return {
        background: { kind: "solid", color: c.accent1 },
        elements: [
          body("SEÇÃO 01", g(m, H * 0.32, W - 2 * m, H * 0.08)),
          title("Título da seção", g(m, H * 0.42, W - 2 * m, H * 0.2)),
        ],
      };
    },
  },
  {
    id: "comparacao-2col",
    name: "Comparação (2 colunas)",
    category: "Conteúdo",
    build: (d) => {
      const W = d.size.w, H = d.size.h, m = W * 0.06, gap = W * 0.04;
      const colW = (W - 2 * m - gap) / 2;
      const c = d.theme.colors;
      const y = H * 0.3, h = H * 0.58;
      return {
        elements: [
          title("Comparação", g(m, H * 0.08, W - 2 * m, H * 0.16)),
          rect(g(m, y, colW, h), { kind: "solid", color: c.bg === "#ffffff" ? "#f1f5f9" : "#1f2937" }),
          rect(g(m + colW + gap, y, colW, h), { kind: "solid", color: c.bg === "#ffffff" ? "#f1f5f9" : "#1f2937" }),
          body("Opção A", g(m + 20, y + 20, colW - 40, 36), { placeholder: undefined }),
          body("• Vantagem 1\n• Vantagem 2\n• Vantagem 3", g(m + 20, y + 70, colW - 40, h - 90)),
          body("Opção B", g(m + colW + gap + 20, y + 20, colW - 40, 36), { placeholder: undefined }),
          body("• Vantagem 1\n• Vantagem 2\n• Vantagem 3", g(m + colW + gap + 20, y + 70, colW - 40, h - 90)),
        ],
      };
    },
  },
  {
    id: "timeline",
    name: "Linha do tempo",
    category: "Conteúdo",
    build: (d) => {
      const W = d.size.w, H = d.size.h, m = W * 0.08;
      const c = d.theme.colors;
      const steps = ["2023", "2024", "2025", "2026"];
      const lineY = H * 0.5;
      const usableW = W - 2 * m;
      const elements: Element[] = [
        title("Linha do tempo", g(m, H * 0.1, W - 2 * m, H * 0.14)),
        rect(g(m, lineY, usableW, 3), { kind: "solid", color: c.accent1 }),
      ];
      steps.forEach((s, i) => {
        const x = m + (usableW / (steps.length - 1)) * i;
        elements.push(
          rect(g(x - 8, lineY - 8, 18, 18), { kind: "solid", color: c.accent2 }),
          body(s, g(x - 60, lineY + 20, 120, 30), { vAlign: "top" }),
          body("Marco importante", g(x - 70, lineY - 70, 140, 44), { vAlign: "bottom" })
        );
      });
      return { elements };
    },
  },
  {
    id: "citacao",
    name: "Citação",
    category: "Conteúdo",
    build: (d) => {
      const W = d.size.w, H = d.size.h, m = W * 0.14;
      const c = d.theme.colors;
      return {
        elements: [
          icon("info", g(m, H * 0.22, 44, 44), c.accent1),
          title('"Uma citação inspiradora vai aqui."', g(m, H * 0.34, W - 2 * m, H * 0.28), {
            vAlign: "top",
          }),
          body("— Nome do autor", g(m, H * 0.68, W - 2 * m, H * 0.08)),
        ],
      };
    },
  },
  {
    id: "kpi-numeros",
    name: "KPI / números",
    category: "Dados",
    build: (d) => {
      const W = d.size.w, H = d.size.h, m = W * 0.08, gap = W * 0.03;
      const c = d.theme.colors;
      const stats = [
        { n: "87%", l: "Satisfação" },
        { n: "3.2x", l: "Crescimento" },
        { n: "42", l: "Países" },
      ];
      const colW = (W - 2 * m - gap * (stats.length - 1)) / stats.length;
      const elements: Element[] = [title("Resultados", g(m, H * 0.1, W - 2 * m, H * 0.14))];
      stats.forEach((s, i) => {
        const x = m + i * (colW + gap);
        elements.push(
          title(s.n, g(x, H * 0.36, colW, H * 0.2), { vAlign: "bottom", fill: undefined }),
          body(s.l, g(x, H * 0.58, colW, H * 0.1))
        );
        if (i > 0) elements.push(rect(g(x - gap / 2, H * 0.36, 1, H * 0.32), { kind: "solid", color: c.accent1 }));
      });
      return { elements };
    },
  },
  {
    id: "foto-fullbleed",
    name: "Foto com legenda",
    category: "Conteúdo",
    build: (d) => {
      const W = d.size.w, H = d.size.h, m = W * 0.06;
      return {
        elements: [
          rect(g(m, H * 0.08, W - 2 * m, H * 0.66), { kind: "solid", color: "#cbd5e1" }),
          body("Imagem", g(m, H * 0.08, W - 2 * m, H * 0.66), { vAlign: "middle" }),
          body("Legenda da imagem", g(m, H * 0.78, W - 2 * m, H * 0.12)),
        ],
      };
    },
  },
  {
    id: "encerramento",
    name: "Encerramento",
    category: "Encerramento",
    build: (d) => {
      const W = d.size.w, H = d.size.h, m = W * 0.1;
      const c = d.theme.colors;
      return {
        background: { kind: "gradient", from: c.accent2, to: c.accent1, angle: 120 },
        elements: [
          title("Obrigado!", g(m, H * 0.36, W - 2 * m, H * 0.2)),
          body("contato@empresa.com · @empresa", g(m, H * 0.58, W - 2 * m, H * 0.1)),
        ],
      };
    },
  },
];

export function findTemplate(id: string): SlideTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
