// Bridge between a deck in memory and a `.tslides` file on disk. The Rust side
// only moves bytes (base64 in/out); the zip structure is built/parsed here with
// JSZip — mirroring how Sheets keeps XLSX logic in JS over a thin binary bridge.

import { invoke } from "@tauri-apps/api/core";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import type { Deck } from "../model/deck";
import { packDeck, unpackDeck } from "../model/serialize";

export interface DeckFile {
  path: string;
  deck: Deck;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export function baseName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

/** Load a deck from a known path. */
export async function openDeckPath(path: string): Promise<DeckFile> {
  const b64 = await invoke<string>("read_file_base64", { path });
  const deck = await unpackDeck(base64ToBytes(b64));
  return { path, deck };
}

/** Show a native open dialog and load the chosen `.tslides`. Null if cancelled. */
export async function openDeck(): Promise<DeckFile | null> {
  const selected = await openDialog({
    multiple: false,
    filters: [{ name: "Apresentação LocalSlides", extensions: ["tslides"] }],
  });
  if (!selected || Array.isArray(selected)) return null;
  return openDeckPath(selected);
}

/** Write a deck to an existing path. */
export async function saveDeckTo(path: string, deck: Deck): Promise<void> {
  const bytes = await packDeck(deck);
  await invoke("write_file_base64", { path, base64Data: bytesToBase64(bytes) });
}

/** Show a native save dialog and write there. Returns the new path, or null. */
export async function saveDeckAs(deck: Deck, suggestedName = "apresentacao.tslides"): Promise<string | null> {
  const path = await saveDialog({
    defaultPath: suggestedName,
    filters: [{ name: "Apresentação LocalSlides", extensions: ["tslides"] }],
  });
  if (!path) return null;
  await saveDeckTo(path, deck);
  return path;
}
