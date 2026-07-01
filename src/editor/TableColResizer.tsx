// Draggable column-width handles overlaid on a selected table (Onda 13.2).
// Each handle sits on a column boundary; dragging it shifts width (as a
// fraction of the table's total width) between the two adjacent columns.

import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { useStore } from "../state/store";
import type { TableEl } from "../model/deck";

export function TableColResizer({ el, scale }: { el: TableEl; scale: number }) {
  const updateElement = useStore((s) => s.updateElement);
  const beginTx = useStore((s) => s.beginTx);
  const endTx = useStore((s) => s.endTx);
  const dragRef = useRef<{ index: number; startX: number; widths: number[] } | null>(null);

  const nCols = el.rows[0]?.length ?? 1;
  if (nCols < 2) return null;
  const widths =
    el.colWidths && el.colWidths.length === nCols ? el.colWidths : Array.from({ length: nCols }, () => 1 / nCols);

  const cumFracs: number[] = [];
  let acc = 0;
  for (let i = 0; i < nCols - 1; i++) {
    acc += widths[i];
    cumFracs.push(acc);
  }

  const onDown = (index: number) => (e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    beginTx();
    dragRef.current = { index, startX: e.clientX, widths: [...widths] };
  };

  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dxLogical = (e.clientX - d.startX) / scale;
    const dFrac = dxLogical / el.geom.w;
    const minW = 0.06;
    const next = [...d.widths];
    let a = next[d.index] + dFrac;
    let b = next[d.index + 1] - dFrac;
    if (a < minW) { b -= minW - a; a = minW; }
    if (b < minW) { a -= minW - b; b = minW; }
    next[d.index] = a;
    next[d.index + 1] = b;
    updateElement(el.id, (x) => {
      if (x.type === "table") x.colWidths = next;
    });
  };

  const onUp = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    endTx();
  };

  return (
    <>
      {cumFracs.map((frac, i) => (
        <div
          key={i}
          onPointerDown={onDown(i)}
          onPointerMove={onMove}
          onPointerUp={onUp}
          title="Arrastar para redimensionar a coluna"
          style={{
            position: "absolute",
            left: el.geom.x + el.geom.w * frac - 3,
            top: el.geom.y,
            width: 6,
            height: el.geom.h,
            cursor: "col-resize",
            zIndex: 25,
          }}
        />
      ))}
    </>
  );
}
