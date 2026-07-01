// Rulers + draggable manual guides (Canva-style). Rendered inside the slide
// frame in *screen* px (so ruler thickness and guide lines stay constant under
// zoom). Drag from a ruler to pull out a new guide; drag an existing guide to
// move it, drop it off-canvas (or double-click) to delete. Elements snap to
// these guides during drag (see EditorStage → computeSnap).

import { useEffect, useRef } from "react";
import type { Size, SlideGuides } from "../model/deck";

const RULER = 18;

export function GuidesOverlay({
  size,
  scale,
  guides,
  addGuide,
  moveGuide,
  removeGuide,
  beginTx,
  endTx,
}: {
  size: Size;
  scale: number;
  guides: SlideGuides | undefined;
  addGuide: (axis: "x" | "y", pos: number) => void;
  moveGuide: (axis: "x" | "y", index: number, pos: number) => void;
  removeGuide: (axis: "x" | "y", index: number) => void;
  beginTx: () => void;
  endTx: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ axis: "x" | "y"; index: number } | null>(null);

  const toLogical = (axis: "x" | "y", clientX: number, clientY: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return 0;
    return axis === "x" ? (clientX - rect.left) / scale : (clientY - rect.top) / scale;
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      moveGuide(d.axis, d.index, toLogical(d.axis, e.clientX, e.clientY));
    };
    const onUp = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      drag.current = null;
      const pos = toLogical(d.axis, e.clientX, e.clientY);
      const max = d.axis === "x" ? size.w : size.h;
      if (pos < -4 || pos > max + 4) removeGuide(d.axis, d.index);
      endTx();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, size.w, size.h]);

  const startCreate = (axis: "x" | "y", e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const index = (axis === "x" ? guides?.x.length : guides?.y.length) ?? 0;
    beginTx();
    addGuide(axis, toLogical(axis, e.clientX, e.clientY));
    drag.current = { axis, index };
  };

  const startMove = (axis: "x" | "y", index: number, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    beginTx();
    drag.current = { axis, index };
  };

  const W = size.w * scale;
  const H = size.h * scale;

  return (
    <div ref={ref} className="guides-overlay" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {/* Corner + rulers (drag out from here). */}
      <div className="ruler-corner" style={{ left: -RULER, top: -RULER, width: RULER, height: RULER }} />
      <div
        className="ruler ruler-top"
        style={{ left: 0, top: -RULER, width: W, height: RULER, pointerEvents: "auto", cursor: "ew-resize" }}
        onPointerDown={(e) => startCreate("x", e)}
        title="Arraste para criar uma guia vertical"
      />
      <div
        className="ruler ruler-left"
        style={{ left: -RULER, top: 0, width: RULER, height: H, pointerEvents: "auto", cursor: "ns-resize" }}
        onPointerDown={(e) => startCreate("y", e)}
        title="Arraste para criar uma guia horizontal"
      />

      {/* Vertical guides (x positions). */}
      {(guides?.x ?? []).map((x, i) => (
        <div
          key={`vx-${i}`}
          className="guide-hit guide-hit-v"
          style={{ left: x * scale - 4, top: 0, width: 9, height: H, pointerEvents: "auto", cursor: "ew-resize" }}
          onPointerDown={(e) => startMove("x", i, e)}
          onDoubleClick={() => removeGuide("x", i)}
          title="Arraste para mover · duplo-clique para remover"
        >
          <div className="guide-line guide-line-v" />
        </div>
      ))}

      {/* Horizontal guides (y positions). */}
      {(guides?.y ?? []).map((y, i) => (
        <div
          key={`hy-${i}`}
          className="guide-hit guide-hit-h"
          style={{ left: 0, top: y * scale - 4, width: W, height: 9, pointerEvents: "auto", cursor: "ns-resize" }}
          onPointerDown={(e) => startMove("y", i, e)}
          onDoubleClick={() => removeGuide("y", i)}
          title="Arraste para mover · duplo-clique para remover"
        >
          <div className="guide-line guide-line-h" />
        </div>
      ))}
    </div>
  );
}
