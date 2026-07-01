// Left rail "Inserir" panel (Onda 7): tabbed catalog of everything that can be
// added to a slide, with search and drag-to-canvas. Click still works (inserts
// centered), matching the old "Inserir ▾" menu behavior; dragging drops the
// element at the cursor. EditorStage reads the same INSERT_MIME payload.

import { useMemo, useState } from "react";
import { useStore } from "../state/store";
import { newImage, newVideo } from "../model/deck";
import { pickImageDataUri, pickVideoDataUri } from "../lib/media";
import { INSERT_CATALOG, INSERT_MIME, type InsertItem, type InsertTab } from "../insert/catalog";

const TABS: { id: InsertTab | "photos" | "templates"; label: string }[] = [
  { id: "elements", label: "Elementos" },
  { id: "text", label: "Texto" },
  { id: "photos", label: "Fotos" },
  { id: "charts", label: "Gráficos" },
  { id: "tables", label: "Tabelas" },
  { id: "templates", label: "Templates" },
];

function IconGlyph({ item }: { item: InsertItem }) {
  if (item.iconPath) {
    return (
      <svg viewBox="0 0 24 24" width={22} height={22} fill="currentColor">
        <path d={item.iconPath} />
      </svg>
    );
  }
  return <span>{item.glyph ?? "•"}</span>;
}

function CatalogGrid({ items, onInsert }: { items: InsertItem[]; onInsert: (item: InsertItem) => void }) {
  if (items.length === 0) {
    return <p className="insert-empty">Nada encontrado.</p>;
  }
  return (
    <div className="insert-grid">
      {items.map((item) => (
        <button
          key={item.id}
          className="insert-item"
          title={item.label}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(INSERT_MIME, JSON.stringify({ kind: "catalog", id: item.id }));
            e.dataTransfer.effectAllowed = "copy";
          }}
          onClick={() => onInsert(item)}
        >
          <span className="insert-item-glyph">
            <IconGlyph item={item} />
          </span>
          <span className="insert-item-label">{item.label}</span>
        </button>
      ))}
    </div>
  );
}

function PhotosTab() {
  const deck = useStore((s) => s.deck);
  const addAsset = useStore((s) => s.addAsset);
  const addElement = useStore((s) => s.addElement);
  const assets = deck.assets ?? [];

  const upload = async (kind: "image" | "video") => {
    try {
      const src = kind === "image" ? await pickImageDataUri() : await pickVideoDataUri();
      if (src) {
        addAsset(kind, kind === "image" ? "Imagem" : "Vídeo", src);
        addElement(kind === "image" ? newImage(useStore.getState().deck, src) : newVideo(useStore.getState().deck, src));
      }
    } catch (e) {
      window.alert(`Não foi possível adicionar:\n${e}`);
    }
  };

  return (
    <div className="insert-photos">
      <div className="media-actions">
        <button className="insp-mini" onClick={() => upload("image")}>＋ Imagem</button>
        <button className="insp-mini" onClick={() => upload("video")}>＋ Vídeo</button>
      </div>
      {assets.length === 0 ? (
        <p className="insert-empty">
          Envie imagens/vídeos e arraste da biblioteca para o slide, ou clique numa miniatura para inserir.
        </p>
      ) : (
        <div className="media-grid">
          {assets.map((a) => (
            <button
              key={a.id}
              className="media-thumb"
              title={`Inserir ${a.name}`}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(
                  INSERT_MIME,
                  JSON.stringify({ kind: "asset", assetKind: a.kind, src: a.src })
                );
                e.dataTransfer.effectAllowed = "copy";
              }}
              onClick={() =>
                addElement(a.kind === "image" ? newImage(useStore.getState().deck, a.src) : newVideo(useStore.getState().deck, a.src))
              }
            >
              {a.kind === "image" ? (
                <img src={a.src} alt={a.name} draggable={false} />
              ) : (
                <video src={a.src} muted preload="metadata" />
              )}
              {a.kind === "video" && <span className="media-badge">▶</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function InsertPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("elements");
  const [query, setQuery] = useState("");
  const addElement = useStore((s) => s.addElement);

  const insert = (item: InsertItem) => {
    addElement(item.make(useStore.getState().deck));
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return INSERT_CATALOG.filter((it) => {
      if (it.tab !== tab) return false;
      if (!q) return true;
      return it.label.toLowerCase().includes(q) || it.tags.some((t) => t.includes(q));
    });
  }, [tab, query]);

  return (
    <div className="insert-panel">
      <div className="insert-head">
        <span>Inserir</span>
        <button className="insp-mini" onClick={onClose} title="Fechar">✕</button>
      </div>

      <input
        className="insert-search"
        type="text"
        placeholder="Buscar…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="insert-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={"insert-tab" + (tab === t.id ? " active" : "")}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="insert-body">
        {tab === "photos" ? (
          <PhotosTab />
        ) : tab === "templates" ? (
          <p className="insert-empty">Templates prontos chegam em breve.</p>
        ) : (
          <CatalogGrid items={filtered} onInsert={insert} />
        )}
      </div>
    </div>
  );
}
