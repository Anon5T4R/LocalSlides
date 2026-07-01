// Onda 15.3 — Brand kit: user-saved color/font combos (a "brand"), persisted
// in localStorage so they're available across every deck, not just the one
// they were captured from. Applied the same way as the built-in THEME_PRESETS.

import type { Theme } from "../model/deck";

export interface BrandKit {
  id: string;
  name: string;
  theme: Theme;
}

const KEY = "localslides.brandkits";

export function loadBrandKits(): BrandKit[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function save(list: BrandKit[]): BrandKit[] {
  localStorage.setItem(KEY, JSON.stringify(list));
  return list;
}

export function saveBrandKit(name: string, theme: Theme): BrandKit[] {
  const kit: BrandKit = { id: `brand-${Date.now().toString(36)}`, name, theme: structuredClone(theme) };
  return save([...loadBrandKits(), kit]);
}

export function removeBrandKit(id: string): BrandKit[] {
  return save(loadBrandKits().filter((k) => k.id !== id));
}
