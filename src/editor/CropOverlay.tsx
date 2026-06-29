// Canva-style image crop: the image is "loose" inside a fixed frame. You PAN
// (drag) and ZOOM (wheel/slider) the image behind the frame, and can resize the
// frame itself (the image stays its size, revealing/hiding more — it only scales
// up if needed to keep covering the frame). On confirm we store el.crop (the
// visible region as fractions of the natural image) and the frame as the geom.

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useStore } from "../state/store";
import type { ImageEl } from "../model/deck";
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

  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  // frame = the visible window (slide coords); dispW = displayed image width;
  // ox/oy = image top-left relative to the frame top-left. dispH derives by aspect.
  const [frame, setFrame] = useState<Rect>({ ...el.geom });
  const [dispW, setDispW] = useState(0);
  const [ox, setOx] = useState(0);
  const [oy, setOy] = useState(0);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setNat({ w: img.naturalWidth || el.geom.w, h: img.naturalHeight || el.geom.h });
    img.src = el.src;
  }, [el.src, el.geom.w, el.geom.h]);

  const ar = nat ? nat.w / nat.h : 1; // image aspect (w/h)
  const dispH = dispW / ar;
  const coverW = nat ? Math.max(frame.w, frame.h * ar) : frame.w; // min width to cover frame

  // Initialise pan/zoom from the existing crop (or cover-centered) once nat loads.
  useEffect(() => {
    if (!nat || dispW) return;
    const c = el.crop;
    if (c && c.w > 0 && c.h > 0) {
      const dw = Math.max(coverW, el.geom.w / c.w);
      setDispW(dw);
      setOx(-c.x * dw);
      setOy(-c.y * (dw / ar));
    } else {
      setDispW(coverW);
      setOx((frame.w - coverW) / 2);
      setOy((frame.h - coverW / ar) / 2);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nat]);

  // Keep the image covering the frame: clamp offsets (and width) so no gaps show.
  const clampOffset = (x: number, y: number, dw: number) => {
    const dh = dw / ar;
    return {
      x: Math.min(0, Math.max(frame.w - dw, x)),
      y: Math.min(0, Math.max(frame.h - dh, y)),
    };
  };

  const gesture = useRef<
    | { kind: "pan"; ox: number; oy: number; px: number; py: number }
    | { kind: "resize"; handle: Handle; start: Rect; sox: number; soy: number; px: number; py: number }
    | null
  >(null);
  const st = useRef({ frame, dispW, ox, oy });
  st.current = { frame, dispW, ox, oy };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const g = gesture.current;
      if (!g) return;
      const dx = (e.clientX - g.px) / scale;
      const dy = (e.clientY - g.py) / scale;
      if (g.kind === "pan") {
        const c = clampOffset(g.ox + dx, g.oy + dy, st.current.dispW);
        setOx(c.x);
        setOy(c.y);
      } else {
        // Resize the frame; keep image size unless it would stop covering.
        const r = resizeGeom({ ...g.start, rotation: 0 }, g.handle, dx, dy);
        const nf = { x: r.x, y: r.y, w: r.w, h: r.h };
        const minW = Math.max(nf.w, nf.h * ar);
        const dw = Math.max(st.current.dispW, minW);
        // Image's top-left in slide coords stays put; recompute offset vs new frame.
        const imgSlideX = g.start.x + g.sox;
        const imgSlideY = g.start.y + g.soy;
        const c = clampOffset(imgSlideX - nf.x, imgSlideY - nf.y, dw);
        setFrame(nf);
        setDispW(dw);
        setOx(c.x);
        setOy(c.y);
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
  }, [scale, ar, frame.w, frame.h]);

  // Zoom around the frame centre.
  const zoomTo = (dw: number) => {
    const next = Math.max(coverW, Math.min(coverW * 8, dw));
    const k = next / dispW;
    const cx = frame.w / 2, cy = frame.h / 2;
    const c = clampOffset(cx - (cx - ox) * k, cy - (cy - oy) * k, next);
    setDispW(next);
    setOx(c.x);
    setOy(c.y);
  };

  if (!nat || !dispW) return null;

  const startPan = (e: ReactPointerEvent) => {
    e.stopPropagation();
    gesture.current = { kind: "pan", ox, oy, px: e.clientX, py: e.clientY };
  };
  const startResize = (handle: Handle, e: ReactPointerEvent) => {
    gesture.current = { kind: "resize", handle, start: { ...frame }, sox: ox, soy: oy, px: e.clientX, py: e.clientY };
  };

  const apply = () => {
    const s = st.current;
    const dh = s.dispW / ar;
    const crop = {
      x: Math.max(0, Math.min(1, -s.ox / s.dispW)),
      y: Math.max(0, Math.min(1, -s.oy / dh)),
      w: Math.max(0.01, Math.min(1, s.frame.w / s.dispW)),
      h: Math.max(0.01, Math.min(1, s.frame.h / dh)),
    };
    updateElement(el.id, (x) => {
      if (x.type !== "image") return;
      x.crop = crop;
      x.geom = { ...x.geom, x: s.frame.x, y: s.frame.y, w: s.frame.w, h: s.frame.h };
    });
    onDone();
  };

  const reset = () => {
    setDispW(coverW);
    setOx((frame.w - coverW) / 2);
    setOy((frame.h - coverW / ar) / 2);
  };

  const zoomPct = Math.round((dispW / coverW) * 100);

  return (
    <>
      {/* Dimmed context: the whole image around the frame (not clipped). */}
      <div
        style={{ position: "absolute", left: frame.x, top: frame.y, width: frame.w, height: frame.h, pointerEvents: "none" }}
      >
        <img
          src={el.src}
          alt=""
          draggable={false}
          style={{ position: "absolute", left: ox, top: oy, width: dispW, height: dispH, maxWidth: "none", opacity: 0.3 }}
        />
      </div>

      {/* Bright window: the visible region, draggable to pan. */}
      <div
        onPointerDown={startPan}
        onWheel={(e) => {
          e.preventDefault();
          zoomTo(dispW * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
        }}
        style={{
          position: "absolute",
          left: frame.x,
          top: frame.y,
          width: frame.w,
          height: frame.h,
          overflow: "hidden",
          cursor: "move",
          touchAction: "none",
        }}
      >
        <img
          src={el.src}
          alt=""
          draggable={false}
          style={{ position: "absolute", left: ox, top: oy, width: dispW, height: dispH, maxWidth: "none" }}
        />
      </div>

      {/* Frame handles (resize the window; the image keeps its size). */}
      <SelectionLayer
        geom={{ ...frame, rotation: 0 }}
        scale={scale}
        accent={accent}
        onHandleDown={startResize}
        onRotateDown={() => {}}
      />

      {/* Toolbar below the frame, counter-scaled to stay constant size. */}
      <div
        className="crop-bar"
        style={{
          position: "absolute",
          left: frame.x,
          top: frame.y + frame.h,
          transform: `scale(${1 / scale})`,
          transformOrigin: "top left",
          marginTop: 8 / scale,
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        <button onClick={() => zoomTo(dispW / 1.15)} title="Reduzir zoom">−</button>
        <input
          type="range"
          min={100}
          max={800}
          value={Math.min(800, zoomPct)}
          onChange={(e) => zoomTo(coverW * (Number(e.target.value) / 100))}
          title={`Zoom ${zoomPct}%`}
          style={{ width: 90 }}
        />
        <button onClick={() => zoomTo(dispW * 1.15)} title="Aumentar zoom">＋</button>
        <button onClick={reset} title="Reenquadrar">Reenquadrar</button>
        <button onClick={onDone} title="Cancelar (Esc)">Cancelar</button>
        <button className="crop-apply" onClick={apply} title="Concluir">Concluir</button>
      </div>
    </>
  );
}
