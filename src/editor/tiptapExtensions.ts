// TipTap configuration for the text inside a box. Ported from the Writer's
// extensions (StarterKit v3 already bundles Underline + Link), trimmed to what a
// slide text box needs: marks, alignment, color. No slash menu / document ribbon
// — slides format via the floating toolbar instead.
//
// We add three extra `textStyle` attributes (font size, font family, letter
// outline) the same way @tiptap/extension-color adds `color`: as global
// attributes on the textStyle mark, set via the built-in `setMark` command. No
// new dependencies. The static renderer (renderPM) mirrors these.

import { Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";

/** Curated, system-safe font stacks offered in the toolbar. */
export const FONT_FAMILIES: { label: string; value: string }[] = [
  { label: "Padrão", value: "" },
  { label: "Inter", value: "Inter, system-ui, sans-serif" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Georgia", value: "Georgia, 'Times New Roman', serif" },
  { label: "Times", value: "'Times New Roman', Times, serif" },
  { label: "Courier", value: "'Courier New', ui-monospace, monospace" },
  { label: "Trebuchet", value: "'Trebuchet MS', system-ui, sans-serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Comic", value: "'Comic Sans MS', 'Comic Sans', cursive" },
  { label: "Impact", value: "Impact, Haettenschweiler, sans-serif" },
];

export const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 60, 72];

/** Adds `fontSize`, `fontFamily` and `textStroke` (letter outline) to textStyle. */
const TextStyleExtras = Extension.create({
  name: "textStyleExtras",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (el: HTMLElement) => el.style.fontSize || null,
            renderHTML: (attrs: Record<string, unknown>) =>
              attrs.fontSize ? { style: `font-size:${attrs.fontSize}` } : {},
          },
          fontFamily: {
            default: null,
            parseHTML: (el: HTMLElement) => el.style.fontFamily || null,
            renderHTML: (attrs: Record<string, unknown>) =>
              attrs.fontFamily ? { style: `font-family:${attrs.fontFamily}` } : {},
          },
          textStroke: {
            default: null,
            parseHTML: (el: HTMLElement) =>
              (el.style as CSSStyleDeclaration & { webkitTextStroke?: string }).webkitTextStroke || null,
            renderHTML: (attrs: Record<string, unknown>) =>
              attrs.textStroke
                ? { style: `-webkit-text-stroke:${attrs.textStroke};paint-order:stroke fill` }
                : {},
          },
        },
      },
    ];
  },
});

export function buildTextExtensions() {
  return [
    StarterKit.configure({
      link: { openOnClick: false, autolink: true },
    }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    TextStyle,
    Color,
    TextStyleExtras,
  ];
}
