// Onda 17.3 — templates de DECK inteiro (pendência da Onda 9): uma sequência
// curada de slide-templates + um tema, gerando uma apresentação completa de
// uma vez. Reusa os builders de index.ts, então cada deck adapta ao tamanho
// do documento e o texto é 100% editável depois.

import { Deck, Slide, TextBox, makeId, plainTextToPM } from "../model/deck";
import { THEME_PRESETS } from "../model/themes";
import { findTemplate } from "./index";

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
      { tpl: "capa-solida", title: "Nome da startup" },
      { tpl: "pergunta", title: "Qual problema ninguém resolveu?" },
      { tpl: "tres-cards", title: "Nossa solução" },
      { tpl: "numero-gigante", title: "R$ 4,2 bi" },
      { tpl: "grafico-destaque", title: "Tração até aqui" },
      { tpl: "antes-depois", title: "O que muda para o cliente" },
      { tpl: "timeline", title: "Roadmap" },
      { tpl: "equipe", title: "Time fundador" },
      { tpl: "cta", title: "Vamos construir juntos?" },
    ],
  },
  {
    id: "relatorio-resultados",
    name: "Relatório de resultados",
    description: "KPIs, gráfico, comparativo e próximos passos — 7 slides.",
    themeId: "claro",
    slides: [
      { tpl: "capa-minimal", title: "Resultados do trimestre" },
      { tpl: "agenda" },
      { tpl: "kpi-numeros", title: "Principais indicadores" },
      { tpl: "grafico-destaque", title: "Evolução no período" },
      { tpl: "comparacao-2col", title: "Planejado vs realizado" },
      { tpl: "lista-icones", title: "Próximos passos" },
      { tpl: "encerramento" },
    ],
  },
  {
    id: "proposta-comercial",
    name: "Proposta comercial",
    description: "Contexto, entrega, cronograma e investimento — 8 slides.",
    themeId: "elegante",
    slides: [
      { tpl: "capa-editorial", title: "Proposta comercial" },
      { tpl: "agenda", title: "O que você vai ver" },
      { tpl: "pergunta", title: "Onde sua operação perde tempo hoje?" },
      { tpl: "tres-cards", title: "O que entregamos" },
      { tpl: "timeline", title: "Cronograma" },
      { tpl: "numero-gigante", title: "R$ 30 mil" },
      { tpl: "swot", title: "Riscos e oportunidades" },
      { tpl: "contato" },
    ],
  },
  {
    id: "aula",
    name: "Aula / workshop",
    description: "Estrutura didática com discussão e resumo — 7 slides.",
    themeId: "manuscrito",
    slides: [
      { tpl: "capa-solida", title: "Nome da aula" },
      { tpl: "agenda", title: "Plano de hoje" },
      { tpl: "titulo-texto", title: "Conceito central" },
      { tpl: "pergunta", title: "O que vocês fariam neste caso?" },
      { tpl: "quatro-cards", title: "Quatro pontos para lembrar" },
      { tpl: "citacao" },
      { tpl: "encerramento", title: "Até a próxima!" },
    ],
  },
  {
    id: "portfolio",
    name: "Portfólio criativo",
    description: "Foco em imagem: capa com foto, galeria e contato — 6 slides.",
    themeId: "ameixa",
    slides: [
      { tpl: "capa-foto", title: "Seu nome aqui" },
      { tpl: "titulo-texto", title: "Sobre mim" },
      { tpl: "foto-fullbleed" },
      { tpl: "foto-fullbleed" },
      { tpl: "citacao", title: '"Um depoimento de cliente vai aqui."' },
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

export function findDeckTemplate(id: string): DeckTemplate | undefined {
  return DECK_TEMPLATES.find((t) => t.id === id);
}

export function themeForDeckTemplate(tpl: DeckTemplate) {
  return THEME_PRESETS.find((p) => p.id === tpl.themeId)?.theme;
}
