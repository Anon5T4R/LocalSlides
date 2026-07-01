// PNG export. Renders a slide into a clean, off-screen DOM node (no handles /
// overlays) at logical size, rasterizes it with html-to-image, and saves the
// result — via a native dialog in Tauri, or a browser download otherwise.

import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { toPng, toJpeg, toSvg } from "html-to-image";
import { invoke } from "@tauri-apps/api/core";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import type { Deck, Slide } from "../model/deck";
import { SlideView } from "../render/SlideView";
import { inTauri } from "../lib/env";

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/** Mount a slide off-screen and wait for it (and its images) to be paint-ready. */
async function mountSlide(slide: Slide, deck: Deck, transparentBg: boolean) {
  const host = document.createElement("div");
  host.style.cssText = `position:fixed;left:-99999px;top:0;width:${deck.size.w}px;height:${deck.size.h}px;`;
  document.body.appendChild(host);
  const root = createRoot(host);
  // A slide with no explicit background falls back to the theme background;
  // for "transparent PNG" we make that fallback transparent instead. An
  // explicit per-slide background (color/gradient/image) is still honored.
  const renderDeck: Deck = transparentBg
    ? { ...deck, theme: { ...deck.theme, colors: { ...deck.theme.colors, bg: "transparent" } } }
    : deck;
  root.render(createElement(SlideView, { slide, deck: renderDeck }));

  await nextFrame();
  await nextFrame();
  await Promise.all(
    [...host.querySelectorAll("img")].map((img) =>
      img.complete ? Promise.resolve() : img.decode().catch(() => {})
    )
  );
  return { host, root, node: host.firstElementChild as HTMLElement };
}

/** Rasterize one slide to a PNG data URL at the given pixel ratio. */
export async function slideToPngDataUrl(
  slide: Slide,
  deck: Deck,
  opts: { pixelRatio?: number; transparentBg?: boolean } = {}
): Promise<string> {
  const { pixelRatio = 2, transparentBg = false } = opts;
  const { host, root, node } = await mountSlide(slide, deck, transparentBg);
  try {
    return await toPng(node, { width: deck.size.w, height: deck.size.h, pixelRatio, cacheBust: true });
  } finally {
    root.unmount();
    host.remove();
  }
}

/** Rasterize one slide to a JPEG data URL (no transparency — always opaque). */
export async function slideToJpegDataUrl(
  slide: Slide,
  deck: Deck,
  opts: { pixelRatio?: number; quality?: number } = {}
): Promise<string> {
  const { pixelRatio = 2, quality = 0.92 } = opts;
  const { host, root, node } = await mountSlide(slide, deck, false);
  try {
    return await toJpeg(node, {
      width: deck.size.w,
      height: deck.size.h,
      pixelRatio,
      quality,
      cacheBust: true,
      backgroundColor: deck.theme.colors.bg,
    });
  } finally {
    root.unmount();
    host.remove();
  }
}

/** Serialize one slide to a self-contained SVG data URL. */
export async function slideToSvgDataUrl(slide: Slide, deck: Deck, transparentBg = false): Promise<string> {
  const { host, root, node } = await mountSlide(slide, deck, transparentBg);
  try {
    return await toSvg(node, { width: deck.size.w, height: deck.size.h, cacheBust: true });
  } finally {
    root.unmount();
    host.remove();
  }
}

/** Save a base64-encoded (PNG/JPEG) data URL to disk, or trigger a browser download. */
async function saveBinaryDataUrl(
  dataUrl: string,
  suggestedName: string,
  filterName: string,
  extensions: string[]
): Promise<void> {
  if (inTauri()) {
    const path = await saveDialog({ defaultPath: suggestedName, filters: [{ name: filterName, extensions }] });
    if (!path) return;
    await invoke("write_file_base64", { path, base64Data: dataUrl.split(",")[1] });
  } else {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = suggestedName;
    a.click();
  }
}

/** Save a PNG data URL to disk (Tauri dialog) or trigger a browser download. */
export async function savePng(dataUrl: string, suggestedName: string): Promise<void> {
  await saveBinaryDataUrl(dataUrl, suggestedName, "Imagem PNG", ["png"]);
}

/** Save a JPEG data URL to disk (Tauri dialog) or trigger a browser download. */
export async function saveJpeg(dataUrl: string, suggestedName: string): Promise<void> {
  await saveBinaryDataUrl(dataUrl, suggestedName, "Imagem JPEG", ["jpg", "jpeg"]);
}

/** Save an SVG data URL (URI-encoded, not base64) to disk or trigger a download. */
export async function saveSvg(dataUrl: string, suggestedName: string): Promise<void> {
  if (inTauri()) {
    const path = await saveDialog({ defaultPath: suggestedName, filters: [{ name: "Imagem SVG", extensions: ["svg"] }] });
    if (!path) return;
    const svgText = decodeURIComponent(dataUrl.slice(dataUrl.indexOf(",") + 1));
    const bytes = new TextEncoder().encode(svgText);
    let binary = "";
    bytes.forEach((b) => (binary += String.fromCharCode(b)));
    await invoke("write_file_base64", { path, base64Data: btoa(binary) });
  } else {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = suggestedName;
    a.click();
  }
}

/** Convenience: rasterize and save a single slide as PNG. */
export async function exportSlidePng(slide: Slide, deck: Deck, index: number, transparentBg = false): Promise<void> {
  const dataUrl = await slideToPngDataUrl(slide, deck, { transparentBg });
  await savePng(dataUrl, `slide-${index + 1}${transparentBg ? "-transparente" : ""}.png`);
}

/** Convenience: rasterize and save a single slide as JPEG. */
export async function exportSlideJpeg(slide: Slide, deck: Deck, index: number): Promise<void> {
  const dataUrl = await slideToJpegDataUrl(slide, deck);
  await saveJpeg(dataUrl, `slide-${index + 1}.jpg`);
}

/** Convenience: serialize and save a single slide as SVG. */
export async function exportSlideSvg(slide: Slide, deck: Deck, index: number): Promise<void> {
  const dataUrl = await slideToSvgDataUrl(slide, deck);
  await saveSvg(dataUrl, `slide-${index + 1}.svg`);
}
