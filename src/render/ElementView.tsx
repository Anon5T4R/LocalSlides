// Static render of a single element at logical coordinates. The parent applies
// the zoom scale; here everything is in logical px. Used by both the editor
// stage and the (non-interactive) thumbnails.

import type { CSSProperties, ReactNode } from "react";
import type { Element, Geom, ImageAdjust, InkEl, ShapeEl, ShapeKind, Stroke, TableEl, Theme } from "../model/deck";
import { pmHasExplicitFontSize } from "../model/deck";
import { fillToCss } from "./fill";
import { ChartView } from "./ChartView";
import { RenderPM } from "./renderPM";
import { AutoFitText } from "./AutoFitText";
import { textEffectStyle } from "./textEffects";
import {
  StrokeDefs,
  dashArrayFor,
  effectiveStyle,
  filterIdFor,
  imageOutlineFilter,
  needsDefs,
} from "./strokeStyle";

export function geomStyle(geom: Geom): CSSProperties {
  return {
    position: "absolute",
    left: geom.x,
    top: geom.y,
    width: geom.w,
    height: geom.h,
    transform: geom.rotation ? `rotate(${geom.rotation}deg)` : undefined,
    transformOrigin: "center center",
  };
}

/**
 * Decorative outline ("contorno") as an SVG rect overlay positioned over the
 * element box, so it supports every stroke style (dash/dot/chalk/smudge). Images
 * use a silhouette outline instead (see ElementView), not this rectangle.
 */
function OutlineLayer({
  geom,
  outline,
  opacity,
  anim,
}: {
  geom: Geom;
  outline: Stroke;
  opacity?: number;
  anim?: string;
}) {
  const style = effectiveStyle(outline);
  const w = Math.max(1, outline.width);
  const filterId = filterIdFor(style);
  return (
    <svg
      width={geom.w}
      height={geom.h}
      style={{ ...geomStyle(geom), overflow: "visible", pointerEvents: "none", opacity, animation: anim }}
    >
      {needsDefs(style) && <StrokeDefs />}
      <rect
        x={w / 2}
        y={w / 2}
        width={geom.w - w}
        height={geom.h - w}
        fill="none"
        stroke={outline.color}
        strokeWidth={w}
        strokeDasharray={dashArrayFor(style, w)}
        filter={filterId ? `url(#${filterId})` : undefined}
      />
    </svg>
  );
}

/** Build a CSS `filter` string from photographic adjustments (empty = neutral). */
export function adjustFilter(a?: ImageAdjust): string {
  if (!a) return "";
  const p: string[] = [];
  if (a.brightness != null && a.brightness !== 100) p.push(`brightness(${a.brightness}%)`);
  if (a.contrast != null && a.contrast !== 100) p.push(`contrast(${a.contrast}%)`);
  if (a.saturate != null && a.saturate !== 100) p.push(`saturate(${a.saturate}%)`);
  if (a.grayscale) p.push(`grayscale(${a.grayscale}%)`);
  if (a.sepia) p.push(`sepia(${a.sepia}%)`);
  if (a.hueRotate) p.push(`hue-rotate(${a.hueRotate}deg)`);
  if (a.blur) p.push(`blur(${a.blur}px)`);
  return p.join(" ");
}

/** Vertices of a regular n-gon inscribed in the box (px), starting at the top. */
function polygonVerts(w: number, h: number, n: number, rotDeg = -90): [number, number][] {
  const cx = w / 2, cy = h / 2, rx = w / 2, ry = h / 2;
  const start = (rotDeg * Math.PI) / 180;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = start + (i * 2 * Math.PI) / n;
    pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return pts;
}

function starVerts(w: number, h: number): [number, number][] {
  const cx = w / 2, cy = h / 2, ox = w / 2, oy = h / 2, ix = ox * 0.4, iy = oy * 0.4;
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rx = i % 2 === 0 ? ox : ix;
    const ry = i % 2 === 0 ? oy : iy;
    pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return pts;
}

/** CSS `clip-path` that masks a box to a shape silhouette, or undefined for none. */
export function shapeClipPath(shape: ShapeKind, w: number, h: number): string | undefined {
  const poly = (v: [number, number][]) =>
    `polygon(${v.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(", ")})`;
  switch (shape) {
    case "ellipse":
      return "ellipse(50% 50% at 50% 50%)";
    case "roundRect":
      return `inset(0 round ${(Math.min(w, h) * 0.12).toFixed(1)}px)`;
    case "triangle":
      return poly([[w / 2, 0], [w, h], [0, h]]);
    case "diamond":
      return poly([[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]]);
    case "pentagon":
      return poly(polygonVerts(w, h, 5));
    case "hexagon":
      return poly(polygonVerts(w, h, 6, 0));
    case "star":
      return poly(starVerts(w, h));
    default:
      return undefined; // rect & unsupported shapes → no clip
  }
}

