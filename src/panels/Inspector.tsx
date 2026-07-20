// Right-hand inspector. Shows properties for the single selected element
// (opacity, outline, z-order, animation, per-type options) or, when nothing is
// selected, the current slide's properties (background, transition). Every change
// flows through the store, so all of it is undoable.

import { useState } from "react";
import { t as tr } from "../lib/i18n";
import { useStore } from "../state/store";
import { useUi } from "../state/ui";
import { sectionOpen } from "../lib/sections";
import { Section as BaseSection } from "../components/Section";
import {
  findSlide,
  plainTextToPM,
  pmToPlainText,
  type AnimKind,
  type ChartKind,
  type Element,
  type Fill,
  type GradientStop,
  type ImageAdjust,
  type ImageEl,
  type ShapeKind,
  type StrokeStyle,
  type TableCellStyle,
  type TableEl,
  type TransitionKind,
} from "../model/deck";
import { THEME_PRESETS, findThemePreset, themeName } from "../model/themes";
import { LAYOUTS, layoutName } from "../model/layouts";
import { ColorPicker } from "../ui/ColorPicker";
import { TEXT_EFFECT_PRESETS } from "../render/textEffects";
import { loadBrandKits, saveBrandKit, removeBrandKit, type BrandKit } from "../lib/brandKit";
import { ensureModelLoaded, removeBackground } from "../lib/backgroundRemoval";
import { expandRectToWholeCells, isMergedMaster, mergeCells, splitCell } from "../model/tableOps";

const ANIMS = (): { value: AnimKind; label: string }[] => [
  { value: "none", label: tr("insp.none") },
  { value: "fadeIn", label: tr("insp.anim.fadeIn") },
  { value: "slideUp", label: tr("insp.anim.slideUp") },
  { value: "slideLeft", label: tr("insp.anim.slideLeft") },
  { value: "zoomIn", label: tr("insp.anim.zoomIn") },
  { value: "bounceIn", label: tr("insp.anim.bounceIn") },
  { value: "flipIn", label: tr("insp.anim.flipIn") },
];

/** Onda 12 — "Animar página": apply one preset to every element on the slide
 * at once, with an automatic stagger so they cascade in during Present mode. */
const PAGE_ANIM_PRESETS = (): { id: string; label: string; kind: AnimKind; duration: number; stagger: number }[] => [
  { id: "dissolve", label: tr("insp.pageAnim.dissolve"), kind: "fadeIn", duration: 0.6, stagger: 0.08 },
  { id: "slide", label: tr("insp.slide"), kind: "slideLeft", duration: 0.5, stagger: 0.1 },
  { id: "cascade", label: tr("insp.pageAnim.cascade"), kind: "slideUp", duration: 0.5, stagger: 0.15 },
];

const TRANSITIONS = (): { value: TransitionKind; label: string }[] => [
  { value: "none", label: tr("insp.none") },
  { value: "fade", label: tr("insp.transition.fade") },
  { value: "slide", label: tr("insp.slide") },
  { value: "push", label: tr("insp.transition.push") },
];

const STROKE_STYLES = (): { value: StrokeStyle; label: string }[] => [
  { value: "solid", label: tr("insp.stroke.solid") },
  { value: "dash", label: tr("insp.stroke.dash") },
  { value: "dot", label: tr("insp.stroke.dot") },
  { value: "chalk", label: tr("insp.stroke.chalk") },
  { value: "smudge", label: tr("insp.stroke.smudge") },
];

const ADJUST_SLIDERS = (): {
  k: keyof ImageAdjust;
  label: string;
  min: number;
  max: number;
  neutral: number;
  suffix: string;
}[] => [
  { k: "brightness", label: tr("insp.adjust.brightness"), min: 0, max: 200, neutral: 100, suffix: "%" },
  { k: "contrast", label: tr("insp.adjust.contrast"), min: 0, max: 200, neutral: 100, suffix: "%" },
  { k: "saturate", label: tr("insp.adjust.saturate"), min: 0, max: 200, neutral: 100, suffix: "%" },
  { k: "hueRotate", label: tr("insp.adjust.hueRotate"), min: 0, max: 360, neutral: 0, suffix: "°" },
  { k: "grayscale", label: tr("insp.adjust.grayscale"), min: 0, max: 100, neutral: 0, suffix: "%" },
  { k: "sepia", label: tr("insp.adjust.sepia"), min: 0, max: 100, neutral: 0, suffix: "%" },
  { k: "blur", label: tr("insp.adjust.blur"), min: 0, max: 20, neutral: 0, suffix: "px" },
];

/** Shapes that can be used as an image mask silhouette (clip-path). */
const MASK_SHAPES = (): { value: "" | ShapeKind; label: string }[] => [
  { value: "", label: tr("insp.none") },
  { value: "ellipse", label: tr("insp.mask.ellipse") },
  { value: "roundRect", label: tr("insp.roundRect") },
  { value: "triangle", label: tr("insp.triangle") },
  { value: "diamond", label: tr("insp.diamond") },
  { value: "pentagon", label: tr("insp.pentagon") },
  { value: "hexagon", label: tr("insp.hexagon") },
  { value: "star", label: tr("insp.star") },
];

const SHAPES = (): { value: ShapeKind; label: string }[] => [
  { value: "rect", label: tr("insp.shape.rect") },
  { value: "roundRect", label: tr("insp.roundRect") },
  { value: "ellipse", label: tr("insp.shape.ellipse") },
  { value: "triangle", label: tr("insp.triangle") },
  { value: "diamond", label: tr("insp.diamond") },
  { value: "pentagon", label: tr("insp.pentagon") },
  { value: "hexagon", label: tr("insp.hexagon") },
  { value: "star", label: tr("insp.star") },
  { value: "arrow", label: tr("insp.shape.arrow") },
  { value: "doubleArrow", label: tr("insp.shape.doubleArrow") },
  { value: "chevron", label: tr("insp.shape.chevron") },
  { value: "line", label: tr("insp.shape.line") },
  { value: "speech", label: tr("insp.shape.speech") },
  { value: "thought", label: tr("insp.shape.thought") },
];

/** Open a file picker and resolve to an image data URL (works in browser + Tauri). */
function pickImageDataUrl(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    };
    input.click();
  });
}

/** Current stops for a gradient fill (falls back to its from/to endpoints). */
function gradientStops(g: Extract<Fill, { kind: "gradient" }>): GradientStop[] {
  if (g.stops && g.stops.length >= 2) return g.stops;
  return [
    { color: g.from, pos: 0 },
    { color: g.to, pos: 100 },
  ];
}

/**
 * Unified fill editor: solid / gradient (linear|radial, multi-stop) / image / none.
 * Renders its own rows. `onChange(undefined)` is used by the "tema" reset option.
 */
