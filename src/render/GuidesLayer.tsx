// Alignment guide lines drawn while dragging (snapping). Vertical guides are x
// positions, horizontal guides are y positions, both in logical px spanning the
// whole slide. Line thickness counter-scales so it stays crisp at any zoom.

import type { Size } from "../model/deck";

export function GuidesLayer({
  vGuides,
  hGuides,
  size,
  scale,
  color = "#ec4899",
}: {
  vGuides: number[];
  hGuides: number[];
  size: Size;
  scale: number;
  color?: string;
}) {
  const t = 1 / scale;
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
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
    </div>
  );
}
