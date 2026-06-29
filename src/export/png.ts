// PNG export. Renders a slide into a clean, off-screen DOM node (no handles /
// overlays) at logical size, rasterizes it with html-to-image, and saves the
// result — via a native dialog in Tauri, or a browser download otherwise.

import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { toPng } from "html-to-image";
import { invoke } from "@tauri-apps/api/core";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import type { Deck, Slide } from "../model/deck";
import { SlideView } from "../render/SlideView";
import { inTauri } from "../lib/env";

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/** Rasterize one slide to a PNG data URL at the given pixel ratio. */
export async function slideToPngDataUrl(slide: Slide, deck: Deck, pixelRatio = 2): Promise<string> {
  const host = document.createElement("div");
  host.style.cssText = `position:fixed;left:-99999px;top:0;width:${deck.size.w}px;height:${deck.size.h}px;`;
  document.body.appendChild(host);
  const root = createRoot(host);
  root.render(createElement(SlideView, { slide, deck }));

  // Let React paint, then make sure every image has decoded before snapshotting.
  await nextFrame();
  await nextFrame();
  await Promise.all(
    [...host.querySelectorAll("img")].map((img) =>
      img.complete ? Promise.resolve() : img.decode().catch(() => {})
    )
  );

  try {
    return await toPng(host.firstElementChild as HTMLElement, {
      width: deck.size.w,
      height: deck.size.h,
      pixelRatio,
      cacheBust: true,
    });
  } finally {
    root.unmount();
    host.remove();
  }
}

/** Save a PNG data URL to disk (Tauri dialog) or trigger a browser download. */
export async function savePng(dataUrl: string, suggestedName: string): Promise<void> {
  if (inTauri()) {
    const path = await saveDialog({
      defaultPath: suggestedName,
      filters: [{ name: "Imagem PNG", extensions: ["png"] }],
    });
    if (!path) return;
    await invoke("write_file_base64", { path, base64Data: dataUrl.split(",")[1] });
  } else {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = suggestedName;
    a.click();
  }
}

/** Convenience: rasterize and save a single slide. */
export async function exportSlidePng(slide: Slide, deck: Deck, index: number): Promise<void> {
  const dataUrl = await slideToPngDataUrl(slide, deck);
  await savePng(dataUrl, `slide-${index + 1}.png`);
}