function FillEditor({
  value,
  onChange,
  themeColors,
  allowNone = true,
  allowImage = false,
  themeLabel,
}: {
  value: Fill | undefined;
  onChange: (f: Fill | undefined) => void;
  themeColors: string[];
  allowNone?: boolean;
  allowImage?: boolean;
  themeLabel?: string;
}) {
  const kind = value ? value.kind : themeLabel ? "theme" : "none";

  const onKind = async (next: string) => {
    if (next === "theme") return onChange(undefined);
    if (next === "none") return onChange({ kind: "none" });
    if (next === "solid") {
      const color = value?.kind === "solid" ? value.color : value?.kind === "gradient" ? value.from : "#2563eb";
      return onChange({ kind: "solid", color });
    }
    if (next === "gradient") {
      const from = value?.kind === "solid" ? value.color : "#2563eb";
      return onChange({ kind: "gradient", from, to: "#0ea5e9", angle: 135 });
    }
    if (next === "image") {
      const src = await pickImageDataUrl();
      if (src) onChange({ kind: "image", src, fit: "cover" });
    }
  };

  const setGradient = (patch: Partial<Extract<Fill, { kind: "gradient" }>>) => {
    if (value?.kind !== "gradient") return;
    onChange({ ...value, ...patch });
  };
  const setStops = (stops: GradientStop[]) => {
    // Keep from/to synced to the endpoints for export fallbacks.
    const sorted = [...stops].sort((a, b) => a.pos - b.pos);
    setGradient({ stops: sorted, from: sorted[0].color, to: sorted[sorted.length - 1].color });
  };

  return (
    <>
      <Row label={tr("insp.fill")}>
        <select value={kind} onChange={(e) => onKind(e.target.value)}>
          {themeLabel && <option value="theme">{themeLabel}</option>}
          {allowNone && <option value="none">{tr("insp.fillNone")}</option>}
          <option value="solid">{tr("insp.fillSolid")}</option>
          <option value="gradient">{tr("insp.fillGradient")}</option>
          {allowImage && <option value="image">{tr("insp.image")}</option>}
        </select>
      </Row>

      {value?.kind === "solid" && (
        <Row label={tr("insp.color")}>
          <ColorPicker value={value.color} themeColors={themeColors} onChange={(c) => onChange({ kind: "solid", color: c })} />
        </Row>
      )}

      {value?.kind === "gradient" && (
        <>
          <Row label={tr("insp.type")}>
            <select value={value.radial ? "radial" : "linear"} onChange={(e) => setGradient({ radial: e.target.value === "radial" })}>
              <option value="linear">{tr("insp.linear")}</option>
              <option value="radial">{tr("insp.radial")}</option>
            </select>
          </Row>
          {!value.radial && (
            <Row label={tr("insp.angleDeg")}>
              <input type="number" min={0} max={360} value={value.angle} onChange={(e) => setGradient({ angle: Number(e.target.value) })} />
            </Row>
          )}
          {gradientStops(value).map((stop, i, arr) => (
            <Row key={i} label={i === 0 ? tr("insp.colors") : ""}>
              <span className="insp-stop">
                <ColorPicker
                  value={stop.color}
                  themeColors={themeColors}
                  onChange={(c) => {
                    const next = gradientStops(value).map((s, j) => (j === i ? { ...s, color: c } : s));
                    setStops(next);
                  }}
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="insp-stop-pos"
                  value={stop.pos}
                  onChange={(e) => {
                    const next = gradientStops(value).map((s, j) => (j === i ? { ...s, pos: Number(e.target.value) } : s));
                    setStops(next);
                  }}
                />
                {arr.length > 2 && (
                  <button
                    className="insp-mini"
                    title={tr("insp.removeColor")}
                    onClick={() => setStops(gradientStops(value).filter((_, j) => j !== i))}
                  >
                    −
                  </button>
                )}
              </span>
            </Row>
          ))}
          <button
            className="insp-mini"
            onClick={() => {
              const stops = gradientStops(value);
              const mid = { color: stops[stops.length - 1].color, pos: Math.round((stops[stops.length - 2].pos + stops[stops.length - 1].pos) / 2) };
              setStops([...stops, mid]);
            }}
          >
            {tr("insp.addColor")}
          </button>
        </>
      )}

      {value?.kind === "image" && (
        <>
          <Row label={tr("insp.fit")}>
            <select value={value.fit ?? "cover"} onChange={(e) => onChange({ ...value, fit: e.target.value as "cover" | "contain" })}>
              <option value="cover">{tr("insp.fitCover")}</option>
              <option value="contain">{tr("insp.fitContain")}</option>
            </select>
          </Row>
          <Row label={tr("insp.image")}>
            <button
              className="insp-mini"
              onClick={async () => {
                const src = await pickImageDataUrl();
                if (src) onChange({ kind: "image", src, fit: value.fit ?? "cover" });
              }}
            >
              {tr("insp.replace")}
            </button>
          </Row>
        </>
      )}
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="insp-row">
      <span className="insp-label">{label}</span>
      <span className="insp-control">{children}</span>
    </label>
  );
}

/**
 * Uma seção do inspetor — adaptador entre o `Section` genérico (padrão B9 da
 * suíte, `components/Section.tsx`, cópia literal do LocalVideo) e este app.
 *
 * O que existia aqui antes já recolhia, mas tinha três furos:
 *
 * 1. **`useState` local.** O estado morria a cada troca de seleção: as seções
 *    de texto (Efeitos) e de imagem (Ajustes) são condicionais ao tipo do
 *    elemento, então clicar num elemento de outro tipo REMONTA a seção e ela
 *    volta ao padrão. Quem organiza o painel do jeito que gosta via tudo
 *    desmanchar ao trocar de slide.
 * 2. **Nada persistia** entre sessões.
 * 3. **Zero ARIA.** O cabeçalho era `<button>` (isso estava certo), mas sem
 *    `aria-expanded` um leitor de tela anuncia "botão Efeitos" e não tem como
 *    saber se aquilo está aberto ou fechado — nem que é um controle de
 *    expansão.
 *
 * `active` = a propriedade desta seção saiu do neutro. É o que faz a seção
 * nascer aberta e ganhar o ponto "em uso", que continua visível com ela
 * FECHADA — é isso que torna seguro persistir a escolha do usuário sem
 * esconder estado.
 */
function Section({
  id,
  title,
  active,
  summary,
  children,
}: {
  id: string;
  title: string;
  active?: boolean;
  summary?: string;
  children: React.ReactNode;
}) {
  const sections = useUi((s) => s.sections);
  const toggleSection = useUi((s) => s.toggleSection);
  return (
    <BaseSection
      id={id}
      title={title}
      active={active}
      summary={summary}
      open={sectionOpen(sections, id, !!active)}
      onToggle={toggleSection}
    >
      {children}
    </BaseSection>
  );
}

function typeLabel(el: Element): string {
  return el.type === "text"
    ? tr("insp.typeText")
    : el.type === "image"
    ? tr("insp.image")
    : el.type === "video"
    ? tr("insp.typeVideo")
    : el.type === "table"
    ? tr("insp.typeTable")
    : el.type === "ink"
    ? tr("insp.typeInk")
    : el.type === "chart"
    ? tr("insp.typeChart")
    : el.type === "icon"
    ? tr("insp.typeIcon")
    : tr("insp.typeShape");
}

