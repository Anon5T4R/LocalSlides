// Real TipTap editor, mounted only while a text box is being edited (double-click
// or F2). It binds directly to the element's ProseMirror JSON, so what you edit is
// exactly what gets stored — no lossy plain-text bridge. On commit we write
// editor.getJSON() back through the store (one undoable command).
//
// Editing ends on Esc (cancel), Ctrl+Enter, or a pointer-down anywhere outside
// the editor + its toolbar. We avoid TipTap's onBlur for this because the color
// picker and toolbar buttons would otherwise trigger spurious commits.

import { useEffect, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { useStore } from "../state/store";
import { findSlide } from "../model/deck";
import { buildTextExtensions } from "./tiptapExtensions";
import { fillToCss } from "../render/fill";
import { TextToolbar } from "./TextToolbar";

export function TextBoxEditor({
  elementId,
  scale,
  onClose,
}: {
  elementId: string;
  scale: number;
  onClose: () => void;
}) {
  const deck = useStore((s) => s.deck);
  const currentSlideId = useStore((s) => s.currentSlideId);
  const updateElement = useStore((s) => s.updateElement);

  const slide = findSlide(deck, currentSlideId);
  const el = slide?.elements.find((e) => e.id === elementId);
  const wrapRef = useRef<HTMLDivElement>(null);
  const committed = useRef(false);

  const isTitle = el?.type === "text" && el.placeholder === "title";

  const editor = useEditor({
    extensions: buildTextExtensions(),
    content: el?.type === "text" ? el.content : undefined,
    autofocus: "end",
  });

  const commit = (save: boolean) => {
    if (committed.current) return;
    committed.current = true;
    if (save && editor) {
      const json = editor.getJSON();
      updateElement(elementId, (e) => {
        if (e.type === "text") e.content = json as typeof e.content;
      });
    }
    onClose();
  };

  // Commit when clicking outside the editor/toolbar; Esc cancels, Ctrl+Enter saves.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) commit(true);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        commit(false);
      } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        commit(true);
      }
    };
    // Capture phase so we see the click before the stage clears selection.
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  if (!el || el.type !== "text") return null;

  const justify =
    el.vAlign === "middle" ? "center" : el.vAlign === "bottom" ? "flex-end" : "flex-start";

  return (
    <div
      ref={wrapRef}
      className="textbox-editor"
      style={{
        position: "absolute",
        left: el.geom.x,
        top: el.geom.y,
        width: el.geom.w,
        height: el.geom.h,
        transform: el.geom.rotation ? `rotate(${el.geom.rotation}deg)` : undefined,
        transformOrigin: "center center",
        display: "flex",
        flexDirection: "column",
        justifyContent: justify,
        boxSizing: "border-box",
        padding: "8px 12px",
        outline: `${2 / scale}px solid ${deck.theme.colors.accent1}`,
        fontFamily: isTitle ? deck.theme.fonts.heading : deck.theme.fonts.body,
        fontSize: isTitle ? 40 : 24,
        fontWeight: isTitle ? 700 : 400,
        lineHeight: 1.25,
        color: deck.theme.colors.text,
        background: fillToCss(el.fill) ?? "transparent",
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {editor && (
        <TextToolbar
          editor={editor}
          scale={scale}
          themeColors={Object.values(deck.theme.colors)}
        />
      )}
      <EditorContent editor={editor} className="tt-content" />
    </div>
  );
}
