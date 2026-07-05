// Onda 17.4 — texto curvado estilo Canva: o box vira um SVG com <textPath>
// sobre um arco cuja flecha (sagitta) vem de `curve` (-100..100). O conteúdo
// rico é achatado para texto plano (uma linha); estilo vem da primeira marca
// textStyle encontrada, com fallback no tema. A edição (TipTap) continua reta —
// só o render estático curva, então nenhum fluxo de edição muda.

import type { ProseMirrorJSON, TextBox, Theme } from "../model/deck";
import { pmToPlainText } from "../model/deck";

/** First textStyle attrs (fontSize/fontFamily/color) and bold flag in the doc. */
function firstTextStyle(doc: ProseMirrorJSON | undefined): {
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  bold?: boolean;
} {
  if (!doc) return {};
  let found: { fontSize?: number; fontFamily?: string; color?: string; bold?: boolean } | null = null;
  const walk = (node: ProseMirrorJSON) => {
    if (found) return;
    if (node.type === "text") {
      const out: { fontSize?: number; fontFamily?: string; color?: string; bold?: boolean } = {};
      for (const mark of node.marks ?? []) {
        if (mark.type === "bold") out.bold = true;
        if (mark.type === "textStyle" && mark.attrs) {
          const fs = mark.attrs.fontSize;
          if (typeof fs === "string" && fs.endsWith("px")) out.fontSize = parseFloat(fs);
          if (typeof mark.attrs.fontFamily === "string") out.fontFamily = mark.attrs.fontFamily;
          if (typeof mark.attrs.color === "string") out.color = mark.attrs.color;
        }
      }
      found = out;
      return;
    }
    (node.content ?? []).forEach(walk);
  };
  walk(doc);
  return found ?? {};
}

export function CurvedText({ el, theme }: { el: TextBox; theme: Theme }) {
  const { w, h } = el.geom;
  const text = pmToPlainText(el.content).replace(/\s*\n\s*/g, " ").trim();
  if (!text) return null;

  const isTitle = el.placeholder === "title";
  const ts = firstTextStyle(el.content);
  const fontSize = ts.fontSize ?? (isTitle ? 40 : 24);
  const fontFamily = ts.fontFamily || (isTitle ? theme.fonts.heading : theme.fonts.body);
  const fontWeight = ts.bold ?? isTitle ? 700 : 400;
  const color = ts.color ?? theme.colors.text;

  const curve = Math.max(-100, Math.min(100, el.curve ?? 0));
  // Sagitta (altura do arco) proporcional à curvatura e limitada pelo box.
  const s = Math.max(4, (Math.abs(curve) / 100) * (h / 2 - fontSize / 2));
  const R = s / 2 + (w * w) / (8 * s);
  const up = curve > 0;
  // Linha-base no meio do box, deslocada para o arco caber dentro dele.
  const y = up ? h / 2 + s / 2 : h / 2 - s / 2;
  const d = up ? `M 0 ${y} A ${R} ${R} 0 0 1 ${w} ${y}` : `M 0 ${y} A ${R} ${R} 0 0 0 ${w} ${y}`;
  const pathId = `curve-${el.id}`;

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${w} ${h}`}
      style={{ display: "block", overflow: "visible" }}
      aria-label={el.alt}
    >
      <defs>
        <path id={pathId} d={d} />
      </defs>
      <text style={{ fontFamily, fontSize, fontWeight }} fill={color}>
        <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">
          {text}
        </textPath>
      </text>
    </svg>
  );
}
