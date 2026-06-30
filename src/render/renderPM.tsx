// Render a ProseMirror JSON document as static React nodes. This is what a text
// box shows when it is NOT being edited (editing swaps in a live editor later).
// Intentionally small: it covers the marks/nodes the MVP can produce.

import { createElement, Fragment, type CSSProperties, type ReactNode } from "react";
import type { ProseMirrorJSON } from "../model/deck";

type Mark = { type: string; attrs?: Record<string, unknown> };

function applyMarks(text: ReactNode, marks: Mark[] | undefined, key: number): ReactNode {
  if (!marks || !marks.length) return text;
  return marks.reduce<ReactNode>((acc, mark, i) => {
    switch (mark.type) {
      case "bold":
        return <strong key={i}>{acc}</strong>;
      case "italic":
        return <em key={i}>{acc}</em>;
      case "underline":
        return <u key={i}>{acc}</u>;
      case "strike":
        return <s key={i}>{acc}</s>;
      case "textStyle": {
        const style: CSSProperties = {};
        const color = mark.attrs?.color as string | undefined;
        const fontSize = mark.attrs?.fontSize as string | undefined;
        const fontFamily = mark.attrs?.fontFamily as string | undefined;
        const textStroke = mark.attrs?.textStroke as string | undefined;
        const letterSpacing = mark.attrs?.letterSpacing as string | undefined;
        const highlight = mark.attrs?.highlight as string | undefined;
        if (color) style.color = color;
        if (fontSize) style.fontSize = fontSize;
        if (fontFamily) style.fontFamily = fontFamily;
        if (textStroke) {
          (style as CSSProperties & { WebkitTextStroke?: string }).WebkitTextStroke = textStroke;
          style.paintOrder = "stroke fill";
        }
        if (letterSpacing) style.letterSpacing = letterSpacing;
        if (highlight) {
          style.backgroundColor = highlight;
          style.borderRadius = "2px";
          style.padding = "0 1px";
        }
        return (
          <span key={i} style={style}>
            {acc}
          </span>
        );
      }
      default:
        return acc;
    }
  }, <Fragment key={key}>{text}</Fragment>);
}

function renderNode(node: ProseMirrorJSON, key: number): ReactNode {
  switch (node.type) {
    case "text":
      return applyMarks(node.text ?? "", node.marks, key);
    case "hardBreak":
      return <br key={key} />;
    case "paragraph": {
      const align = node.attrs?.textAlign as string | undefined;
      const lineHeight = node.attrs?.lineHeight as string | undefined;
      const style: CSSProperties = {};
      if (align) style.textAlign = align as CSSProperties["textAlign"];
      if (lineHeight) style.lineHeight = lineHeight;
      return (
        <p key={key} style={style}>
          {(node.content ?? []).map((c, i) => renderNode(c, i))}
          {!node.content?.length && <br />}
        </p>
      );
    }
    case "heading": {
      const level = Math.min(Math.max((node.attrs?.level as number) ?? 1, 1), 6);
      const align = node.attrs?.textAlign as string | undefined;
      const lineHeight = node.attrs?.lineHeight as string | undefined;
      const style: CSSProperties = {};
      if (align) style.textAlign = align as CSSProperties["textAlign"];
      if (lineHeight) style.lineHeight = lineHeight;
      return createElement(
        `h${level}`,
        { key, style },
        (node.content ?? []).map((c, i) => renderNode(c, i))
      );
    }
    case "bulletList":
      return <ul key={key}>{(node.content ?? []).map((c, i) => renderNode(c, i))}</ul>;
    case "orderedList":
      return <ol key={key}>{(node.content ?? []).map((c, i) => renderNode(c, i))}</ol>;
    case "listItem":
      return <li key={key}>{(node.content ?? []).map((c, i) => renderNode(c, i))}</li>;
    default:
      return (
        <Fragment key={key}>{(node.content ?? []).map((c, i) => renderNode(c, i))}</Fragment>
      );
  }
}

export function RenderPM({ doc }: { doc: ProseMirrorJSON | undefined }) {
  if (!doc?.content?.length) return null;
  return <>{doc.content.map((node, i) => renderNode(node, i))}</>;
}
