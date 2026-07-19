import { useEffect } from "react";
import { useUi } from "../state/ui";

/** Toasts empilhados no rodapé (somem sozinhos; clique dispensa na hora). */
export function Toasts() {
  const toasts = useUi((s) => s.toasts);
  const dismiss = useUi((s) => s.dismissToast);

  useEffect(() => {
    if (toasts.length === 0) return;
    const first = toasts[0];
    // Erros carregam detalhe (mensagem da exceção) — ficam mais tempo na tela.
    const timer = setTimeout(() => dismiss(first.id), first.kind === "error" ? 7000 : 4000);
    return () => clearTimeout(timer);
  }, [toasts, dismiss]);

  if (toasts.length === 0) return null;
  return (
    <div className="toasts">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.kind}`} onClick={() => dismiss(toast.id)}>
          {toast.text}
        </div>
      ))}
    </div>
  );
}
