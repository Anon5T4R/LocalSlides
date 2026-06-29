// Freehand drawing surface. Active only in pen mode: it overlays the slide,
// captures pointer strokes (in logical/base coords), shows the live stroke, and
// commits each finished stroke to the slide's ink layer via the store. The ink
// element itself is rendered by the normal SlideView underneath.

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useStore } from "../state/store";
import type { Size } from "../model/deck";

export function DrawLayer({ size, scale }: { size: Size; scale: number }) {
  const color = useStore((s) => s.inkColor);
  const width = useStore((s) => s.inkWidth);
  const inkStyle = useStore((s) => s.inkStyle);
  const appendStroke = useStore((s) => s.appendStroke);

  const ref = useRef<HTMLDivElement>(null);
  const drawing = useRef(false);
  const [pts, setPts] = useState<number[]>([]);
  const ptsRef = useRef<number[]>([]);

  const toLocal = (clientX: number, clientY: number): [number, number] => {
    const r = ref.current!.getBoundingClientRect();
    return [(clientX - r.left) / scale, (clientY - r.top) / scale];
  };

  const onDown = (e: ReactPointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drawing.current = true;
    const [x, y] = toLocal(e.clientX, e.clientY);
    ptsRef.current = [x, y];
    setPts([x, y]);
  };
  const onMove = (e: ReactPointerEvent) => {
    if (!drawing.current) return;
    const [x, y] = toLocal(e.clientX, e.clientY);
    const last = ptsRef.current;
    // Skip points too close together to keep strokes light.
    const lx = last[last.length - 2];
    const ly = last[last.length - 1];
    if (lx != null && Math.abs(x - lx) < 1.5 && Math.abs(y - ly) < 1.5) return;
    ptsRef.current = [...last, x, y];
    setPts(ptsRef.current);
  };
  const onUp = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (ptsRef.current.length >= 2)
      appendStroke({ points: ptsRef.current, color, width, style: inkStyle });
    ptsRef.current = [];
    setPts([]);
  };

  const livePoints: string[] = [];
  for (let i = 0; i + 1 < pts.length; i += 2) livePoints.push(`${pts[i]},${pts[i + 1]}`);

  return (
    <div
      ref={ref}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      style={{ position: "absolute", inset: 0, cursor: "crosshair", touchAction: "none", zIndex: 20 }}
    >
      <svg width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`} style={{ display: "block" }}>
        {livePoints.length >= 2 && (
          <polyline
            points={livePoints.join(" ")}
            fill="none"
            stroke={color}
            strokeWidth={width}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </div>
  );
}
