// Deck media library: upload images/videos once, then click to drop them onto
// the current slide as many times as needed. Assets live on the deck (deck.assets)
// and are externalized/deduped in the .tslides zip, so reuse costs no extra bytes.

import { useStore } from "../state/store";
import { newImage, newVideo } from "../model/deck";
import { pickImageDataUri, pickVideoDataUri } from "../lib/media";

export function MediaPanel({ onClose }: { onClose: () => void }) {
  const deck = useStore((s) => s.deck);
  const addAsset = useStore((s) => s.addAsset);
  const removeAsset = useStore((s) => s.removeAsset);
  const addElement = useStore((s) => s.addElement);
  const assets = deck.assets ?? [];

  const upload = async (kind: "image" | "video") => {
    try {
      const src = kind === "image" ? await pickImageDataUri() : await pickVideoDataUri();
      if (src) addAsset(kind, kind === "image" ? "Imagem" : "Vídeo", src);
    } catch (e) {
      window.alert(`Não foi possível adicionar:\n${e}`);
    }
  };

  const insert = (kind: "image" | "video", src: string) => {
    const d = useStore.getState().deck;
    addElement(kind === "image" ? newImage(d, src) : newVideo(d, src));
  };

  return (
    <div className="media-panel">
      <div className="media-head">
        <span>Mídia</span>
        <button className="insp-mini" onClick={onClose} title="Fechar">✕</button>
      </div>

      <div className="media-actions">
        <button className="insp-mini" onClick={() => upload("image")}>＋ Imagem</button>
        <button className="insp-mini" onClick={() => upload("video")}>＋ Vídeo</button>
      </div>

      {assets.length === 0 ? (
        <p className="media-empty">
          Envie imagens/vídeos uma vez e reutilize em qualquer slide. Clique numa miniatura para inserir.
        </p>
      ) : (
        <div className="media-grid">
          {assets.map((a) => (
            <div key={a.id} className="media-item" title={`Inserir ${a.name}`}>
              <button className="media-thumb" onClick={() => insert(a.kind, a.src)}>
                {a.kind === "image" ? (
                  <img src={a.src} alt={a.name} draggable={false} />
                ) : (
                  <video src={a.src} muted preload="metadata" />
                )}
                {a.kind === "video" && <span className="media-badge">▶</span>}
              </button>
              <button
                className="media-del"
                title="Remover da biblioteca"
                onClick={() => removeAsset(a.id)}
              >
                🗑
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
