// TipTap configuration for the text inside a box. Ported from the Writer's
// extensions (StarterKit v3 already bundles Underline + Link), trimmed to what a
// slide text box needs: marks, alignment, color. No slash menu / document ribbon
// — slides format via the floating toolbar instead.

import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";

export function buildTextExtensions() {
  return [
    StarterKit.configure({
      link: { openOnClick: false, autolink: true },
    }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    TextStyle,
    Color,
  ];
}
