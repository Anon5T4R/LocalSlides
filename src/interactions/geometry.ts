// Pure geometry helpers for the canvas gestures. All math is in logical px.

import type { Geom } from "../model/deck";

export const MIN_SIZE = 24;

export type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export const HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

/** CSS cursor for each resize handle. */
export const HANDLE_CURSOR: Record<Handle, string> = {
  nw: "nwse-resize",
  n: "ns-resize",
  ne: "nesw-resize",
  e: "ew-resize",
  se: "nwse-resize",
  s: "ns-resize",
  sw: "nesw-resize",
  w: "ew-resize",
};

/** Position of a handle as a fraction (0..1) of the box, for placement. */
export function handleAnchor(h: Handle): { fx: number; fy: number } {
  const fx = h.includes("w") ? 0 : h.includes("e") ? 1 : 0.5;
  const fy = h.includes("n") ? 0 : h.includes("s") ? 1 : 0.5;
  return { fx, fy };
}

/**
 * Apply a resize from `start` geom by a logical (dx, dy) on the given handle.
 * - `aspect` (Shift + corner): keeps the original w/h ratio.
 * - `fromCenter` (Alt): expands/contracts symmetrically around the center.
 */
export function resizeGeom(
  start: Geom,
  handle: Handle,
  dx: number,
  dy: number,
  aspect = false,
  fromCenter = false,
): Geom {
  let { x, y, w, h } = start;
  const west = handle.includes("w");
  const east = handle.includes("e");
  const north = handle.includes("n");
  const south = handle.includes("s");
  const corner = (west || east) && (north || south);

  if (aspect && corner && start.h > 0) {
    const ratio = start.w / start.h;
    let nw: number;
    let nh: number;
    if (Math.abs(dx) >= Math.abs(dy)) {
      nw = start.w + (east ? dx : -dx);
      nh = nw / ratio;
    } else {
      nh = start.h + (south ? dy : -dy);
      nw = nh * ratio;
    }
    nw = Math.max(MIN_SIZE, nw);
    nh = Math.max(MIN_SIZE, nh);
    if (fromCenter) {
      x = start.x + (start.w - nw) / 2;
      y = start.y + (start.h - nh) / 2;
    } else {
      if (west) x = start.x + (start.w - nw);
      if (north) y = start.y + (start.h - nh);
    }
    return { ...start, x, y, w: nw, h: nh };
  }

  // Raw deltas for each axis.
  const rawDx = west ? -dx : east ? dx : 0;
  const rawDy = north ? -dy : south ? dy : 0;

  if (fromCenter) {
    // Grow/shrink symmetrically: both opposite edges move by the same amount.
    w = Math.max(MIN_SIZE, start.w + rawDx * 2);
    h = Math.max(MIN_SIZE, start.h + rawDy * 2);
    x = start.x + (start.w - w) / 2;
    y = start.y + (start.h - h) / 2;
  } else {
    if (west) { x = start.x + dx; w = start.w - dx; }
    else if (east) { w = start.w + dx; }
    if (north) { y = start.y + dy; h = start.h - dy; }
    else if (south) { h = start.h + dy; }

    if (w < MIN_SIZE) { if (west) x -= MIN_SIZE - w; w = MIN_SIZE; }
    if (h < MIN_SIZE) { if (north) y -= MIN_SIZE - h; h = MIN_SIZE; }
  }

  return { ...start, x, y, w, h };
}

/** Angle (degrees) from a box center to a point, with 0° pointing up. */
export function rotationFromPointer(
  geom: Geom,
  px: number,
  py: number,
  snap = false
): number {
  const cx = geom.x + geom.w / 2;
  const cy = geom.y + geom.h / 2;
  let deg = (Math.atan2(py - cy, px - cx) * 180) / Math.PI + 90;
  deg = ((deg % 360) + 360) % 360;
  if (snap) deg = Math.round(deg / 15) * 15;
  return Math.round(deg);
}
