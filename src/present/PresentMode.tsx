// Fullscreen presentation. Shows one slide at a time, scaled to the window, with
// videos live (presenting=true). Navigation: →/Space/click advances, ← goes back,
// Esc exits. Each slide entry replays its transition and its elements' entrance
// animations (forced by a changing React key, so they restart on every visit).

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useStore } from "../state/store";
import { SlideView } from "../render/SlideView";

export function PresentMode({ onExit }: { onExit: () => void }) {
  const deck = useStore((s) => s.deck);
  const currentSlideId = useStore((s) => s.currentSlideId);
  const setCurrentSlide = useStore((s) => s.setCurrentSlide);

  const startIndex = Math.max(0, deck.slides.findIndex((s) => s.id === currentSlideId));
  const [index, setIndex] = useState(startIndex);
  // Bumped on every navigation so element entrance animations replay.
  const [visit, setVisit] = useState(0);
  // Active slide-to-slide transition (outgoing + incoming animate together).
  const [trans, setTrans] = useState<{ from: number; id: number } | null>(null);
  const transId = useRef(0);
  const transTimer = useRef<number | undefined>(undefined);

  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const measure = () => {
      const s = Math.min(window.innerWidth / deck.size.w, window.innerHeight / deck.size.h);
      setScale(s);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [deck.size.w, deck.size.h]);

  const go = useCallback(
    (delta: number) => {
      setIndex((i) => {
        const next = Math.max(0, Math.min(i + delta, deck.slides.length - 1));
        if (next === i) return i;
        setVisit((v) => v + 1);
        // The transition belongs to the *incoming* slide.
        const t = deck.slides[next]?.transition;
        if (t && t.kind !== "none") {
          const id = ++transId.current;
          setTrans({ from: i, id });
          window.clearTimeout(transTimer.current);
          transTimer.current = window.setTimeout(
            () => setTrans((cur) => (cur && cur.id === id ? null : cur)),
            t.duration * 1000 + 60
          );
        } else {
          setTrans(null);
        }
        return next;
      });
    },
    [deck.slides]
  );

  useEffect(() => () => window.clearTimeout(transTimer.current), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        go(-1);
      } else if (e.key === "Escape") {
        e.preventDefault();
        // Sync the editor's current slide to where we left off, then exit.
        setCurrentSlide(deck.slides[index]?.id ?? currentSlideId);
        onExit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index, deck.slides, currentSlideId, setCurrentSlide, onExit]);

  const slide = deck.slides[index];
  if (!slide) return null;

  const t = slide.transition;
  const dur = t?.duration ?? 0.5;
  const kind = t?.kind ?? "none";
  const enterAnim = trans && kind !== "none" ? `pt-${kind}-in ${dur}s ease both` : undefined;
  const exitAnim = trans && kind !== "none" ? `pt-${kind}-out ${dur}s ease both` : undefined;

  const layer = (i: number, key: string, animation: string | undefined) => (
    <div key={key} className="present-layer" style={{ animation }}>
      <div
        className="present-slide"
        style={{
          width: deck.size.w,
          height: deck.size.h,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <SlideView slide={deck.slides[i]} deck={deck} presenting />
      </div>
    </div>
  );

  return (
    <div className="present-root" ref={wrapRef} onClick={() => go(1)}>
      <div
        className="present-frame"
        style={{ width: deck.size.w * scale, height: deck.size.h * scale }}
      >
        {/* During a transition the outgoing slide animates out while the incoming
            (stable key by visit) animates in; afterwards only the incoming remains. */}
        {trans && layer(trans.from, `out-${trans.id}`, exitAnim)}
        {layer(index, `cur-${visit}`, enterAnim)}
      </div>

      <div className="present-hud" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => go(-1)} disabled={index === 0} title="Anterior">‹</button>
        <span>
          {index + 1} / {deck.slides.length}
        </span>
        <button onClick={() => go(1)} disabled={index === deck.slides.length - 1} title="Próximo">›</button>
        <button onClick={onExit} title="Sair (Esc)">✕</button>
      </div>
    </div>
  );
}
