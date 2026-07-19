// ---------------------------------------------------------------------------
// UI feedback: toasts empilhados (mesmo padrão do LocalCalc/LocalAgenda).
// Store zustand separado do deck (state/store.ts) — feedback efêmero não entra
// no histórico de undo. `pushToast` é exportado como função de módulo pra poder
// ser chamado fora de componente (callbacks async, libs).
// ---------------------------------------------------------------------------

import { create } from "zustand";

export interface Toast {
  id: number;
  kind: "info" | "error" | "ok";
  text: string;
}

interface UiState {
  toasts: Toast[];
  pushToast: (kind: Toast["kind"], text: string) => void;
  dismissToast: (id: number) => void;
}

let nextToast = 1;

export const useUi = create<UiState>((set) => ({
  toasts: [],
  pushToast: (kind, text) =>
    set((s) => ({ toasts: [...s.toasts, { id: nextToast++, kind, text }] })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Atalho pra disparar toast de qualquer lugar (inclusive fora de componente). */
export function pushToast(kind: Toast["kind"], text: string) {
  useUi.getState().pushToast(kind, text);
}
