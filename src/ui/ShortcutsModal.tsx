// Onda 16 — keyboard shortcuts cheat-sheet. Opened with "?" or the toolbar
// help button; a static list (kept in sync by hand, there's no central
// shortcut registry in the app) grouped by category.

import { t } from "../lib/i18n";

function buildGroups(): { title: string; items: { keys: string; label: string }[] }[] {
  return [
    {
      title: t("sc.grpFile"),
      items: [
        { keys: "Ctrl+N", label: t("sc.newPres") },
        { keys: "Ctrl+O", label: t("sc.open") },
        { keys: "Ctrl+S", label: t("sc.save") },
        { keys: "Ctrl+Shift+S", label: t("sc.saveAs") },
      ],
    },
    {
      title: t("sc.grpEdit"),
      items: [
        { keys: "Ctrl+Z", label: t("sc.undo") },
        { keys: "Ctrl+Y / Ctrl+Shift+Z", label: t("sc.redo") },
        { keys: "Ctrl+C", label: t("sc.copy") },
        { keys: "Ctrl+X", label: t("sc.cut") },
        { keys: "Ctrl+V", label: t("sc.paste") },
        { keys: "Ctrl+Shift+C / Ctrl+Shift+V", label: t("sc.copyPasteStyle") },
        { keys: "Ctrl+D", label: t("sc.dupSelection") },
        { keys: "Ctrl+A", label: t("sc.selectAll") },
        { keys: "Delete / Backspace", label: t("sc.deleteSelection") },
        { keys: t("sc.keysMove"), label: t("sc.move1px") },
        { keys: "Ctrl+G / Ctrl+Shift+G", label: t("sc.groupUngroup") },
      ],
    },
    {
      title: t("sc.grpSlides"),
      items: [
        { keys: "Ctrl+M", label: t("sc.newSlide") },
        { keys: t("sc.keysDupSlide"), label: t("sc.dupSlide") },
        { keys: "F2 / Enter", label: t("sc.editText") },
      ],
    },
    {
      title: t("sc.grpCanvas"),
      items: [
        { keys: "Ctrl+Scroll", label: t("sc.zoom") },
        { keys: t("sc.keysPan"), label: t("sc.pan") },
        { keys: t("sc.keysDupElement"), label: t("sc.dupElement") },
        { keys: t("sc.keysAddRemove"), label: t("sc.addRemoveSelection") },
      ],
    },
    {
      title: t("sc.grpPresent"),
      items: [
        { keys: "F5", label: t("sc.startPresent") },
        { keys: t("sc.keysNextSlide"), label: t("sc.nextSlide") },
        { keys: "← / PageUp", label: t("sc.prevSlide") },
        { keys: "N", label: t("sc.toggleNotes") },
        { keys: "Esc", label: t("sc.exitPresent") },
      ],
    },
  ];
}

export function ShortcutsModal({ onClose }: { onClose: () => void }) {
  const GROUPS = buildGroups();
  return (
    <div className="shortcuts-backdrop" onClick={onClose}>
      <div className="shortcuts-modal" onClick={(e) => e.stopPropagation()}>
        <div className="shortcuts-head">
          <span>{t("sc.title")}</span>
          <button className="insp-mini" onClick={onClose} title={t("sc.close")}>✕</button>
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
