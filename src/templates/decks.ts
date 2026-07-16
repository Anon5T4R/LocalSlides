// Onda 17.3 — templates de DECK inteiro (pendência da Onda 9): uma sequência
// curada de slide-templates + um tema, gerando uma apresentação completa de
// uma vez. Reusa os builders de index.ts, então cada deck adapta ao tamanho
// do documento e o texto é 100% editável depois.

import { Deck, Slide, TextBox, makeId, plainTextToPM } from "../model/deck";
import { THEME_PRESETS } from "../model/themes";
import { findTemplate } from "./index";
import { t as tr, type MessageKey } from "../lib/i18n";

export interface DeckTemplate {
  id: string;
  name: string;
  description: string;
  /** id em THEME_PRESETS aplicado ao deck novo. */
  themeId: string;
  /** Sequência de slides: template + overrides de texto. */
  slides: { tpl: string; title?: string; }[];
}

export const DECK_TEMPLATES: DeckTemplate[] = [
  {
    id: "pitch-startup",
    name: "Pitch de startup",
    description: "Problema, solução, mercado, tração e time — 9 slides.",
    themeId: "startup",
    slides: [
      { tpl: "capa-solida", title: tr("tpl.pitch-startup.s1") },
      { tpl: "pergunta", title: tr("tpl.pitch-startup.s2") },
      { tpl: "tres-cards", title: tr("tpl.pitch-startup.s3") },
      { tpl: "numero-gigante", title: tr("tpl.pitch-startup.s4") },
      { tpl: "grafico-destaque", title: tr("tpl.pitch-startup.s5") },
      { tpl: "antes-depois", title: tr("tpl.pitch-startup.s6") },
      { tpl: "timeline", title: tr("tpl.pitch-startup.s7") },
      { tpl: "equipe", title: tr("tpl.pitch-startup.s8") },
      { tpl: "cta", title: tr("tpl.pitch-startup.s9") },
    ],
  },
  {
    id: "relatorio-resultados",
    name: "Relatório de resultados",
    description: "KPIs, gráfico, comparativo e próximos passos — 7 slides.",
    themeId: "claro",
    slides: [
      { tpl: "capa-minimal", title: tr("tpl.relatorio-resultados.s1") },
      { tpl: "agenda" },
      { tpl: "kpi-numeros", title: tr("tpl.relatorio-resultados.s3") },
      { tpl: "grafico-destaque", title: tr("tpl.relatorio-resultados.s4") },
      { tpl: "comparacao-2col", title: tr("tpl.relatorio-resultados.s5") },
      { tpl: "lista-icones", title: tr("tpl.relatorio-resultados.s6") },
      { tpl: "encerramento" },
    ],
  },
  {
    id: "proposta-comercial",
    name: "Proposta comercial",
    description: "Contexto, entrega, cronograma e investimento — 8 slides.",
    themeId: "elegante",
    slides: [
      { tpl: "capa-editorial", title: tr("tpl.proposta-comercial.s1") },
      { tpl: "agenda", title: tr("tpl.proposta-comercial.s2") },
      { tpl: "pergunta", title: tr("tpl.proposta-comercial.s3") },
      { tpl: "tres-cards", title: tr("tpl.proposta-comercial.s4") },
      { tpl: "timeline", title: tr("tpl.proposta-comercial.s5") },
      { tpl: "numero-gigante", title: tr("tpl.proposta-comercial.s6") },
      { tpl: "swot", title: tr("tpl.proposta-comercial.s7") },
      { tpl: "contato" },
    ],
  },
  {
    id: "aula",
    name: "Aula / workshop",
    description: "Estrutura didática com discussão e resumo — 7 slides.",
    themeId: "manuscrito",
    slides: [
      { tpl: "capa-solida", title: tr("tpl.aula.s1") },
      { tpl: "agenda", title: tr("tpl.aula.s2") },
      { tpl: "titulo-texto", title: tr("tpl.aula.s3") },
      { tpl: "pergunta", title: tr("tpl.aula.s4") },
      { tpl: "quatro-cards", title: tr("tpl.aula.s5") },
      { tpl: "citacao" },
      { tpl: "encerramento", title: tr("tpl.aula.s7") },
    ],
  },
  {
    id: "portfolio",
    name: "Portfólio criativo",
    description: "Foco em imagem: capa com foto, galeria e contato — 6 slides.",
    themeId: "ameixa",
    slides: [
      { tpl: "capa-foto", title: tr("tpl.portfolio.s1") },
      { tpl: "titulo-texto", title: tr("tpl.portfolio.s2") },
      { tpl: "foto-fullbleed" },
      { tpl: "foto-fullbleed" },
      { tpl: "citacao", title: tr("tpl.portfolio.s5") },
      { tpl: "contato" },
    ],
  },
];

/** Replace the text of the first placeholder-title box, keeping theme styling. */
function overrideTitle(elements: Slide["elements"], text: string) {
  const t = elements.find((e): e is TextBox => e.type === "text" && e.placeholder === "title");
  if (t) t.content = plainTextToPM(text);
}

/** Build all slides of a deck template against `deck` (theme/size already set). */
export function buildDeckTemplate(tpl: DeckTemplate, deck: Deck): Slide[] {
  const slides: Slide[] = [];
  for (const spec of tpl.slides) {
    const st = findTemplate(spec.tpl);
    if (!st) continue;
    const { elements, background } = st.build(deck);
    if (spec.title) overrideTitle(elements, spec.title);
    slides.push({ id: makeId("slide"), elements, background });
  }
  return slides;
}

/** Localized display name for a full-deck template, keyed by its stable `id`. */
export function deckTemplateName(id: string): string {
  return tr(`tpl.${id}` as MessageKey);
}

/** Localized description for a full-deck template, keyed by its stable `id`. */
export function deckTemplateDesc(id: string): string {
  return tr(`tpl.${id}.desc` as MessageKey);
}

export function findDeckTemplate(id: string): DeckTemplate | undefined {
  return DECK_TEMPLATES.find((t) => t.id === id);
}

export function themeForDeckTemplate(tpl: DeckTemplate) {
  return THEME_PRESETS.find((p) => p.id === tpl.themeId)?.theme;
}