/** Points for a regular n-gon inscribed in the box, starting at the top. */
function polygonPoints(w: number, h: number, n: number, rotDeg = -90): string {
  const cx = w / 2, cy = h / 2;
  const rx = w / 2, ry = h / 2;
  const start = (rotDeg * Math.PI) / 180;
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = start + (i * 2 * Math.PI) / n;
    pts.push(`${cx + rx * Math.cos(a)},${cy + ry * Math.sin(a)}`);
  }
  return pts.join(" ");
}

/** Alternating outer/inner points for a 5-point star. */
function starPoints(w: number, h: number): string {
  const cx = w / 2, cy = h / 2;
  const outerX = w / 2, outerY = h / 2;
  const innerX = outerX * 0.4, innerY = outerY * 0.4;
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rx = i % 2 === 0 ? outerX : innerX;
    const ry = i % 2 === 0 ? outerY : innerY;
    pts.push(`${cx + rx * Math.cos(a)},${cy + ry * Math.sin(a)}`);
  }
  return pts.join(" ");
}

/** Flatten one ink stroke's [x0,y0,x1,y1,…] into an SVG polyline points string. */
function strokePoints(pts: number[]): string {
  const out: string[] = [];
  for (let i = 0; i + 1 < pts.length; i += 2) out.push(`${pts[i]},${pts[i + 1]}`);
  return out.join(" ");
}

function InkSvg({ el }: { el: InkEl }) {
  const anyTexture = el.strokes.some((s) => needsDefs(effectiveStyle(s)));
  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${el.base.w} ${el.base.h}`}
      preserveAspectRatio="none"
      style={{ display: "block", overflow: "visible" }}
    >
      {anyTexture && <StrokeDefs />}
      {el.strokes.map((s, i) => {
        const style = effectiveStyle(s);
        const filterId = filterIdFor(style);
        const common = {
          stroke: s.color,
          strokeDasharray: dashArrayFor(style, s.width),
          filter: filterId ? `url(#${filterId})` : undefined,
        };
        return s.points.length >= 4 ? (
          <polyline
            key={i}
            points={strokePoints(s.points)}
            fill="none"
            strokeWidth={s.width}
            strokeLinecap="round"
            strokeLinejoin="round"
            {...common}
          />
        ) : s.points.length === 2 ? (
          <circle key={i} cx={s.points[0]} cy={s.points[1]} r={s.width / 2} fill={s.color} />
        ) : null;
      })}
    </svg>
  );
}

