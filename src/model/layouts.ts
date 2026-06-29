// ---------------------------------------------------------------------------
// Master layouts ("layouts ricos").
//
// A layout is a named builder that emits positioned placeholder elements for a
// blank slide (in logical px, derived from the deck size so it works for 16:9
// and 4:3 alike). Title/body boxes carry `placeholder` so the theme typography
// and the AI fill know what they are. Image slots are light rounded shapes
// labeled "Imagem" — the user drops a real picture on top later.
// ---------------------------------------------------------------------------

import {
  Deck,
  Element,
  Geom,
  ShapeEl,
  TextBox,
  makeId,
  newTextBox,
  plainTextToPM,
} from "./deck";

function g(x: number, y: number, w: number, h: number): Geom {
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), rotation: 0 };
}

function title(text: string, geom: Geom): TextBox {
  return newTextBox({ geom, placeholder: "title", vAlign: "middle", content: plainTextToPM(text) });
}

function body(text: string, geom: Geom, vAlign: TextBox["vAlign"] = "top"): TextBox {
  return newTextBox({ geom, placeholder: "body", vAlign, content: plainTextToPM(text) });
}

function imageSlot(geom: Geom): ShapeEl {
  return {
    id: makeId("shape"),
    type: "shape",
    geom,
    shape: "roundRect",
    fill: { kind: "solid", color: "#e2e8f0" },
    text: plainTextToPM("Imagem"),
  };
}

export interface LayoutDef {
  id: string;
  name: string;
  build: (deck: Deck) => Element[];
}

export const LAYOUTS: LayoutDef[] = [
  {
    id: "capa",
    name: "Capa",
    build: (d) => {
      const W = d.size.w, H = d.size.h, m = W * 0.1;
      return [
        title("Título da apresentação", g(m, H * 0.36, W - 2 * m, H * 0.2)),
        body("Subtítulo · autor · data", g(m, H * 0.58, W - 2 * m, H * 0.12), "top"),
      ];
    },
  },
  {
    id: "secao",
    name: "Seção",
    build: (d) => {
      const W = d.size.w, H = d.size.h, m = W * 0.08;
      return [title("Título da seção", g(m, H * 0.4, W - 2 * m, H * 0.2))];
    },
  },
  {
    id: "titulo-conteudo",
    name: "Título + conteúdo",
    build: (d) => {
      const W = d.size.w, H = d.size.h, m = W * 0.06;
      return [
        title("Título do slide", g(m, H * 0.08, W - 2 * m, H * 0.16)),
        body("Clique para editar", g(m, H * 0.3, W - 2 * m, H * 0.6)),
      ];
    },
  },
  {
    id: "dois-conteudos",
    name: "Dois conteúdos",
    build: (d) => {
      const W = d.size.w, H = d.size.h, m = W * 0.06, gap = W * 0.04;
      const colW = (W - 2 * m - gap) / 2;
      const y = H * 0.3, h = H * 0.6;
      return [
        title("Título do slide", g(m, H * 0.08, W - 2 * m, H * 0.16)),
        body("Coluna 1", g(m, y, colW, h)),
        body("Coluna 2", g(m + colW + gap, y, colW, h)),
      ];
    },
  },
  {
    id: "titulo-imagem",
    name: "Título + imagem",
    build: (d) => {
      const W = d.size.w, H = d.size.h, m = W * 0.06, gap = W * 0.04;
      const colW = (W - 2 * m - gap) / 2;
      const y = H * 0.3, h = H * 0.6;
      return [
        title("Título do slide", g(m, H * 0.08, W - 2 * m, H * 0.16)),
        body("Texto", g(m, y, colW, h)),
        imageSlot(g(m + colW + gap, y, colW, h)),
      ];
    },
  },
  {
    id: "legenda",
    name: "Imagem com legenda",
    build: (d) => {
      const W = d.size.w, H = d.size.h, m = W * 0.06;
      return [
        imageSlot(g(m, H * 0.08, W - 2 * m, H * 0.66)),
        body("Legenda da imagem", g(m, H * 0.78, W - 2 * m, H * 0.12), "top"),
      ];
    },
  },
  {
    id: "em-branco",
    name: "Em branco",
    build: () => [],
  },
];

/** Build a layout's elements, falling back to the default title+content. */
export function buildLayout(layoutId: string, deck: Deck): Element[] {
  const def = LAYOUTS.find((l) => l.id === layoutId) ?? LAYOUTS[2];
  return def.build(deck);
}
