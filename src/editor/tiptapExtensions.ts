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

/** Curated font stacks offered in the toolbar. The first block is bundled with
 *  the app (OFL via @fontsource — see lib/embeddedFonts.ts); the second is
 *  system-safe fallbacks. */
// The default entry's label is resolved at render time (see TextToolbar) so it
// follows locale changes; an empty label here is the "use the theme font" option.
export const FONT_FAMILIES: { label: string; value: string }[] = [
  { label: "", value: "" },
  // — Embutidas (sempre disponíveis, offline) —
  { label: "Inter", value: "Inter, system-ui, sans-serif" },
  { label: "Poppins", value: "Poppins, system-ui, sans-serif" },
  { label: "Montserrat", value: "Montserrat, system-ui, sans-serif" },
  { label: "DM Sans", value: "'DM Sans', system-ui, sans-serif" },
  { label: "Nunito", value: "Nunito, system-ui, sans-serif" },
  { label: "Raleway", value: "Raleway, system-ui, sans-serif" },
  { label: "Space Grotesk", value: "'Space Grotesk', system-ui, sans-serif" },
  { label: "Oswald", value: "Oswald, Impact, sans-serif" },
  { label: "Playfair Display", value: "'Playfair Display', Georgia, serif" },
  { label: "Lora", value: "Lora, Georgia, serif" },
  { label: "Merriweather", value: "Merriweather, Georgia, serif" },
  { label: "Caveat", value: "Caveat, 'Comic Sans MS', cursive" },
  { label: "JetBrains Mono", value: "'JetBrains Mono', ui-monospace, monospace" },
  // — Fontes do sistema —
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

/** Adds `fontSize`, `fontFamily`, `textStroke`, `letterSpacing`, `highlight` to textStyle,
 *  and `lineHeight` as a paragraph-level attribute. */
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
          letterSpacing: {
            default: null,
            parseHTML: (el: HTMLElement) => el.style.letterSpacing || null,
            renderHTML: (attrs: Record<string, unknown>) =>
              attrs.letterSpacing ? { style: `letter-spacing:${attrs.letterSpacing}` } : {},
          },
          highlight: {
            default: null,
            parseHTML: (el: HTMLElement) => el.style.backgroundColor || null,
            renderHTML: (attrs: Record<string, unknown>) =>
              attrs.highlight ? { style: `background-color:${attrs.highlight};border-radius:2px;padding:0 1px` } : {},
          },
        },
      },
      {
        types: ["paragraph", "heading"],
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (el: HTMLElement) => el.style.lineHeight || null,
            renderHTML: (attrs: Record<string, unknown>) =>
              attrs.lineHeight ? { style: `line-height:${attrs.lineHeight}` } : {},
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
