// Contextual action bar rendered below the main topbar.
// Shows selection actions when elements are selected, or ink controls
// when the draw tool is active. Hidden when nothing is selected and not drawing.

import { t } from "../lib/i18n";
import { useStore } from "../state/store";
import type { StrokeStyle } from "../model/deck";

export function ContextBar({
  onInkColor,
  onInkWidth,
  onInkStyle,
}: {
  onInkColor: (c: string) => void;
  onInkWidth: (n: number) => void;
  onInkStyle: (s: StrokeStyle) => void;
}) {
  const selection = useStore((s) => s.selection);
  const drawing = useStore((s) => s.drawing);
  const inkMode = useStore((s) => s.inkMode);
  const setInkMode = useStore((s) => s.setInkMode);
  const inkColor = useStore((s) => s.inkColor);
  const inkWidth = useStore((s) => s.inkWidth);
  const inkStyle = useStore((s) => s.inkStyle);
  const clipboardSize = useStore((s) => s.clipboardSize);
  const copySelection = useStore((s) => s.copySelection);
  const cutSelection = useStore((s) => s.cutSelection);
  const pasteFromClipboard = useStore((s) => s.pasteFromClipboard);
  const duplicateElements = useStore((s) => s.duplicateElements);
  const deleteElements = useStore((s) => s.deleteElements);
  const reorder = useStore((s) => s.reorder);
  const align = useStore((s) => s.align);
  const distribute = useStore((s) => s.distribute);
  const group = useStore((s) => s.group);
  const ungroup = useStore((s) => s.ungroup);

  const count = selection.length;

  if (!drawing && count === 0) return null;

  return (
    <div className="context-bar">
      {drawing && (
        <>
          <button
            className={"ctx-btn ctx-icon" + (inkMode === "pen" ? " active" : "")}
            onClick={() => setInkMode("pen")}
            title={t("ctxbar.pen")}
          >
            ✏
          </button>
          <button
            className={"ctx-btn ctx-icon" + (inkMode === "eraser" ? " active" : "")}
            onClick={() => setInkMode("eraser")}
            title={t("ctxbar.eraser")}
          >
            🧽
          </button>
          <span className="ctx-sep" />
          {inkMode === "pen" ? (
            <>
              <span className="ctx-label">{t("ctxbar.stroke")}</span>
              <input
                type="color"
                className="ctx-color"
                value={inkColor}
                onChange={(e) => onInkColor(e.target.value)}
                title={t("ctxbar.strokeColor")}
              />
              <input
                type="range"
                min={1}
                max={24}
                value={inkWidth}
                onChange={(e) => onInkWidth(Number(e.target.value))}
                style={{ width: 70 }}
                title={t("ctxbar.thickness", { n: inkWidth })}
              />
              <span className="ctx-label">{inkWidth}px</span>
              <select
                value={inkStyle}
                onChange={(e) => onInkStyle(e.target.value as StrokeStyle)}
                className="ctx-select"
                title={t("ctxbar.strokeStyle")}
              >
                <option value="solid">{t("ctxbar.styleSolid")}</option>
                <option value="dash">{t("ctxbar.styleDash")}</option>
                <option value="dot">{t("ctxbar.styleDot")}</option>
                <option value="chalk">{t("ctxbar.styleChalk")}</option>
                <option value="smudge">{t("ctxbar.styleSmudge")}</option>
              </select>
            </>
          ) : (
            <span className="ctx-label">{t("ctxbar.eraseHint")}</span>
          )}
        </>
      )}

      {count > 0 && !drawing && (
        <>
          <button className="ctx-btn" onClick={() => duplicateElements(selection)} title={t("ctxbar.duplicateTitle")}>
            {t("ctxbar.duplicate")}
          </button>
          <button className="ctx-btn" onClick={copySelection} title={t("ctxbar.copyTitle")}>
            {t("ctxbar.copy")}
          </button>
          <button className="ctx-btn" onClick={cutSelection} title={t("ctxbar.cutTitle")}>
            {t("ctxbar.cut")}
          </button>
          <button
            className="ctx-btn"
            onClick={pasteFromClipboard}
            disabled={clipboardSize === 0}
            title={t("ctxbar.pasteTitle")}
          >
            {t("ctxbar.paste")}
          </button>

          {count === 1 && (
            <>
              <span className="ctx-sep" />
              <button className="ctx-btn ctx-icon" onClick={() => reorder(selection[0], "front")} title={t("ctxbar.bringFront")}>⤒</button>
              <button className="ctx-btn ctx-icon" onClick={() => reorder(selection[0], "forward")} title={t("ctxbar.forward")}>↑</button>
              <button className="ctx-btn ctx-icon" onClick={() => reorder(selection[0], "backward")} title={t("ctxbar.backward")}>↓</button>
              <button className="ctx-btn ctx-icon" onClick={() => reorder(selection[0], "back")} title={t("ctxbar.sendBack")}>⤓</button>
            </>
          )}

          {count >= 2 && (
            <>
              <span className="ctx-sep" />
              <button className="ctx-btn ctx-icon" onClick={() => align("left")} title={t("ctxbar.alignLeft")}>⫷</button>
              <button className="ctx-btn ctx-icon" onClick={() => align("hcenter")} title={t("ctxbar.alignHCenter")}>⊟</button>
              <button className="ctx-btn ctx-icon" onClick={() => align("right")} title={t("ctxbar.alignRight")}>⫸</button>
              <button className="ctx-btn ctx-icon" onClick={() => align("top")} title={t("ctxbar.alignTop")}>⫶</button>
              <button className="ctx-btn ctx-icon" onClick={() => align("vcenter")} title={t("ctxbar.alignVCenter")}>⊞</button>
              <button className="ctx-btn ctx-icon" onClick={() => align("bottom")} title={t("ctxbar.alignBottom")}>⫵</button>
              {count >= 3 && (
                <>
                  <button className="ctx-btn ctx-icon" onClick={() => distribute("h")} title={t("ctxbar.distributeH")}>↔</button>
                  <button className="ctx-btn ctx-icon" onClick={() => distribute("v")} title={t("ctxbar.distributeV")}>↕</button>
                </>
              )}
              <span className="ctx-sep" />
              <button className="ctx-btn" onClick={group} title={t("ctxbar.groupTitle")}>{t("ctxbar.group")}</button>
              <button className="ctx-btn" onClick={ungroup} title={t("ctxbar.ungroupTitle")}>{t("ctxbar.ungroup")}</button>
            </>
          )}

          <span className="ctx-sep" />
          <button
            className="ctx-btn ctx-danger"
            onClick={() => deleteElements(selection)}
            title={t("ctxbar.deleteTitle")}
          >
            {t("ctxbar.delete")}
          </button>
        </>
      )}
    </div>
  );
}
