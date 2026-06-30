// Custom color picker popover: theme swatches, curated palette, recent colors,
// hex input, and (when available) the browser EyeDropper API.

import { useEffect, useRef, useState } from "react";

// Module-level recent colors, shared across all pickers, capped at 12.
const recent: string[] = [];
function pushRecent(color: string) {
  const norm = color.toLowerCase();
  const idx = recent.indexOf(norm);
  if (idx !== -1) recent.splice(idx, 1);
  recent.unshift(norm);
  if (recent.length > 12) recent.pop();
}

const PALETTE: string[] = [
  "#ffffff", "#f8fafc", "#e2e8f0", "#94a3b8", "#475569", "#1e293b", "#000000",
  "#fca5a5", "#f87171", "#ef4444", "#dc2626", "#b91c1c",
  "#fdba74", "#fb923c", "#f97316", "#ea580c", "#c2410c",
  "#fde68a", "#fbbf24", "#f59e0b", "#d97706", "#b45309",
  "#86efac", "#4ade80", "#22c55e", "#16a34a", "#15803d",
  "#67e8f9", "#22d3ee", "#06b6d4", "#0891b2", "#0e7490",
  "#93c5fd", "#60a5fa", "#3b82f6", "#2563eb", "#1d4ed8",
  "#c4b5fd", "#a78bfa", "#8b5cf6", "#7c3aed", "#6d28d9",
  "#f9a8d4", "#f472b6", "#ec4899", "#db2777", "#be185d",
];

export function ColorPicker({
  value,
  onChange,
  themeColors,
}: {
  value: string;
  onChange: (color: string) => void;
  themeColors?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState(value);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Keep hex input in sync with external value changes.
  useEffect(() => setHex(value), [value]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  const pick = (color: string) => {
    pushRecent(color);
    onChange(color);
    setHex(color);
    setOpen(false);
  };

  const commitHex = () => {
    const norm = hex.startsWith("#") ? hex : `#${hex}`;
    if (/^#[0-9a-fA-F]{6}$/.test(norm)) pick(norm);
  };

  const eyeDrop = async () => {
    // EyeDropper API (Chrome 95+)
    if (!("EyeDropper" in window)) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ed = new (window as any).EyeDropper();
      const result = await ed.open();
      if (result?.sRGBHex) pick(result.sRGBHex);
    } catch {
      // user cancelled
    }
  };

  return (
    <div className="cp-wrap" ref={wrapRef}>
      <button
        className="cp-swatch"
        style={{ background: value }}
        title={value}
        onClick={() => setOpen((v) => !v)}
      />
      {open && (
        <div className="cp-popover">
          {/* Theme colors */}
          {themeColors && themeColors.length > 0 && (
            <div className="cp-section">
              <div className="cp-row">
                {themeColors.map((c) => (
                  <button key={c} className="cp-dot" style={{ background: c }} title={c} onClick={() => pick(c)} />
                ))}
              </div>
            </div>
          )}

          {/* Recent colors */}
          {recent.length > 0 && (
            <div className="cp-section">
              <div className="cp-row-label">Recentes</div>
              <div className="cp-row">
                {recent.map((c) => (
                  <button key={c} className="cp-dot" style={{ background: c }} title={c} onClick={() => pick(c)} />
                ))}
              </div>
            </div>
          )}

          {/* Palette grid */}
          <div className="cp-grid">
            {PALETTE.map((c) => (
              <button
                key={c}
                className={"cp-dot" + (c.toLowerCase() === value.toLowerCase() ? " active" : "")}
                style={{ background: c }}
                title={c}
                onClick={() => pick(c)}
              />
            ))}
          </div>

          {/* Hex input + eyedropper + native picker */}
          <div className="cp-bottom">
            <input
              className="cp-hex"
              type="text"
              value={hex}
              maxLength={7}
              spellCheck={false}
              onChange={(e) => setHex(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") commitHex(); }}
              onBlur={commitHex}
            />
            {"EyeDropper" in window && (
              <button className="cp-eyedrop" title="Conta-gotas" onClick={eyeDrop}>
                💧
              </button>
            )}
            <label className="cp-native" title="Abrir seletor de cores">
              🎨
              <input
                type="color"
                value={value}
                style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
                onChange={(e) => { onChange(e.target.value); setHex(e.target.value); }}
                onBlur={(e) => pushRecent(e.target.value)}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
