/** True when running inside the Tauri native shell (vs a plain browser preview). */
export function inTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
