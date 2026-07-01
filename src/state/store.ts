// ---------------------------------------------------------------------------
// Central store: Zustand + immer.
//
// Every deck mutation goes through `apply(recipe)`, which produces the next deck
// via immer (cheap structural sharing) and pushes the previous snapshot onto the
// history. undo/redo just swap snapshots. Because *all* edits — including future
// AI edits — funnel through `apply`, they become undoable for free.
//
// Continuous gestures (drag/resize/nudge) wrap their many `apply` calls in a
// transaction (`beginTx`/`endTx`) so they collapse into a single undo step.
// ---------------------------------------------------------------------------

import { create } from "zustand";
import { produce } from "immer";
import {
  Deck,
  Element,
  Slide,
  Theme,
  Asset,
  InkEl,
  InkStroke,
  StrokeStyle,
  newDeck,
  newSlide,
  newAsset,
  findSlide,
  makeId,
} from "../model/deck";
import { copyElements, pasteElements } from "../lib/clipboard";
import { copyStyle as copyStyleSnapshot, getStyle as getStyleSnapshot } from "../lib/styleClipboard";
import { applyStyle } from "../lib/styleClipboard";
import { registerEmbeddedFont } from "../lib/fonts";
import type { EmbeddedFont } from "../model/deck";
import { buildLayout } from "../model/layouts";
import { findTemplate } from "../templates";

const HISTORY_LIMIT = 100;

