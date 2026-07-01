import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ask } from "@tauri-apps/plugin-dialog";
import { useStore } from "./state/store";
import { EditorStage } from "./editor/EditorStage";
import { SlidesPanel } from "./panels/SlidesPanel";
import { Inspector } from "./panels/Inspector";
import { PresentMode } from "./present/PresentMode";
import { newChart, newFreeTextBox, newIcon, newImage, newShape, newTable, newVideo, type ChartKind, type ShapeKind } from "./model/deck";
import { ICONS } from "./model/icons";
import { pickImageDataUri, pickVideoDataUri, imageDataUrlFromPath } from "./lib/media";
import {
  DeckFile,
  baseName,
  openDeck,
  openDeckPath,
  saveDeckAs,
  saveDeckTo,
} from "./lib/deck-io";
import { applyTheme, loadSettings, saveSettings, addRecent, type Settings } from "./lib/settings";
import { useLocalAi } from "./ai/useLocalAi";
import { AiPanel } from "./ai/AiPanel";
import { MediaPanel } from "./panels/MediaPanel";
import { LayersPanel } from "./panels/LayersPanel";
import { inTauri } from "./lib/env";
import { PrintView } from "./export/PrintView";
import { exportSlidePng } from "./export/png";
import { exportDeckPptx } from "./export/pptx";
import { importPptx } from "./lib/pptx-io";
import { saveRecovery, loadRecovery, clearRecovery } from "./lib/recovery";
import { findSlide } from "./model/deck";
import { Menu, type MenuItemDef } from "./ui/Menu";
import { ContextBar } from "./ui/ContextBar";
import "./App.css";

const SHAPE_PICKER: { kind: ShapeKind; label: string; glyph: string }[] = [
  { kind: "rect", label: "Retângulo", glyph: "▭" },
  { kind: "roundRect", label: "Arredondado", glyph: "▢" },
  { kind: "ellipse", label: "Elipse", glyph: "◯" },
  { kind: "triangle", label: "Triângulo", glyph: "△" },
  { kind: "diamond", label: "Losango", glyph: "◇" },
  { kind: "pentagon", label: "Pentágono", glyph: "⬠" },
  { kind: "hexagon", label: "Hexágono", glyph: "⬡" },
  { kind: "star", label: "Estrela", glyph: "☆" },
  { kind: "arrow", label: "Seta", glyph: "➜" },
  { kind: "doubleArrow", label: "Seta dupla", glyph: "↔" },
  { kind: "chevron", label: "Chevron", glyph: "❯" },
  { kind: "line", label: "Linha", glyph: "—" },
  { kind: "speech", label: "Balão de fala", glyph: "💬" },
  { kind: "thought", label: "Balão de pensamento", glyph: "💭" },
];