const CHART_KINDS = (): { value: ChartKind; label: string }[] => [
  { value: "bar", label: tr("insp.chart.bar") },
  { value: "stackedBar", label: tr("insp.chart.stackedBar") },
  { value: "line", label: tr("insp.chart.line") },
  { value: "area", label: tr("insp.chart.area") },
  { value: "pie", label: tr("insp.chart.pie") },
  { value: "donut", label: tr("insp.chart.donut") },
];

const isPieLikeChart = (k: ChartKind) => k === "pie" || k === "donut";

/** Onda 15.1 — "Remover fundo" button + model-picker state for image elements. */
function BackgroundRemoveRow({
  el,
  set,
}: {
  el: ImageEl;
  set: (recipe: (e: Element) => void) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const ok = await ensureModelLoaded();
      if (!ok) return; // user cancelled the file picker
      const src = await removeBackground(el.src);
      set((x) => x.type === "image" && (x.src = src));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Row label={tr("insp.background")}>
      <div className="insp-zorder">
        <button className="insp-mini" onClick={run} disabled={busy} title={tr("insp.removeBgTitle")}>
          {busy ? tr("insp.processing") : tr("insp.removeBg")}
        </button>
      </div>
      {error && <p className="insp-bgremove-error">{error}</p>}
    </Row>
  );
}

/**
 * Mini grid mirroring the table structure: click a cell to select it, shift+click
 * to extend a rectangle. "Mesclar"/"Dividir" operate on the (expanded) selection;
 * fill/color/negrito/alinhar apply per-cell style to every master cell inside it.
 */
