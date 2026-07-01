// Onda 16 — keyboard shortcuts cheat-sheet. Opened with "?" or the toolbar
// help button; a static list (kept in sync by hand, there's no central
// shortcut registry in the app) grouped by category.

const GROUPS: { title: string; items: { keys: string; label: string }[] }[] = [
  {
    title: "Arquivo",
    items: [
      { keys: "Ctrl+N", label: "Nova apresentação" },
      { keys: "Ctrl+O", label: "Abrir" },
      { keys: "Ctrl+S", label: "Salvar" },
      { keys: "Ctrl+Shift+S", label: "Salvar como" },
    ],
  },
  {
    title: "Edição",
    items: [
      { keys: "Ctrl+Z", label: "Desfazer" },
      { keys: "Ctrl+Y / Ctrl+Shift+Z", label: "Refazer" },
      { keys: "Ctrl+C", label: "Copiar" },
      { keys: "Ctrl+X", label: "Recortar" },
      { keys: "Ctrl+V", label: "Colar" },
      { keys: "Ctrl+Shift+C / Ctrl+Shift+V", label: "Copiar / colar estilo" },
      { keys: "Ctrl+D", label: "Duplicar seleção" },
      { keys: "Ctrl+A", label: "Selecionar tudo no slide" },
      { keys: "Delete / Backspace", label: "Excluir seleção" },
      { keys: "Setas", label: "Mover 1px (Shift = 10px)" },
      { keys: "Ctrl+G / Ctrl+Shift+G", label: "Agrupar / desagrupar" },
    ],
  },
  {
    title: "Slides",
    items: [
      { keys: "Ctrl+M", label: "Novo slide" },
      { keys: "Alt+arrastar (painel Slides)", label: "Duplicar slide" },
      { keys: "F2 / Enter", label: "Editar texto selecionado" },
    ],
  },
  {
    title: "Canvas",
    items: [
      { keys: "Ctrl+Scroll", label: "Zoom" },
      { keys: "Espaço+arrastar", label: "Panorâmica" },
      { keys: "Alt+arrastar elemento", label: "Duplicar elemento" },
      { keys: "Shift+clique", label: "Somar/remover da seleção" },
    ],
  },
  {
    title: "Apresentar",
    items: [
      { keys: "F5", label: "Iniciar apresentação" },
      { keys: "→ / Espaço / PageDown", label: "Próximo slide" },
      { keys: "← / PageUp", label: "Slide anterior" },
      { keys: "N", label: "Alternar notas do apresentador" },
      { keys: "Esc", label: "Sair da apresentação" },
    ],
  },
];

export function ShortcutsModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="shortcuts-backdrop" onClick={onClose}>
      <div className="shortcuts-modal" onClick={(e) => e.stopPropagation()}>
        <div className="shortcuts-head">
          <span>Atalhos de teclado</span>
          <button className="insp-mini" onClick={onClose} title="Fechar (Esc)">✕</button>
        </div>
        <div className="shortcuts-body">
          {GROUPS.map((g) => (
            <div key={g.title} className="shortcuts-group">
              <div className="shortcuts-group-title">{g.title}</div>
              {g.items.map((it) => (
                <div key={it.label} className="shortcuts-row">
                  <kbd>{it.keys}</kbd>
                  <span>{it.label}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
