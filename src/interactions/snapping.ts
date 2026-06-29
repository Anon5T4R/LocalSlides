// Alignment snapping for drag. Compares the moving element's edges and center
// against every other element's edges/centers and the slide's own guides
// (left/center/right, top/middle/bottom). When a pair is within `threshold`
// logical px, it snaps and emits a guide line. All math is in logical px.

import type { Geom, Size } from "../model/deck";

export interface SnapResult {
  x: number;
  y: number;
  /** Vertical guide lines (x positions) and horizontal guide lines (y positions). */
  vGuides: number[];
  hGuides: number[];
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
  // Collect every target a (now-snapped) point lands on, so multiple guides show.
  const snappedPoints = [snapped, snapped + size / 2, snapped + size];
  const guides = new Set<number>();
  for (const p of snappedPoints) {
    for (const t of targets) {
      if (Math.abs(p - t) < 0.5) guides.add(t);
    }
  }
  return { pos: snapped, guides: [...guides] };
}

export function computeSnap(
  moving: Geom,
  others: Geom[],
  slide: Size,
  threshold = DEFAULT_THRESHOLD
): SnapResult {
  const xs = others.map((g) => ({ lo: g.x, mid: g.x + g.w / 2, hi: g.x + g.w }));
  const ys = others.map((g) => ({ lo: g.y, mid: g.y + g.h / 2, hi: g.y + g.h }));
  const x = snapAxis(moving.x, moving.w, axisTargets(xs, slide.w), threshold);
  const y = snapAxis(moving.y, moving.h, axisTargets(ys, slide.h), threshold);
  return { x: x.pos, y: y.pos, vGuides: x.guides, hGuides: y.guides };
}
