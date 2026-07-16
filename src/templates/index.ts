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
  ShapeKind,
  TextBox,
  makeId,
  newChart,
  newTextBox,
  plainTextToPM,
} from "../model/deck";
import { ICONS } from "../model/icons";
import { t as tr, type MessageKey } from "../lib/i18n";

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

function shape(kind: ShapeKind, geom: Geom, fill: Fill, opts: Partial<ShapeEl> = {}): ShapeEl {
  return { id: makeId("shape"), type: "shape", geom, shape: kind, fill, ...opts };
}

/** Card/panel color that reads against the theme background (light or dark). */
function panelColor(d: Deck): string {
  const hex = d.theme.colors.bg.replace("#", "");
  const full = hex.length === 3 ? hex.split("").map((ch) => ch + ch).join("") : hex;
  const n = parseInt(full, 16);
  const lum = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum > 128 ? "#f1f5f9" : "#1f2937";
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
          title(tr("tpl.presTitle"), g(m, H * 0.34, W - 2 * m, H * 0.22), { fill: undefined }),
          body(tr("tpl.subtitleAuthorDate"), g(m, H * 0.58, W - 2 * m, H * 0.12)),
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
      const items = [tr("tpl.agendaItem1"), tr("tpl.agendaItem2"), tr("tpl.agendaItem3"), tr("tpl.agendaItem4")];
      const rowH = (H * 0.6) / items.length;
      const elements: Element[] = [title(tr("tpl.agendaTitle"), g(m, H * 0.08, W - 2 * m, H * 0.14))];
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
          body(tr("tpl.section01"), g(m, H * 0.32, W - 2 * m, H * 0.08)),
          title(tr("tpl.sectionTitle"), g(m, H * 0.42, W - 2 * m, H * 0.2)),
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
      const y = H * 0.3, h = H * 0.58;
      return {
        elements: [
          title(tr("tpl.comparisonTitle"), g(m, H * 0.08, W - 2 * m, H * 0.16)),
          rect(g(m, y, colW, h), { kind: "solid", color: panelColor(d) }),
          rect(g(m + colW + gap, y, colW, h), { kind: "solid", color: panelColor(d) }),
          body(tr("tpl.optionA"), g(m + 20, y + 20, colW - 40, 36), { placeholder: undefined }),
          body(tr("tpl.advantages"), g(m + 20, y + 70, colW - 40, h - 90)),
          body(tr("tpl.optionB"), g(m + colW + gap + 20, y + 20, colW - 40, 36), { placeholder: undefined }),
          body(tr("tpl.advantages"), g(m + colW + gap + 20, y + 70, colW - 40, h - 90)),
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
        title(tr("tpl.timelineTitle"), g(m, H * 0.1, W - 2 * m, H * 0.14)),
        rect(g(m, lineY, usableW, 3), { kind: "solid", color: c.accent1 }),
      ];
      steps.forEach((s, i) => {
        const x = m + (usableW / (steps.length - 1)) * i;
        elements.push(
          rect(g(x - 8, lineY - 8, 18, 18), { kind: "solid", color: c.accent2 }),
          body(s, g(x - 60, lineY + 20, 120, 30), { vAlign: "top" }),
          body(tr("tpl.milestone"), g(x - 70, lineY - 70, 140, 44), { vAlign: "bottom" })
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
          title(tr("tpl.quotePlaceholder"), g(m, H * 0.34, W - 2 * m, H * 0.28), {
            vAlign: "top",
          }),
          body(tr("tpl.authorName"), g(m, H * 0.68, W - 2 * m, H * 0.08)),
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
        { n: "87%", l: tr("tpl.satisfaction") },
        { n: "3.2x", l: tr("tpl.growth") },
        { n: "42", l: tr("tpl.countries") },
      ];
      const colW = (W - 2 * m - gap * (stats.length - 1)) / stats.length;
      const elements: Element[] = [title(tr("tpl.resultsTitle"), g(m, H * 0.1, W - 2 * m, H * 0.14))];
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
          body(tr("tpl.image"), g(m, H * 0.08, W - 2 * m, H * 0.66), { vAlign: "middle" }),
          body(tr("tpl.imageCaption"), g(m, H * 0.78, W - 2 * m, H * 0.12)),
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
          title(tr("tpl.thanks"), g(m, H * 0.36, W - 2 * m, H * 0.2)),
          body(tr("tpl.contactPlaceholder"), g(m, H * 0.58, W - 2 * m, H * 0.1)),
        ],
      };
    },
  },

  // --- Onda 17.3: pack extra de templates ---
  {
    id: "capa-minimal",
    name: "Capa minimal",
    category: "Capa",
    build: (d) => {
      const W = d.size.w, H = d.size.h, m = W * 0.1;
      const c = d.theme.colors;
      return {
        elements: [
          rect(g(m, H * 0.3, 6, H * 0.28), { kind: "solid", color: c.accent1 }),
          title(tr("tpl.presTitle"), g(m + 30, H * 0.3, W - 2 * m - 30, H * 0.28), { vAlign: "middle" }),
          body(tr("tpl.authorDate"), g(m + 30, H * 0.62, W - 2 * m - 30, H * 0.08)),
        ],
      };
    },
  },
  {
    id: "capa-foto",
    name: "Capa com foto",
    category: "Capa",
    build: (d) => {
      const W = d.size.w, H = d.size.h, m = W * 0.07;
      const c = d.theme.colors;
      const half = W * 0.46;
      return {
        elements: [
          shape("roundRect", g(W - half - m, H * 0.1, half, H * 0.8), { kind: "solid", color: panelColor(d) }, {
            stroke: { color: c.accent1, width: 2, style: "dash" },
            text: plainTextToPM(tr("tpl.dragPhoto")),
          }),
          title(tr("tpl.presTitle"), g(m, H * 0.3, W - half - 3 * m, H * 0.3), { vAlign: "middle" }),
          body(tr("tpl.subtitleAuthorDate"), g(m, H * 0.64, W - half - 3 * m, H * 0.1)),
        ],
      };
    },
  },
  {
    id: "capa-editorial",
    name: "Capa editorial",
    category: "Capa",
    build: (d) => {
      const W = d.size.w, H = d.size.h, m = W * 0.08;
      const c = d.theme.colors;
      return {
        elements: [
          body(tr("tpl.editionNo1"), g(m, H * 0.1, W - 2 * m, H * 0.06)),
          title(tr("tpl.magazineTitle"), g(m, H * 0.2, W - 2 * m, H * 0.42), { vAlign: "middle" }),
          rect(g(m, H * 0.7, W - 2 * m, 2), { kind: "solid", color: c.text }),
          body(tr("tpl.authorDateSubject"), g(m, H * 0.74, W - 2 * m, H * 0.08)),
        ],
      };
    },
  },
  {
    id: "tres-cards",
    name: "3 cartões",
    category: "Conteúdo",
    build: (d) => {
      const W = d.size.w, H = d.size.h, m = W * 0.06, gap = W * 0.03;
      const c = d.theme.colors;
      const colW = (W - 2 * m - 2 * gap) / 3;
      const y = H * 0.3, h = H * 0.56;
      const cards = [
        { ic: "lightbulb", t: tr("tpl.idea") },
        { ic: "build", t: tr("tpl.execution") },
        { ic: "target", t: tr("tpl.resultCard") },
      ];
      const elements: Element[] = [title(tr("tpl.threePillars"), g(m, H * 0.08, W - 2 * m, H * 0.16))];
      cards.forEach((card, i) => {
        const x = m + i * (colW + gap);
        elements.push(
          shape("roundRect", g(x, y, colW, h), { kind: "solid", color: panelColor(d) }),
          icon(card.ic, g(x + 24, y + 28, 40, 40), c.accent1),
          body(card.t, g(x + 24, y + 84, colW - 48, 36)),
          body(tr("tpl.describePoint"), g(x + 24, y + 128, colW - 48, h - 152))
        );
      });
      return { elements };
    },
  },
  {
    id: "quatro-cards",
    name: "4 cartões",
    category: "Conteúdo",
    build: (d) => {
      const W = d.size.w, H = d.size.h, m = W * 0.06, gap = W * 0.025;
      const c = d.theme.colors;
      const colW = (W - 2 * m - gap) / 2;
      const rowH = (H * 0.62 - gap) / 2;
      const y0 = H * 0.28;
      const cards = [
        { ic: "star", t: tr("tpl.quality") },
        { ic: "bolt", t: tr("tpl.speed") },
        { ic: "lock", t: tr("tpl.security") },
        { ic: "heart", t: tr("tpl.trust") },
      ];
      const elements: Element[] = [title(tr("tpl.differentiators"), g(m, H * 0.07, W - 2 * m, H * 0.15))];
      cards.forEach((card, i) => {
        const x = m + (i % 2) * (colW + gap);
        const y = y0 + Math.floor(i / 2) * (rowH + gap);
        elements.push(
          shape("roundRect", g(x, y, colW, rowH), { kind: "solid", color: panelColor(d) }),
          icon(card.ic, g(x + 22, y + 22, 34, 34), c.accent2),
          body(card.t, g(x + 70, y + 20, colW - 92, 34), { vAlign: "middle" }),
          body(tr("tpl.shortDetail"), g(x + 22, y + 66, colW - 44, rowH - 88))
        );
      });
      return { elements };
    },
  },
  {
    id: "lista-icones",
    name: "Lista com ícones",
    category: "Conteúdo",
    build: (d) => {
      const W = d.size.w, H = d.size.h, m = W * 0.08;
      const c = d.theme.colors;
      const items = [
        { ic: "check", t: tr("tpl.point1") },
        { ic: "check", t: tr("tpl.point2") },
        { ic: "check", t: tr("tpl.point3") },
        { ic: "check", t: tr("tpl.point4") },
      ];
      const rowH = (H * 0.6) / items.length;
      const elements: Element[] = [title(tr("tpl.highlights"), g(m, H * 0.08, W - 2 * m, H * 0.14))];
      items.forEach((it, i) => {
        const y = H * 0.28 + i * rowH;
        elements.push(
          icon(it.ic, g(m, y + rowH * 0.2, 34, 34), c.accent1),
          body(it.t, g(m + 54, y, W - 2 * m - 54, rowH * 0.8), { vAlign: "middle" })
        );
      });
      return { elements };
    },
  },
  {
    id: "titulo-texto",
    name: "Título + texto",
    category: "Conteúdo",
    build: (d) => {
      const W = d.size.w, H = d.size.h, m = W * 0.07;
      const c = d.theme.colors;
      const leftW = W * 0.34;
      return {
        elements: [
          title(tr("tpl.supportTitle"), g(m, H * 0.14, leftW, H * 0.4), { vAlign: "top" }),
          rect(g(m, H * 0.58, W * 0.08, 5), { kind: "solid", color: c.accent1 }),
          body(
            tr("tpl.columnBody"),
            g(m + leftW + W * 0.06, H * 0.16, W - 2 * m - leftW - W * 0.06, H * 0.66)
          ),
        ],
      };
    },
  },
  {
    id: "pergunta",
    name: "Pergunta",
    category: "Conteúdo",
    build: (d) => {
      const W = d.size.w, H = d.size.h, m = W * 0.12;
      const c = d.theme.colors;
      return {
        elements: [
          shape("ellipse", g(-W * 0.12, -H * 0.25, W * 0.36, W * 0.36), { kind: "solid", color: c.accent2 }, { opacity: 0.18 }),
          shape("ellipse", g(W * 0.82, H * 0.65, W * 0.3, W * 0.3), { kind: "solid", color: c.accent1 }, { opacity: 0.18 }),
          body(tr("tpl.forDiscussion"), g(m, H * 0.3, W - 2 * m, H * 0.07)),
          title(tr("tpl.whatIfDifferent"), g(m, H * 0.38, W - 2 * m, H * 0.3), { vAlign: "top" }),
        ],
      };
    },
  },
  {
    id: "equipe",
    name: "Equipe",
    category: "Conteúdo",
    build: (d) => {
      const W = d.size.w, H = d.size.h, m = W * 0.07, gap = W * 0.03;
      const c = d.theme.colors;
      const n = 4;
      const colW = (W - 2 * m - (n - 1) * gap) / n;
      const av = Math.min(colW * 0.7, H * 0.24);
      const elements: Element[] = [title(tr("tpl.teamTitle"), g(m, H * 0.08, W - 2 * m, H * 0.15))];
      for (let i = 0; i < n; i++) {
        const x = m + i * (colW + gap);
        elements.push(
          shape("ellipse", g(x + (colW - av) / 2, H * 0.3, av, av), { kind: "solid", color: i % 2 ? c.accent2 : c.accent1 }, { opacity: 0.85 }),
          body(tr("tpl.fullName"), g(x, H * 0.3 + av + 16, colW, 32), { vAlign: "top" }),
          body(tr("tpl.role"), g(x, H * 0.3 + av + 52, colW, 28))
        );
      }
      return { elements };
    },
  },
  {
    id: "processo",
    name: "Processo (3 passos)",
    category: "Conteúdo",
    build: (d) => {
      const W = d.size.w, H = d.size.h, m = W * 0.06, gap = W * 0.02;
      const c = d.theme.colors;
      const colW = (W - 2 * m - 2 * gap) / 3;
      const y = H * 0.36, h = H * 0.2;
      const steps = [tr("tpl.discover"), tr("tpl.build"), tr("tpl.deliver")];
      const elements: Element[] = [title(tr("tpl.howItWorks"), g(m, H * 0.1, W - 2 * m, H * 0.15))];
      steps.forEach((s, i) => {
        const x = m + i * (colW + gap);
        elements.push(
          shape("chevron", g(x, y, colW, h), { kind: "solid", color: i === 2 ? c.accent2 : c.accent1 }, {
            text: plainTextToPM(s),
            opacity: 0.9 - i * 0.06,
          }),
          body(tr("tpl.stepExplain", { n: i + 1 }), g(x + 8, y + h + 24, colW - 16, H * 0.2))
        );
      });
      return { elements };
    },
  },
  {
    id: "antes-depois",
    name: "Antes / depois",
    category: "Conteúdo",
    build: (d) => {
      const W = d.size.w, H = d.size.h, m = W * 0.06;
      const c = d.theme.colors;
      const colW = W * 0.36;
      const y = H * 0.3, h = H * 0.55;
      const arrowW = W - 2 * m - 2 * colW;
      return {
        elements: [
          title(tr("tpl.transformation"), g(m, H * 0.08, W - 2 * m, H * 0.16)),
          shape("roundRect", g(m, y, colW, h), { kind: "solid", color: panelColor(d) }),
          body(tr("tpl.before"), g(m + 20, y + 18, colW - 40, 34)),
          body(tr("tpl.beforeItems"), g(m + 20, y + 64, colW - 40, h - 84)),
          shape("arrow", g(m + colW + arrowW * 0.2, y + h * 0.4, arrowW * 0.6, h * 0.16), { kind: "solid", color: c.accent1 }),
          shape("roundRect", g(W - m - colW, y, colW, h), { kind: "solid", color: panelColor(d) }, {
            stroke: { color: c.accent2, width: 2, style: "solid" },
          }),
          body(tr("tpl.after"), g(W - m - colW + 20, y + 18, colW - 40, 34)),
          body(tr("tpl.afterItems"), g(W - m - colW + 20, y + 64, colW - 40, h - 84)),
        ],
      };
    },
  },
  {
    id: "swot",
    name: "Matriz SWOT",
    category: "Dados",
    build: (d) => {
      const W = d.size.w, H = d.size.h, m = W * 0.06, gap = 14;
      const colW = (W - 2 * m - gap) / 2;
      const rowH = (H * 0.66 - gap) / 2;
      const y0 = H * 0.26;
      const quads = [
        { t: tr("tpl.strengths"), color: "#16a34a" },
        { t: tr("tpl.weaknesses"), color: "#dc2626" },
        { t: tr("tpl.opportunities"), color: "#2563eb" },
        { t: tr("tpl.threats"), color: "#d97706" },
      ];
      const elements: Element[] = [title(tr("tpl.swotTitle"), g(m, H * 0.06, W - 2 * m, H * 0.14))];
      quads.forEach((q, i) => {
        const x = m + (i % 2) * (colW + gap);
        const y = y0 + Math.floor(i / 2) * (rowH + gap);
        elements.push(
          shape("roundRect", g(x, y, colW, rowH), { kind: "solid", color: q.color }, { opacity: 0.16 }),
          body(q.t, g(x + 18, y + 14, colW - 36, 32)),
          body(tr("tpl.twoItems"), g(x + 18, y + 54, colW - 36, rowH - 70))
        );
      });
      return { elements };
    },
  },
  {
    id: "grafico-destaque",
    name: "Gráfico + insight",
    category: "Dados",
    build: (d) => {
      const W = d.size.w, H = d.size.h, m = W * 0.06;
      const c = d.theme.colors;
      const leftW = W * 0.32;
      const ch = newChart(d, "bar");
      ch.geom = g(m + leftW + W * 0.04, H * 0.18, W - 2 * m - leftW - W * 0.04, H * 0.66);
      return {
        elements: [
          title(tr("tpl.dataThatMatters"), g(m, H * 0.16, leftW, H * 0.34), { vAlign: "top" }),
          rect(g(m, H * 0.52, W * 0.07, 5), { kind: "solid", color: c.accent1 }),
          body(tr("tpl.summarizeChart"), g(m, H * 0.58, leftW, H * 0.24)),
          ch,
        ],
      };
    },
  },
  {
    id: "numero-gigante",
    name: "Número gigante",
    category: "Dados",
    build: (d) => {
      const W = d.size.w, H = d.size.h, m = W * 0.1;
      const c = d.theme.colors;
      return {
        elements: [
          shape("ellipse", g(W * 0.72, -H * 0.2, W * 0.5, W * 0.5), { kind: "solid", color: c.accent1 }, { opacity: 0.12 }),
          title("2,4x", g(m, H * 0.22, W - 2 * m, H * 0.34), { vAlign: "middle" }),
          body(tr("tpl.growth12mo"), g(m, H * 0.58, W - 2 * m, H * 0.08)),
          body(tr("tpl.contextExplain"), g(m, H * 0.7, W - 2 * m, H * 0.1)),
        ],
      };
    },
  },
  {
    id: "cta",
    name: "Chamada para ação",
    category: "Encerramento",
    build: (d) => {
      const W = d.size.w, H = d.size.h, m = W * 0.12;
      const c = d.theme.colors;
      const btnW = Math.min(W * 0.3, 380);
      return {
        elements: [
          title(tr("tpl.readyToStart"), g(m, H * 0.28, W - 2 * m, H * 0.2), { vAlign: "middle" }),
          body(tr("tpl.nextStepMinutes"), g(m, H * 0.5, W - 2 * m, H * 0.08)),
          shape("roundRect", g((W - btnW) / 2, H * 0.62, btnW, H * 0.11), { kind: "solid", color: c.accent1 }, {
            text: plainTextToPM(tr("tpl.talkToUs")),
          }),
        ],
      };
    },
  },
  {
    id: "contato",
    name: "Contato",
    category: "Encerramento",
    build: (d) => {
      const W = d.size.w, H = d.size.h, m = W * 0.1;
      const c = d.theme.colors;
      const rows = [
        { ic: "mail", t: tr("tpl.contactEmail") },
        { ic: "phone", t: tr("tpl.contactPhone") },
        { ic: "location", t: tr("tpl.contactLocation") },
      ];
      const elements: Element[] = [title(tr("tpl.letsChat"), g(m, H * 0.14, W - 2 * m, H * 0.18))];
      rows.forEach((r, i) => {
        const y = H * 0.4 + i * H * 0.13;
        elements.push(
          icon(r.ic, g(m, y, 36, 36), c.accent1),
          body(r.t, g(m + 56, y - 4, W - 2 * m - 56, 44), { vAlign: "middle" })
        );
      });
      return { elements };
    },
  },
];

/** Localized display name for a slide template, keyed by its stable `id`. */
export function templateName(id: string): string {
  return tr(`tpl.${id}` as MessageKey);
}

export function findTemplate(id: string): SlideTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
