// Onda 16 — named version history: manual snapshots of the whole deck, kept
// alongside undo/autosave and persisted inside the .tslides file itself.

import { t, localeTag } from "../lib/i18n";
import { useStore } from "../state/store";
import type { DeckVersion } from "../model/deck";

// Stable reference: a selector returning a fresh `[]` on every call breaks
// useSyncExternalStore's snapshot-consistency check and freezes the app in an
// infinite re-render loop (looks like a white-screen hang, not a JS error).
const NO_VERSIONS: DeckVersion[] = [];

function fmt(ts: number): string {
  return new Date(ts).toLocaleString(localeTag());
}

export function VersionsModal({ onClose }: { onClose: () => void }) {
  const versions = useStore((s) => s.deck.versions ?? NO_VERSIONS);
  const saveVersion = useStore((s) => s.saveVersion);
  const restoreVersion = useStore((s) => s.restoreVersion);
  const deleteVersion = useStore((s) => s.deleteVersion);

  const onSave = () => {
    const name = window.prompt(t("ver.promptName"), t("ver.defaultName", { date: new Date().toLocaleDateString(localeTag()) }));
    if (!name) return;
    try {
      saveVersion(name);
    } catch (e) {
      window.alert(t("ver.saveError", { error: String(e) }));
    }
  };

  const onRestore = (id: string, name: string) => {
    if (!window.confirm(t("ver.confirmRestore", { name }))) return;
    try {
      restoreVersion(id);
      onClose();
    } catch (e) {
      window.alert(t("ver.restoreError", { error: String(e) }));
    }
  };

  return (
    <div className="shortcuts-backdrop" onClick={onClose}>
      <div className="shortcuts-modal" onClick={(e) => e.stopPropagation()}>
        <div className="shortcuts-head">
          <span>{t("ver.title")}</span>
          <button className="insp-mini" onClick={onClose} title={t("ver.close")}>✕</button>
        </div>
        <div className="versions-body">
          <button className="insp-mini" onClick={onSave}>＋ {t("ver.saveCurrent")}</button>
          {versions.length === 0 ? (
            <p className="insp-empty-hint">{t("ver.empty")}</p>
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
                      {t("ver.restore")}
                    </button>
                    <button className="insp-mini" onClick={() => deleteVersion(v.id)} title={t("ver.deleteTitle")}>
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
