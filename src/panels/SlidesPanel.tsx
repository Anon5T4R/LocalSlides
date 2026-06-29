// Left rail: ordered slide thumbnails. Each thumbnail is the very same SlideView,
// shrunk and pointer-disabled. Drag to reorder; buttons add/duplicate/delete.

import { useState } from "react";
import { useStore } from "../state/store";
import type { Deck, Slide } from "../model/deck";
import { SlideView } from "../render/SlideView";

const THUMB_W = 168;

function Thumbnail({ slide, deck }: { slide: Slide; deck: Deck }) {
  const scale = THUMB_W / deck.size.w;
  return (
    <div
      style={{
        width: THUMB_W,
        height: deck.size.h * scale,
        position: "relative",
        overflow: "hidden",
        borderRadius: 4,
        background: deck.theme.colors.bg,
      }}
    >
      <div
        style={{
          width: deck.size.w,
          height: deck.size.h,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          pointerEvents: "none",
        }}
      >
        <SlideView slide={slide} deck={deck} />
      </div>
    </div>
  );
}

export function SlidesPanel() {
  const deck = useStore((s) => s.deck);
  const currentSlideId = useStore((s) => s.currentSlideId);
  const setCurrentSlide = useStore((s) => s.setCurrentSlide);
  const addSlide = useStore((s) => s.addSlide);
  const duplicateSlide = useStore((s) => s.duplicateSlide);
  const deleteSlide = useStore((s) => s.deleteSlide);
  const moveSlide = useStore((s) => s.moveSlide);

  const [dragId, setDragId] = useState<string | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  return (
    <div className="slides-panel">
      <div className="slides-panel-head">
        <span>Slides</span>
        <button className="icon-btn" title="Novo slide" onClick={addSlide}>
          ＋
        </button>
      </div>
      <div className="slides-list">
        {deck.slides.map((slide, i) => (
          <div
            key={slide.id}
            className={
              "slide-thumb-row" +
              (slide.id === currentSlideId ? " active" : "") +
              (overIndex === i ? " drop-target" : "")
            }
            draggable
            onDragStart={() => setDragId(slide.id)}
            onDragOver={(e) => {
              e.preventDefault();
              setOverIndex(i);
            }}
            onDrop={() => {
              if (dragId) moveSlide(dragId, i);
              setDragId(null);
              setOverIndex(null);
            }}
            onDragEnd={() => {
              setDragId(null);
              setOverIndex(null);
            }}
            onClick={() => setCurrentSlide(slide.id)}
          >
            <span className="slide-index">{i + 1}</span>
            <Thumbnail slide={slide} deck={deck} />
            <div className="slide-thumb-actions">
              <button
                className="icon-btn sm"
                title="Duplicar"
                onClick={(e) => {
                  e.stopPropagation();
                  duplicateSlide(slide.id);
                }}
              >
                ⧉
              </button>
              <button
                className="icon-btn sm"
                title="Excluir"
                disabled={deck.slides.length <= 1}
                onClick={(e) => {
                  e.stopPropagation();
                  deleteSlide(slide.id);
                }}
              >
                🗑
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
