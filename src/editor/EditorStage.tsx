// The interactive editing surface for the current slide.
//
// Layout: a centered "frame" sized in screen px, holding a single scaled
// container whose children live in logical px. The static SlideView paints the
// visuals (pointer-events off); a transparent hit-box per element captures
// select/drag; SelectionLayer draws resize/rotate handles; GuidesLayer shows
// snapping. All gesture math is in logical px (screen delta ÷ scale).

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useStore, expandToGroups } from "../state/store";
import { findSlide, type Geom } from "../model/deck";
import { SlideView } from "../render/SlideView";
import { SelectionLayer } from "../render/SelectionLayer";
import { GuidesLayer } from "../render/GuidesLayer";
import { resizeGeom, rotationFromPointer, type Handle } from "../interactions/geometry";
import { computeSnap } from "../interactions/snapping";
import { TextBoxEditor } from "./TextBoxEditor";
import { TableCellEditor } from "./TableCellEditor";
import { CropOverlay } from "./CropOverlay";

const FIT_MARGIN = 48;

type MoveGesture = {
  kind: "move";
  primaryId: string;
  starts: { id: string; geom: Geom }[];
  px: number;
  py: number;
  moved: boolean;
};
type ResizeGesture = { kind: "resize"; elId: string; handle: Handle; start: Geom; px: number; py: number };
type RotateGesture = { kind: "rotate"; elId: string; start: Geom };
type MarqueeGesture = { kind: "marquee"; ox: number; oy: number };
type Gesture = MoveGesture | ResizeGesture | RotateGesture | MarqueeGesture | null;

interface CellTarget {
  elId: string;
  row: number;
  col: number;
}

