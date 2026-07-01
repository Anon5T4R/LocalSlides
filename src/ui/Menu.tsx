// Generic dropdown menu with separator and submenu (hover-to-open) support.
// Uses the same backdrop pattern as the existing shape-picker.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

export type MenuItemDef =
  | { kind: "item"; label: string; shortcut?: string; icon?: string; onClick: () => void; disabled?: boolean }
  | { kind: "sep" }
  | { kind: "sub"; label: string; icon?: string; items: MenuItemDef[] };

function MenuItems({ items, onClose }: { items: MenuItemDef[]; onClose: () => void }) {
  return (
    <>
      {items.map((item, i) => {
        if (item.kind === "sep") return <div key={i} className="menu-sep" />;
        if (item.kind === "sub") return <SubMenuItem key={i} item={item} onClose={onClose} />;
        return (
          <button
            key={i}
            className="menu-item"
            disabled={item.disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { item.onClick(); onClose(); }}
          >
            {item.icon && <span className="menu-icon">{item.icon}</span>}
            <span className="menu-label">{item.label}</span>
            {item.shortcut && <span className="menu-shortcut">{item.shortcut}</span>}
          </button>
        );
      })}
    </>
  );
}

function SubMenuItem({
  item,
  onClose,
}: {
  item: Extract<MenuItemDef, { kind: "sub" }>;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  // Submenu is position:fixed so it escapes the parent menu's overflow clipping;
  // coords are measured from the trigger row (flip left / clamp to viewport).
  const [coords, setCoords] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    const trig = rowRef.current?.getBoundingClientRect();
    if (!trig) return;
    const pop = popRef.current?.getBoundingClientRect();
    const pw = pop?.width || 200;
    const ph = pop?.height || 0;
    const margin = 8;
    let left = trig.right; // touch the row (no gap → mouse can cross into it)
    if (left + pw > window.innerWidth - margin) left = trig.left - pw; // flip to the left
    left = Math.max(margin, Math.min(left, window.innerWidth - pw - margin));
    let top = trig.top - 4;
    if (ph && top + ph > window.innerHeight - margin) top = window.innerHeight - ph - margin;
    top = Math.max(margin, top);
    setCoords({ left, top });
  }, [open]);

  return (
    <div
      ref={rowRef}
      className={"menu-sub" + (open ? " open" : "")}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button className="menu-item menu-sub-trigger" onMouseDown={(e) => e.preventDefault()}>
        {item.icon && <span className="menu-icon">{item.icon}</span>}
        <span className="menu-label">{item.label}</span>
        <span className="menu-arrow">›</span>
      </button>
      {open && (
        <div
          ref={popRef}
          className="menu-sub-popover"
          style={{
            position: "fixed",
            left: coords?.left ?? -9999,
            top: coords?.top ?? -9999,
            visibility: coords ? "visible" : "hidden",
          }}
        >
          <MenuItems items={item.items} onClose={onClose} />
        </div>
      )}
    </div>
  );
}

export function Menu({
  trigger,
  items,
  align = "left",
  className,
}: {
  trigger: ReactNode;
  items: MenuItemDef[];
  align?: "left" | "right";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [alignRight, setAlignRight] = useState(align === "right");

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Flip to right-aligned if the menu would overflow the right edge.
  useLayoutEffect(() => {
    if (!open) { setAlignRight(align === "right"); return; }
    const r = popRef.current?.getBoundingClientRect();
    if (r && r.right > window.innerWidth - 8) setAlignRight(true);
  }, [open, align]);

  return (
    <div ref={wrapRef} className={"menu-wrap" + (className ? " " + className : "")}>
      <button
        className={"menu-trigger" + (open ? " open" : "")}
        onClick={() => setOpen((v) => !v)}
      >
        {trigger}
      </button>
      {open && (
        <div ref={popRef} className={"menu-popover" + (alignRight ? " align-right" : "")}>
          <MenuItems items={items} onClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
