// Layers panel: the current slide's elements as a stacking list (top of the list
// = front-most). Lets you select any element even when overlapped or hidden,
// reorder z, toggle visibility, and lock — which solves "can't click the thing
// behind the drawing" and "the ink selection box is in the way".

import { useStore } from "../state/store";
import { findSlide, pmToPlainText, type Element } from "../model/deck";

function labelFor(el: Element): string {
  switch (el.type) {
    case "text": {
      const t = pmToPlainText(el.content).trim().replace(/\s+/g, " ");
      return t ? (t.length > 22 ? t.slice(0, 22) + "…" : t) : "Texto";
    }
    case "image":
      return "Imagem";
    case "video":
      return "Vídeo";
    case "table":
      return "Tabela";
    case "ink":
      return "Desenho";
    case "chart":
      return "Gráfico";
    default:
      return "Forma";
  }
}

function iconFor(el: Element): string {
  return el.type === "text"
    ? "T"
    : el.type === "image"
    ? "🖼"
    : el.type === "video"
    ? "▶"
    : el.type === "table"
    ? "▦"
    : el.type === "ink"
    ? "✎"
    : el.type === "chart"
    ? "📊"
    : "◆";
}

export function LayersPanel({ onClose }: { onClose: () => void }) {
  const deck = useStore((s) => s.deck);
  const currentSlideId = useStore((s) => s.currentSlideId);
  const selection = useStore((s) => s.selection);
  const select = useStore((s) => s.select);
  const reorder = useStore((s) => s.reorder);
  const updateElement = useStore((s) => s.updateElement);
  const deleteElements = useStore((s) => s.deleteElements);

  const slide = findSlide(deck, currentSlideId);
  // Top of the list = front-most (last in the elements array).
  const rows = slide ? [...slide.elements].reverse() : [];

  return (
    <div className="layers-panel">
      <div className="media-head">
        <span>Camadas</span>
        <button className="insp-mini" onClick={onClose} title="Fechar">✕</button>
      </div>

      {rows.length === 0 ? (
        <p className="media-empty">Nada neste slide ainda.</p>
      ) : (
        <div className="layers-list">
          {rows.map((el, i) => {
            const sel = selection.includes(el.id);
            return (
              <div key={el.id} className={"layer-row" + (sel ? " active" : "")}>
                <button
                  className="layer-eye"
                  title={el.hidden ? "Mostrar" : "Ocultar"}
                  onClick={() => updateElement(el.id, (x) => (x.hidden = !x.hidden))}
                >
                  {el.hidden ? "🚫" : "👁"}
                </button>
                <button
                  className="layer-lock"
                  title={el.locked ? "Desbloquear" : "Bloquear"}
                  onClick={() => updateElement(el.id, (x) => (x.locked = !x.locked))}
                >
                  {el.locked ? "🔒" : "🔓"}
                </button>
                <button className="layer-name" onClick={() => select([el.id])} title="Selecionar">
                  <span className="layer-icon">{iconFor(el)}</span>
                  <span className="layer-text">{labelFor(el)}</span>
                </button>
                <button
                  className="layer-z"
                  title="Trazer para frente"
                  disabled={i === 0}
                  onClick={() => reorder(el.id, "forward")}
                >
                  ↑
                </button>
                <button
                  className="layer-z"
                  title="Enviar para trás"
                  disabled={i === rows.length - 1}
                  onClick={() => reorder(el.id, "backward")}
                >
                  ↓
                </button>
                <button className="layer-del" title="Excluir" onClick={() => deleteElements([el.id])}>
                  🗑
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