export function EditorStage() {
  const deck = useStore((s) => s.deck);
  const currentSlideId = useStore((s) => s.currentSlideId);
  const selection = useStore((s) => s.selection);
  const croppingId = useStore((s) => s.croppingId);
  const setCropping = useStore((s) => s.setCropping);
  const zoom = useStore((s) => s.zoom);
  const select = useStore((s) => s.select);
  const clearSelection = useStore((s) => s.clearSelection);
  const updateElement = useStore((s) => s.updateElement);
  const deleteElements = useStore((s) => s.deleteElements);
  const beginTx = useStore((s) => s.beginTx);
  const endTx = useStore((s) => s.endTx);

  const slide = findSlide(deck, currentSlideId);

  const stageRef = useRef<HTMLDivElement>(null);
  const scaledRef = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState({ w: 0, h: 0 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<CellTarget | null>(null);
  const [guides, setGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] });
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAvail({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fitScale =
    avail.w > 0 && avail.h > 0
      ? Math.min((avail.w - FIT_MARGIN) / deck.size.w, (avail.h - FIT_MARGIN) / deck.size.h)
      : 0.5;
  const scale = zoom > 0 ? zoom : Math.max(0.1, fitScale);
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  // Latest selection/slide for use inside the window gesture listeners.
  const selRef = useRef(selection);
  selRef.current = selection;
  const slideRef = useRef(slide);
  slideRef.current = slide;

  const toLogical = useCallback((clientX: number, clientY: number) => {
    const rect = scaledRef.current?.getBoundingClientRect();
    const s = scaleRef.current;
    if (!rect) return { x: 0, y: 0 };
    return { x: (clientX - rect.left) / s, y: (clientY - rect.top) / s };
  }, []);

  const gesture = useRef<Gesture>(null);

  // --- Window-level gesture handlers ---
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const g = gesture.current;
      if (!g) return;
      const s = scaleRef.current;

      if (g.kind === "move") {
        const dx = (e.clientX - g.px) / s;
        const dy = (e.clientY - g.py) / s;
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) g.moved = true;
        const primaryStart = g.starts.find((x) => x.id === g.primaryId)!.geom;
        // Snap the primary element against everything not being dragged.
        const movingIds = new Set(g.starts.map((x) => x.id));
        const others =
          slideRef.current?.elements.filter((el) => !movingIds.has(el.id)).map((el) => el.geom) ?? [];
        const proposed: Geom = { ...primaryStart, x: primaryStart.x + dx, y: primaryStart.y + dy };
        const snap = computeSnap(proposed, others, deck.size);
        const adjDx = snap.x - primaryStart.x;
        const adjDy = snap.y - primaryStart.y;
        setGuides({ v: snap.vGuides, h: snap.hGuides });
        g.starts.forEach((st) =>
          updateElement(st.id, (el) => {
            el.geom.x = Math.round(st.geom.x + adjDx);
            el.geom.y = Math.round(st.geom.y + adjDy);
          })
        );
      } else if (g.kind === "resize") {
        const dx = (e.clientX - g.px) / s;
        const dy = (e.clientY - g.py) / s;
        const next = resizeGeom(g.start, g.handle, dx, dy, e.shiftKey);
        updateElement(g.elId, (el) => {
          el.geom.x = Math.round(next.x);
          el.geom.y = Math.round(next.y);
          el.geom.w = Math.round(next.w);
          el.geom.h = Math.round(next.h);
        });
      } else if (g.kind === "rotate") {
        const p = toLogical(e.clientX, e.clientY);
        const deg = rotationFromPointer(g.start, p.x, p.y, e.shiftKey);
        updateElement(g.elId, (el) => (el.geom.rotation = deg));
      } else if (g.kind === "marquee") {
        const p = toLogical(e.clientX, e.clientY);
        setMarquee({
          x: Math.min(g.ox, p.x),
          y: Math.min(g.oy, p.y),
          w: Math.abs(p.x - g.ox),
          h: Math.abs(p.y - g.oy),
        });
      }
    };

    const onUp = () => {
      const g = gesture.current;
      if (!g) return;
      if (g.kind === "marquee") {
        const m = marqueeRef.current;
        if (m && (m.w > 3 || m.h > 3)) {
          const hits =
            slideRef.current?.elements
              .filter(
                (el) =>
                  el.geom.x < m.x + m.w &&
                  el.geom.x + el.geom.w > m.x &&
                  el.geom.y < m.y + m.h &&
                  el.geom.y + el.geom.h > m.y
              )
              .map((el) => el.id) ?? [];
          select(expandToGroups(slideRef.current, hits));
        } else {
          clearSelection();
        }
        setMarquee(null);
      } else {
        endTx();
      }
      setGuides({ v: [], h: [] });
      gesture.current = null;
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [updateElement, endTx, select, clearSelection, toLogical, deck.size]);

  // Keep a ref of the marquee so the pointerup handler sees the final rect.
  const marqueeRef = useRef(marquee);
  marqueeRef.current = marquee;

  // Esc leaves crop mode (the overlay's own buttons also exit).
  useEffect(() => {
    if (!croppingId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setCropping(null);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [croppingId, setCropping]);

  // --- Start gestures ---
  const startMove = useCallback(
    (elId: string, e: ReactPointerEvent) => {
      if (editingId || editingCell) return;
      e.stopPropagation();
      const sl = slideRef.current;
      const el = sl?.elements.find((x) => x.id === elId);
      if (!el || el.locked || !sl) return;

      // Resolve which ids this click selects (group-aware).
      const groupIds = expandToGroups(sl, [elId]);
      let nextSelection: string[];
      if (e.shiftKey) {
        const has = selRef.current.includes(elId);
        nextSelection = has
          ? selRef.current.filter((id) => !groupIds.includes(id))
          : [...new Set([...selRef.current, ...groupIds])];
        select(nextSelection);
        return; // shift-click toggles; don't start a drag
      } else if (selRef.current.includes(elId)) {
        nextSelection = selRef.current; // keep the multi-selection, drag it all
      } else {
        nextSelection = groupIds;
        select(nextSelection);
      }

      const starts = (sl.elements.filter((x) => nextSelection.includes(x.id)) || []).map((x) => ({
        id: x.id,
        geom: { ...x.geom },
      }));
      beginTx();
      gesture.current = { kind: "move", primaryId: elId, starts, px: e.clientX, py: e.clientY, moved: false };
    },
    [editingId, editingCell, select, beginTx]
  );

  const startResize = useCallback(
    (handle: Handle, e: ReactPointerEvent) => {
      const el = slideRef.current?.elements.find((x) => x.id === selRef.current[0]);
      if (!el) return;
      beginTx();
      gesture.current = { kind: "resize", elId: el.id, handle, start: { ...el.geom }, px: e.clientX, py: e.clientY };
    },
    [beginTx]
  );

  const startRotate = useCallback(
    (_e: ReactPointerEvent) => {
      const el = slideRef.current?.elements.find((x) => x.id === selRef.current[0]);
      if (!el) return;
      beginTx();
      gesture.current = { kind: "rotate", elId: el.id, start: { ...el.geom } };
    },
    [beginTx]
  );

  const startMarquee = useCallback(
    (e: ReactPointerEvent) => {
      if (editingId || editingCell) return;
      const p = toLogical(e.clientX, e.clientY);
      gesture.current = { kind: "marquee", ox: p.x, oy: p.y };
      setMarquee({ x: p.x, y: p.y, w: 0, h: 0 });
    },
    [editingId, editingCell, toLogical]
  );

  const openCellEditor = useCallback((elId: string, e: React.MouseEvent<HTMLElement>) => {
    const el = slideRef.current?.elements.find((x) => x.id === elId);
    if (el?.type !== "table") return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const nCols = el.rows[0]?.length ?? 1;
    const nRows = el.rows.length;
    const col = Math.min(nCols - 1, Math.max(0, Math.floor(((e.clientX - rect.left) / rect.width) * nCols)));
    const row = Math.min(nRows - 1, Math.max(0, Math.floor(((e.clientY - rect.top) / rect.height) * nRows)));
    setEditingCell({ elId, row, col });
  }, []);

  // --- Keyboard ---
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (editingId || editingCell) return;
      if (!selection.length) return;
      if ((e.key === "F2" || e.key === "Enter") && selection.length === 1) {
        const el = slide?.elements.find((x) => x.id === selection[0]);
        if (el?.type === "text") {
          e.preventDefault();
          setEditingId(el.id);
          return;
        }
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteElements(selection);
        return;
      }
      const step = e.shiftKey ? 10 : 1;
      const deltas: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      const d = deltas[e.key];
      if (!d) return;
      e.preventDefault();
      beginTx();
      selection.forEach((id) =>
        updateElement(id, (el) => {
          el.geom.x += d[0];
          el.geom.y += d[1];
        })
      );
      endTx();
    },
    [editingId, editingCell, selection, slide, deleteElements, updateElement, beginTx, endTx]
  );

  if (!slide) return <div className="stage" ref={stageRef} />;

  const selectedEl = selection.length === 1 ? slide.elements.find((e) => e.id === selection[0]) : undefined;
  const selSet = new Set(selection);
  const cropEl =
    croppingId ? slide.elements.find((e) => e.id === croppingId && e.type === "image") : undefined;
  const hidden = new Set<string>();
  if (editingId) hidden.add(editingId);
  if (cropEl) hidden.add(cropEl.id);

  return (
    <div
      className="stage"
      ref={stageRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={(e) => {
        // Empty-area press starts a marquee (or clears on a plain click).
        if (!editingId && !editingCell && e.target === e.currentTarget) startMarquee(e);
      }}
    >
      <div
        className="slide-frame"
        style={{ width: deck.size.w * scale, height: deck.size.h * scale }}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget || e.target === scaledRef.current) {
            e.stopPropagation();
            startMarquee(e);
          }
        }}
      >
        <div
          className="slide-scaled"
          ref={scaledRef}
          style={{
            width: deck.size.w,
            height: deck.size.h,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          <SlideView
            slide={slide}
            deck={deck}
            style={{ pointerEvents: "none" }}
            // Hide the text box being edited / image being cropped so the live
            // overlay doesn't ghost over the static render (tables keep painting).
            hideIds={hidden.size ? hidden : undefined}
          />

          {/* interaction hit boxes */}
          {slide.elements.map((el) => (
            <div
              key={el.id}
              onPointerDown={(ev) => startMove(el.id, ev)}
              onDoubleClick={(ev) => {
                ev.stopPropagation();
                if (el.type === "text") setEditingId(el.id);
                else if (el.type === "table") openCellEditor(el.id, ev);
              }}
              style={{
                position: "absolute",
                left: el.geom.x,
                top: el.geom.y,
                width: el.geom.w,
                height: el.geom.h,
                transform: el.geom.rotation ? `rotate(${el.geom.rotation}deg)` : undefined,
                transformOrigin: "center center",
                outline: selSet.has(el.id) && !selectedEl ? `${1.5 / scale}px solid ${deck.theme.colors.accent1}` : undefined,
                cursor: editingId || editingCell || croppingId ? "default" : "move",
                pointerEvents:
                  editingId === el.id || editingCell?.elId === el.id || croppingId ? "none" : "auto",
              }}
            />
          ))}

          {/* snapping guides */}
          {(guides.v.length > 0 || guides.h.length > 0) && (
            <GuidesLayer vGuides={guides.v} hGuides={guides.h} size={deck.size} scale={scale} />
          )}

          {/* image crop overlay */}
          {cropEl && cropEl.type === "image" && (
            <CropOverlay el={cropEl} scale={scale} onDone={() => setCropping(null)} />
          )}

          {/* resize + rotate handles for a single selection */}
          {selectedEl && !editingId && !editingCell && !croppingId && (
            <SelectionLayer
              geom={selectedEl.geom}
              scale={scale}
              accent={deck.theme.colors.accent1}
              onHandleDown={startResize}
              onRotateDown={startRotate}
            />
          )}

          {/* marquee rectangle */}
          {marquee && (
            <div
              style={{
                position: "absolute",
                left: marquee.x,
                top: marquee.y,
                width: marquee.w,
                height: marquee.h,
                border: `${1 / scale}px solid ${deck.theme.colors.accent1}`,
                background: `${deck.theme.colors.accent1}22`,
                pointerEvents: "none",
              }}
            />
          )}

          {/* in-place editors */}
          {editingId && (
            <TextBoxEditor key={editingId} elementId={editingId} scale={scale} onClose={() => setEditingId(null)} />
          )}
          {editingCell && (
            <TableCellEditor
              key={`${editingCell.elId}-${editingCell.row}-${editingCell.col}`}
              elementId={editingCell.elId}
              row={editingCell.row}
              col={editingCell.col}
              scale={scale}
              onClose={() => setEditingCell(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
