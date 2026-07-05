// Left rail "Inserir" panel (Onda 7): tabbed catalog of everything that can be
// added to a slide, with search and drag-to-canvas. Click still works (inserts
// centered), matching the old "Inserir ▾" menu behavior; dragging drops the
// element at the cursor. EditorStage reads the same INSERT_MIME payload.

import { useEffect, useMemo, useState } from "react";
import { useStore } from "../state/store";
import { newIcon, newImage, newVideo } from "../model/deck";
import { pickImageDataUri, pickVideoDataUri } from "../lib/media";
import { INSERT_CATALOG, INSERT_MIME, type InsertItem, type InsertTab } from "../insert/catalog";
import { ICONS, type IconDef } from "../model/icons";
import { TEMPLATES } from "../templates";
import { DECK_TEMPLATES, buildDeckTemplate, themeForDeckTemplate } from "../templates/decks";
import { SlideView } from "../render/SlideView";

const TEMPLATE_THUMB_W = 220;

const TABS: { id: InsertTab | "photos" | "templates"; label: string }[] = [
  { id: "elements", label: "Elementos" },
  { id: "text", label: "Texto" },
  { id: "icons", label: "Ícones" },
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

// Cache de módulo: o pack (7k+ ícones, chunk lazy) só é importado uma vez por
// sessão, na primeira abertura da aba Ícones.
let packCache: IconDef[] | null = null;

const ICONS_GRID_MAX = 240;

function IconsTab({ query }: { query: string }) {
  const addElement = useStore((s) => s.addElement);
  const [pack, setPack] = useState<IconDef[] | null>(packCache);

  useEffect(() => {
    if (packCache) return;
    let alive = true;
    import("../model/iconsPack").then(
      (m) => {
        packCache = m.ICONS_PACK;
        if (alive) setPack(packCache);
      },
      () => {
        /* pack indisponível — a aba segue só com os ícones core */
      }
    );
    return () => {
      alive = false;
    };
  }, []);

  const all = useMemo(() => (pack ? [...ICONS, ...pack] : ICONS), [pack]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (ic) =>
        ic.name.includes(q) ||
        ic.label.toLowerCase().includes(q) ||
        (ic.category ?? "").includes(q) ||
        (ic.tags ?? []).some((t) => t.includes(q))
    );
  }, [all, query]);

  const shown = filtered.length > ICONS_GRID_MAX ? filtered.slice(0, ICONS_GRID_MAX) : filtered;

  return (
    <div>
      <div className="insert-grid">
        {shown.map((ic) => (
          <button
            key={ic.name}
            className="insert-item"
            title={ic.label}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(INSERT_MIME, JSON.stringify({ kind: "iconPath", path: ic.path }));
              e.dataTransfer.effectAllowed = "copy";
            }}
            onClick={() => addElement(newIcon(useStore.getState().deck, ic.path))}
          >
            <span className="insert-item-glyph">
              <svg viewBox="0 0 24 24" width={22} height={22} fill="currentColor">
                <path d={ic.path} />
              </svg>
            </span>
            <span className="insert-item-label">{ic.label}</span>
          </button>
        ))}
      </div>
      {!pack && <p className="insert-empty">Carregando pack completo de ícones…</p>}
      {filtered.length > ICONS_GRID_MAX && (
        <p className="insert-empty">
          Mostrando {ICONS_GRID_MAX} de {filtered.length} ícones — refine a busca.
        </p>
      )}
      {filtered.length === 0 && <p className="insert-empty">Nada encontrado.</p>}
    </div>
  );
}

const TEMPLATE_CATEGORIES = ["Capa", "Conteúdo", "Dados", "Encerramento"] as const;

function TemplateThumb({
  elements,
  background,
  deck,
}: {
  elements: React.ComponentProps<typeof SlideView>["slide"]["elements"];
  background?: React.ComponentProps<typeof SlideView>["slide"]["background"];
  deck: ReturnType<typeof useStore.getState>["deck"];
}) {
  const scale = TEMPLATE_THUMB_W / deck.size.w;
  return (
    <div className="template-thumb" style={{ width: TEMPLATE_THUMB_W, height: deck.size.h * scale }}>
      <div
        style={{
          width: deck.size.w,
          height: deck.size.h,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          pointerEvents: "none",
        }}
      >
        <SlideView slide={{ id: "tpl-preview", elements, background }} deck={deck} />
      </div>
    </div>
  );
}

function TemplatesTab() {
  const deck = useStore((s) => s.deck);
  const addTemplateSlide = useStore((s) => s.addTemplateSlide);
  const newDeckFromTemplate = useStore((s) => s.newDeckFromTemplate);

  const startDeck = (id: string, name: string) => {
    const { dirty } = useStore.getState();
    if (
      dirty &&
      !window.confirm(`Criar a apresentação "${name}"?\nA apresentação atual será substituída (alterações não salvas serão perdidas).`)
    ) {
      return;
    }
    newDeckFromTemplate(id);
  };

  return (
    <div className="insert-templates">
      <div className="template-section">Apresentações completas</div>
      {DECK_TEMPLATES.map((dt) => {
        const theme = themeForDeckTemplate(dt) ?? deck.theme;
        const previewDeck = { ...deck, theme };
        const first = buildDeckTemplate(dt, previewDeck)[0];
        return (
          <button
            key={dt.id}
            className="template-item"
            title={dt.description}
            onClick={() => startDeck(dt.id, dt.name)}
          >
            {first && <TemplateThumb elements={first.elements} background={first.background} deck={previewDeck} />}
            <span className="template-label">
              {dt.name} · {dt.slides.length} slides
            </span>
          </button>
        );
      })}

      {TEMPLATE_CATEGORIES.map((cat) => {
        const tpls = TEMPLATES.filter((t) => t.category === cat);
        if (!tpls.length) return null;
        return (
          <div key={cat} className="template-group">
            <div className="template-section">{cat}</div>
            {tpls.map((tpl) => {
              const { elements, background } = tpl.build(deck);
              return (
                <button
                  key={tpl.id}
                  className="template-item"
                  title={`Inserir slide "${tpl.name}"`}
                  onClick={() => addTemplateSlide(tpl.id)}
                >
                  <TemplateThumb elements={elements} background={background} deck={deck} />
                  <span className="template-label">{tpl.name}</span>
                </button>
              );
            })}
          </div>
        );
      })}
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
          <TemplatesTab />
        ) : tab === "icons" ? (
          <IconsTab query={query} />
        ) : (
          <CatalogGrid items={filtered} onInsert={insert} />
        )}
      </div>
    </div>
  );
}