function App() {
  const deck = useStore((s) => s.deck);
  const filePath = useStore((s) => s.filePath);
  const dirty = useStore((s) => s.dirty);
  const zoom = useStore((s) => s.zoom);
  const setZoom = useStore((s) => s.setZoom);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const loadDeck = useStore((s) => s.loadDeck);
  const resetDeck = useStore((s) => s.resetDeck);
  const markSaved = useStore((s) => s.markSaved);
  const addSlide = useStore((s) => s.addSlide);
  const addElement = useStore((s) => s.addElement);
  const addAsset = useStore((s) => s.addAsset);
  const group = useStore((s) => s.group);
  const ungroup = useStore((s) => s.ungroup);
  const drawing = useStore((s) => s.drawing);
  const setDrawing = useStore((s) => s.setDrawing);
  const setInkColor = useStore((s) => s.setInkColor);
  const setInkWidth = useStore((s) => s.setInkWidth);
  const setInkStyle = useStore((s) => s.setInkStyle);
  const commenting = useStore((s) => s.commenting);
  const setCommenting = useStore((s) => s.setCommenting);
  const copySelection = useStore((s) => s.copySelection);
  const cutSelection = useStore((s) => s.cutSelection);
  const pasteFromClipboard = useStore((s) => s.pasteFromClipboard);
  const duplicateElements = useStore((s) => s.duplicateElements);

  const [busy, setBusy] = useState<string>("");
  const [presenting, setPresenting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [showMedia, setShowMedia] = useState(false);
  const [showLayers, setShowLayers] = useState(false);
  const [rightWidth, setRightWidth] = useState(300);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  const [settings] = useState<Settings>(() => loadSettings());
  const ai = useLocalAi(settings, (patch) => saveSettings(patch));

  useEffect(() => {
    applyTheme(loadSettings().theme);
  }, []);

  // ---- Right panel resize (drag the handle on its left edge) ----
  const rightResizing = useRef(false);
  const startRightResize = useCallback((e: React.PointerEvent) => {
    rightResizing.current = true;
    e.preventDefault();
  }, []);
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!rightResizing.current) return;
      setRightWidth(Math.min(560, Math.max(220, window.innerWidth - e.clientX)));
    };
    const onUp = () => {
      rightResizing.current = false;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  const remember = (path: string) => addRecent(path);

  // ---- File operations ----
  const applyOpened = useCallback(
    (f: DeckFile) => {
      loadDeck(f.deck, f.path);
      remember(f.path);
      clearRecovery();
    },
    [loadDeck]
  );

  const handleNew = useCallback(() => {
    if (dirty && !window.confirm("Há alterações não salvas. Criar uma nova apresentação mesmo assim?"))
      return;
    resetDeck();
  }, [dirty, resetDeck]);

  const handleOpen = useCallback(async () => {
    if (!inTauri()) return;
    try {
      const f = await openDeck();
      if (f) applyOpened(f);
    } catch (e) {
      window.alert(`Não foi possível abrir:\n${e}`);
    }
  }, [applyOpened]);

  const handleSaveAs = useCallback(async () => {
    if (!inTauri()) return;
    const suggested = filePath ? baseName(filePath) : "apresentacao.tslides";
    try {
      setBusy("Salvando…");
      const path = await saveDeckAs(useStore.getState().deck, suggested);
      if (path) {
        markSaved(path);
        remember(path);
        clearRecovery();
      }
    } catch (e) {
      window.alert(`Não foi possível salvar:\n${e}`);
    } finally {
      setBusy("");
    }
  }, [filePath, markSaved]);

  const handleSave = useCallback(async () => {
    if (!inTauri()) return;
    const path = useStore.getState().filePath;
    if (!path) return handleSaveAs();
    try {
      setBusy("Salvando…");
      await saveDeckTo(path, useStore.getState().deck);
      markSaved(path);
      remember(path);
      clearRecovery();
    } catch (e) {
      window.alert(`Não foi possível salvar:\n${e}`);
    } finally {
      setBusy("");
    }
  }, [handleSaveAs, markSaved]);

  // ---- Insert elements ----
  const insertText = useCallback(() => {
    addElement(newFreeTextBox(useStore.getState().deck));
  }, [addElement]);

  const insertShape = useCallback(
    (kind: ShapeKind = "rect") => {
      addElement(newShape(useStore.getState().deck, kind));
    },
    [addElement]
  );

  const insertTable = useCallback(() => {
    addElement(newTable(useStore.getState().deck, 3, 3));
  }, [addElement]);

  const insertChart = useCallback(
    (kind: ChartKind = "bar") => {
      addElement(newChart(useStore.getState().deck, kind));
    },
    [addElement]
  );

  const insertIcon = useCallback(
    (path: string) => {
      addElement(newIcon(useStore.getState().deck, path));
    },
    [addElement]
  );

  const insertImage = useCallback(async () => {
    if (!inTauri()) return;
    try {
      const src = await pickImageDataUri();
      if (src) {
        addAsset("image", "Imagem", src); // also keep it in the reusable library
        addElement(newImage(useStore.getState().deck, src));
      }
    } catch (e) {
      window.alert(`Não foi possível inserir a imagem:\n${e}`);
    }
  }, [addElement, addAsset]);

  const insertVideo = useCallback(async () => {
    if (!inTauri()) return;
    try {
      const src = await pickVideoDataUri();
      if (src) {
        addAsset("video", "Vídeo", src);
        addElement(newVideo(useStore.getState().deck, src));
      }
    } catch (e) {
      window.alert(`Não foi possível inserir o vídeo:\n${e}`);
    }
  }, [addElement, addAsset]);

  // ---- Export ----
  const handleExportPdf = useCallback(() => {
    setPrinting(true);
  }, []);

  // When the print view mounts, give it a couple frames to paint, then print.
  useEffect(() => {
    if (!printing) return;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setPrinting(false);
    };
    window.addEventListener("afterprint", finish);
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        window.print();
        // Fallback in case afterprint never fires (some webviews).
        setTimeout(finish, 1000);
      })
    );
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("afterprint", finish);
    };
  }, [printing]);

  const handleExportPng = useCallback(async () => {
    const st = useStore.getState();
    const slide = findSlide(st.deck, st.currentSlideId);
    if (!slide) return;
    const idx = st.deck.slides.findIndex((s) => s.id === slide.id);
    try {
      setBusy("Exportando PNG…");
      await exportSlidePng(slide, st.deck, idx);
    } catch (e) {
      window.alert(`Não foi possível exportar PNG:\n${e}`);
    } finally {
      setBusy("");
    }
  }, []);

  const handleImportPptx = useCallback(async () => {
    if (dirty && !window.confirm("Há alterações não salvas. Importar um PPTX mesmo assim?")) return;
    try {
      setBusy("Importando PPTX…");
      const res = await importPptx();
      if (res) loadDeck(res.deck, null);
    } catch (e) {
      window.alert(`Não foi possível importar o PPTX:\n${e}`);
    } finally {
      setBusy("");
    }
  }, [dirty, loadDeck]);

  const handleExportPptx = useCallback(async () => {
    try {
      setBusy("Exportando PPTX…");
      await exportDeckPptx(useStore.getState().deck);
    } catch (e) {
      window.alert(`Não foi possível exportar PPTX:\n${e}`);
    } finally {
      setBusy("");
    }
  }, []);

  // ---- Debounced autosave (only for decks already on disk) ----
  const autosaveTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!inTauri()) return;
    const st = useStore.getState();
    if (!st.filePath || !st.dirty) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(async () => {
      const s = useStore.getState();
      if (!s.filePath || !s.dirty) return;
      try {
        await saveDeckTo(s.filePath, s.deck);
        s.markSaved(s.filePath);
      } catch {
        /* keep dirty; the user can still save manually */
      }
    }, 2000);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [deck, dirty, filePath]);

  // ---- Recovery snapshot for never-saved decks (light, debounced) ----
  // On-disk decks autosave to their file above; this is the safety net for a
  // brand-new deck that has no path yet, so an unexpected close loses nothing.
  useEffect(() => {
    if (filePath || !dirty) return;
    const id = window.setTimeout(() => {
      const st = useStore.getState();
      if (!st.filePath && st.dirty) saveRecovery(st.deck);
    }, 4000);
    return () => clearTimeout(id);
  }, [deck, dirty, filePath]);

  // Offer to restore an unsaved deck from a previous session (once, on launch).
  const recoveryChecked = useRef(false);
  useEffect(() => {
    if (recoveryChecked.current) return;
    recoveryChecked.current = true;
    const rec = loadRecovery();
    if (!rec) return;
    // Wait a beat so a file opened at startup wins over the recovery prompt.
    const t = window.setTimeout(() => {
      const st = useStore.getState();
      if (st.filePath || st.dirty) return;
      const when = new Date(rec.savedAt).toLocaleString();
      if (window.confirm(`Restaurar a apresentação não salva da sessão anterior?\n(salva em ${when})`)) {
        loadDeck(rec.deck, null);
      } else {
        clearRecovery();
      }
    }, 700);
    return () => clearTimeout(t);
  }, [loadDeck]);

  // ---- Window close confirmation (Rust intercepts → emits close-requested) ----
  useEffect(() => {
    if (!inTauri()) return;
    const un = listen("close-requested", async () => {
      if (useStore.getState().dirty) {
        const ok = await ask("Há alterações não salvas.\nSair mesmo assim?", {
          title: "Sair do LocalSlides",
          kind: "warning",
        }).catch(() => true);
        if (!ok) return;
      }
      invoke("exit_app").catch(() => {});
    });
    return () => {
      un.then((f) => f());
    };
  }, []);

  // ---- Open a file passed at launch / forwarded by a 2nd instance ----
  const openedStartup = useRef(false);
  useEffect(() => {
    if (!inTauri() || openedStartup.current) return;
    openedStartup.current = true;
    invoke<string | null>("get_startup_file")
      .then((p) => {
        if (p) openDeckPath(p).then(applyOpened).catch(() => {});
      })
      .catch(() => {});
    const un = listen<string>("open-file", (e) => {
      if (e.payload) openDeckPath(e.payload).then(applyOpened).catch(() => {});
    });
    return () => {
      un.then((f) => f());
    };
  }, [applyOpened]);

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      const t = e.target as HTMLElement | null;
      // When typing in a text field/editor, let the field handle editing shortcuts.
      const inField =
        !!t && (t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA");
      if (inField && (k === "a" || k === "z" || k === "y" || k === "c" || k === "x" || k === "v")) return;

      if (k === "a") {
        e.preventDefault();
        const st = useStore.getState();
        const slide = findSlide(st.deck, st.currentSlideId);
        if (slide) st.select(slide.elements.filter((el) => !el.hidden && !el.locked).map((el) => el.id));
      } else if (k === "c") {
        e.preventDefault();
        if (e.shiftKey) useStore.getState().copyStyle();
        else useStore.getState().copySelection();
      } else if (k === "x") {
        e.preventDefault();
        useStore.getState().cutSelection();
      } else if (k === "v") {
        e.preventDefault();
        if (e.shiftKey) useStore.getState().pasteStyle();
        else useStore.getState().pasteFromClipboard();
      } else if (k === "d") {
        e.preventDefault();
        const { selection } = useStore.getState();
        if (selection.length) useStore.getState().duplicateElements(selection);
      } else if (k === "s") {
        e.preventDefault();
        e.shiftKey ? handleSaveAs() : handleSave();
      } else if (k === "o") {
        e.preventDefault();
        handleOpen();
      } else if (k === "n") {
        e.preventDefault();
        handleNew();
      } else if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((k === "z" && e.shiftKey) || k === "y") {
        e.preventDefault();
        redo();
      } else if (k === "m") {
        e.preventDefault();
        addSlide();
      } else if (k === "g") {
        e.preventDefault();
        e.shiftKey ? ungroup() : group();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSave, handleSaveAs, handleOpen, handleNew, undo, redo, addSlide, group, ungroup,
      copySelection, cutSelection, pasteFromClipboard, duplicateElements]);

  // ---- OS drag-and-drop of image files onto the canvas ----
  const dropImageAt = useCallback(
    (src: string, clientX?: number, clientY?: number) => {
      const st = useStore.getState();
      const deckNow = st.deck;
      const scaled = document.querySelector(".slide-scaled") as HTMLElement | null;
      let lx: number | undefined;
      let ly: number | undefined;
      if (scaled && clientX != null && clientY != null) {
        const rect = scaled.getBoundingClientRect();
        const s = rect.width / deckNow.size.w;
        lx = (clientX - rect.left) / s;
        ly = (clientY - rect.top) / s;
        // Dropped onto a shape? Fill that shape with the image (Canva-style).
        const slide = findSlide(deckNow, st.currentSlideId);
        const shape = slide?.elements
          .slice()
          .reverse()
          .find(
            (e) =>
              e.type === "shape" &&
              lx! >= e.geom.x &&
              lx! <= e.geom.x + e.geom.w &&
              ly! >= e.geom.y &&
              ly! <= e.geom.y + e.geom.h
          );
        if (shape) {
          addAsset("image", "Imagem", src);
          st.updateElement(shape.id, (x) => {
            if (x.type === "shape") x.fill = { kind: "image", src, fit: "cover" };
          });
          st.select([shape.id]);
          return;
        }
      }
      addAsset("image", "Imagem", src); // dropped images join the library too
      const img = newImage(deckNow, src);
      if (lx != null && ly != null) {
        img.geom.x = Math.round(lx - img.geom.w / 2);
        img.geom.y = Math.round(ly - img.geom.h / 2);
      }
      addElement(img);
    },
    [addElement, addAsset]
  );

  // Browser fallback (works in the dev preview).
  useEffect(() => {
    if (inTauri()) return;
    const onDrop = (e: DragEvent) => {
      if (!e.dataTransfer?.files?.length) return;
      e.preventDefault();
      [...e.dataTransfer.files]
        .filter((f) => f.type.startsWith("image/"))
        .forEach((f) => {
          const reader = new FileReader();
          reader.onload = () => dropImageAt(String(reader.result), e.clientX, e.clientY);
          reader.readAsDataURL(f);
        });
    };
    const onDragOver = (e: DragEvent) => e.preventDefault();
    window.addEventListener("drop", onDrop);
    window.addEventListener("dragover", onDragOver);
    return () => {
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("dragover", onDragOver);
    };
  }, [dropImageAt]);

  // Tauri native file-drop (gives file paths + a window position).
  useEffect(() => {
    if (!inTauri()) return;
    let un: (() => void) | undefined;
    (async () => {
      const { getCurrentWebview } = await import("@tauri-apps/api/webview");
      un = await getCurrentWebview().onDragDropEvent(async (event) => {
        if (event.payload.type !== "drop") return;
        const pos = event.payload.position;
        for (const path of event.payload.paths) {
          try {
            const src = await imageDataUrlFromPath(path);
            if (src) dropImageAt(src, pos?.x, pos?.y);
          } catch {
            /* skip non-image / unreadable files */
          }
        }
      });
    })();
    return () => un?.();
  }, [dropImageAt]);

  // F5 starts the presentation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F5") {
        e.preventDefault();
        setPresenting(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const title = (filePath ? baseName(filePath) : "Sem título") + (dirty ? " •" : "");
  const zoomPct = zoom > 0 ? Math.round(zoom * 100) : 0;

  const arquivoItems: MenuItemDef[] = [
    { kind: "item", label: "Nova apresentação", shortcut: "Ctrl+N", onClick: handleNew },
    { kind: "item", label: "Abrir…", shortcut: "Ctrl+O", onClick: handleOpen },
    { kind: "sep" },
    { kind: "item", label: "Salvar", shortcut: "Ctrl+S", onClick: handleSave },
    { kind: "item", label: "Salvar como…", shortcut: "Ctrl+Shift+S", onClick: handleSaveAs },
    { kind: "sep" },
    { kind: "item", label: "Importar PPTX…", onClick: handleImportPptx },
    { kind: "sep" },
    {
      kind: "sub",
      label: "Exportar",
      items: [
        { kind: "item", label: "PDF (todos os slides)", onClick: handleExportPdf },
        { kind: "item", label: "PNG (slide atual)", onClick: handleExportPng },
        { kind: "item", label: "PPTX (PowerPoint)", onClick: handleExportPptx },
      ],
    },
  ];

  const inserirItems: MenuItemDef[] = [
    { kind: "item", label: "Caixa de texto", icon: "T", onClick: insertText },
    { kind: "item", label: "Imagem…", icon: "🖼", onClick: insertImage },
    { kind: "item", label: "Vídeo…", icon: "▶", onClick: insertVideo },
    { kind: "sep" },
    {
      kind: "sub",
      label: "Forma",
      icon: "◻",
      items: SHAPE_PICKER.map((s) => ({
        kind: "item" as const,
        label: s.label,
        icon: s.glyph,
        onClick: () => insertShape(s.kind),
      })),
    },
    { kind: "item", label: "Tabela", icon: "⊞", onClick: insertTable },
    {
      kind: "sub",
      label: "Gráfico",
      icon: "📊",
      items: [
        { kind: "item", label: "Barras", icon: "📊", onClick: () => insertChart("bar") },
        { kind: "item", label: "Linhas", icon: "📈", onClick: () => insertChart("line") },
        { kind: "item", label: "Pizza", icon: "🥧", onClick: () => insertChart("pie") },
      ],
    },
    {
      kind: "sub",
      label: "Ícone",
      icon: "★",
      items: ICONS.map((ic) => ({
        kind: "item" as const,
        label: ic.label,
        onClick: () => insertIcon(ic.path),
      })),
    },
  ];

  const togglePanel = (which: "layers" | "media" | "ai") => {
    const wasLayers = showLayers, wasMedia = showMedia, wasAi = showAi;
    setShowLayers(which === "layers" ? !wasLayers : false);
    setShowMedia(which === "media" ? !wasMedia : false);
    setShowAi(which === "ai" ? !wasAi : false);
    setRightCollapsed(false);
  };

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">LocalSlides</div>
        <div className="toolbar">
          {/* Arquivo */}
          <Menu trigger="Arquivo ▾" items={arquivoItems} />

          <span className="sep" />

          {/* Histórico */}
          <button onClick={undo} disabled={!canUndo} title="Desfazer (Ctrl+Z)" className="tb-icon">↶</button>
          <button onClick={redo} disabled={!canRedo} title="Refazer (Ctrl+Y)" className="tb-icon">↷</button>

          <span className="sep" />

          {/* Novo slide */}
          <button onClick={() => addSlide()} title="Novo slide (Ctrl+M)">＋ Slide</button>

          <span className="sep" />

          {/* Inserir */}
          <Menu trigger="Inserir ▾" items={inserirItems} />

          <span className="sep" />

          {/* Ferramentas — segmentado */}
          <div className="tool-group">
            <button
              className={"tool-btn" + (!drawing && !commenting ? " active" : "")}
              onClick={() => { setDrawing(false); setCommenting(false); }}
              title="Selecionar / mover"
            >↖</button>
            <button
              className={"tool-btn" + (drawing ? " active" : "")}
              onClick={() => setDrawing(!drawing)}
              title="Desenhar à mão livre"
            >✏</button>
            <button
              className={"tool-btn" + (commenting ? " active" : "")}
              onClick={() => setCommenting(!commenting)}
              title="Adicionar comentário"
            >💬</button>
          </div>

          <span className="sep" />

          {/* Painéis — segmentado */}
          <div className="tool-group">
            <button
              className={"tool-btn" + (showLayers ? " active" : "")}
              onClick={() => togglePanel("layers")}
              title="Camadas"
            >▤</button>
            <button
              className={"tool-btn" + (showMedia ? " active" : "")}
              onClick={() => togglePanel("media")}
              title="Biblioteca de mídia"
            >⬚</button>
            <button
              className={"tool-btn" + (showAi ? " active" : "")}
              onClick={() => togglePanel("ai")}
              title="IA local"
            >✦</button>
          </div>

          <span className="sep" />

          <button className="present-btn" onClick={() => setPresenting(true)} title="Apresentar (F5)">
            ▶ Apresentar
          </button>
        </div>
        <div className="doc-title">{title}</div>
        <div className="zoom">
          <button onClick={() => setZoom(Math.max(0.1, (zoom || 0.5) - 0.1))} title="Reduzir">−</button>
          <button onClick={() => setZoom(0)} title="Ajustar à tela">{zoomPct ? `${zoomPct}%` : "Ajustar"}</button>
          <button onClick={() => setZoom((zoom || 0.5) + 0.1)} title="Ampliar">+</button>
        </div>
      </div>
      <ContextBar
        onInkColor={setInkColor}
        onInkWidth={setInkWidth}
        onInkStyle={setInkStyle}
      />
      <div className="workspace">
        <SlidesPanel />
        <EditorStage />
        {rightCollapsed ? (
          <button
            className="right-reopen"
            onClick={() => setRightCollapsed(false)}
            title="Mostrar painel (Inspetor / IA)"
          >
            ‹
          </button>
        ) : (
          <div className="right-pane" style={{ width: rightWidth }}>
            <div className="right-resize" onPointerDown={startRightResize} title="Arraste para redimensionar" />
            <button className="right-collapse" onClick={() => setRightCollapsed(true)} title="Recolher painel">
              ⟩
            </button>
            {showLayers ? (
              <LayersPanel onClose={() => setShowLayers(false)} />
            ) : showMedia ? (
              <MediaPanel onClose={() => setShowMedia(false)} />
            ) : showAi ? (
              <AiPanel ai={ai} onClose={() => setShowAi(false)} />
            ) : (
              <Inspector />
            )}
          </div>
        )}
      </div>
      {busy && <div className="busy">{busy}</div>}
      {presenting && <PresentMode onExit={() => setPresenting(false)} />}
      {printing && <PrintView deck={deck} />}
    </div>
  );
}

export default App;
