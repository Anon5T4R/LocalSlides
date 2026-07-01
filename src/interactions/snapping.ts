// Alignment snapping for drag. Compares the moving element's edges and center
// against every other element's edges/centers and the slide's own guides
// (left/center/right, top/middle/bottom). When a pair is within `threshold`
// logical px, it snaps and emits a guide line.
//
// Also detects equal-spacing between the moving element and its two nearest
// neighbours on each axis, emitting "gap guides" (like Canva's pink arrows).
//
// All math is in logical px.

import type { Geom, Size } from "../model/deck";

export interface GapGuide {
  /** Gap guides are rendered as double-headed arrows between two elements. */
  axis: "h" | "v";
  /** Fixed-axis position of the guide (top edge of H gap, left edge of V gap). */
  pos: number;
  /** Start and end of the gap along the main axis. */
  from: number;
  to: number;
}

export interface SnapResult {
  x: number;
  y: number;
  /** Vertical guide lines (x positions) and horizontal guide lines (y positions). */
  vGuides: number[];
  hGuides: number[];
  /** Equal-spacing gap guides. */
  gapGuides: GapGuide[];
}

const DEFAULT_THRESHOLD = 6;

function axisTargets(others: { lo: number; mid: number; hi: number }[], slideExtent: number): number[] {
  const t = [0, slideExtent / 2, slideExtent];
  for (const o of others) t.push(o.lo, o.mid, o.hi);
  return t;
}

function snapAxis(
  pos: number,
  size: number,
  targets: number[],
  threshold: number
): { pos: number; guides: number[] } {
  const points = [pos, pos + size / 2, pos + size]; // lo, mid, hi of the moving box
  let best: { delta: number; abs: number } | null = null;
  for (const p of points) {
    for (const t of targets) {
      const delta = t - p;
      const abs = Math.abs(delta);
      if (abs <= threshold && (!best || abs < best.abs)) best = { delta, abs };
    }
  }
  if (!best) return { pos, guides: [] };
  const snapped = pos + best.delta;
  const snappedPoints = [snapped, snapped + size / 2, snapped + size];
  const guides = new Set<number>();
  for (const p of snappedPoints) {
    for (const t of targets) {
      if (Math.abs(p - t) < 0.5) guides.add(t);
    }
  }
  return { pos: snapped, guides: [...guides] };
}

/**
 * Equal-spacing snap on one axis.
 * Finds the two closest neighbours (one on each side of the moving box) and
 * checks whether the gaps on both sides are nearly equal. If so, snaps to make
 * them exactly equal and returns gap guides.
 */
function snapGap(
  pos: number,
  size: number,
  others: Geom[],
  axisKey: "x" | "y",
  sizeKey: "w" | "h",
  threshold: number,
): { delta: number; gapGuides: GapGuide[] } {
  const axis: "h" | "v" = axisKey === "x" ? "h" : "v";

  // Sort others by their start on this axis.
  const sorted = [...others].sort((a, b) => a[axisKey] - b[axisKey]);

  // Neighbours: nearest element ending before the moving box (left/top) and
  // nearest element starting after it (right/bottom).
  const mid = pos + size / 2;
  let before: Geom | null = null;
  let after: Geom | null = null;
  for (const o of sorted) {
    const oEnd = o[axisKey] + o[sizeKey];
    const oStart = o[axisKey];
    if (oEnd <= pos + threshold && (before === null || oEnd > before[axisKey] + before[sizeKey])) {
      before = o;
    }
    if (oStart >= pos + size - threshold && (after === null || oStart < after[axisKey])) {
      after = o;
    }
  }

  if (!before || !after) return { delta: 0, gapGuides: [] };

  const gapBefore = pos - (before[axisKey] + before[sizeKey]); // space between `before` end and moving start
  const gapAfter = after[axisKey] - (pos + size);               // space between moving end and `after` start

  const diff = gapBefore - gapAfter;
  if (Math.abs(diff) > threshold) return { delta: 0, gapGuides: [] };

  // Snap: move so both gaps are equal.
  const targetGap = (gapBefore + gapAfter) / 2;
  const snappedPos = before[axisKey] + before[sizeKey] + targetGap;
  const delta = snappedPos - pos;

  // Build gap guides (midline of each gap along the perpendicular axis).
  // Use the vertical centre of the bounding box of all three elements for position.
  const crossKey = axisKey === "x" ? "y" : "x";
  const crossSizeKey = axisKey === "x" ? "h" : "w";
  const crossMid = mid; // reuse the moving box center for the perpendicular pos
  void crossMid;
  // Guide 1: between `before` and moving (at snapped position).
  const g1From = before[axisKey] + before[sizeKey];
  const g1To = snappedPos;
  const g1Pos = Math.max(before[crossKey], (before[crossKey] + before[crossSizeKey]) / 2);
  void g1Pos;

  const guides: GapGuide[] = [
    { axis, pos: before[crossKey] + before[crossSizeKey] / 2, from: g1From, to: g1To },
    { axis, pos: after[crossKey] + after[crossSizeKey] / 2, from: snappedPos + size, to: after[axisKey] },
  ];

  return { delta, gapGuides: guides };
}

export function computeSnap(
  moving: Geom,
  others: Geom[],
  slide: Size,
  threshold = DEFAULT_THRESHOLD,
  /** Manual ruler guides to also snap against (vertical x[], horizontal y[]). */
  manual?: { x: number[]; y: number[] }
): SnapResult {
  const xs = others.map((g) => ({ lo: g.x, mid: g.x + g.w / 2, hi: g.x + g.w }));
  const ys = others.map((g) => ({ lo: g.y, mid: g.y + g.h / 2, hi: g.y + g.h }));
  const xSnap = snapAxis(moving.x, moving.w, axisTargets(xs, slide.w).concat(manual?.x ?? []), threshold);
  const ySnap = snapAxis(moving.y, moving.h, axisTargets(ys, slide.h).concat(manual?.y ?? []), threshold);

  // Only apply gap-snap if no alignment snap won on that axis.
  const gapGuides: GapGuide[] = [];
  let finalX = xSnap.pos;
  let finalY = ySnap.pos;

  if (xSnap.guides.length === 0) {
    const g = snapGap(moving.x, moving.w, others, "x", "w", threshold);
    if (g.gapGuides.length) { finalX += g.delta; gapGuides.push(...g.gapGuides); }
  }
  if (ySnap.guides.length === 0) {
    const g = snapGap(moving.y, moving.h, others, "y", "h", threshold);
    if (g.gapGuides.length) { finalY += g.delta; gapGuides.push(...g.gapGuides); }
  }

  return { x: finalX, y: finalY, vGuides: xSnap.guides, hGuides: ySnap.guides, gapGuides };
}
