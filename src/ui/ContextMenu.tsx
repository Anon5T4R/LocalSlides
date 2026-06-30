// Fixed-position context menu (right-click). Renders at the pointer position
// and adjusts to stay within the viewport. Closes on click-outside or Esc.

import { useEffect, useLayoutEffect, useRef, useState } from "react";

export type CtxItemDef =
  | { kind: "item"; label: string; shortcut?: string; onClick: () => void; disabled?: boolean; danger?: boolean }
  | { kind: "sep" };

export function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: CtxItemDef[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  // Adjust so the menu never clips the viewport.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos({
      x: Math.min(x, window.innerWidth - width - 8),
      y: Math.min(y, window.innerHeight - height - 8),
    });
  }, [x, y]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    // Use capture so the click reaches us before other handlers clear selection.
    window.addEventListener("mousedown", onDown, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div ref={ref} className="ctx-menu" style={{ left: pos.x, top: pos.y }}>
      {items.map((item, i) => {
        if (item.kind === "sep") return <div key={i} className="menu-sep" />;
        return (
          <button
            key={i}
            className={"menu-item" + (item.danger ? " menu-item-danger" : "")}
            disabled={item.disabled}
            onClick={() => { item.onClick(); onClose(); }}
          >
            <span className="menu-label">{item.label}</span>
            {item.shortcut && <span className="menu-shortcut">{item.shortcut}</span>}
          </button>
        );
      })}
    </div>
  );
}
