// ---------------------------------------------------------------------------
// UI feedback: toasts empilhados (mesmo padrão do LocalCalc/LocalAgenda).
// Store zustand separado do deck (state/store.ts) — feedback efêmero não entra
// no histórico de undo. `pushToast` é exportado como função de módulo pra poder
// ser chamado fora de componente (callbacks async, libs).
// ---------------------------------------------------------------------------

import { create } from "zustand";

import { loadSections, saveSections, toggled, type SectionState } from "../lib/sections";

export interface Toast {
  id: number;
  kind: "info" | "error" | "ok";
  text: string;
}

interface UiState {
  toasts: Toast[];
  /**
   * Quais seções do inspetor o usuário abriu/fechou (padrão B9 da suíte).
   *
   * Só o que ele MEXEU entra aqui — ausente = "ainda não opinou", e aí vale o
   * padrão da seção (aberta quando a propriedade saiu do neutro). Mora no
   * store, e não num `useState` dentro da seção, por um motivo concreto: as
   * seções condicionais ao tipo do elemento (Efeitos em texto, Ajustes em
   * imagem) REMONTAM ao trocar de seleção, e com isso o estado local morria.
   * PERSISTE em `localStorage` — é layout de bancada, não estado de momento.
   */
  sections: SectionState;
  toggleSection: (id: string, open: boolean) => void;
  pushToast: (kind: Toast["kind"], text: string) => void;
  dismissToast: (id: number) => void;
}

const SECTIONS_KEY = "localslides.sections";

let nextToast = 1;

export const useUi = create<UiState>((set) => ({
  toasts: [],
  sections: loadSections(SECTIONS_KEY),
  toggleSection: (id, open) =>
    set((s) => {
      const sections = toggled(s.sections, id, open);
      saveSections(SECTIONS_KEY, sections);
      return { sections };
    }),
  pushToast: (kind, text) =>
    set((s) => ({ toasts: [...s.toasts, { id: nextToast++, kind, text }] })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Atalho pra disparar toast de qualquer lugar (inclusive fora de componente). */
export function pushToast(kind: Toast["kind"], text: string) {
  useUi.getState().pushToast(kind, text);
}
