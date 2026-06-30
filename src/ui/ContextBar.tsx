// Contextual action bar rendered below the main topbar.
// Shows selection actions when elements are selected, or ink controls
// when the draw tool is active. Hidden when nothing is selected and not drawing.

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
          <span className="ctx-label">Traço</span>
          <input
            type="color"
            className="ctx-color"
            value={inkColor}
            onChange={(e) => onInkColor(e.target.value)}
            title="Cor do traço"
          />
          <input
            type="range"
            min={1}
            max={24}
            value={inkWidth}
            onChange={(e) => onInkWidth(Number(e.target.value))}
            style={{ width: 70 }}
            title={`Espessura: ${inkWidth}px`}
          />
          <span className="ctx-label">{inkWidth}px</span>
          <select
            value={inkStyle}
            onChange={(e) => onInkStyle(e.target.value as StrokeStyle)}
            className="ctx-select"
            title="Estilo do traço"
          >
            <option value="solid">Normal</option>
            <option value="dash">Tracejado</option>
            <option value="dot">Pontilhado</option>
            <option value="chalk">Giz</option>
            <option value="smudge">Esfumaçado</option>
          </select>
        </>
      )}

      {count > 0 && !drawing && (
        <>
          <button className="ctx-btn" onClick={() => duplicateElements(selection)} title="Duplicar (Ctrl+D)">
            Duplicar
          </button>
          <button className="ctx-btn" onClick={copySelection} title="Copiar (Ctrl+C)">
            Copiar
          </button>
          <button className="ctx-btn" onClick={cutSelection} title="Recortar (Ctrl+X)">
            Recortar
          </button>
          <button
            className="ctx-btn"
            onClick={pasteFromClipboard}
            disabled={clipboardSize === 0}
            title="Colar (Ctrl+V)"
          >
            Colar
          </button>

          {count === 1 && (
            <>
              <span className="ctx-sep" />
              <button className="ctx-btn ctx-icon" onClick={() => reorder(selection[0], "front")} title="Trazer para frente">⤒</button>
              <button className="ctx-btn ctx-icon" onClick={() => reorder(selection[0], "forward")} title="Avançar um nível">↑</button>
              <button className="ctx-btn ctx-icon" onClick={() => reorder(selection[0], "backward")} title="Recuar um nível">↓</button>
              <button className="ctx-btn ctx-icon" onClick={() => reorder(selection[0], "back")} title="Enviar para trás">⤓</button>
            </>
          )}

          {count >= 2 && (
            <>
              <span className="ctx-sep" />
              <button className="ctx-btn ctx-icon" onClick={() => align("left")} title="Alinhar à esquerda">⫷</button>
              <button className="ctx-btn ctx-icon" onClick={() => align("hcenter")} title="Centralizar horizontalmente">⊟</button>
              <button className="ctx-btn ctx-icon" onClick={() => align("right")} title="Alinhar à direita">⫸</button>
              <button className="ctx-btn ctx-icon" onClick={() => align("top")} title="Alinhar ao topo">⫶</button>
              <button className="ctx-btn ctx-icon" onClick={() => align("vcenter")} title="Centralizar verticalmente">⊞</button>
              <button className="ctx-btn ctx-icon" onClick={() => align("bottom")} title="Alinhar à base">⫵</button>
              {count >= 3 && (
                <>
                  <button className="ctx-btn ctx-icon" onClick={() => distribute("h")} title="Distribuir horizontalmente">↔</button>
                  <button className="ctx-btn ctx-icon" onClick={() => distribute("v")} title="Distribuir verticalmente">↕</button>
                </>
              )}
              <span className="ctx-sep" />
              <button className="ctx-btn" onClick={group} title="Agrupar (Ctrl+G)">Agrupar</button>
              <button className="ctx-btn" onClick={ungroup} title="Desagrupar (Ctrl+Shift+G)">Desagrupar</button>
            </>
          )}

          <span className="ctx-sep" />
          <button
            className="ctx-btn ctx-danger"
            onClick={() => deleteElements(selection)}
            title="Excluir (Delete)"
          >
            Excluir
          </button>
        </>
      )}
    </div>
  );
}