function ShapeSvg({ el }: { el: ShapeEl }) {
  const { w, h } = el.geom;
  // Gradient fill uses an SVG linearGradient keyed to the element id.
  const gradId = el.fill?.kind === "gradient" ? `g-${el.id}` : null;
  const patId = el.fill?.kind === "image" ? `img-${el.id}` : null;
  const fill = !el.fill
    ? "#cbd5e1"
    : el.fill.kind === "none"
    ? "none"
    : el.fill.kind === "gradient"
    ? `url(#${gradId})`
    : el.fill.kind === "image"
    ? `url(#${patId})`
    : el.fill.color;
  const stroke = el.stroke?.color ?? "none";
  const sw = el.stroke?.width ?? 0;
  const style = effectiveStyle(el.stroke);
  const dash = el.stroke ? dashArrayFor(style, sw || 1) : undefined;
  const filterId = el.stroke ? filterIdFor(style) : undefined;
  const common = {
    fill,
    stroke,
    strokeWidth: sw,
    strokeDasharray: dash,
    filter: filterId ? `url(#${filterId})` : undefined,
  };
  // Inset so the stroke stays inside the box.
  const i = sw / 2;
  const iw = w - sw, ih = h - sw;

  let shape: React.ReactNode;
  switch (el.shape) {
    case "ellipse":
      shape = <ellipse cx={w / 2} cy={h / 2} rx={w / 2 - i} ry={h / 2 - i} {...common} />;
      break;
    case "triangle":
      shape = <polygon points={`${w / 2},${i} ${w - i},${h - i} ${i},${h - i}`} {...common} />;
      break;
    case "roundRect":
      shape = <rect x={i} y={i} width={iw} height={ih} rx={Math.min(w, h) * 0.12} {...common} />;
      break;
    case "diamond":
      shape = <polygon points={`${w / 2},${i} ${w - i},${h / 2} ${w / 2},${h - i} ${i},${h / 2}`} {...common} />;
      break;
    case "pentagon":
      shape = <polygon points={polygonPoints(w, h, 5)} {...common} />;
      break;
    case "hexagon":
      shape = <polygon points={polygonPoints(w, h, 6, 0)} {...common} />;
      break;
    case "star":
      shape = <polygon points={starPoints(w, h)} {...common} />;
      break;
    case "line":
      shape = <line x1={i} y1={h / 2} x2={w - i} y2={h / 2} stroke={stroke === "none" ? fill : stroke} strokeWidth={Math.max(sw, 3)} strokeDasharray={dash} filter={filterId ? `url(#${filterId})` : undefined} strokeLinecap="round" />;
      break;
    case "arrow": {
      // Right-pointing block arrow (rotate the element for other directions).
      const sh = h * 0.34, hl = w * 0.4; // shaft half-height, head length
      const cy = h / 2;
      shape = (
        <polygon
          points={`${i},${cy - sh} ${w - hl},${cy - sh} ${w - hl},${i} ${w - i},${cy} ${w - hl},${h - i} ${w - hl},${cy + sh} ${i},${cy + sh}`}
          {...common}
        />
      );
      break;
    }
    case "doubleArrow": {
      const sh = h * 0.34, hl = w * 0.22;
      const cy = h / 2;
      shape = (
        <polygon
          points={`${i},${cy} ${hl},${i} ${hl},${cy - sh} ${w - hl},${cy - sh} ${w - hl},${i} ${w - i},${cy} ${w - hl},${h - i} ${w - hl},${cy + sh} ${hl},${cy + sh} ${hl},${h - i}`}
          {...common}
        />
      );
      break;
    }
    case "chevron": {
      const notch = w * 0.25;
      shape = (
        <polygon
          points={`${i},${i} ${w - notch},${i} ${w - i},${h / 2} ${w - notch},${h - i} ${i},${h - i} ${notch},${h / 2}`}
          {...common}
        />
      );
      break;
    }
    case "speech": {
      // Rounded rectangle body with a tail at the bottom-left.
      const r = Math.min(w, h) * 0.14;
      const bodyH = h * 0.78;
      const d = `M ${i + r} ${i}
        H ${w - i - r} A ${r} ${r} 0 0 1 ${w - i} ${i + r}
        V ${bodyH - r} A ${r} ${r} 0 0 1 ${w - i - r} ${bodyH}
        H ${w * 0.32} L ${w * 0.16} ${h - i} L ${w * 0.22} ${bodyH}
        H ${i + r} A ${r} ${r} 0 0 1 ${i} ${bodyH - r}
        V ${i + r} A ${r} ${r} 0 0 1 ${i + r} ${i} Z`;
      shape = <path d={d} {...common} />;
      break;
    }
    case "thought": {
      // Cloud-ish body (overlapping ellipses) + two little bubbles.
      const cy = h * 0.4;
      shape = (
        <g {...common}>
          <ellipse cx={w * 0.32} cy={cy} rx={w * 0.3} ry={h * 0.3} />
          <ellipse cx={w * 0.62} cy={cy} rx={w * 0.34} ry={h * 0.36} />
          <ellipse cx={w * 0.5} cy={h * 0.32} rx={w * 0.28} ry={h * 0.26} />
          <ellipse cx={w * 0.22} cy={h * 0.82} rx={w * 0.07} ry={h * 0.07} />
          <ellipse cx={w * 0.12} cy={h * 0.95} rx={w * 0.04} ry={h * 0.04} />
        </g>
      );
      break;
    }
    default:
      shape = <rect x={i} y={i} width={iw} height={ih} {...common} />;
  }
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", overflow: "visible" }}>
      {needsDefs(style) && <StrokeDefs />}
      {gradId && el.fill?.kind === "gradient" && (
        <defs>{gradientDef(gradId, el.fill)}</defs>
      )}
      {patId && el.fill?.kind === "image" && (
        <defs>
          <pattern id={patId} patternUnits="userSpaceOnUse" width={w} height={h}>
            <image
              href={el.fill.src}
              x={0}
              y={0}
              width={w}
              height={h}
              preserveAspectRatio={el.fill.fit === "contain" ? "xMidYMid meet" : "xMidYMid slice"}
            />
          </pattern>
        </defs>
      )}
      {shape}
    </svg>
  );
}