function deepEqual(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

/** After a deck swap, keep currentSlide/selection pointing at things that exist. */
function reconcile(
  deck: Deck,
  currentSlideId: string,
  selection: string[]
): { currentSlideId: string; selection: string[] } {
  const slide = findSlide(deck, currentSlideId) ?? deck.slides[0];
  const ids = new Set(slide?.elements.map((e) => e.id));
  return {
    currentSlideId: slide?.id ?? "",
    selection: selection.filter((id) => ids.has(id)),
  };
}

export interface SlidesState {
  deck: Deck;
  filePath: string | null;
  dirty: boolean;

  selection: string[];
  currentSlideId: string;
  /** Id of the image currently being cropped (ephemeral UI state), or null. */
  croppingId: string | null;
  /** Freehand drawing tool state (ephemeral UI). */
  drawing: boolean;
  /** Pen draws strokes; eraser removes whole strokes it touches. */
  inkMode: "pen" | "eraser";
  inkColor: string;
  inkWidth: number;
  inkStyle: StrokeStyle;
  /** When true, the next canvas click drops a comment pin. */
  commenting: boolean;
  /** 0 = fit-to-container (computed by the canvas); otherwise a literal scale. */
  zoom: number;
  /** Embed an imported font into the deck (persisted in `.tslides`) and register it. */
  embedFont: (font: EmbeddedFont) => void;

  past: Deck[];
  future: Deck[];
  txDepth: number;

  // history-aware mutation
  apply: (recipe: (d: Deck) => void) => void;
  beginTx: () => void;
  endTx: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // document lifecycle
  loadDeck: (deck: Deck, filePath: string | null) => void;
  resetDeck: () => void;
  markSaved: (filePath?: string) => void;
  setTheme: (theme: Theme) => void;

  // media library (undoable)
  addAsset: (kind: "image" | "video", name: string, src: string) => Asset;
  removeAsset: (id: string) => void;

  // navigation & selection
  setCurrentSlide: (id: string) => void;
  setCropping: (id: string | null) => void;
  setDrawing: (b: boolean) => void;
  setInkMode: (m: "pen" | "eraser") => void;
  setInkColor: (c: string) => void;
  setInkWidth: (n: number) => void;
  setInkStyle: (s: StrokeStyle) => void;
  setCommenting: (b: boolean) => void;
  /** Append a freehand stroke to the current slide's ink layer (creates one if needed). */
  appendStroke: (stroke: InkStroke) => void;
  /** Remove ink strokes near (absolute slide coords) within `radius`; drops the ink element if empty. */
  eraseStrokesAt: (x: number, y: number, radius: number) => void;
  setZoom: (z: number) => void;
  select: (ids: string[]) => void;
  toggleSelect: (id: string, additive: boolean) => void;
  clearSelection: () => void;

  // slide ops (undoable)
  addSlide: (layoutId?: string) => void;
  applyLayout: (layoutId: string) => void;
  addTemplateSlide: (templateId: string) => void;
  duplicateSlide: (id: string) => void;
  deleteSlide: (id: string) => void;
  moveSlide: (id: string, toIndex: number) => void;

  updateCurrentSlide: (recipe: (s: Slide) => void) => void;

  // element ops (undoable)
  addElement: (el: Element) => void;
  addElements: (els: Element[]) => void;
  updateElement: (elId: string, recipe: (el: Element) => void) => void;
  deleteElements: (ids: string[]) => void;
  reorder: (id: string, dir: "front" | "back" | "forward" | "backward") => void;
  duplicateElements: (ids: string[]) => void;

  // clipboard (wraps lib/clipboard; clipboardSize drives paste-button reactivity)
  clipboardSize: number;
  copySelection: () => void;
  cutSelection: () => void;
  pasteFromClipboard: () => void;

  // style clipboard ("copiar/colar estilo"); styleClipboardSize drives reactivity
  styleClipboardSize: number;
  copyStyle: () => void;
  pasteStyle: () => void;

  // manual ruler guides (undoable)
  addGuide: (axis: "x" | "y", pos: number) => void;
  moveGuide: (axis: "x" | "y", index: number, pos: number) => void;
  removeGuide: (axis: "x" | "y", index: number) => void;

  // comments (undoable)
  addComment: (x: number, y: number) => string;
  updateComment: (id: string, patch: { text?: string; resolved?: boolean }) => void;
  removeComment: (id: string) => void;

  // grouping & arrangement (undoable)
  group: () => void;
  ungroup: () => void;
  align: (edge: "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom") => void;
  distribute: (axis: "h" | "v") => void;
}

/** Expand a set of element ids to include every element sharing their groupId. */
export function expandToGroups(slide: Slide | undefined, ids: string[]): string[] {
  if (!slide) return ids;
  const groups = new Set(
    ids
      .map((id) => slide.elements.find((e) => e.id === id)?.groupId)
      .filter((g): g is string => !!g)
  );
  if (!groups.size) return ids;
  const out = new Set(ids);
  slide.elements.forEach((e) => {
    if (e.groupId && groups.has(e.groupId)) out.add(e.id);
  });
  return [...out];
}

const initialDeck = newDeck("16:9");

export const useStore = create<SlidesState>((set, get) => ({
  deck: initialDeck,
  filePath: null,
  dirty: false,

  selection: [],
  currentSlideId: initialDeck.slides[0].id,
  croppingId: null,
  drawing: false,
  inkMode: "pen",
  inkColor: "#ef4444",
  inkWidth: 4,
  inkStyle: "solid",
  commenting: false,
  zoom: 0,
  clipboardSize: 0,
  styleClipboardSize: 0,

  past: [],
  future: [],
  txDepth: 0,

  apply: (recipe) =>
    set((state) => {
      const next = produce(state.deck, recipe);
      if (next === state.deck) return {};
      if (state.txDepth > 0) return { deck: next, dirty: true };
      const past = [...state.past, state.deck];
      if (past.length > HISTORY_LIMIT) past.shift();
      return { deck: next, past, future: [], dirty: true };
    }),

  beginTx: () =>
    set((state) => {
      if (state.txDepth > 0) return { txDepth: state.txDepth + 1 };
      const past = [...state.past, state.deck];
      if (past.length > HISTORY_LIMIT) past.shift();
      return { past, future: [], txDepth: 1 };
    }),

  endTx: () =>
    set((state) => {
      if (state.txDepth === 0) return {};
      const depth = state.txDepth - 1;
      if (depth > 0) return { txDepth: depth };
      // Closing the outermost transaction: drop the snapshot if nothing changed,
      // so an empty gesture doesn't leave a no-op undo step.
      const past = [...state.past];
      const snap = past[past.length - 1];
      if (snap && deepEqual(snap, state.deck)) past.pop();
      return { past, txDepth: 0 };
    }),

  undo: () =>
    set((state) => {
      if (!state.past.length) return {};
      const past = [...state.past];
      const prev = past.pop()!;
      const future = [state.deck, ...state.future];
      return {
        deck: prev,
        past,
        future,
        dirty: true,
        ...reconcile(prev, state.currentSlideId, state.selection),
      };
    }),

  redo: () =>
    set((state) => {
      if (!state.future.length) return {};
      const [next, ...rest] = state.future;
      const past = [...state.past, state.deck];
      return {
        deck: next,
        past,
        future: rest,
        dirty: true,
        ...reconcile(next, state.currentSlideId, state.selection),
      };
    }),

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  loadDeck: (deck, filePath) => {
    // Re-register embedded fonts so saved decks render with their imported fonts.
    (deck.fonts ?? []).forEach((f) => registerEmbeddedFont(f.family, f.src).catch(() => {}));
    set({
      deck,
      filePath,
      dirty: false,
      past: [],
      future: [],
      txDepth: 0,
      selection: [],
      currentSlideId: deck.slides[0]?.id ?? "",
      zoom: 0,
    });
  },

  resetDeck: () => {
    const deck = newDeck("16:9");
    get().loadDeck(deck, null);
  },

  markSaved: (filePath) =>
    set((state) => ({ dirty: false, filePath: filePath ?? state.filePath })),

  setTheme: (theme) =>
    get().apply((d) => {
      d.theme = structuredClone(theme);
    }),

  addAsset: (kind, name, src) => {
    // Dedup by src so re-uploading or re-inserting the same file reuses one asset.
    const existing = get().deck.assets?.find((a) => a.src === src);
    if (existing) return existing;
    const asset = newAsset(kind, name, src);
    get().apply((d) => {
      (d.assets ??= []).push(asset);
    });
    return asset;
  },

  removeAsset: (id) =>
    get().apply((d) => {
      if (d.assets) d.assets = d.assets.filter((a) => a.id !== id);
    }),

  setCurrentSlide: (id) => set({ currentSlideId: id, selection: [], croppingId: null }),
  setCropping: (id) => set({ croppingId: id }),
  setDrawing: (b) => set({ drawing: b, croppingId: null, commenting: false, inkMode: b ? get().inkMode : "pen" }),
  setInkMode: (m) => set({ inkMode: m }),
  embedFont: (font) => {
    registerEmbeddedFont(font.family, font.src).catch(() => {});
    get().apply((d) => {
      d.fonts ??= [];
      if (!d.fonts.some((f) => f.value === font.value)) d.fonts.push(font);
    });
  },
  setInkColor: (c) => set({ inkColor: c }),
  setInkWidth: (n) => set({ inkWidth: n }),
  setInkStyle: (s) => set({ inkStyle: s }),
  setCommenting: (b) => set({ commenting: b, drawing: false, croppingId: null }),

  appendStroke: (stroke) => {
    // Incoming points are absolute slide coords (from DrawLayer). We keep the ink
    // element's box tight to its strokes (so the selection box isn't slide-sized),
    // storing stroke points RELATIVE to that box origin.
    const { currentSlideId } = get();
    const pad = Math.ceil((stroke.width || 4) / 2) + 2;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i + 1 < stroke.points.length; i += 2) {
      minX = Math.min(minX, stroke.points[i]);
      maxX = Math.max(maxX, stroke.points[i]);
      minY = Math.min(minY, stroke.points[i + 1]);
      maxY = Math.max(maxY, stroke.points[i + 1]);
    }
    get().apply((d) => {
      const slide = findSlide(d, currentSlideId);
      if (!slide) return;
      const ink = slide.elements.find((e): e is InkEl => e.type === "ink");
      if (!ink) {
        const x = Math.floor(minX - pad), y = Math.floor(minY - pad);
        const w = Math.ceil(maxX + pad) - x, h = Math.ceil(maxY + pad) - y;
        slide.elements.push({
          id: makeId("ink"),
          type: "ink",
          geom: { x, y, w, h, rotation: 0 },
          base: { w, h },
          strokes: [{ ...stroke, points: stroke.points.map((v, i) => (i % 2 ? v - y : v - x)) }],
        });
        return;
      }
      const ox = ink.geom.x, oy = ink.geom.y;
      const nx = Math.floor(Math.min(ox, minX - pad));
      const ny = Math.floor(Math.min(oy, minY - pad));
      const nw = Math.ceil(Math.max(ox + ink.geom.w, maxX + pad)) - nx;
      const nh = Math.ceil(Math.max(oy + ink.geom.h, maxY + pad)) - ny;
      const sx = ox - nx, sy = oy - ny;
      if (sx || sy || nw !== ink.geom.w || nh !== ink.geom.h) {
        // Box grew/shifted: re-base existing relative points and the geom/base.
        ink.strokes.forEach((s) => (s.points = s.points.map((v, i) => (i % 2 ? v + sy : v + sx))));
        ink.geom = { ...ink.geom, x: nx, y: ny, w: nw, h: nh };
        ink.base = { w: nw, h: nh };
      }
      ink.strokes.push({ ...stroke, points: stroke.points.map((v, i) => (i % 2 ? v - ny : v - nx)) });
    });
  },

  eraseStrokesAt: (x, y, radius) => {
    const { currentSlideId } = get();
    get().apply((d) => {
      const slide = findSlide(d, currentSlideId);
      if (!slide) return;
      const ink = slide.elements.find((e): e is InkEl => e.type === "ink");
      if (!ink) return;
      // Stroke points are stored relative to the ink box origin.
      const lx = x - ink.geom.x;
      const ly = y - ink.geom.y;
      const kept = ink.strokes.filter((s) => {
        const r = radius + (s.width || 1) / 2;
        const r2 = r * r;
        for (let i = 0; i + 1 < s.points.length; i += 2) {
          const dx = s.points[i] - lx;
          const dy = s.points[i + 1] - ly;
          if (dx * dx + dy * dy <= r2) return false; // touched → erase whole stroke
        }
        return true;
      });
      if (kept.length === ink.strokes.length) return; // nothing erased
      if (kept.length === 0) {
        slide.elements = slide.elements.filter((e) => e.id !== ink.id);
      } else {
        ink.strokes = kept;
      }
    });
  },
  setZoom: (z) => set({ zoom: z }),
  select: (ids) => set({ selection: ids }),
  toggleSelect: (id, additive) =>
    set((state) => {
      if (!additive) return { selection: [id] };
      return state.selection.includes(id)
        ? { selection: state.selection.filter((x) => x !== id) }
        : { selection: [...state.selection, id] };
    }),
  clearSelection: () => set({ selection: [] }),

  addSlide: (layoutId) => {
    const { currentSlideId, deck } = get();
    const idx = deck.slides.findIndex((s) => s.id === currentSlideId);
    const slide: Slide = layoutId
      ? { id: makeId("slide"), elements: buildLayout(layoutId, deck) }
      : newSlide(true);
    get().apply((d) => {
      d.slides.splice(idx < 0 ? d.slides.length : idx + 1, 0, slide);
    });
    set({ currentSlideId: slide.id, selection: [] });
  },

  applyLayout: (layoutId) => {
    const { currentSlideId } = get();
    get().apply((d) => {
      const slide = findSlide(d, currentSlideId);
      if (slide) slide.elements = buildLayout(layoutId, d);
    });
    set({ selection: [] });
  },

  addTemplateSlide: (templateId) => {
    const tpl = findTemplate(templateId);
    if (!tpl) return;
    const { currentSlideId, deck } = get();
    const idx = deck.slides.findIndex((s) => s.id === currentSlideId);
    const { elements, background } = tpl.build(deck);
    const slide: Slide = { id: makeId("slide"), elements, background };
    get().apply((d) => {
      d.slides.splice(idx < 0 ? d.slides.length : idx + 1, 0, slide);
    });
    set({ currentSlideId: slide.id, selection: [] });
  },

  duplicateSlide: (id) => {
    const { deck } = get();
    const idx = deck.slides.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const clone: Slide = structuredClone(deck.slides[idx]);
    clone.id = makeId("slide");
    clone.elements = clone.elements.map((e) => ({ ...e, id: makeId(e.type) }));
    get().apply((d) => {
      d.slides.splice(idx + 1, 0, clone);
    });
    set({ currentSlideId: clone.id, selection: [] });
  },

  deleteSlide: (id) => {
    const { deck } = get();
    if (deck.slides.length <= 1) return; // never leave the deck empty
    const idx = deck.slides.findIndex((s) => s.id === id);
    get().apply((d) => {
      d.slides.splice(idx, 1);
    });
    set((state) => {
      const neighbor = state.deck.slides[Math.min(idx, state.deck.slides.length - 1)];
      return { currentSlideId: neighbor?.id ?? "", selection: [] };
    });
  },

  moveSlide: (id, toIndex) => {
    get().apply((d) => {
      const from = d.slides.findIndex((s) => s.id === id);
      if (from < 0) return;
      const clamped = Math.max(0, Math.min(toIndex, d.slides.length - 1));
      const [s] = d.slides.splice(from, 1);
      d.slides.splice(clamped, 0, s);
    });
  },

  updateCurrentSlide: (recipe) => {
    const { currentSlideId } = get();
    get().apply((d) => {
      const slide = findSlide(d, currentSlideId);
      if (slide) recipe(slide);
    });
  },

  addElement: (el) => {
    const { currentSlideId } = get();
    get().apply((d) => {
      findSlide(d, currentSlideId)?.elements.push(el);
    });
    set({ selection: [el.id] });
  },

  addElements: (els) => {
    if (!els.length) return;
    const { currentSlideId } = get();
    get().apply((d) => {
      const slide = findSlide(d, currentSlideId);
      if (slide) slide.elements.push(...els);
    });
    set({ selection: els.map((e) => e.id) });
  },

  duplicateElements: (ids) => {
    if (!ids.length) return;
    const { currentSlideId, deck } = get();
    const slide = findSlide(deck, currentSlideId);
    if (!slide) return;
    const groupMap = new Map<string, string>();
    const clones: Element[] = [];
    ids.forEach((id) => {
      const el = slide.elements.find((e) => e.id === id);
      if (!el) return;
      const clone = structuredClone(el) as Element;
      clone.id = makeId(el.type);
      clone.geom = { ...clone.geom, x: clone.geom.x + 16, y: clone.geom.y + 16 };
      if (clone.groupId) {
        if (!groupMap.has(clone.groupId)) groupMap.set(clone.groupId, makeId("group"));
        clone.groupId = groupMap.get(clone.groupId)!;
      }
      clones.push(clone);
    });
    get().apply((d) => {
      findSlide(d, currentSlideId)?.elements.push(...clones);
    });
    set({ selection: clones.map((c) => c.id) });
  },

  copySelection: () => {
    const { deck, currentSlideId, selection } = get();
    const slide = findSlide(deck, currentSlideId);
    const els = slide?.elements.filter((e) => selection.includes(e.id)) ?? [];
    if (els.length) {
      copyElements(els);
      set({ clipboardSize: els.length });
    }
  },

  cutSelection: () => {
    get().copySelection();
    const { selection } = get();
    if (selection.length) get().deleteElements(selection);
  },

  pasteFromClipboard: () => {
    const els = pasteElements();
    if (els.length) get().addElements(els);
  },

  copyStyle: () => {
    const { deck, currentSlideId, selection } = get();
    const slide = findSlide(deck, currentSlideId);
    const el = slide?.elements.find((e) => e.id === selection[0]);
    if (el) {
      copyStyleSnapshot(el);
      set({ styleClipboardSize: 1 });
    }
  },

  pasteStyle: () => {
    const style = getStyleSnapshot();
    if (!style) return;
    const { currentSlideId, selection } = get();
    const sel = new Set(selection);
    get().apply((d) => {
      findSlide(d, currentSlideId)?.elements.forEach((e) => {
        if (sel.has(e.id)) applyStyle(e, style);
      });
    });
  },

  updateElement: (elId, recipe) => {
    const { currentSlideId } = get();
    get().apply((d) => {
      const slide = findSlide(d, currentSlideId);
      const el = slide?.elements.find((e) => e.id === elId);
      if (el) recipe(el);
    });
  },

  deleteElements: (ids) => {
    if (!ids.length) return;
    const { currentSlideId } = get();
    const set_ = new Set(ids);
    get().apply((d) => {
      const slide = findSlide(d, currentSlideId);
      if (slide) slide.elements = slide.elements.filter((e) => !set_.has(e.id));
    });
    set({ selection: [] });
  },

  reorder: (id, dir) => {
    const { currentSlideId } = get();
    get().apply((d) => {
      const slide = findSlide(d, currentSlideId);
      if (!slide) return;
      const i = slide.elements.findIndex((e) => e.id === id);
      if (i < 0) return;
      const [el] = slide.elements.splice(i, 1);
      const last = slide.elements.length;
      const to =
        dir === "front" ? last : dir === "back" ? 0 : dir === "forward" ? Math.min(i + 1, last) : Math.max(i - 1, 0);
      slide.elements.splice(to, 0, el);
    });
  },

  addGuide: (axis, pos) => {
    const { currentSlideId } = get();
    get().apply((d) => {
      const slide = findSlide(d, currentSlideId);
      if (!slide) return;
      (slide.guides ??= { x: [], y: [] })[axis].push(Math.round(pos));
    });
  },

  moveGuide: (axis, index, pos) => {
    const { currentSlideId } = get();
    get().apply((d) => {
      const g = findSlide(d, currentSlideId)?.guides;
      if (g && g[axis][index] != null) g[axis][index] = Math.round(pos);
    });
  },

  removeGuide: (axis, index) => {
    const { currentSlideId } = get();
    get().apply((d) => {
      const g = findSlide(d, currentSlideId)?.guides;
      if (g) g[axis].splice(index, 1);
    });
  },

  addComment: (x, y) => {
    const { currentSlideId } = get();
    const id = makeId("cmt");
    get().apply((d) => {
      const slide = findSlide(d, currentSlideId);
      if (!slide) return;
      (slide.comments ??= []).push({ id, x: Math.round(x), y: Math.round(y), text: "" });
    });
    return id;
  },

  updateComment: (id, patch) => {
    const { currentSlideId } = get();
    get().apply((d) => {
      const c = findSlide(d, currentSlideId)?.comments?.find((c) => c.id === id);
      if (c) Object.assign(c, patch);
    });
  },

  removeComment: (id) => {
    const { currentSlideId } = get();
    get().apply((d) => {
      const slide = findSlide(d, currentSlideId);
      if (slide?.comments) slide.comments = slide.comments.filter((c) => c.id !== id);
    });
  },

  group: () => {
    const { currentSlideId, selection } = get();
    if (selection.length < 2) return;
    const gid = makeId("group");
    const sel = new Set(selection);
    get().apply((d) => {
      findSlide(d, currentSlideId)?.elements.forEach((e) => {
        if (sel.has(e.id)) e.groupId = gid;
      });
    });
  },

  ungroup: () => {
    const { currentSlideId, selection } = get();
    const sel = new Set(selection);
    get().apply((d) => {
      findSlide(d, currentSlideId)?.elements.forEach((e) => {
        if (sel.has(e.id)) delete e.groupId;
      });
    });
  },

  align: (edge) => {
    const { currentSlideId, selection } = get();
    if (selection.length < 2) return;
    const sel = new Set(selection);
    get().apply((d) => {
      const slide = findSlide(d, currentSlideId);
      if (!slide) return;
      const els = slide.elements.filter((e) => sel.has(e.id));
      const left = Math.min(...els.map((e) => e.geom.x));
      const right = Math.max(...els.map((e) => e.geom.x + e.geom.w));
      const top = Math.min(...els.map((e) => e.geom.y));
      const bottom = Math.max(...els.map((e) => e.geom.y + e.geom.h));
      const cx = (left + right) / 2;
      const cy = (top + bottom) / 2;
      els.forEach((e) => {
        if (edge === "left") e.geom.x = left;
        else if (edge === "right") e.geom.x = right - e.geom.w;
        else if (edge === "hcenter") e.geom.x = cx - e.geom.w / 2;
        else if (edge === "top") e.geom.y = top;
        else if (edge === "bottom") e.geom.y = bottom - e.geom.h;
        else if (edge === "vcenter") e.geom.y = cy - e.geom.h / 2;
      });
    });
  },

  distribute: (axis) => {
    const { currentSlideId, selection } = get();
    if (selection.length < 3) return;
    const sel = new Set(selection);
    get().apply((d) => {
      const slide = findSlide(d, currentSlideId);
      if (!slide) return;
      const els = slide.elements.filter((e) => sel.has(e.id));
      const key = axis === "h" ? "x" : "y";
      const size = axis === "h" ? "w" : "h";
      els.sort((a, b) => a.geom[key] - b.geom[key]);
      const first = els[0].geom[key];
      const last = els[els.length - 1].geom[key] + els[els.length - 1].geom[size];
      const span = last - first;
      const totalSize = els.reduce((s, e) => s + e.geom[size], 0);
      const gap = (span - totalSize) / (els.length - 1);
      let cursor = first;
      els.forEach((e) => {
        e.geom[key] = Math.round(cursor);
        cursor += e.geom[size] + gap;
      });
    });
  },
}));