function TableStructureEditor({
  el,
  set,
  accent,
}: {
  el: TableEl;
  set: (recipe: (e: Element) => void) => void;
  accent: string;
}) {
  const [sel, setSel] = useState<{ r0: number; c0: number; r1: number; c1: number } | null>(null);

  const nRows = el.rows.length;
  const nCols = el.rows[0]?.length ?? 1;

  const masterOf = (r: number, c: number): [number, number] => {
    for (let rr = r; rr >= 0; rr--) {
      for (let cc = c; cc >= 0; cc--) {
        const cell = el.rows[rr]?.[cc];
        if (!cell || cell.covered) continue;
        const cs = cell.colSpan ?? 1;
        const rs = cell.rowSpan ?? 1;
        if (rr + rs > r && cc + cs > c) return [rr, cc];
      }
    }
    return [r, c];
  };

  const clickCell = (r: number, c: number, shift: boolean) => {
    const [mr, mc] = masterOf(r, c);
    setSel((prev) => (shift && prev ? { r0: prev.r0, c0: prev.c0, r1: mr, c1: mc } : { r0: mr, c0: mc, r1: mr, c1: mc }));
  };

  const rect = sel ? expandRectToWholeCells(el, sel.r0, sel.c0, sel.r1, sel.c1) : null;
  const [minR, minC, maxR, maxC] = rect ?? [0, 0, 0, 0];
  const canMerge = !!rect && (minR !== maxR || minC !== maxC);
  const canSplit = !!rect && isMergedMaster(el, minR, minC);

  const applyCellStyle = (patch: Partial<TableCellStyle>) => {
    if (!rect) return;
    set((e) => {
      if (e.type !== "table") return;
      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          const cell = e.rows[r]?.[c];
          if (!cell || cell.covered) continue;
          cell.style = { ...cell.style, ...patch };
        }
      }
    });
  };

  const selCell = rect ? el.rows[minR]?.[minC] : undefined;

  return (
    <>
      <Row label={tr("insp.cells")}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${nCols}, 20px)`,
            gridTemplateRows: `repeat(${nRows}, 20px)`,
            gap: 2,
          }}
        >
          {el.rows.map((row, r) =>
            row.map((cell, c) => {
              if (cell.covered) return null;
              const cs = cell.colSpan ?? 1;
              const rs = cell.rowSpan ?? 1;
              const inSel = !!rect && r >= minR && r <= maxR && c >= minC && c <= maxC;
              return (
                <div
                  key={`${r}-${c}`}
                  onClick={(e) => clickCell(r, c, e.shiftKey)}
                  title={tr("insp.cellPos", { row: r + 1, col: c + 1 })}
                  style={{
                    gridColumn: `${c + 1} / span ${cs}`,
                    gridRow: `${r + 1} / span ${rs}`,
                    border: `1px solid ${inSel ? accent : "#cbd5e1"}`,
                    background: inSel ? `${accent}33` : "#f1f5f9",
                    cursor: "pointer",
                    boxSizing: "border-box",
                  }}
                />
              );
            })
          )}
        </div>
      </Row>
      <Row label={tr("insp.mergeSplit")}>
        <div className="insp-zorder">
          <button className="insp-mini" disabled={!canMerge} onClick={() => set((e) => e.type === "table" && mergeCells(e, minR, minC, maxR, maxC))}>
            {tr("insp.merge")}
          </button>
          <button className="insp-mini" disabled={!canSplit} onClick={() => set((e) => e.type === "table" && splitCell(e, minR, minC))}>
            {tr("insp.split")}
          </button>
        </div>
      </Row>
      {rect && (
        <>
          <Row label={tr("insp.cellFill")}>
            <ColorPicker
              value={selCell?.style?.fill ?? "#ffffff"}
              themeColors={[]}
              onChange={(c) => applyCellStyle({ fill: c })}
            />
          </Row>
          <Row label={tr("insp.textColor")}>
            <ColorPicker
              value={selCell?.style?.color ?? "#000000"}
              themeColors={[]}
              onChange={(c) => applyCellStyle({ color: c })}
            />
          </Row>
          <Row label={tr("insp.bold")}>
            <input
              type="checkbox"
              checked={!!selCell?.style?.bold}
              onChange={(e) => applyCellStyle({ bold: e.target.checked })}
            />
          </Row>
          <Row label={tr("insp.align")}>
            <select
              value={selCell?.style?.align ?? "left"}
              onChange={(e) => applyCellStyle({ align: e.target.value as TableCellStyle["align"] })}
            >
              <option value="left">{tr("insp.alignLeft")}</option>
              <option value="center">{tr("insp.alignCenter")}</option>
              <option value="right">{tr("insp.alignRight")}</option>
            </select>
          </Row>
        </>
      )}
    </>
  );
}

function ElementInspector({ el }: { el: Element }) {
  const updateElement = useStore((s) => s.updateElement);
  const reorder = useStore((s) => s.reorder);
  const deleteElements = useStore((s) => s.deleteElements);
  const setCropping = useStore((s) => s.setCropping);
  const theme = useStore((s) => s.deck.theme);
  const themeColors = Object.values(theme.colors) as string[];
  const copyStyle = useStore((s) => s.copyStyle);
  const pasteStyle = useStore((s) => s.pasteStyle);
  const styleClipboardSize = useStore((s) => s.styleClipboardSize);

  const set = (recipe: (e: Element) => void) => updateElement(el.id, recipe);

  return (
    <>
      <div className="insp-head">{typeLabel(el)}</div>

      <div className="insp-zorder">
        <button className="insp-mini" onClick={copyStyle} title={tr("insp.copyStyleTitle")}>
          {tr("insp.copyStyle")}
        </button>
        <button
          className="insp-mini"
          onClick={pasteStyle}
          disabled={!styleClipboardSize}
          title={tr("insp.pasteStyleTitle")}
        >
          {tr("insp.pasteStyle")}
        </button>
      </div>

      {/* Position & size */}
      {/* O miolo do elemento selecionado: nasce SEMPRE aberta (o B9 é
          explícito em não colapsar o miolo da tarefa). */}
      <Section id="posSize" title={tr("insp.posSize")} active>
        <div className="insp-geom-grid">
          <label className="insp-geom-cell">
            <span className="insp-geom-label">X</span>
            <input
              type="number"
              className="insp-geom-input"
              value={Math.round(el.geom.x)}
              disabled={!!el.locked}
              onChange={(e) => set((x) => { x.geom.x = Number(e.target.value); })}
            />
          </label>
          <label className="insp-geom-cell">
            <span className="insp-geom-label">Y</span>
            <input
              type="number"
              className="insp-geom-input"
              value={Math.round(el.geom.y)}
              disabled={!!el.locked}
              onChange={(e) => set((x) => { x.geom.y = Number(e.target.value); })}
            />
          </label>
          <label className="insp-geom-cell">
            <span className="insp-geom-label">{tr("insp.geomW")}</span>
            <input
              type="number"
              className="insp-geom-input"
              min={24}
              value={Math.round(el.geom.w)}
              disabled={!!el.locked}
              onChange={(e) => set((x) => { x.geom.w = Math.max(24, Number(e.target.value)); })}
            />
          </label>
          <label className="insp-geom-cell">
            <span className="insp-geom-label">{tr("insp.geomH")}</span>
            <input
              type="number"
              className="insp-geom-input"
              min={24}
              value={Math.round(el.geom.h)}
              disabled={!!el.locked}
              onChange={(e) => set((x) => { x.geom.h = Math.max(24, Number(e.target.value)); })}
            />
          </label>
          <label className="insp-geom-cell insp-geom-rot">
            <span className="insp-geom-label">°</span>
            <input
              type="number"
              className="insp-geom-input"
              value={Math.round(el.geom.rotation ?? 0)}
              disabled={!!el.locked}
              onChange={(e) => set((x) => { x.geom.rotation = ((Number(e.target.value) % 360) + 360) % 360; })}
            />
          </label>
        </div>
      </Section>

      <Row label={tr("insp.opacity")}>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round((el.opacity ?? 1) * 100)}
          onChange={(e) => set((x) => (x.opacity = Number(e.target.value) / 100))}
        />
        <span className="insp-num">{Math.round((el.opacity ?? 1) * 100)}%</span>
      </Row>

      <Row label={tr("insp.altText")}>
        <input
          type="text"
          value={el.alt ?? ""}
          placeholder={tr("insp.altPlaceholder")}
          onChange={(e) => set((x) => (x.alt = e.target.value || undefined))}
        />
      </Row>

      {/* Outline ("contorno") */}
      <Row label={tr("insp.outline")}>
        <input
          type="checkbox"
          checked={!!el.outline}
          onChange={(e) =>
            set((x) => (x.outline = e.target.checked ? { color: "#1e293b", width: 3 } : undefined))
          }
        />
      </Row>
      {el.outline && (
        <>
          <Row label={tr("insp.outlineColor")}>
            <ColorPicker
              value={el.outline.color}
              themeColors={themeColors}
              onChange={(c) => set((x) => x.outline && (x.outline.color = c))}
            />
          </Row>
          <Row label={tr("insp.thickness")}>
            <input
              type="range"
              min={1}
              max={24}
              value={el.outline.width}
              onChange={(e) => set((x) => x.outline && (x.outline.width = Number(e.target.value)))}
            />
            <span className="insp-num">{el.outline.width}px</span>
          </Row>
          <Row label={tr("insp.style")}>
            <select
              value={el.outline.style ?? el.outline.dash ?? "solid"}
              onChange={(e) => set((x) => x.outline && (x.outline.style = e.target.value as StrokeStyle))}
            >
              {STROKE_STYLES().map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Row>
        </>
      )}

      {/* Shadow */}
      <Row label={tr("insp.shadow")}>
        <input
          type="checkbox"
          checked={!!el.shadow}
          onChange={(e) =>
            set((x) => (x.shadow = e.target.checked ? { color: "#00000066", blur: 8, x: 4, y: 4 } : undefined))
          }
        />
      </Row>
      {el.shadow && (
        <>
          <Row label={tr("insp.shadowColor")}>
            <ColorPicker
              value={el.shadow.color}
              themeColors={themeColors}
              onChange={(c) => set((x) => x.shadow && (x.shadow.color = c))}
            />
          </Row>
          <Row label={tr("insp.shadowBlur")}>
            <input
              type="range"
              min={0}
              max={60}
              value={el.shadow.blur}
              onChange={(e) => set((x) => x.shadow && (x.shadow.blur = Number(e.target.value)))}
            />
            <span className="insp-num">{el.shadow.blur}px</span>
          </Row>
          <Row label={tr("insp.shadowOffsetX")}>
            <input
              type="range"
              min={-40}
              max={40}
              value={el.shadow.x}
              onChange={(e) => set((x) => x.shadow && (x.shadow.x = Number(e.target.value)))}
            />
            <span className="insp-num">{el.shadow.x}px</span>
          </Row>
          <Row label={tr("insp.shadowOffsetY")}>
            <input
              type="range"
              min={-40}
              max={40}
              value={el.shadow.y}
              onChange={(e) => set((x) => x.shadow && (x.shadow.y = Number(e.target.value)))}
            />
            <span className="insp-num">{el.shadow.y}px</span>
          </Row>
        </>
      )}

      {/* Text box fill */}
      {el.type === "text" && (
        <FillEditor
          value={el.fill}
          onChange={(f) => set((x) => x.type === "text" && (x.fill = f))}
          themeColors={themeColors}
          allowNone
          allowImage
        />
      )}

      {/* Text effects (Onda 10).
          Fora do neutro = tem efeito aplicado. Um efeito ligado muda como o
          texto aparece; esconder isso é esconder o porquê. */}
      {el.type === "text" && (
        <Section
          id="effects"
          title={tr("insp.effects")}
          active={(el.effect?.kind ?? "none") !== "none"}
        >
          <div className="insp-effect-grid">
            {TEXT_EFFECT_PRESETS.map((p) => (
              <button
                key={p.kind}
                className={"insp-effect-btn" + ((el.effect?.kind ?? "none") === p.kind ? " active" : "")}
                onClick={() =>
                  set(
                    (x) =>
                      x.type === "text" &&
                      (x.effect = p.kind === "none" ? undefined : { kind: p.kind, intensity: 50, color: x.effect?.color })
                  )
                }
              >
                {p.label}
              </button>
            ))}
          </div>
          {el.effect && el.effect.kind !== "none" && (
            <>
              <Row label={el.effect.kind === "gradient" ? tr("insp.angle") : tr("insp.intensity")}>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={el.effect.intensity ?? 50}
                  onChange={(e) =>
                    set((x) => x.type === "text" && x.effect && (x.effect.intensity = Number(e.target.value)))
                  }
                />
              </Row>
              {["splice", "echo", "neon", "glow"].includes(el.effect.kind) && (
                <Row label={tr("insp.color")}>
                  <ColorPicker
                    value={el.effect.color ?? theme.colors.accent1}
                    themeColors={themeColors}
                    onChange={(c) => set((x) => x.type === "text" && x.effect && (x.effect.color = c))}
                  />
                </Row>
              )}
              {el.effect.kind === "gradient" && (
                <>
                  <Row label={tr("insp.colorStart")}>
                    <ColorPicker
                      value={el.effect.color ?? theme.colors.accent1}
                      themeColors={themeColors}
                      onChange={(c) => set((x) => x.type === "text" && x.effect && (x.effect.color = c))}
                    />
                  </Row>
                  <Row label={tr("insp.colorEnd")}>
                    <ColorPicker
                      value={el.effect.color2 ?? theme.colors.accent2}
                      themeColors={themeColors}
                      onChange={(c) => set((x) => x.type === "text" && x.effect && (x.effect.color2 = c))}
                    />
                  </Row>
                </>
              )}
            </>
          )}
          <Row label={tr("insp.curve")}>
            <input
              type="range"
              min={-100}
              max={100}
              value={el.curve ?? 0}
              onChange={(e) => {
                const v = Number(e.target.value);
                set((x) => x.type === "text" && (x.curve = Math.abs(v) < 2 ? undefined : v));
              }}
            />
            <span className="insp-num">{el.curve ?? 0}</span>
          </Row>
        </Section>
      )}

      {/* Animation */}
      <Row label={tr("insp.animation")}>
        <select
          value={el.anim?.kind ?? "none"}
          onChange={(e) => {
            const kind = e.target.value as AnimKind;
            set((x) => (x.anim = kind === "none" ? undefined : { kind, duration: 0.5, delay: 0 }));
          }}
        >
          {ANIMS().map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
      </Row>
      {el.anim && (
        <Row label={tr("insp.delaySeconds")}>
          <input
            type="number"
            min={0}
            step={0.1}
            value={el.anim.delay}
            onChange={(e) => set((x) => x.anim && (x.anim.delay = Number(e.target.value)))}
          />
        </Row>
      )}

      {/* Per-type options */}
      {el.type === "text" && (
        <>
          <Row label={tr("insp.vAlign")}>
            <select
              value={el.vAlign ?? "top"}
              onChange={(e) =>
                set((x) => x.type === "text" && (x.vAlign = e.target.value as "top" | "middle" | "bottom"))
              }
            >
              <option value="top">{tr("insp.vAlignTop")}</option>
              <option value="middle">{tr("insp.vAlignMiddle")}</option>
              <option value="bottom">{tr("insp.vAlignBottom")}</option>
            </select>
          </Row>
          <Row label={tr("insp.autoFit")}>
            <input
              type="checkbox"
              checked={el.autoFit !== false}
              onChange={(e) => set((x) => x.type === "text" && (x.autoFit = e.target.checked))}
            />
          </Row>
        </>
      )}

      {(el.type === "image" || el.type === "video") && (
        <Row label={tr("insp.fit")}>
          <select
            value={el.fit ?? "contain"}
            onChange={(e) =>
              set((x) => (x.type === "image" || x.type === "video") && (x.fit = e.target.value as "contain" | "cover"))
            }
          >
            <option value="contain">{tr("insp.fitContain")}</option>
            <option value="cover">{tr("insp.fitCover")}</option>
          </select>
        </Row>
      )}

      {el.type === "image" && (
        <Row label={tr("insp.crop")}>
          <div className="insp-zorder">
            <button className="insp-mini" onClick={() => setCropping(el.id)} title={tr("insp.cropTitle")}>
              {tr("insp.cropBtn")}
            </button>
            {el.crop && (
              <button
                className="insp-mini"
                onClick={() => set((x) => x.type === "image" && (x.crop = undefined))}
                title={tr("insp.removeCropTitle")}
              >
                {tr("insp.remove")}
              </button>
            )}
          </div>
        </Row>
      )}

      {el.type === "image" && <BackgroundRemoveRow el={el} set={set} />}

      {el.type === "image" && (
        <Row label={tr("insp.mask")}>
          <select
            value={el.maskShape ?? ""}
            onChange={(e) =>
              set((x) => x.type === "image" && (x.maskShape = (e.target.value || undefined) as ShapeKind | undefined))
            }
          >
            {MASK_SHAPES().map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Row>
      )}

      {el.type === "image" && (
        <Section
          id="imageAdjust"
          title={tr("insp.imageAdjust")}
          active={ADJUST_SLIDERS().some((sl) => (el.adjust?.[sl.k] ?? sl.neutral) !== sl.neutral)}
        >
          {ADJUST_SLIDERS().map((s) => {
            const v = el.adjust?.[s.k] ?? s.neutral;
            return (
              <Row key={s.k} label={s.label}>
                <input
                  type="range"
                  min={s.min}
                  max={s.max}
                  value={v}
                  onChange={(e) =>
                    set((x) => {
                      if (x.type !== "image") return;
                      const value = Number(e.target.value);
                      const adj = { ...(x.adjust ?? {}) };
                      if (value === s.neutral) delete adj[s.k];
                      else adj[s.k] = value;
                      x.adjust = Object.keys(adj).length ? adj : undefined;
                    })
                  }
                />
                <span className="insp-num">{v}{s.suffix}</span>
              </Row>
            );
          })}
          {el.adjust && (
            <button className="insp-mini" onClick={() => set((x) => x.type === "image" && (x.adjust = undefined))}>
              {tr("insp.resetAdjust")}
            </button>
          )}
        </Section>
      )}

      {el.type === "video" && (
        <>
          <Row label={tr("insp.autoplay")}>
            <input
              type="checkbox"
              checked={!!el.autoplay}
              onChange={(e) => set((x) => x.type === "video" && (x.autoplay = e.target.checked))}
            />
          </Row>
          <Row label={tr("insp.loop")}>
            <input
              type="checkbox"
              checked={!!el.loop}
              onChange={(e) => set((x) => x.type === "video" && (x.loop = e.target.checked))}
            />
          </Row>
          <Row label={tr("insp.muted")}>
            <input
              type="checkbox"
              checked={!!el.muted}
              onChange={(e) => set((x) => x.type === "video" && (x.muted = e.target.checked))}
            />
          </Row>
        </>
      )}

      {el.type === "shape" && (
        <>
          <Row label={tr("insp.shapeLabel")}>
            <select
              value={el.shape}
              onChange={(e) => set((x) => x.type === "shape" && (x.shape = e.target.value as ShapeKind))}
            >
              {SHAPES().map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Row>
          <FillEditor
            value={el.fill}
            onChange={(f) => set((x) => x.type === "shape" && (x.fill = f ?? { kind: "none" }))}
            themeColors={themeColors}
            allowNone
            allowImage
          />
          <Row label={tr("insp.stroke")}>
            <input
              type="checkbox"
              checked={!!el.stroke}
              onChange={(e) =>
                set((x) => x.type === "shape" && (x.stroke = e.target.checked ? { color: "#1e293b", width: 3 } : undefined))
              }
            />
          </Row>
          {el.stroke && (
            <>
              <Row label={tr("insp.strokeColor")}>
                <ColorPicker
                  value={el.stroke.color}
                  themeColors={themeColors}
                  onChange={(c) => set((x) => x.type === "shape" && x.stroke && (x.stroke.color = c))}
                />
              </Row>
              <Row label={tr("insp.thickness")}>
                <input
                  type="range"
                  min={1}
                  max={32}
                  value={el.stroke.width}
                  onChange={(e) => set((x) => x.type === "shape" && x.stroke && (x.stroke.width = Number(e.target.value)))}
                />
                <span className="insp-num">{el.stroke.width}px</span>
              </Row>
              <Row label={tr("insp.style")}>
                <select
                  value={el.stroke.style ?? el.stroke.dash ?? "solid"}
                  onChange={(e) => set((x) => x.type === "shape" && x.stroke && (x.stroke.style = e.target.value as StrokeStyle))}
                >
                  {STROKE_STYLES().map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </Row>
            </>
          )}
        </>
      )}

      {el.type === "table" && (
        <>
          <div className="insp-head">{tr("insp.tableHead")}</div>
          <Row label={tr("insp.rows")}>
            <div className="insp-zorder">
              <button
                onClick={() =>
                  set((x) => {
                    if (x.type !== "table") return;
                    const cols = x.rows[0]?.length ?? 1;
                    x.rows.push(Array.from({ length: cols }, () => ({ content: plainTextToPM("") })));
                  })
                }
              >
                +
              </button>
              <button
                onClick={() => set((x) => x.type === "table" && x.rows.length > 1 && void x.rows.pop())}
              >
                −
              </button>
            </div>
          </Row>
          <Row label={tr("insp.columns")}>
            <div className="insp-zorder">
              <button
                onClick={() =>
                  set((x) => x.type === "table" && x.rows.forEach((r) => r.push({ content: plainTextToPM("") })))
                }
              >
                +
              </button>
              <button
                onClick={() =>
                  set(
                    (x) =>
                      x.type === "table" &&
                      (x.rows[0]?.length ?? 0) > 1 &&
                      x.rows.forEach((r) => r.pop())
                  )
                }
              >
                −
              </button>
            </div>
          </Row>
          <Row label={tr("insp.header")}>
            <ColorPicker
              value={el.headerFill ?? "#2563eb"}
              themeColors={themeColors}
              onChange={(c) => set((x) => x.type === "table" && (x.headerFill = c))}
            />
          </Row>
          <Row label={tr("insp.zebra")}>
            <input
              type="checkbox"
              checked={!!el.zebra}
              onChange={(e) => set((x) => x.type === "table" && (x.zebra = e.target.checked))}
            />
          </Row>
          <TableStructureEditor el={el} set={set} accent={theme.colors.accent1} />
        </>
      )}

      {el.type === "icon" && (
        <Row label={tr("insp.iconColor")}>
          <ColorPicker
            value={el.color ?? themeColors[2] ?? "#2563eb"}
            themeColors={themeColors}
            onChange={(c) => set((x) => x.type === "icon" && (x.color = c))}
          />
        </Row>
      )}

      {el.type === "chart" && (
        <>
          <div className="insp-head">{tr("insp.chartHead")}</div>
          <Row label={tr("insp.type")}>
            <select
              value={el.chart}
              onChange={(e) => set((x) => x.type === "chart" && (x.chart = e.target.value as ChartKind))}
            >
              {CHART_KINDS().map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </Row>
          <Row label={tr("insp.title")}>
            <input
              type="text"
              value={el.title ?? ""}
              placeholder={tr("insp.titlePlaceholder")}
              onChange={(e) => set((x) => x.type === "chart" && (x.title = e.target.value))}
            />
          </Row>
          <Row label={tr("insp.legend")}>
            <input
              type="checkbox"
              checked={el.showLegend !== false}
              onChange={(e) => set((x) => x.type === "chart" && (x.showLegend = e.target.checked))}
            />
          </Row>
          <Row label={tr("insp.showValues")}>
            <input
              type="checkbox"
              checked={!!el.showValues}
              onChange={(e) => set((x) => x.type === "chart" && (x.showValues = e.target.checked))}
            />
          </Row>
          {!isPieLikeChart(el.chart) && (
            <Row label={tr("insp.valueAxis")}>
              <input
                type="checkbox"
                checked={el.showAxis !== false}
                onChange={(e) => set((x) => x.type === "chart" && (x.showAxis = e.target.checked))}
                title={tr("insp.valueAxisTitle")}
              />
            </Row>
          )}

          {/* Os dados SÃO o gráfico: nasce sempre aberta. */}
          <Section id="chartData" title={tr("insp.data")} active>
            <button
              className="insp-mini"
              title={tr("insp.pasteCsvTitle")}
              onClick={() => {
                const text = window.prompt(tr("insp.pasteCsvPrompt"));
                if (!text) return;
                const lines = text.trim().split(/\r?\n/).filter(Boolean);
                if (lines.length < 2) return;
                const categories = lines[0].split(",").slice(1).map((c) => c.trim());
                const parsedSeries = lines.slice(1).map((line) => {
                  const cells = line.split(",");
                  return { name: cells[0]?.trim() || tr("insp.seriesName"), values: cells.slice(1).map((v) => Number(v.trim()) || 0) };
                });
                set((x) => {
                  if (x.type !== "chart") return;
                  x.categories = categories;
                  x.series = isPieLikeChart(x.chart) ? parsedSeries.slice(0, 1) : parsedSeries;
                });
              }}
            >
              {tr("insp.pasteCsv")}
            </button>
            <div className="chart-grid">
              {/* Category header row */}
              <div className="chart-grid-row">
                <span className="chart-grid-corner" />
                {el.categories.map((c, ci) => (
                  <input
                    key={ci}
                    className="chart-cell chart-cat"
                    value={c}
                    onChange={(e) => set((x) => x.type === "chart" && (x.categories[ci] = e.target.value))}
                  />
                ))}
                <button
                  className="insp-mini"
                  title={tr("insp.addCategory")}
                  onClick={() =>
                    set((x) => {
                      if (x.type !== "chart") return;
                      x.categories.push(tr("insp.catName", { n: x.categories.length + 1 }));
                      x.series.forEach((s) => s.values.push(0));
                    })
                  }
                >
                  ＋
                </button>
              </div>

              {/* Series rows */}
              {(isPieLikeChart(el.chart) ? el.series.slice(0, 1) : el.series).map((s, si) => (
                <div key={si} className="chart-grid-row">
                  <input
                    className="chart-cell chart-series-name"
                    value={s.name}
                    onChange={(e) => set((x) => x.type === "chart" && (x.series[si].name = e.target.value))}
                  />
                  {el.categories.map((_, ci) => (
                    <input
                      key={ci}
                      type="number"
                      className="chart-cell chart-val"
                      value={s.values[ci] ?? 0}
                      onChange={(e) =>
                        set((x) => x.type === "chart" && (x.series[si].values[ci] = Number(e.target.value)))
                      }
                    />
                  ))}
                  {el.series.length > 1 && !isPieLikeChart(el.chart) && (
                    <button
                      className="insp-mini"
                      title={tr("insp.removeSeries")}
                      onClick={() => set((x) => x.type === "chart" && x.series.splice(si, 1))}
                    >
                      −
                    </button>
                  )}
                </div>
              ))}
            </div>
            {!isPieLikeChart(el.chart) && (
              <button
                className="insp-mini"
                onClick={() =>
                  set((x) => {
                    if (x.type !== "chart") return;
                    x.series.push({ name: tr("insp.seriesNameN", { n: x.series.length + 1 }), values: x.categories.map(() => 0) });
                  })
                }
              >
                {tr("insp.addSeries")}
              </button>
            )}
            {el.categories.length > 1 && (
              <button
                className="insp-mini"
                title={tr("insp.removeLastCategory")}
                onClick={() =>
                  set((x) => {
                    if (x.type !== "chart") return;
                    x.categories.pop();
                    x.series.forEach((s) => s.values.pop());
                  })
                }
              >
                {tr("insp.removeCategory")}
              </button>
            )}
          </Section>

          <Section
            id="chartColors"
            title={tr("insp.colors")}
            active={!!el.palette && el.palette.length > 0}
          >
            {(isPieLikeChart(el.chart) ? el.categories : el.series.map((s) => s.name)).map((lab, i) => {
              const fallback = ["#2563eb", "#0ea5e9", "#f59e0b", "#ef4444", "#10b981", "#8b5cf6", "#ec4899", "#14b8a6"];
              const color = el.palette?.[i] ?? fallback[i % fallback.length];
              return (
                <Row key={i} label={lab || `#${i + 1}`}>
                  <ColorPicker
                    value={color}
                    themeColors={themeColors}
                    onChange={(c) =>
                      set((x) => {
                        if (x.type !== "chart") return;
                        const pal = [...(x.palette ?? [])];
                        while (pal.length <= i) pal.push(fallback[pal.length % fallback.length]);
                        pal[i] = c;
                        x.palette = pal;
                      })
                    }
                  />
                </Row>
              );
            })}
          </Section>
        </>
      )}

      {/* Transform: flip + quick rotate */}
      <div className="insp-head">{tr("insp.transform")}</div>
      <div className="insp-zorder">
        <button onClick={() => set((x) => (x.flipH = !x.flipH))} title={tr("insp.flipH")}>⇋</button>
        <button onClick={() => set((x) => (x.flipV = !x.flipV))} title={tr("insp.flipV")}>⥮</button>
        <button
          onClick={() => set((x) => (x.geom.rotation = ((x.geom.rotation ?? 0) + 90) % 360))}
          title={tr("insp.rotate90")}
        >
          ⟳
        </button>
        <button
          onClick={() => set((x) => (x.geom.rotation = ((x.geom.rotation ?? 0) + 270) % 360))}
          title={tr("insp.rotateNeg90")}
        >
          ⟲
        </button>
      </div>

      {/* Z-order */}
      <div className="insp-head">{tr("insp.layers")}</div>
      <div className="insp-zorder">
        <button onClick={() => reorder(el.id, "front")} title={tr("insp.bringFront")}>⤒</button>
        <button onClick={() => reorder(el.id, "forward")} title={tr("insp.bringForward")}>↑</button>
        <button onClick={() => reorder(el.id, "backward")} title={tr("insp.sendBackward")}>↓</button>
        <button onClick={() => reorder(el.id, "back")} title={tr("insp.sendBack")}>⤓</button>
      </div>

      <button className="insp-delete" onClick={() => deleteElements([el.id])}>
        {tr("insp.deleteElement")}
      </button>
    </>
  );
}