/** Build an SVG linear/radial gradient (supporting multi-stop) keyed by id. */
function gradientDef(id: string, g: Extract<NonNullable<ShapeEl["fill"]>, { kind: "gradient" }>) {
  const stops =
    g.stops && g.stops.length >= 2
      ? g.stops
      : [
          { color: g.from, pos: 0 },
          { color: g.to, pos: 100 },
        ];
  const stopEls = stops.map((s, i) => <stop key={i} offset={`${s.pos}%`} stopColor={s.color} />);
  return g.radial ? (
    <radialGradient id={id} cx="50%" cy="50%" r="65%">
      {stopEls}
    </radialGradient>
  ) : (
    <linearGradient id={id} gradientTransform={`rotate(${g.angle}, 0.5, 0.5)`} gradientUnits="objectBoundingBox">
      {stopEls}
    </linearGradient>
  );
}

function TableView({ el, theme, style }: { el: TableEl; theme: Theme; style: CSSProperties }) {
  const nCols = el.rows[0]?.length ?? 1;
  const nRows = el.rows.length;
  const border = el.border ? `${el.border.width}px solid ${el.border.color}` : "1px solid #94a3b8";
  const gridTemplateColumns =
    el.colWidths && el.colWidths.length === nCols
      ? el.colWidths.map((w) => `${Math.max(0.05, w)}fr`).join(" ")
      : `repeat(${nCols}, 1fr)`;
  return (
    <div
      style={{
        ...style,
        display: "grid",
        gridTemplateColumns,
        gridTemplateRows: `repeat(${nRows}, 1fr)`,
        borderTop: border,
        borderLeft: border,
        boxSizing: "border-box",
        fontFamily: theme.fonts.body,
        fontSize: 20,
        color: theme.colors.text,
      }}
    >
      {el.rows.map((row, r) =>
        row.map((cell, c) => {
          if (cell.covered) return null;
          const cs = cell.colSpan ?? 1;
          const rs = cell.rowSpan ?? 1;
          const s = cell.style;
          return (
            <div
              key={`${r}-${c}`}
              style={{
                gridColumn: `${c + 1} / span ${cs}`,
                gridRow: `${r + 1} / span ${rs}`,
                borderRight: border,
                borderBottom: border,
                padding: "4px 8px",
                overflow: "hidden",
                boxSizing: "border-box",
                textAlign: s?.align ?? "left",
                background:
                  s?.fill ??
                  (r === 0 && el.headerFill
                    ? el.headerFill
                    : el.zebra && r > 0 && r % 2 === 0
                    ? "rgba(100,116,139,0.08)"
                    : "transparent"),
                color: s?.color ?? (r === 0 && el.headerFill ? "#fff" : theme.colors.text),
                fontWeight: s?.bold ? 700 : r === 0 ? 600 : 400,
              }}
            >
              <RenderPM doc={cell.content} />
            </div>
          );
        })
      )}
    </div>
  );
}

