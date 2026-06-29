// Pick image/video files from disk and bring them in as data URLs. The Rust side
// only reads bytes (base64); we tag the right MIME from the extension. In memory
// media always lives as a data URL; serialize.ts externalizes it to the zip.

import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

const IMAGE_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
};

const VIDEO_MIME: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  ogv: "video/ogg",
  ogg: "video/ogg",
  mov: "video/quicktime",
  m4v: "video/mp4",
};

function extOf(path: string): string {
  return path.split(/[\\/]/).pop()?.split(".").pop()?.toLowerCase() ?? "";
}

async function pickAsDataUrl(
  label: string,
  extensions: string[],
  mimeMap: Record<string, string>
): Promise<string | null> {
  const selected = await openDialog({
    multiple: false,
    filters: [{ name: label, extensions }],
  });
  if (!selected || Array.isArray(selected)) return null;
  const b64 = await invoke<string>("read_file_base64", { path: selected });
  const mime = mimeMap[extOf(selected)] ?? "application/octet-stream";
  return `data:${mime};base64,${b64}`;
}

export function pickImageDataUri(): Promise<string | null> {
  return pickAsDataUrl("Imagens", Object.keys(IMAGE_MIME), IMAGE_MIME);
}

/** Build an image data URL from a file path (used by OS drag-and-drop in Tauri). */
export async function imageDataUrlFromPath(path: string): Promise<string | null> {
  const mime = IMAGE_MIME[extOf(path)];
  if (!mime) return null; // not an image we support
  const b64 = await invoke<string>("read_file_base64", { path });
  return `data:${mime};base64,${b64}`;
}

export function pickVideoDataUri(): Promise<string | null> {
  return pickAsDataUrl("Vídeos", Object.keys(VIDEO_MIME), VIDEO_MIME);
}
