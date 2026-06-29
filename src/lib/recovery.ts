// Lightweight crash/close recovery for decks that were never saved to disk.
//
// On-disk decks autosave to their file (see App.tsx). But a brand-new deck has
// no path, so an unexpected close would lose it. We keep a single debounced
// snapshot in localStorage (deck JSON, media inline). It's intentionally cheap:
// one key, written only while dirty, and skipped when the serialized snapshot is
// too large for localStorage (big embedded media) to avoid quota crashes.

import type { Deck } from "../model/deck";

const KEY = "localslides.recovery";
// localStorage is ~5MB; stay well under so a write never throws.
const MAX_BYTES = 4_200_000;

export interface Recovery {
  savedAt: number;
  deck: Deck;
}

/** Persist a recovery snapshot. Returns false if skipped (too large) or failed. */
export function saveRecovery(deck: Deck): boolean {
  try {
    const json = JSON.stringify({ savedAt: Date.now(), deck });
    if (json.length > MAX_BYTES) {
      // Too big to stash safely; drop any stale snapshot so we don't restore old work.
      clearRecovery();
      return false;
    }
    localStorage.setItem(KEY, json);
    return true;
  } catch {
    return false;
  }
}

export function loadRecovery(): Recovery | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const r = JSON.parse(raw) as Recovery;
    if (!r?.deck?.slides?.length) return null;
    return r;
  } catch {
    return null;
  }
}

export function clearRecovery(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
