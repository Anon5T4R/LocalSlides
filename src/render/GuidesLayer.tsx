// Alignment guide lines drawn while dragging (snapping). Vertical guides are x
// positions, horizontal guides are y positions, both in logical px spanning the
// whole slide. Gap guides are equal-spacing indicators (horizontal or vertical).
// Line thickness counter-scales so it stays crisp at any zoom.

import type { Size } from "../model/deck";
import type { GapGuide } from "../interactions/snapping";

const GAP_COLOR = "#ec4899";
const GAP_ARROW = 5; // arrowhead size in logical px

export function GuidesLayer({
  vGuides,
  hGuides,
  gapGuides = [],
  size,
  scale,
  color = "#ec4899",
}: {
  vGuides: number[];
  hGuides: number[];
  gapGuides?: GapGuide[];
  size: Size;
  scale: number;
  color?: string;
}) {
  const t = 1 / scale;
  const a = GAP_ARROW / scale; // scaled arrowhead

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {/* Alignment lines */}
      {vGuides.map((x, i) => (
        <div
          key={"v" + i}
          style={{ position: "absolute", left: x, top: 0, width: t, height: size.h, background: color }}
        />
      ))}
      {hGuides.map((y, i) => (
        <div
          key={"h" + i}
          style={{ position: "absolute", left: 0, top: y, width: size.w, height: t, background: color }}
        />
      ))}

      {/* Gap (equal-spacing) guides — rendered as SVG arrows */}
      {gapGuides.length > 0 && (
        <svg
          width={size.w}
          height={size.h}
          viewBox={`0 0 ${size.w} ${size.h}`}
          style={{ position: "absolute", inset: 0, overflow: "visible" }}
        >
          {gapGuides.map((g, i) => {
            if (g.axis === "h") {
              // Horizontal gap: arrow from g.from to g.to at vertical pos g.pos
              const y = g.pos;
              const x1 = g.from, x2 = g.to;
              const mid = (x1 + x2) / 2;
              return (
                <g key={i} stroke={GAP_COLOR} fill={GAP_COLOR} strokeWidth={t}>
                  <line x1={x1} y1={y} x2={x2} y2={y} />
                  {/* left arrowhead */}
                  <polyline points={`${x1 + a},${y - a} ${x1},${y} ${x1 + a},${y + a}`} fill="none" />
                  {/* right arrowhead */}
                  <polyline points={`${x2 - a},${y - a} ${x2},${y} ${x2 - a},${y + a}`} fill="none" />
                  {/* end ticks */}
                  <line x1={x1} y1={y - a} x2={x1} y2={y + a} />
                  <line x1={x2} y1={y - a} x2={x2} y2={y + a} />
                  {/* gap value label */}
                  <text x={mid} y={y - a * 1.5} textAnchor="middle" fontSize={10 / scale} fill={GAP_COLOR} stroke="none">
                    {Math.round(x2 - x1)}
                  </text>
                </g>
              );
            } else {
              // Vertical gap: arrow from g.from to g.to at horizontal pos g.pos
              const x = g.pos;
              const y1 = g.from, y2 = g.to;
              const mid = (y1 + y2) / 2;
              return (
                <g key={i} stroke={GAP_COLOR} fill={GAP_COLOR} strokeWidth={t}>
                  <line x1={x} y1={y1} x2={x} y2={y2} />
                  <polyline points={`${x - a},${y1 + a} ${x},${y1} ${x + a},${y1 + a}`} fill="none" />
                  <polyline points={`${x - a},${y2 - a} ${x},${y2} ${x + a},${y2 - a}`} fill="none" />
                  <line x1={x - a} y1={y1} x2={x + a} y2={y1} />
                  <line x1={x - a} y1={y2} x2={x + a} y2={y2} />
                  <text x={x + a * 1.5} y={mid} dominantBaseline="middle" fontSize={10 / scale} fill={GAP_COLOR} stroke="none">
                    {Math.round(y2 - y1)}
                  </text>
                </g>
              );
            }
          })}
        </svg>
      )}
    </div>
  );
}
