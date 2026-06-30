// Load a font file picked by the user (.ttf/.otf/.woff/.woff2) and register it
// with the document so it can be used in text. Session-scoped: the font is NOT
// embedded in the .tslides file, so reopening a saved deck falls back unless the
// same font is imported again (or installed on the system).

export interface CustomFont {
  label: string;
  /** CSS font-family value, e.g. "'My Font', sans-serif". */
  value: string;
}

/** Read a font File, register it via FontFace, and return its label/value. */
export async function loadFontFromFile(file: File): Promise<CustomFont> {
  const buf = await file.arrayBuffer();
  const base =
    file.name.replace(/\.(ttf|otf|woff2?|ttc)$/i, "").replace(/[_-]+/g, " ").trim() || "Fonte importada";
  // Strip quotes that would break the CSS family string.
  const family = base.replace(/['"]/g, "");
  const face = new FontFace(family, buf);
  await face.load();
  document.fonts.add(face);
  return { label: family, value: `'${family}', sans-serif` };
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
