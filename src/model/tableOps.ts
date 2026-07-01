// Table cell merge/split helpers (Onda 13.2). Operate in-place on a TableEl,
// meant to be called from inside an immer `updateElement` recipe.

import { plainTextToPM, pmToPlainText, type TableEl } from "./deck";

/** Expand a selection rectangle so it never cuts through an existing merged cell. */
export function expandRectToWholeCells(
  el: TableEl,
  r0: number,
  c0: number,
  r1: number,
  c1: number
): [number, number, number, number] {
  let [minR, minC, maxR, maxC] = [Math.min(r0, r1), Math.min(c0, c1), Math.max(r0, r1), Math.max(c0, c1)];
  let changed = true;
  while (changed) {
    changed = false;
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const cell = el.rows[r]?.[c];
        if (!cell) continue;
        // If this cell is covered, find its master and include the whole span.
        if (cell.covered) {
          for (let mr = r; mr >= 0; mr--) {
            for (let mc = c; mc >= 0; mc--) {
              const master = el.rows[mr]?.[mc];
              if (!master || master.covered) continue;
              const cs = master.colSpan ?? 1;
              const rs = master.rowSpan ?? 1;
              if (mr + rs > r && mc + cs > c && mr <= r && mc <= c) {
                if (mr < minR) { minR = mr; changed = true; }
                if (mc < minC) { minC = mc; changed = true; }
                if (mr + rs - 1 > maxR) { maxR = mr + rs - 1; changed = true; }
                if (mc + cs - 1 > maxC) { maxC = mc + cs - 1; changed = true; }
              }
            }
          }
        } else {
          const cs = cell.colSpan ?? 1;
          const rs = cell.rowSpan ?? 1;
          if (r + rs - 1 > maxR) { maxR = r + rs - 1; changed = true; }
          if (c + cs - 1 > maxC) { maxC = c + cs - 1; changed = true; }
        }
      }
    }
  }
  return [minR, minC, maxR, maxC];
}

/** Merge every cell inside [r0,c0]..[r1,c1] into a single spanning master cell. */
export function mergeCells(el: TableEl, r0: number, c0: number, r1: number, c1: number): void {
  const [minR, minC, maxR, maxC] = expandRectToWholeCells(el, r0, c0, r1, c1);
  if (minR === maxR && minC === maxC) return; // single cell, nothing to merge
  const texts: string[] = [];
  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      const cell = el.rows[r][c];
      if (!cell.covered) {
        const t = pmToPlainText(cell.content).trim();
        if (t) texts.push(t);
      }
    }
  }
  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      const cell = el.rows[r][c];
      if (r === minR && c === minC) {
        cell.colSpan = maxC - minC + 1;
        cell.rowSpan = maxR - minR + 1;
        cell.covered = false;
        cell.content = plainTextToPM(texts.join(" "));
      } else {
        cell.colSpan = 1;
        cell.rowSpan = 1;
        cell.covered = true;
        cell.content = plainTextToPM("");
      }
    }
  }
}

/** Undo a merge at the master cell (r,c): every covered sibling becomes independent again. */
export function splitCell(el: TableEl, r: number, c: number): void {
  const cell = el.rows[r]?.[c];
  if (!cell) return;
  const cs = cell.colSpan ?? 1;
  const rs = cell.rowSpan ?? 1;
  if (cs <= 1 && rs <= 1) return;
  for (let rr = r; rr < r + rs; rr++) {
    for (let cc = c; cc < c + cs; cc++) {
      const sib = el.rows[rr]?.[cc];
      if (!sib) continue;
      sib.colSpan = 1;
      sib.rowSpan = 1;
      sib.covered = false;
    }
  }
}

/** True when (r,c) is the master cell of a merge spanning more than one cell. */
export function isMergedMaster(el: TableEl, r: number, c: number): boolean {
  const cell = el.rows[r]?.[c];
  if (!cell || cell.covered) return false;
  return (cell.colSpan ?? 1) > 1 || (cell.rowSpan ?? 1) > 1;
}
