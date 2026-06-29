// Interactive image crop (Canva-style). While active, the element box shows the
// WHOLE source image (contain-fitted) dimmed, with a bright, draggable crop
// frame over it. Confirming stores el.crop (fractions of the natural image) and
// resizes the element to the crop frame, so the result fills the box undistorted.

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useStore } from "../state/store";
import type { Geom, ImageEl } from "../model/deck";
import { SelectionLayer } from "../render/SelectionLayer";
import { resizeGeom, type Handle } from "../interactions/geometry";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function CropOverlay({ el, scale, onDone }: { el: ImageEl; scale: number; onDone: () => void }) {
  const updateElement = useStore((s) => s.updateElement);
  const accent = useStore((s) => s.deck.theme.colors.accent1);

  const box = el.geom;
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);

  // Load the source to learn its natural size → the contain rectangle inside the box.
  useEffect(() => {
    const img = new Image();
    img.onload = () => setNat({ w: img.naturalWidth || box.w, h: img.naturalHeight || box.h });
    img.src = el.src;
  }, [el.src, box.w, box.h]);

  // contain fit of the image within the box (box-local px)
  const fit =
    nat && nat.w > 0 && nat.h > 0
      ? (() => {
          const s = Math.min(box.w / nat.w, box.h / nat.h);
          const dispW = nat.w * s;
          const dispH = nat.h * s;
          return { dispW, dispH, offX: (box.w - dispW) / 2, offY: (box.h - dispH) / 2 };
        })()
      : { dispW: box.w, dispH: box.h, offX: 0, offY: 0 };

  // Initialise the crop frame from el.crop (or the whole image) once we know the fit.
  useEffect(() => {
    if (!nat || rect) return;
    const c = el.crop;
    if (c) {
      setRect({
        x: fit.offX + c.x * fit.dispW,
        y: fit.offY + c.y * fit.dispH,
        w: c.w * fit.dispW,
        h: c.h * fit.dispH,
      });
    } else {
      setRect({ x: fit.offX, y: fit.offY, w: fit.dispW, h: fit.dispH });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nat]);

  const gesture = useRef<{ kind: "move" | "resize"; handle?: Handle; start: Rect; px: number; py: number } | null>(null);
  const rectRef = useRef<Rect | null>(rect);
  rectRef.current = rect;

  const clamp = (r: Rect): Rect => {
    // Keep the frame inside the displayed image and non-degenerate.
    const minX = fit.offX, minY = fit.offY;
    const maxX = fit.offX + fit.dispW, maxY = fit.offY + fit.dispH;
    let { x, y, w, h } = r;
    w = Math.max(20, Math.min(w, fit.dispW));
    h = Math.max(20, Math.min(h, fit.dispH));
    x = Math.max(minX, Math.min(x, maxX - w));
    y = Math.max(minY, Math.min(y, maxY - h));
    return { x, y, w, h };
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const g = gesture.current;
      if (!g) return;
      const dx = (e.clientX - g.px) / scale;
      const dy = (e.clientY - g.py) / scale;
      if (g.kind === "move") {
        setRect(clamp({ ...g.start, x: g.start.x + dx, y: g.start.y + dy }));
      } else {
        const geom: Geom = { ...g.start, rotation: 0 };
        const next = resizeGeom(geom, g.handle!, dx, dy);
        setRect(clamp({ x: next.x, y: next.y, w: next.w, h: next.h }));
      }
    };
    const onUp = () => (gesture.current = null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, fit.offX, fit.offY, fit.dispW, fit.dispH]);

  if (!rect) return null;

  const startMove = (e: ReactPointerEvent) => {
    e.stopPropagation();
    gesture.current = { kind: "move", start: rect, px: e.clientX, py: e.clientY };
  };
  const startResize = (handle: Handle, e: ReactPointerEvent) => {
    gesture.current = { kind: "resize", handle, start: rect, px: e.clientX, py: e.clientY };
  };

  const apply = () => {
    const r = rectRef.current!;
    const crop = {
      x: Math.max(0, Math.min(1, (r.x - fit.offX) / fit.dispW)),
      y: Math.max(0, Math.min(1, (r.y - fit.offY) / fit.dispH)),
      w: Math.max(0.01, Math.min(1, r.w / fit.dispW)),
      h: Math.max(0.01, Math.min(1, r.h / fit.dispH)),
    };
    updateElement(el.id, (x) => {
      if (x.type !== "image") return;
      x.crop = crop;
      x.geom = { ...x.geom, x: box.x + r.x, y: box.y + r.y, w: r.w, h: r.h };
    });
    onDone();
  };

  const reset = () => setRect({ x: fit.offX, y: fit.offY, w: fit.dispW, h: fit.dispH });

  return (
    <>
      {/* The element box: dimmed full image + bright clipped preview at the frame. */}
      <div style={{ position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h }}>
        <img
          src={el.src}
          alt=""
          draggable={false}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", opacity: 0.35 }}
        />
        <div style={{ position: "absolute", left: rect.x, top: rect.y, width: rect.w, height: rect.h, overflow: "hidden", cursor: "move" }} onPointerDown={startMove}>
          <img
            src={el.src}
            alt=""
            draggable={false}
            style={{ position: "absolute", left: fit.offX - rect.x, top: fit.offY - rect.y, width: fit.dispW, height: fit.dispH, maxWidth: "none" }}
          />
        </div>
      </div>

      <SelectionLayer
        geom={{ x: box.x + rect.x, y: box.y + rect.y, w: rect.w, h: rect.h, rotation: 0 }}
        scale={scale}
        accent={accent}
        onHandleDown={startResize}
        onRotateDown={() => {}}
      />

      {/* Toolbar below the box, counter-scaled to stay constant size. */}
      <div
        className="crop-bar"
        style={{
          position: "absolute",
          left: box.x,
          top: box.y + box.h,
          transform: `scale(${1 / scale})`,
          transformOrigin: "top left",
          marginTop: 8 / scale,
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button onClick={reset} title="Restaurar imagem inteira">Tudo</button>
        <button onClick={onDone} title="Cancelar (Esc)">Cancelar</button>
        <button className="crop-apply" onClick={apply} title="Aplicar corte (Enter)">Cortar</button>
      </div>
    </>
  );
}
