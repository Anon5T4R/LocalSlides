// Generic dropdown menu with separator and submenu (hover-to-open) support.
// Uses the same backdrop pattern as the existing shape-picker.

import { useEffect, useRef, useState, type ReactNode } from "react";

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
  return (
    <div
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
        <div className="menu-sub-popover">
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

  return (
    <div ref={wrapRef} className={"menu-wrap" + (className ? " " + className : "")}>
      <button
        className={"menu-trigger" + (open ? " open" : "")}
        onClick={() => setOpen((v) => !v)}
      >
        {trigger}
      </button>
      {open && (
        <div className={"menu-popover" + (align === "right" ? " align-right" : "")}>
          <MenuItems items={items} onClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
