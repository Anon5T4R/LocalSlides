// Off-screen-until-print view: one slide per page at logical px. The @page size
// is set to the slide's exact dimensions (px → inches at 96dpi), so a 1280×720
// deck prints as 13.333"×7.5" landscape pages with crisp vector text. The print
// stylesheet (App.css) hides the app and reveals only `.print-root` when printing.

import type { Deck } from "../model/deck";
import { SlideView } from "../render/SlideView";

export function PrintView({ deck }: { deck: Deck }) {
  const wIn = (deck.size.w / 96).toFixed(3);
  const hIn = (deck.size.h / 96).toFixed(3);
  return (
    <div className="print-root">
      <style>{`@page { size: ${wIn}in ${hIn}in; margin: 0; }`}</style>
      {deck.slides.map((slide) => (
        <div
          key={slide.id}
          className="print-page"
          style={{ width: deck.size.w, height: deck.size.h, overflow: "hidden" }}
        >
          <SlideView slide={slide} deck={deck} />
        </div>
      ))}
    </div>
  );
}
