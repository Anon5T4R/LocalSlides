// AI deck generation: the model emits a small, constrained JSON "spec" (titles +
// bullets per slide), which we validate and turn into real positioned slides.
//
// Asking for a high-level spec instead of raw geometry is the robust choice: the
// model can't produce a broken canvas, and we own the layout/theme. This is the
// validated-JSON ("parseEdits/applyEdits") boundary — nothing the model returns
// touches the store until it parses and type-checks here.

import {
  Deck,
  Slide,
  TextBox,
  ProseMirrorJSON,
  makeId,
  newTextBox,
  plainTextToPM,
} from "../model/deck";

export type SlideLayout = "title" | "bullets" | "section";

export interface SlideSpec {
  layout: SlideLayout;
  title: string;
  subtitle?: string;
  bullets?: string[];
}

export interface DeckSpec {
  slides: SlideSpec[];
}

/** The JSON contract handed to the model. Kept tiny on purpose. */
export const DECKGEN_SYSTEM = `Você é um gerador de apresentações de slides. Responda APENAS com um objeto JSON válido, sem texto antes ou depois, sem cercas de código.

Formato:
{
  "slides": [
    { "layout": "title", "title": "Título da apresentação", "subtitle": "Subtítulo opcional" },
    { "layout": "section", "title": "Nome de uma seção" },
    { "layout": "bullets", "title": "Título do slide", "bullets": ["ponto 1", "ponto 2", "ponto 3"] }
  ]
}

Regras:
- "layout" deve ser "title", "section" ou "bullets".
- O primeiro slide normalmente é "title".
- Slides "bullets" têm de 3 a 6 itens curtos (uma linha cada).
- Escreva no mesmo idioma do pedido do usuário.
- Gere de 5 a 8 slides, salvo se o usuário pedir outra quantidade.`;

/** Pull the first balanced JSON object out of arbitrary model output. */
export function extractJsonObject(text: string): string | null {
  // Prefer a fenced ```json block if present.
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const haystack = fence ? fence[1] : text;
  const start = haystack.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < haystack.length; i++) {
    const c = haystack[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return haystack.slice(start, i + 1);
    }
  }
  return null;
}

const LAYOUTS: SlideLayout[] = ["title", "bullets", "section"];

/** Validate + normalize raw parsed JSON into a DeckSpec, or throw. */
export function parseDeckSpec(text: string): DeckSpec {
  const json = extractJsonObject(text);
  if (!json) throw new Error("a IA não retornou um JSON reconhecível");
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (e) {
    throw new Error(`JSON inválido da IA: ${e}`);
  }
  const slidesRaw = (raw as { slides?: unknown }).slides;
  if (!Array.isArray(slidesRaw) || slidesRaw.length === 0) {
    throw new Error("a IA não retornou nenhum slide");
  }
  const slides: SlideSpec[] = [];
  for (const s of slidesRaw) {
    if (!s || typeof s !== "object") continue;
    const o = s as Record<string, unknown>;
    const layout = LAYOUTS.includes(o.layout as SlideLayout)
      ? (o.layout as SlideLayout)
      : "bullets";
    const title = typeof o.title === "string" ? o.title.trim() : "";
    const subtitle = typeof o.subtitle === "string" ? o.subtitle.trim() : undefined;
    const bullets = Array.isArray(o.bullets)
      ? o.bullets.filter((b): b is string => typeof b === "string").map((b) => b.trim()).filter(Boolean)
      : undefined;
    if (!title && !(bullets && bullets.length)) continue;
    slides.push({ layout, title, subtitle, bullets });
  }
  if (!slides.length) throw new Error("a IA não retornou slides válidos");
  return { slides };
}

// --- Spec → real slides ------------------------------------------------------

/** A ProseMirror doc with one bulletList of plain-text items. */
function bulletsToPM(items: string[]): ProseMirrorJSON {
  return {
    type: "doc",
    content: [
      {
        type: "bulletList",
        content: items.map((text) => ({
          type: "listItem",
          content: [{ type: "paragraph", content: text ? [{ type: "text", text }] : [] }],
        })),
      },
    ],
  };
}

/** A heading-styled ProseMirror doc (used for big title text). */
function headingPM(text: string, level: 1 | 2): ProseMirrorJSON {
  return {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level, textAlign: "center" },
        content: text ? [{ type: "text", text }] : [],
      },
    ],
  };
}

function tb(partial: Partial<TextBox>): TextBox {
  return newTextBox(partial);
}

/** Build one real Slide from a spec, laid out against the deck size. */
function specToSlide(deck: Deck, spec: SlideSpec): Slide {
  const { w, h } = deck.size;
  const pad = Math.round(w * 0.075);
  const innerW = w - pad * 2;
  const elements: TextBox[] = [];

  if (spec.layout === "title") {
    elements.push(
      tb({
        geom: { x: pad, y: Math.round(h * 0.34), w: innerW, h: Math.round(h * 0.2), rotation: 0 },
        vAlign: "middle",
        placeholder: "title",
        content: headingPM(spec.title, 1),
      })
    );
    if (spec.subtitle) {
      elements.push(
        tb({
          geom: { x: pad, y: Math.round(h * 0.56), w: innerW, h: Math.round(h * 0.12), rotation: 0 },
          vAlign: "top",
          content: { type: "doc", content: [{ type: "paragraph", attrs: { textAlign: "center" }, content: [{ type: "text", text: spec.subtitle }] }] },
        })
      );
    }
  } else if (spec.layout === "section") {
    elements.push(
      tb({
        geom: { x: pad, y: Math.round(h * 0.4), w: innerW, h: Math.round(h * 0.2), rotation: 0 },
        vAlign: "middle",
        placeholder: "title",
        content: headingPM(spec.title, 1),
      })
    );
  } else {
    // bullets
    elements.push(
      tb({
        geom: { x: pad, y: Math.round(h * 0.08), w: innerW, h: Math.round(h * 0.17), rotation: 0 },
        vAlign: "middle",
        placeholder: "title",
        content: headingPM(spec.title, 2),
      })
    );
    elements.push(
      tb({
        geom: { x: pad, y: Math.round(h * 0.3), w: innerW, h: Math.round(h * 0.6), rotation: 0 },
        vAlign: "top",
        placeholder: "body",
        content: spec.bullets && spec.bullets.length ? bulletsToPM(spec.bullets) : plainTextToPM(""),
      })
    );
  }

  return { id: makeId("slide"), elements };
}

/** Turn a validated DeckSpec into real slides. */
export function specToSlides(deck: Deck, spec: DeckSpec): Slide[] {
  return spec.slides.map((s) => specToSlide(deck, s));
}
