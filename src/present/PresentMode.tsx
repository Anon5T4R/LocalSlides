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
  // Bumped on every navigation so the slide remounts and animations replay.
  const [visit, setVisit] = useState(0);

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
        if (next !== i) setVisit((v) => v + 1);
        return next;
      });
    },
    [deck.slides.length]
  );

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

  const transition = slide.transition;
  const animName = transition && transition.kind !== "none" ? `slide-${transition.kind}` : undefined;
  const animStyle = animName ? `${animName} ${transition!.duration}s ease both` : undefined;

  return (
    <div className="present-root" ref={wrapRef} onClick={() => go(1)}>
      <div
        className="present-frame"
        style={{ width: deck.size.w * scale, height: deck.size.h * scale }}
      >
        {/* Transition animates on this wrapper so it never fights the slide's scale. */}
        <div
          key={`${slide.id}:${visit}`}
          className="present-anim"
          style={{ width: "100%", height: "100%", animation: animStyle }}
        >
          <div
            className="present-slide"
            style={{
              width: deck.size.w,
              height: deck.size.h,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            <SlideView slide={slide} deck={deck} presenting />
          </div>
        </div>
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
