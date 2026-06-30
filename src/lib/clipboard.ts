import type { Element } from "../model/deck";
import { makeId } from "../model/deck";

let stored: Element[] | null = null;
let pasteCount = 0;

export function copyElements(els: Element[]): void {
  stored = els.map((e) => structuredClone(e));
  pasteCount = 0;
}

export function hasClipboard(): boolean {
  return stored !== null && stored.length > 0;
}

/** Returns clones with fresh ids and cumulative +16px offset, ready to paste. */
export function pasteElements(): Element[] {
  if (!stored) return [];
  pasteCount++;
  const offset = pasteCount * 16;
  const groupMap = new Map<string, string>();
  return stored.map((e) => {
    const clone = structuredClone(e) as Element;
    clone.id = makeId(e.type);
    clone.geom = { ...clone.geom, x: clone.geom.x + offset, y: clone.geom.y + offset };
    if (clone.groupId) {
      if (!groupMap.has(clone.groupId)) groupMap.set(clone.groupId, makeId("group"));
      clone.groupId = groupMap.get(clone.groupId)!;
    }
    return clone;
  });
}
