// Load a font file picked by the user (.ttf/.otf/.woff/.woff2) and register it
// with the document so it can be used in text. The font bytes are also returned
// as a data URL so the caller can embed them in the deck (`deck.fonts`), making
// the saved .tslides portable — reopening it re-registers the same font.

export interface CustomFont {
  label: string;
  /** CSS font-family value, e.g. "'My Font', sans-serif". */
  value: string;
  /** Bare family name (FontFace key), e.g. "My Font". */
  family: string;
  /** Font file as a data URL, for embedding/persisting in the deck. */
  src: string;
}

const FONT_MIME: Record<string, string> = {
  ttf: "font/ttf",
  otf: "font/otf",
  woff: "font/woff",
  woff2: "font/woff2",
  ttc: "font/collection",
};

function bufToDataUrl(buf: ArrayBuffer, mime: string): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  // Chunk to avoid call-stack limits on String.fromCharCode for large fonts.
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return `data:${mime};base64,${btoa(bin)}`;
}

/** Read a font File, register it via FontFace, and return label/value/family/src. */
export async function loadFontFromFile(file: File): Promise<CustomFont> {
  const buf = await file.arrayBuffer();
  const base =
    file.name.replace(/\.(ttf|otf|woff2?|ttc)$/i, "").replace(/[_-]+/g, " ").trim() || "Fonte importada";
  // Strip quotes that would break the CSS family string.
  const family = base.replace(/['"]/g, "");
  const face = new FontFace(family, buf);
  await face.load();
  document.fonts.add(face);
  const ext = (file.name.split(".").pop() ?? "ttf").toLowerCase();
  const src = bufToDataUrl(buf, FONT_MIME[ext] ?? "font/ttf");
  return { label: family, value: `'${family}', sans-serif`, family, src };
}

/** Register an already-embedded font (from a loaded deck) so its text renders. */
export async function registerEmbeddedFont(family: string, src: string): Promise<void> {
  // Skip if a face with this family is already registered.
  let already = false;
  document.fonts.forEach((f) => {
    if (f.family === family || f.family === `'${family}'`) already = true;
  });
  if (already) return;
  const face = new FontFace(family, `url(${src})`);
  await face.load();
  document.fonts.add(face);
}

/** Open a file picker for a font and resolve to the loaded font (or null if cancelled). */
export function pickAndLoadFont(): Promise<CustomFont | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".ttf,.otf,.woff,.woff2,.ttc,font/ttf,font/otf,font/woff,font/woff2";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        resolve(await loadFontFromFile(file));
      } catch (e) {
        reject(e);
      }
    };
    input.click();
  });
}