function DeckAudioSection() {
  const deckAudio = useStore((s) => s.deck.audio);
  const apply = useStore((s) => s.apply);

  const onPick = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      apply((d) => {
        d.audio = { src, name: file.name, volume: 1 };
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      <div className="insp-head">{tr("insp.deckAudio")}</div>
      {deckAudio ? (
        <>
          <Row label={tr("insp.track")}>
            <span className="insp-audio-name" title={deckAudio.name}>{deckAudio.name}</span>
            <button className="insp-mini" onClick={() => apply((d) => (d.audio = undefined))}>
              {tr("insp.remove")}
            </button>
          </Row>
          <Row label={tr("insp.volume")}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={deckAudio.volume ?? 1}
              onChange={(e) =>
                apply((d) => {
                  if (d.audio) d.audio.volume = Number(e.target.value);
                })
              }
            />
          </Row>
        </>
      ) : (
        <Row label={tr("insp.track")}>
          <label className="insp-mini insp-file-label">
            {tr("insp.chooseFile")}
            <input
              type="file"
              accept="audio/*"
              style={{ display: "none" }}
              onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])}
            />
          </label>
        </Row>
      )}
    </>
  );
}

function SlideInspector() {
  const deck = useStore((s) => s.deck);
  const currentSlideId = useStore((s) => s.currentSlideId);
  const updateCurrentSlide = useStore((s) => s.updateCurrentSlide);
  const setTheme = useStore((s) => s.setTheme);
  const applyLayout = useStore((s) => s.applyLayout);
  const addSlide = useStore((s) => s.addSlide);
  const slide = findSlide(deck, currentSlideId);
  const [brandKits, setBrandKits] = useState<BrandKit[]>(() => loadBrandKits());
  if (!slide) return null;

  const themeColors = Object.values(deck.theme.colors) as string[];
  const activeTheme = findThemePreset(deck.theme);

  return (
    <>
      {/* Galerias de ESCOLHA (tema, layout): não têm "valor não-neutro" — são
          ações, não estado. Então nascem fechadas, e nada fica escondido por
          isso. O kit de marca é a exceção: kit salvo é conteúdo DO USUÁRIO, e
          conteúdo do usuário nasce à vista. */}
      <Section id="presentationTheme" title={tr("insp.presentationTheme")}>
      <div className="insp-themes">
        {THEME_PRESETS.map((p) => (
          <button
            key={p.id}
            className={"theme-swatch" + (activeTheme?.id === p.id ? " active" : "")}
            title={themeName(p.id)}
            onClick={() => setTheme(p.theme)}
            style={{ background: p.theme.colors.bg, color: p.theme.colors.text }}
          >
            <span className="theme-dot" style={{ background: p.theme.colors.accent1 }} />
            <span className="theme-dot" style={{ background: p.theme.colors.accent2 }} />
            <span className="theme-name" style={{ fontFamily: p.theme.fonts.heading }}>
              {themeName(p.id)}
            </span>
          </button>
        ))}
      </div>
      </Section>

      <Section id="brandKit" title={tr("insp.brandKit")} active={brandKits.length > 0}>
      <div className="insp-themes">
        {brandKits.map((k) => (
          <div key={k.id} className="brand-kit-row">
            <button
              className="theme-swatch"
              title={k.name}
              onClick={() => setTheme(k.theme)}
              style={{ background: k.theme.colors.bg, color: k.theme.colors.text }}
            >
              <span className="theme-dot" style={{ background: k.theme.colors.accent1 }} />
              <span className="theme-dot" style={{ background: k.theme.colors.accent2 }} />
              <span className="theme-name" style={{ fontFamily: k.theme.fonts.heading }}>{k.name}</span>
            </button>
            <button
              className="insp-mini"
              title={tr("insp.removeBrandKit")}
              onClick={() => setBrandKits(removeBrandKit(k.id))}
            >
              🗑
            </button>
          </div>
        ))}
      </div>
      <button
        className="insp-mini"
        title={tr("insp.saveBrandTitle")}
        onClick={() => {
          const name = window.prompt(tr("insp.brandKitNamePrompt"), tr("insp.brandKitDefaultName"));
          if (name) setBrandKits(saveBrandKit(name, deck.theme));
        }}
      >
        {tr("insp.saveBrand")}
      </button>
      </Section>

      <Section id="slideLayout" title={tr("insp.slideLayout")}>
      <div className="insp-layouts">
        {LAYOUTS.map((l) => (
          <div key={l.id} className="insp-layout-row">
            <button className="insp-mini" onClick={() => applyLayout(l.id)} title={tr("insp.applyLayout", { name: layoutName(l.id) })}>
              {layoutName(l.id)}
            </button>
            <button
              className="insp-mini insp-layout-add"
              onClick={() => addSlide(l.id)}
              title={tr("insp.newSlideLayout", { name: layoutName(l.id) })}
            >
              ＋
            </button>
          </div>
        ))}
      </div>
      </Section>

      <div className="insp-head">{tr("insp.slideBackground")}</div>
      <FillEditor
        value={slide.background}
        onChange={(f) => updateCurrentSlide((s) => (s.background = f))}
        themeColors={themeColors}
        allowNone={false}
        allowImage
        themeLabel={tr("insp.themeLabel")}
      />

      <div className="insp-head">{tr("insp.entryTransition")}</div>
      <Row label={tr("insp.type")}>
        <select
          value={slide.transition?.kind ?? "none"}
          onChange={(e) => {
            const kind = e.target.value as TransitionKind;
            updateCurrentSlide((s) =>
              (s.transition = kind === "none" ? undefined : { kind, duration: 0.5 })
            );
          }}
        >
          {TRANSITIONS().map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </Row>
      {slide.transition && (
        <Row label={tr("insp.durationSeconds")}>
          <input
            type="number"
            min={0.1}
            step={0.1}
            value={slide.transition.duration}
            onChange={(e) =>
              updateCurrentSlide((s) => s.transition && (s.transition.duration = Number(e.target.value)))
            }
          />
        </Row>
      )}

      <div className="insp-head">{tr("insp.animatePage")}</div>
      <div className="insp-zorder">
        {PAGE_ANIM_PRESETS().map((p) => (
          <button
            key={p.id}
            className="insp-mini"
            title={tr("insp.applyPageAnim", { label: p.label })}
            onClick={() =>
              updateCurrentSlide((s) => {
                s.elements.forEach((el, i) => {
                  el.anim = { kind: p.kind, duration: p.duration, delay: i * p.stagger };
                });
              })
            }
          >
            {p.label}
          </button>
        ))}
        <button
          className="insp-mini"
          title={tr("insp.clearPageAnimTitle")}
          onClick={() =>
            updateCurrentSlide((s) => {
              s.elements.forEach((el) => (el.anim = undefined));
            })
          }
        >
          {tr("insp.clear")}
        </button>
      </div>

      <DeckAudioSection />

      <div className="insp-head">{tr("insp.presenterNotes")}</div>
      <textarea
        className="insp-notes"
        placeholder={tr("insp.notesPlaceholder")}
        value={pmToPlainText(slide.notes)}
        onChange={(e) => {
          const text = e.target.value;
          updateCurrentSlide((s) => (s.notes = text ? plainTextToPM(text) : undefined));
        }}
      />
    </>
  );
}

function MultiInspector({ count }: { count: number }) {
  const align = useStore((s) => s.align);
  const distribute = useStore((s) => s.distribute);
  const group = useStore((s) => s.group);
  const ungroup = useStore((s) => s.ungroup);
  const pasteStyle = useStore((s) => s.pasteStyle);
  const styleClipboardSize = useStore((s) => s.styleClipboardSize);

  return (
    <>
      <div className="insp-head">{tr("insp.elementsCount", { count })}</div>
      {styleClipboardSize > 0 && (
        <div className="insp-zorder">
          <button className="insp-mini" onClick={pasteStyle} title={tr("insp.pasteStyleTitle")}>
            {tr("insp.pasteStyleInto", { count })}
          </button>
        </div>
      )}
      <div className="insp-head">{tr("insp.align")}</div>
      <div className="insp-align">
        <button onClick={() => align("left")} title={tr("insp.alignLeft")}>⫷</button>
        <button onClick={() => align("hcenter")} title={tr("insp.alignHCenter")}>⊟</button>
        <button onClick={() => align("right")} title={tr("insp.alignRight")}>⫸</button>
        <button onClick={() => align("top")} title={tr("insp.alignTop")}>⫶</button>
        <button onClick={() => align("vcenter")} title={tr("insp.alignVCenter")}>⊞</button>
        <button onClick={() => align("bottom")} title={tr("insp.alignBottom")}>⫶</button>
      </div>
      <div className="insp-head">{tr("insp.distribute")}</div>
      <div className="insp-zorder">
        <button onClick={() => distribute("h")} title={tr("insp.horizontal")}>↔</button>
        <button onClick={() => distribute("v")} title={tr("insp.vertical")}>↕</button>
      </div>
      <div className="insp-head">{tr("insp.group")}</div>
      <div className="insp-zorder">
        <button onClick={group} title={tr("insp.groupTitle")}>{tr("insp.groupBtn")}</button>
        <button onClick={ungroup} title={tr("insp.ungroupTitle")}>{tr("insp.ungroupBtn")}</button>
      </div>
    </>
  );
}

export function Inspector() {
  const deck = useStore((s) => s.deck);
  const currentSlideId = useStore((s) => s.currentSlideId);
  const selection = useStore((s) => s.selection);
  const slide = findSlide(deck, currentSlideId);
  const el = selection.length === 1 ? slide?.elements.find((e) => e.id === selection[0]) : undefined;

  return (
    <div className="inspector">
      {selection.length > 1 ? (
        <MultiInspector count={selection.length} />
      ) : el ? (
        <ElementInspector el={el} />
      ) : (
        <SlideInspector />
      )}
    </div>
  );
}
