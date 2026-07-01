// Onda 11.2 — Export MP4/GIF (Abordagem A from the plan: MediaRecorder over a
// canvas, no native binary). Each slide is rasterized once via html-to-image
// (reusing slideToPngDataUrl), painted onto a canvas, held for its configured
// duration, then swapped — canvas.captureStream() samples that canvas at a
// fixed frame rate the whole time, so MediaRecorder gets a normal video
// stream with zero extra dependencies. Output is WEBM (VP9/VP8); MP4 would
// need a native encoder (ffmpeg) and is left for a future pass.

import { invoke } from "@tauri-apps/api/core";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import type { Deck } from "../model/deck";
import { slideToPngDataUrl } from "./png";
import { inTauri } from "../lib/env";

export interface VideoExportOptions {
  /** Seconds each slide stays on screen. Default 3. */
  secondsPerSlide?: number;
  /** Capture frame rate. Default 30. */
  fps?: number;
  onProgress?: (doneSlides: number, totalSlides: number) => void;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function pickMimeType(withAudio: boolean): string {
  const candidates = withAudio
    ? ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
    : ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) return c;
  }
  return "video/webm";
}

/** Render the whole deck to a WEBM video blob. */
export async function exportDeckVideo(deck: Deck, opts: VideoExportOptions = {}): Promise<Blob> {
  const { secondsPerSlide = 3, fps = 30, onProgress } = opts;
  if (typeof MediaRecorder === "undefined") {
    throw new Error("Gravação de vídeo não é suportada neste ambiente.");
  }
  if (deck.slides.length === 0) throw new Error("A apresentação não tem slides.");

  const canvas = document.createElement("canvas");
  canvas.width = deck.size.w;
  canvas.height = deck.size.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível criar o contexto 2D do canvas.");

  const videoStream = (canvas as HTMLCanvasElement & { captureStream(fps?: number): MediaStream }).captureStream(fps);
  const tracks: MediaStreamTrack[] = [...videoStream.getVideoTracks()];

  // Onda 14 — mix in the deck's background music track (if any) via Web Audio,
  // so the exported WEBM carries an audio track alongside the rendered frames.
  let audioEl: HTMLAudioElement | undefined;
  let audioCtx: AudioContext | undefined;
  if (deck.audio) {
    try {
      audioEl = new Audio(deck.audio.src);
      audioEl.loop = true;
      audioEl.crossOrigin = "anonymous";
      audioCtx = new AudioContext();
      const source = audioCtx.createMediaElementSource(audioEl);
      const gain = audioCtx.createGain();
      gain.gain.value = deck.audio.volume ?? 1;
      const dest = audioCtx.createMediaStreamDestination();
      source.connect(gain);
      gain.connect(dest);
      await audioEl.play();
      tracks.push(...dest.stream.getAudioTracks());
    } catch {
      audioEl?.pause();
      audioCtx?.close().catch(() => {});
      audioEl = undefined;
      audioCtx = undefined;
    }
  }

  const stream = new MediaStream(tracks);
  const mimeType = pickMimeType(!!audioEl);
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };

  const stopped = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
  });

  recorder.start();

  try {
    for (let i = 0; i < deck.slides.length; i++) {
      const slide = deck.slides[i];
      const dataUrl = await slideToPngDataUrl(slide, deck, { pixelRatio: 1 });
      const img = await loadImage(dataUrl);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      onProgress?.(i + 1, deck.slides.length);
      await new Promise((r) => setTimeout(r, Math.max(200, secondsPerSlide * 1000)));
    }
  } finally {
    recorder.stop();
    audioEl?.pause();
    audioCtx?.close().catch(() => {});
  }

  return stopped;
}

/** Save a video Blob to disk (Tauri dialog) or trigger a browser download. */
export async function saveVideoBlob(blob: Blob, suggestedName: string): Promise<void> {
  if (inTauri()) {
    const path = await saveDialog({
      defaultPath: suggestedName,
      filters: [{ name: "Vídeo WEBM", extensions: ["webm"] }],
    });
    if (!path) return;
    const buf = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    buf.forEach((b) => (binary += String.fromCharCode(b)));
    await invoke("write_file_base64", { path, base64Data: btoa(binary) });
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = suggestedName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}
