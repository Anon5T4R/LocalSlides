// Pure render of one slide at its logical size. No scaling, no interaction — the
// caller wraps this in a `transform: scale(zoom)` container. The same component
// powers the editor stage and the (pointer-disabled) thumbnails.

import type { CSSProperties } from "react";
import type { Deck, Slide } from "../model/deck";
import { ElementView } from "./ElementView";

function slideBackground(slide: Slide, deck: Deck): string {
  const bg = slide.background;
  if (bg && bg.kind === "solid") return bg.color;
  return deck.theme.colors.bg;
}

export function SlideView({
  slide,
  deck,
  style,
  presenting = false,
  hideIds,
}: {
  slide: Slide;
  deck: Deck;
  style?: CSSProperties;
  presenting?: boolean;
  /** Elements to skip painting — e.g. one being edited by an overlay editor. */
  hideIds?: Set<string>;
}) {
  return (
    <div
      style={{
        position: "relative",
        width: deck.size.w,
        height: deck.size.h,
        background: slideBackground(slide, deck),
        overflow: "hidden",
        ...style,
      }}
    >
      {slide.elements.map((el) =>
        hideIds?.has(el.id) ? null : (
          <ElementView key={el.id} el={el} theme={deck.theme} presenting={presenting} />
        )
      )}
    </div>
  );
}
