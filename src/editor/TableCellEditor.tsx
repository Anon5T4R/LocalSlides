// In-place TipTap editor for a single table cell. Positioned over the cell (cells
// are evenly distributed within the table geom). Commits the cell's ProseMirror
// JSON on outside-click / Esc / Ctrl+Enter, same pattern as TextBoxEditor.

import { useEffect, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { useStore } from "../state/store";
import { findSlide } from "../model/deck";
import { buildTextExtensions } from "./tiptapExtensions";

export function TableCellEditor({
  elementId,
  row,
  col,
  scale,
  onClose,
}: {
  elementId: string;
  row: number;
  col: number;
  scale: number;
  onClose: () => void;
}) {
  const deck = useStore((s) => s.deck);
  const currentSlideId = useStore((s) => s.currentSlideId);
  const updateElement = useStore((s) => s.updateElement);

  const slide = findSlide(deck, currentSlideId);
  const el = slide?.elements.find((e) => e.id === elementId);
  const table = el?.type === "table" ? el : undefined;
  const cell = table?.rows[row]?.[col];

  const wrapRef = useRef<HTMLDivElement>(null);
  const committed = useRef(false);

  const editor = useEditor({
    extensions: buildTextExtensions(),
    content: cell?.content,
    autofocus: "end",
  });

  const commit = (save: boolean) => {
    if (committed.current) return;
    committed.current = true;
    if (save && editor) {
      const json = editor.getJSON();
      updateElement(elementId, (e) => {
        if (e.type === "table" && e.rows[row]?.[col]) e.rows[row][col].content = json as never;
      });
    }
    onClose();
  };

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
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  if (!table || !cell || cell.covered) return null;

  const nRows = table.rows.length;
  const nCols = table.rows[0]?.length ?? 1;
  const colWidths =
    table.colWidths && table.colWidths.length === nCols
      ? table.colWidths
      : Array.from({ length: nCols }, () => 1 / nCols);
  const colX = (c: number) => table.geom.w * colWidths.slice(0, c).reduce((a, b) => a + b, 0);
  const colW = (c: number, span: number) =>
    table.geom.w * colWidths.slice(c, c + span).reduce((a, b) => a + b, 0);
  const ch = table.geom.h / nRows;
  const cs = cell.colSpan ?? 1;
  const rs = cell.rowSpan ?? 1;

  return (
    <div
      ref={wrapRef}
      className="cell-editor"
      style={{
        position: "absolute",
        left: table.geom.x + colX(col),
        top: table.geom.y + row * ch,
        width: colW(col, cs),
        height: ch * rs,
        boxSizing: "border-box",
        padding: "4px 8px",
        background: "#fff",
        outline: `${2 / scale}px solid ${deck.theme.colors.accent1}`,
        fontFamily: deck.theme.fonts.body,
        fontSize: 20,
        color: deck.theme.colors.text,
        overflow: "hidden",
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <EditorContent editor={editor} className="tt-content" />
    </div>
  );
}
