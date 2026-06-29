import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ask } from "@tauri-apps/plugin-dialog";
import { useStore } from "./state/store";
import { EditorStage } from "./editor/EditorStage";
import { SlidesPanel } from "./panels/SlidesPanel";
import { Inspector } from "./panels/Inspector";
import { PresentMode } from "./present/PresentMode";
import { newFreeTextBox, newImage, newShape, newTable, newVideo, type ShapeKind, type StrokeStyle } from "./model/deck";
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
import { inTauri } from "./lib/env";
import { PrintView } from "./export/PrintView";
import { exportSlidePng } from "./export/png";
import { exportDeckPptx } from "./export/pptx";
import { importPptx } from "./lib/pptx-io";
import { saveRecovery, loadRecovery, clearRecovery } from "./lib/recovery";
import { findSlide } from "./model/deck";
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
  const inkColor = useStore((s) => s.inkColor);
  const setInkColor = useStore((s) => s.setInkColor);
  const inkWidth = useStore((s) => s.inkWidth);
  const setInkWidth = useStore((s) => s.setInkWidth);
  const inkStyle = useStore((s) => s.inkStyle);
  const setInkStyle = useStore((s) => s.setInkStyle);
  const commenting = useStore((s) => s.commenting);
  const setCommenting = useStore((s) => s.setCommenting);

  const [busy, setBusy] = useState<string>("");
  const [presenting, setPresenting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [showMedia, setShowMedia] = useState(false);
  const [showShapes, setShowShapes] = useState(false);
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
      setShowShapes(false);
    },
    [addElement]
  );

  const insertTable = useCallback(() => {
    addElement(newTable(useStore.getState().deck, 3, 3));
  }, [addElement]);

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
      if (k === "s") {
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
  }, [handleSave, handleSaveAs, handleOpen, handleNew, undo, redo, addSlide, group, ungroup]);

  // ---- OS drag-and-drop of image files onto the canvas ----
  const dropImageAt = useCallback(
    (src: string, clientX?: number, clientY?: number) => {
      const deckNow = useStore.getState().deck;
      addAsset("image", "Imagem", src); // dropped images join the library too
      const img = newImage(deckNow, src);
      // If we know where it was dropped, center the image there.
      const scaled = document.querySelector(".slide-scaled") as HTMLElement | null;
      if (scaled && clientX != null && clientY != null) {
        const rect = scaled.getBoundingClientRect();
        const s = rect.width / deckNow.size.w;
        const lx = (clientX - rect.left) / s;
        const ly = (clientY - rect.top) / s;
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

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">LocalSlides</div>
        <div className="toolbar">
          <button onClick={handleNew} title="Nova (Ctrl+N)">Nova</button>
          <button onClick={handleOpen} title="Abrir (Ctrl+O)">Abrir</button>
          <button onClick={handleSave} title="Salvar (Ctrl+S)">Salvar</button>
          <button onClick={handleSaveAs} title="Salvar como (Ctrl+Shift+S)">Salvar como</button>
          <span className="sep" />
          <button onClick={undo} disabled={!canUndo} title="Desfazer (Ctrl+Z)">↶</button>
          <button onClick={redo} disabled={!canRedo} title="Refazer (Ctrl+Y)">↷</button>
          <span className="sep" />
          <button onClick={() => addSlide()} title="Novo slide (Ctrl+M)">＋ Slide</button>
          <span className="sep" />
          <button onClick={insertText} title="Caixa de texto">Texto</button>
          <button onClick={insertImage} title="Inserir imagem">Imagem</button>
          <button onClick={insertVideo} title="Inserir vídeo">Vídeo</button>
          <div className="shape-picker-wrap">
            <button onClick={() => setShowShapes((v) => !v)} title="Inserir forma">Forma ▾</button>
            {showShapes && (
              <>
                <div className="shape-picker-backdrop" onClick={() => setShowShapes(false)} />
                <div className="shape-picker">
                  {SHAPE_PICKER.map((s) => (
                    <button key={s.kind} title={s.label} onClick={() => insertShape(s.kind)}>
                      <span className="shape-glyph">{s.glyph}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <button onClick={insertTable} title="Inserir tabela">Tabela</button>
          <span className="sep" />
          <button
            className={"ai-toggle" + (drawing ? " active" : "")}
            onClick={() => setDrawing(!drawing)}
            title="Desenhar à mão livre"
          >
            ✏ Desenhar
          </button>
          {drawing && (
            <>
              <input
                type="color"
                className="ink-color"
                value={inkColor}
                onChange={(e) => setInkColor(e.target.value)}
                title="Cor do traço"
              />
              <input
                type="range"
                min={1}
                max={24}
                value={inkWidth}
                onChange={(e) => setInkWidth(Number(e.target.value))}
                title={`Espessura: ${inkWidth}px`}
                style={{ width: 70 }}
              />
              <select
                value={inkStyle}
                onChange={(e) => setInkStyle(e.target.value as StrokeStyle)}
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
          <button
            className={"ai-toggle" + (commenting ? " active" : "")}
            onClick={() => setCommenting(!commenting)}
            title="Adicionar comentário (clique no slide)"
          >
            💬 Comentar
          </button>
          <span className="sep" />
          <button onClick={handleExportPdf} title="Exportar PDF (todos os slides)">PDF</button>
          <button onClick={handleExportPng} title="Exportar PNG (slide atual)">PNG</button>
          <button onClick={handleExportPptx} title="Exportar PPTX (PowerPoint)">PPTX</button>
          <button onClick={handleImportPptx} title="Importar PPTX (PowerPoint)">Importar PPTX</button>
          <span className="sep" />
          <button
            className={"ai-toggle" + (showMedia ? " active" : "")}
            onClick={() => {
              setShowMedia((v) => !v);
              setShowAi(false);
              setRightCollapsed(false);
            }}
            title="Biblioteca de mídia"
          >
            ⬚ Mídia
          </button>
          <button
            className={"ai-toggle" + (showAi ? " active" : "")}
            onClick={() => {
              setShowAi((v) => !v);
              setShowMedia(false);
              setRightCollapsed(false);
            }}
            title="IA local (gerar/conversar)"
          >
            ✦ IA
          </button>
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
            {showMedia ? (
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
