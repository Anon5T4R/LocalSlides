// Shrink-to-fit text: when the content would overflow the box, scale it down so
// it always fits (like PowerPoint's "shrink text on overflow"). It only ever
// shrinks — text that already fits is untouched (scale 1). A ResizeObserver
// re-measures on box resize; scrollHeight is the unscaled layout height, so the
// applied transform never feeds back into the measurement.

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

const PAD_X = 12;
const PAD_Y = 8;

export function AutoFitText({
  vAlign = "top",
  enabled = true,
  contentKey,
  children,
}: {
  vAlign?: "top" | "middle" | "bottom";
  enabled?: boolean;
  /** Changes whenever the text/styles change, to force a re-measure. */
  contentKey?: string;
  children: ReactNode;
}) {
  const padRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    if (!enabled) {
      setScale(1);
      return;
    }
    const pad = padRef.current;
    const inner = innerRef.current;
    if (!pad || !inner) return;
    const measure = () => {
      const availH = pad.clientHeight - PAD_Y * 2;
      const availW = pad.clientWidth - PAD_X * 2;
      const h = inner.scrollHeight; // unscaled layout height
      const w = inner.scrollWidth;
      if (h <= 0 || availH <= 0) return;
      const k = Math.min(1, availH / h, availW > 0 && w > 0 ? availW / w : 1);
      setScale(k > 0.05 ? k : 0.05);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(pad);
    return () => ro.disconnect();
  }, [enabled, contentKey]);

  const justify = vAlign === "middle" ? "center" : vAlign === "bottom" ? "flex-end" : "flex-start";
  const origin = vAlign === "middle" ? "center center" : vAlign === "bottom" ? "center bottom" : "center top";

  const padStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    padding: `${PAD_Y}px ${PAD_X}px`,
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    justifyContent: justify,
    overflow: "hidden",
  };

  return (
    <div ref={padRef} style={padStyle}>
      <div
        ref={innerRef}
        style={{
          width: "100%",
          transform: scale !== 1 ? `scale(${scale})` : undefined,
          transformOrigin: origin,
        }}
      >
        {children}
      </div>
    </div>
  );
}
