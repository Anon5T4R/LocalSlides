// Rulers + draggable manual guides (Canva-style). Rendered inside the slide
// frame in *screen* px (so ruler thickness and guide lines stay constant under
// zoom). Drag from a ruler to pull out a new guide; drag an existing guide to
// move it, drop it off-canvas (or double-click) to delete. Elements snap to
// these guides during drag (see EditorStage → computeSnap).

import { useEffect, useRef } from "react";
import type { Size, SlideGuides } from "../model/deck";

const RULER = 18;

/** Fixed inset margin markers drawn on the rulers (Onda 16), not draggable. */
const MARGIN_FRAC = 0.05;

export function GuidesOverlay({
  size,
  scale,
  guides,
  addGuide,
  moveGuide,
  removeGuide,
  deckGuides,
  addDeckGuide,
  moveDeckGuide,
  removeDeckGuide,
  beginTx,
  endTx,
}: {
  size: Size;
  scale: number;
  guides: SlideGuides | undefined;
  addGuide: (axis: "x" | "y", pos: number) => void;
  moveGuide: (axis: "x" | "y", index: number, pos: number) => void;
  removeGuide: (axis: "x" | "y", index: number) => void;
  deckGuides?: SlideGuides;
  addDeckGuide?: (axis: "x" | "y", pos: number) => void;
  moveDeckGuide?: (axis: "x" | "y", index: number, pos: number) => void;
  removeDeckGuide?: (axis: "x" | "y", index: number) => void;
  beginTx: () => void;
  endTx: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ axis: "x" | "y"; index: number; deck: boolean } | null>(null);

  const toLogical = (axis: "x" | "y", clientX: number, clientY: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return 0;
    return axis === "x" ? (clientX - rect.left) / scale : (clientY - rect.top) / scale;
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const pos = toLogical(d.axis, e.clientX, e.clientY);
      if (d.deck) moveDeckGuide?.(d.axis, d.index, pos);
      else moveGuide(d.axis, d.index, pos);
    };
    const onUp = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      drag.current = null;
      const pos = toLogical(d.axis, e.clientX, e.clientY);
      const max = d.axis === "x" ? size.w : size.h;
      if (pos < -4 || pos > max + 4) {
        if (d.deck) removeDeckGuide?.(d.axis, d.index);
        else removeGuide(d.axis, d.index);
      }
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
    const deck = e.altKey && !!addDeckGuide;
    const index = deck
      ? ((axis === "x" ? deckGuides?.x.length : deckGuides?.y.length) ?? 0)
      : ((axis === "x" ? guides?.x.length : guides?.y.length) ?? 0);
    beginTx();
    if (deck) addDeckGuide?.(axis, toLogical(axis, e.clientX, e.clientY));
    else addGuide(axis, toLogical(axis, e.clientX, e.clientY));
    drag.current = { axis, index, deck };
  };

  const startMove = (axis: "x" | "y", index: number, deck: boolean, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    beginTx();
    drag.current = { axis, index, deck };
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
        title="Arraste para criar uma guia vertical (Alt = guia do deck inteiro)"
      >
        <div className="ruler-margin-mark" style={{ left: size.w * MARGIN_FRAC * scale }} />
        <div className="ruler-margin-mark" style={{ left: size.w * (1 - MARGIN_FRAC) * scale }} />
      </div>
      <div
        className="ruler ruler-left"
        style={{ left: -RULER, top: 0, width: RULER, height: H, pointerEvents: "auto", cursor: "ns-resize" }}
        onPointerDown={(e) => startCreate("y", e)}
        title="Arraste para criar uma guia horizontal (Alt = guia do deck inteiro)"
      >
        <div className="ruler-margin-mark ruler-margin-mark-h" style={{ top: size.h * MARGIN_FRAC * scale }} />
        <div className="ruler-margin-mark ruler-margin-mark-h" style={{ top: size.h * (1 - MARGIN_FRAC) * scale }} />
      </div>

      {/* Vertical guides (x positions) — per-slide. */}
      {(guides?.x ?? []).map((x, i) => (
        <div
          key={`vx-${i}`}
          className="guide-hit guide-hit-v"
          style={{ left: x * scale - 4, top: 0, width: 9, height: H, pointerEvents: "auto", cursor: "ew-resize" }}
          onPointerDown={(e) => startMove("x", i, false, e)}
          onDoubleClick={() => removeGuide("x", i)}
          title="Arraste para mover · duplo-clique para remover"
        >
          <div className="guide-line guide-line-v" />
        </div>
      ))}

      {/* Horizontal guides (y positions) — per-slide. */}
      {(guides?.y ?? []).map((y, i) => (
        <div
          key={`hy-${i}`}
          className="guide-hit guide-hit-h"
          style={{ left: 0, top: y * scale - 4, width: W, height: 9, pointerEvents: "auto", cursor: "ns-resize" }}
          onPointerDown={(e) => startMove("y", i, false, e)}
          onDoubleClick={() => removeGuide("y", i)}
          title="Arraste para mover · duplo-clique para remover"
        >
          <div className="guide-line guide-line-h" />
        </div>
      ))}

      {/* Vertical deck-wide guides (Onda 16) — shown on every slide. */}
      {(deckGuides?.x ?? []).map((x, i) => (
        <div
          key={`dvx-${i}`}
          className="guide-hit guide-hit-v"
          style={{ left: x * scale - 4, top: 0, width: 9, height: H, pointerEvents: "auto", cursor: "ew-resize" }}
          onPointerDown={(e) => startMove("x", i, true, e)}
          onDoubleClick={() => removeDeckGuide?.("x", i)}
          title="Guia do deck inteiro · arraste para mover · duplo-clique para remover"
        >
          <div className="guide-line guide-line-v guide-line-deck" />
        </div>
      ))}

      {/* Horizontal deck-wide guides (Onda 16) — shown on every slide. */}
      {(deckGuides?.y ?? []).map((y, i) => (
        <div
          key={`dhy-${i}`}
          className="guide-hit guide-hit-h"
          style={{ left: 0, top: y * scale - 4, width: W, height: 9, pointerEvents: "auto", cursor: "ns-resize" }}
          onPointerDown={(e) => startMove("y", i, true, e)}
          onDoubleClick={() => removeDeckGuide?.("y", i)}
          title="Guia do deck inteiro · arraste para mover · duplo-clique para remover"
        >
          <div className="guide-line guide-line-h guide-line-deck" />
        </div>
      ))}
    </div>
  );
}
