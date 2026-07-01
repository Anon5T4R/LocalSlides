// Onda 11.1 — Presenter view: a second Tauri window (meant for a second
// monitor / projector setup) showing the current + next slide, the speaker
// notes, and an elapsed timer. It never touches the deck store directly —
// it's a passive mirror driven by "presenter-sync" events from the main
// window's PresentMode, and it drives navigation back via "presenter-nav".
//
// Rendered instead of <App/> when this window's label is "presenter" (see
// main.tsx), so it stays a tiny, dependency-light surface.

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Deck } from "../model/deck";
import { pmToPlainText } from "../model/deck";
import { SlideView } from "../render/SlideView";

interface SyncPayload {
  deck: Deck;
  index: number;
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function MiniSlide({ deck, index, label }: { deck: Deck; index: number; label: string }) {
  const slide = deck.slides[index];
  return (
    <div className="presenter-slide-block">
      <div className="presenter-slide-label">{label}</div>
      {slide ? (
        <div className="presenter-slide-frame">
          <div
            style={{
              width: deck.size.w,
              height: deck.size.h,
              transform: "scale(var(--s))",
              transformOrigin: "top left",
              pointerEvents: "none",
            }}
          >
            <SlideView slide={slide} deck={deck} presenting />
          </div>
        </div>
      ) : (
        <div className="presenter-slide-frame presenter-slide-empty">Fim</div>
      )}
    </div>
  );
}

export function PresenterWindow() {
  const [sync, setSync] = useState<SyncPayload | null>(null);
  const [startedAt] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  const navRef = useRef<((delta: number) => void) | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setElapsed(Date.now() - startedAt), 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);

  useEffect(() => {
    let un: (() => void) | undefined;
    (async () => {
      const { listen, emit } = await import("@tauri-apps/api/event");
      un = await listen<SyncPayload>("presenter-sync", (e) => setSync(e.payload));
      navRef.current = (delta: number) => emit("presenter-nav", { delta });
      // Tell the main window we're ready to receive the current state.
      emit("presenter-ready", {});
    })();
    return () => un?.();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") navRef.current?.(1);
      else if (e.key === "ArrowLeft") navRef.current?.(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!sync) {
    return <div className="presenter-root presenter-waiting">Aguardando a apresentação iniciar…</div>;
  }

  const { deck, index } = sync;
  const slide = deck.slides[index];
  const notesText = pmToPlainText(slide?.notes);
  const scaleMain = 420 / deck.size.w;
  const scaleNext = 260 / deck.size.w;

  return (
    <div className="presenter-root">
      <div className="presenter-top">
        <div className="presenter-timer">⏱ {formatElapsed(elapsed)}</div>
        <div className="presenter-count">
          Slide {index + 1} / {deck.slides.length}
        </div>
      </div>

      <div className="presenter-slides">
        <div style={{ ["--s" as string]: scaleMain } as CSSProperties}>
          <MiniSlide deck={deck} index={index} label="Atual" />
        </div>
        <div style={{ ["--s" as string]: scaleNext } as CSSProperties}>
          <MiniSlide deck={deck} index={index + 1} label="Próximo" />
        </div>
      </div>

      <div className="presenter-notes">
        <div className="presenter-notes-head">Notas</div>
        <div className="presenter-notes-body">
          {notesText || <span className="presenter-notes-empty">Sem notas para este slide.</span>}
        </div>
      </div>

      <div className="presenter-controls">
        <button onClick={() => navRef.current?.(-1)} disabled={index === 0}>‹ Anterior</button>
        <button onClick={() => navRef.current?.(1)} disabled={index >= deck.slides.length - 1}>Próximo ›</button>
      </div>
    </div>
  );
}
