// ---------------------------------------------------------------------------
// `.tslides` = a zip holding `deck.json` + `media/`.
//
// Mirroring the pptx in spirit: keep images out of the JSON (no base64 bloat,
// natural dedup). In memory we always work with data URLs on ImageEl.src; the
// media folder only exists on disk. This module is the single boundary between
// the two representations.
// ---------------------------------------------------------------------------

import JSZip from "jszip";
import type { Deck, Element } from "./deck";

const DECK_ENTRY = "deck.json";
const MEDIA_DIR = "media/";
const FONTS_DIR = "fonts/";

const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/ogg": "ogv",
  "video/quicktime": "mov",
  "font/ttf": "ttf",
  "font/otf": "otf",
  "font/woff": "woff",
  "font/woff2": "woff2",
  "font/collection": "ttc",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
};
const EXT_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  webm: "video/webm",
  ogv: "video/ogg",
  mov: "video/quicktime",
  ttf: "font/ttf",
  otf: "font/otf",
  woff: "font/woff",
  woff2: "font/woff2",
  ttc: "font/collection",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  aac: "audio/aac",
};

function dataUrlToParts(dataUrl: string): { mime: string; bytes: Uint8Array } | null {
  const m = dataUrl.match(/^data:([^;,]+)(;base64)?,(.*)$/s);
  if (!m) return null;
  const mime = m[1];
  const isB64 = !!m[2];
  const raw = m[3];
  if (isB64) {
    const bin = atob(raw);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { mime, bytes };
  }
  return { mime, bytes: new TextEncoder().encode(decodeURIComponent(raw)) };
}

function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return `data:${mime};base64,${btoa(bin)}`;
}

/** Serialize a deck to `.tslides` bytes, externalizing image data URLs to media/. */
export async function packDeck(deck: Deck): Promise<Uint8Array> {
  const zip = new JSZip();
  // Deep-clone so we can rewrite image srcs without touching the live deck.
  const out: Deck = structuredClone(deck);
  let mediaCount = 0;
  // Dedup identical data URLs (e.g. an asset inserted on many slides) → one file.
  const seen = new Map<string, string>();

  const externalize = (src: string, kind: "image" | "video" | "audio"): string => {
    if (!src.startsWith("data:")) return src;
    const hit = seen.get(src);
    if (hit) return hit;
    const parts = dataUrlToParts(src);
    if (!parts) return src;
    const ext = MIME_EXT[parts.mime] ?? "bin";
    const prefix = kind === "video" ? "vid" : kind === "audio" ? "aud" : "img";
    const name = `${prefix}${++mediaCount}.${ext}`;
    zip.file(MEDIA_DIR + name, parts.bytes);
    const path = MEDIA_DIR + name;
    seen.set(src, path);
    return path;
  };

  const externalizeFont = (src: string, family: string): string => {
    if (!src.startsWith("data:")) return src;
    const hit = seen.get(src);
    if (hit) return hit;
    const parts = dataUrlToParts(src);
    if (!parts) return src;
    const ext = MIME_EXT[parts.mime] ?? "ttf";
    const safe = family.replace(/[^a-z0-9_-]+/gi, "_") || "font";
    const path = `${FONTS_DIR}${safe}-${++mediaCount}.${ext}`;
    zip.file(path, parts.bytes);
    seen.set(src, path);
    return path;
  };

  for (const slide of out.slides) {
    if (slide.background?.kind === "image") slide.background.src = externalize(slide.background.src, "image");
    for (const el of slide.elements) {
      if (el.type === "image" || el.type === "video") el.src = externalize(el.src, el.type);
      if ((el.type === "shape" || el.type === "text") && el.fill?.kind === "image")
        el.fill.src = externalize(el.fill.src, "image");
    }
  }
  for (const asset of out.assets ?? []) asset.src = externalize(asset.src, asset.kind);
  for (const font of out.fonts ?? []) font.src = externalizeFont(font.src, font.family);
  if (out.audio) out.audio.src = externalize(out.audio.src, "audio");

  zip.file(DECK_ENTRY, JSON.stringify(out));
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

/** Parse `.tslides` bytes back into a deck, inlining media/ files as data URLs. */
export async function unpackDeck(bytes: Uint8Array): Promise<Deck> {
  const zip = await JSZip.loadAsync(bytes);
  const entry = zip.file(DECK_ENTRY);
  if (!entry) throw new Error("Arquivo .tslides inválido: deck.json ausente.");
  const deck = JSON.parse(await entry.async("string")) as Deck;

  // Inline any media/ references back into data URLs.
  const cache = new Map<string, string>();
  const resolve = async (src: string): Promise<string> => {
    if (!src.startsWith(MEDIA_DIR) && !src.startsWith(FONTS_DIR)) return src;
    if (cache.has(src)) return cache.get(src)!;
    const f = zip.file(src);
    if (!f) return src;
    const data = await f.async("uint8array");
    const ext = src.split(".").pop()?.toLowerCase() ?? "";
    const url = bytesToDataUrl(data, EXT_MIME[ext] ?? "application/octet-stream");
    cache.set(src, url);
    return url;
  };

  for (const slide of deck.slides) {
    if (slide.background?.kind === "image") slide.background.src = await resolve(slide.background.src);
    for (const el of slide.elements as Element[]) {
      if (el.type === "image" || el.type === "video") el.src = await resolve(el.src);
      if ((el.type === "shape" || el.type === "text") && el.fill?.kind === "image")
        el.fill.src = await resolve(el.fill.src);
    }
  }
  for (const asset of deck.assets ?? []) asset.src = await resolve(asset.src);
  for (const font of deck.fonts ?? []) font.src = await resolve(font.src);
  if (deck.audio) deck.audio.src = await resolve(deck.audio.src);
  return deck;
}