export function ElementView({
  el,
  theme,
  presenting = false,
}: {
  el: Element;
  theme: Theme;
  presenting?: boolean;
}) {
  const base: CSSProperties = {
    ...geomStyle(el.geom),
    opacity: el.opacity ?? 1,
  };

  // Mirror (flip) — combine with any rotation from geomStyle.
  if (el.flipH || el.flipV) {
    const tf: string[] = [];
    if (el.geom.rotation) tf.push(`rotate(${el.geom.rotation}deg)`);
    if (el.flipH) tf.push("scaleX(-1)");
    if (el.flipV) tf.push("scaleY(-1)");
    base.transform = tf.join(" ");
  }

  // Entrance animation only plays in present mode. `both` holds the start frame
  // during the delay and the end frame afterwards.
  const anim =
    presenting && el.anim && el.anim.kind !== "none"
      ? `anim-${el.anim.kind} ${el.anim.duration}s ease ${el.anim.delay}s both`
      : undefined;
  if (anim) base.animation = anim;

  // Drop shadow applied via filter (works on all element types).
  if (el.shadow) {
    const sh = el.shadow;
    const shadowFilter = `drop-shadow(${sh.x}px ${sh.y}px ${sh.blur}px ${sh.color})`;
    base.filter = shadowFilter;
  }

  // Images outline their alpha silhouette (Canva sticker/shadow); every other
  // type gets the rectangular SVG outline overlay appended at the end.
  const imgOutline =
    el.type === "image" && el.outline && el.outline.width > 0
      ? imageOutlineFilter(el.outline)
      : undefined;

  const body: ReactNode = (() => {
  if (el.type === "text") {
    const isTitle = el.placeholder === "title";
    const textBg = fillToCss(el.fill);
    return (
      <div
        style={{
          ...base,
          overflow: "hidden",
          fontFamily: isTitle ? theme.fonts.heading : theme.fonts.body,
          fontSize: isTitle ? 40 : 24,
          fontWeight: isTitle ? 700 : 400,
          lineHeight: 1.25,
          color: theme.colors.text,
          background: textBg,
          ...textEffectStyle(el.effect, theme.colors.text),
        }}
      >
        <AutoFitText
          vAlign={el.vAlign ?? "top"}
          // An explicit font size wins over shrink-to-fit: stop auto-shrinking
          // so the chosen size is respected (clear it back to "Auto" to re-enable).
          enabled={el.autoFit !== false && !pmHasExplicitFontSize(el.content)}
          contentKey={JSON.stringify(el.content)}
        >
          <RenderPM doc={el.content} />
        </AutoFitText>
      </div>
    );
  }

  if (el.type === "image") {
    const c = el.crop;
    const adj = adjustFilter(el.adjust) || undefined;
    const clip = el.maskShape ? shapeClipPath(el.maskShape, el.geom.w, el.geom.h) : undefined;
    // A crop shows only a sub-rectangle of the source, scaled to fill the box.
    if (c && (c.x > 0 || c.y > 0 || c.w < 1 || c.h < 1)) {
      return (
        <div style={{ ...base, overflow: "hidden", clipPath: clip }}>
          <img
            src={el.src}
            alt={el.alt ?? ""}
            draggable={false}
            style={{
              position: "absolute",
              width: `${100 / c.w}%`,
              height: `${100 / c.h}%`,
              left: `${(-c.x / c.w) * 100}%`,
              top: `${(-c.y / c.h) * 100}%`,
              userSelect: "none",
              filter: adj,
            }}
          />
        </div>
      );
    }
    // Combine adjustments, the alpha-silhouette outline, and any shadow into one
    // filter string (an explicit `filter` here would otherwise drop base.shadow).
    const imgFilter =
      [adj, imgOutline, base.filter as string | undefined].filter(Boolean).join(" ") || undefined;
    return (
      <img
        src={el.src}
        alt={el.alt ?? ""}
        draggable={false}
        style={{ ...base, objectFit: el.fit ?? "contain", userSelect: "none", filter: imgFilter, clipPath: clip }}
      />
    );
  }

  if (el.type === "video") {
    return (
      <video
        src={el.src}
        // Controls only when presenting (in the editor the drag hit-box sits on top).
        controls={presenting}
        autoPlay={presenting && el.autoplay}
        loop={el.loop}
        muted={presenting ? el.muted : true}
        playsInline
        style={{ ...base, objectFit: el.fit ?? "contain", background: "#000", userSelect: "none" }}
      />
    );
  }

  if (el.type === "table") {
    return <TableView el={el} theme={theme} style={base} />;
  }

  if (el.type === "ink") {
    return (
      <div style={base}>
        <InkSvg el={el} />
      </div>
    );
  }

  if (el.type === "chart") {
    return (
      <div style={base}>
        <ChartView el={el} theme={theme} />
      </div>
    );
  }

  if (el.type === "icon") {
    return (
      <div style={base}>
        <svg width="100%" height="100%" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
          <path d={el.path} fill={el.color ?? theme.colors.accent1} />
        </svg>
      </div>
    );
  }

  // shape
  return (
    <div style={base}>
      <ShapeSvg el={el} />
      {el.text && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            padding: 8,
            boxSizing: "border-box",
            fontFamily: theme.fonts.body,
            fontSize: 22,
            color: theme.colors.text,
            textAlign: "center",
          }}
        >
          <RenderPM doc={el.text} />
        </div>
      )}
    </div>
  );
  })();

  // Rectangular decorative outline (all types except images, which outline alpha).
  const rectOutline =
    el.type !== "image" && el.outline && el.outline.width > 0 ? (
      <OutlineLayer geom={el.geom} outline={el.outline} opacity={el.opacity} anim={anim} />
    ) : null;

  return (
    <>
      {body}
      {rectOutline}
    </>
  );
}
