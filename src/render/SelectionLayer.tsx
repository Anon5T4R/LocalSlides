// Selection overlay: bounding box + 8 resize handles for the selected element.
// Rendered inside the scaled slide container, so it counter-scales its own
// stroke/handle sizes to stay visually constant regardless of zoom.

import type { PointerEvent as ReactPointerEvent } from "react";
import type { Geom } from "../model/deck";
import { HANDLES, HANDLE_CURSOR, handleAnchor, type Handle } from "../interactions/geometry";

const HANDLE_PX = 10; // on-screen size
const BORDER_PX = 1.5;

export function SelectionLayer({
  geom,
  scale,
  accent,
  onHandleDown,
  onRotateDown,
}: {
  geom: Geom;
  scale: number;
  accent: string;
  onHandleDown: (handle: Handle, e: ReactPointerEvent) => void;
  onRotateDown: (e: ReactPointerEvent) => void;
}) {
  const hs = HANDLE_PX / scale;
  const border = BORDER_PX / scale;
  const rotOffset = 26 / scale;
  return (
    <div
      style={{
        position: "absolute",
        left: geom.x,
        top: geom.y,
        width: geom.w,
        height: geom.h,
        transform: geom.rotation ? `rotate(${geom.rotation}deg)` : undefined,
        transformOrigin: "center center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          border: `${border}px solid ${accent}`,
          boxSizing: "border-box",
        }}
      />
      {/* rotation handle: a stalk above the top-center with a round grip */}
      <div
        style={{
          position: "absolute",
          left: geom.w / 2,
          top: -rotOffset,
          width: border,
          height: rotOffset,
          background: accent,
          pointerEvents: "none",
        }}
      />
      <div
        onPointerDown={(e) => {
          e.stopPropagation();
          onRotateDown(e);
        }}
        style={{
          position: "absolute",
          left: geom.w / 2 - hs / 2,
          top: -rotOffset - hs,
          width: hs,
          height: hs,
          background: "#fff",
          border: `${border}px solid ${accent}`,
          borderRadius: "50%",
          boxSizing: "border-box",
          cursor: "grab",
          pointerEvents: "auto",
        }}
      />
      {HANDLES.map((h) => {
        const { fx, fy } = handleAnchor(h);
        return (
          <div
            key={h}
            onPointerDown={(e) => {
              e.stopPropagation();
              onHandleDown(h, e);
            }}
            style={{
              position: "absolute",
              left: geom.w * fx - hs / 2,
              top: geom.h * fy - hs / 2,
              width: hs,
              height: hs,
              background: "#ffffff",
              border: `${border}px solid ${accent}`,
              borderRadius: hs * 0.2,
              boxSizing: "border-box",
              cursor: HANDLE_CURSOR[h],
              pointerEvents: "auto",
            }}
          />
        );
      })}
    </div>
  );
}
