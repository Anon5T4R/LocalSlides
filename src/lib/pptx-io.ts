// Open a .pptx from disk and parse it into a deck. Like deck-io.ts, the Rust
// side only hands us bytes (base64); the OPC zip parsing lives in import/pptx.ts.
// Browser builds (the dev preview) fall back to a hidden <input type=file>.

import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import type { Deck } from "../model/deck";
import { importPptxToDeck } from "../import/pptx";
import { inTauri } from "./env";

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export interface ImportedPptx {
  /** Source path (Tauri) or file name (browser) — used to suggest a save name. */
  name: string;
  deck: Deck;
}

/** Pick a .pptx via the browser file dialog (dev preview). Null if cancelled. */
function pickPptxBrowser(): Promise<ImportedPptx | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        resolve({ name: file.name, deck: await importPptxToDeck(bytes) });
      } catch (e) {
        reject(e);
      }
    };
    input.click();
  });
}

/** Show the native open dialog and import the chosen .pptx. Null if cancelled. */
export async function importPptx(): Promise<ImportedPptx | null> {
  if (!inTauri()) return pickPptxBrowser();
  const selected = await openDialog({
    multiple: false,
    filters: [{ name: "Apresentação PowerPoint", extensions: ["pptx"] }],
  });
  if (!selected || Array.isArray(selected)) return null;
  const b64 = await invoke<string>("read_file_base64", { path: selected });
  const deck = await importPptxToDeck(base64ToBytes(b64));
  const name = selected.split(/[\\/]/).pop() ?? "importado.pptx";
  return { name, deck };
}
