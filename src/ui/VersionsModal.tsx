// Onda 16 — named version history: manual snapshots of the whole deck, kept
// alongside undo/autosave and persisted inside the .tslides file itself.

import { useStore } from "../state/store";
import type { DeckVersion } from "../model/deck";

// Stable reference: a selector returning a fresh `[]` on every call breaks
// useSyncExternalStore's snapshot-consistency check and freezes the app in an
// infinite re-render loop (looks like a white-screen hang, not a JS error).
const NO_VERSIONS: DeckVersion[] = [];

function fmt(ts: number): string {
  return new Date(ts).toLocaleString();
}

export function VersionsModal({ onClose }: { onClose: () => void }) {
  const versions = useStore((s) => s.deck.versions ?? NO_VERSIONS);
  const saveVersion = useStore((s) => s.saveVersion);
  const restoreVersion = useStore((s) => s.restoreVersion);
  const deleteVersion = useStore((s) => s.deleteVersion);

  const onSave = () => {
    const name = window.prompt("Nome da versão:", `Versão ${new Date().toLocaleDateString()}`);
    if (!name) return;
    try {
      saveVersion(name);
    } catch (e) {
      window.alert(`Não foi possível salvar a versão:\n${e}`);
    }
  };

  const onRestore = (id: string, name: string) => {
    if (!window.confirm(`Restaurar "${name}"? As mudanças atuais não salvas nesta versão serão substituídas (mas continuam no histórico de desfazer).`)) return;
    try {
      restoreVersion(id);
      onClose();
    } catch (e) {
      window.alert(`Não foi possível restaurar a versão:\n${e}`);
    }
  };

  return (
    <div className="shortcuts-backdrop" onClick={onClose}>
      <div className="shortcuts-modal" onClick={(e) => e.stopPropagation()}>
        <div className="shortcuts-head">
          <span>Histórico de versões</span>
          <button className="insp-mini" onClick={onClose} title="Fechar (Esc)">✕</button>
        </div>
        <div className="versions-body">
          <button className="insp-mini" onClick={onSave}>＋ Salvar versão atual</button>
          {versions.length === 0 ? (
            <p className="insp-empty-hint">Nenhuma versão salva ainda. Salve uma agora para poder voltar a ela depois.</p>
          ) : (
            <div className="versions-list">
              {[...versions].reverse().map((v) => (
                <div key={v.id} className="versions-row">
                  <div className="versions-row-info">
                    <span className="versions-row-name">{v.name}</span>
                    <span className="versions-row-ts">{fmt(v.ts)}</span>
                  </div>
                  <div className="insp-zorder">
                    <button className="insp-mini" onClick={() => onRestore(v.id, v.name)}>
                      Restaurar
                    </button>
                    <button className="insp-mini" onClick={() => deleteVersion(v.id)} title="Excluir versão">
                      🗑
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
