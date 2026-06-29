// Static render of a single element at logical coordinates. The parent applies
// the zoom scale; here everything is in logical px. Used by both the editor
// stage and the (non-interactive) thumbnails.

import type { CSSProperties } from "react";
import type { Element, Geom, InkEl, ShapeEl, Stroke, TableEl, Theme } from "../model/deck";
import { RenderPM } from "./renderPM";

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

/** Decorative outline ("contorno") rendered as a CSS outline so it never shifts layout. */
function outlineStyle(outline: Stroke | undefined): CSSProperties {
  if (!outline || outline.width <= 0) return {};
  const style = outline.dash === "dash" ? "dashed" : outline.dash === "dot" ? "dotted" : "solid";
  return { outline: `${outline.width}px ${style} ${outline.color}`, outlineOffset: 0 };
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
  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${el.base.w} ${el.base.h}`}
      preserveAspectRatio="none"
      style={{ display: "block", overflow: "visible" }}
    >
      {el.strokes.map((s, i) =>
        s.points.length >= 4 ? (
          <polyline
            key={i}
            points={strokePoints(s.points)}
            fill="none"
            stroke={s.color}
            strokeWidth={s.width}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : s.points.length === 2 ? (
          // A dot (single tap).
          <circle key={i} cx={s.points[0]} cy={s.points[1]} r={s.width / 2} fill={s.color} />
        ) : null
      )}
    </svg>
  );
}

function ShapeSvg({ el }: { el: ShapeEl }) {
  const { w, h } = el.geom;
  // Undefined fill → default gray; explicit "none" → transparent (SVG "none").
  const fill = !el.fill ? "#cbd5e1" : el.fill.kind === "none" ? "none" : el.fill.color;
  const stroke = el.stroke?.color ?? "none";
  const sw = el.stroke?.width ?? 0;
  const dash =
    el.stroke?.dash === "dash" ? "12 8" : el.stroke?.dash === "dot" ? "2 6" : undefined;
  const common = { fill, stroke, strokeWidth: sw, strokeDasharray: dash };
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
      shape = <line x1={i} y1={h / 2} x2={w - i} y2={h / 2} stroke={stroke === "none" ? fill : stroke} strokeWidth={Math.max(sw, 3)} strokeDasharray={dash} strokeLinecap="round" />;
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
      {shape}
    </svg>
  );
}

function TableView({ el, theme, style }: { el: TableEl; theme: Theme; style: CSSProperties }) {
  const nCols = el.rows[0]?.length ?? 1;
  const border = el.border ? `${el.border.width}px solid ${el.border.color}` : "1px solid #94a3b8";
  return (
    <div
      style={{
        ...style,
        display: "grid",
        gridTemplateColumns: `repeat(${nCols}, 1fr)`,
        gridAutoRows: "1fr",
        borderTop: border,
        borderLeft: border,
        boxSizing: "border-box",
        fontFamily: theme.fonts.body,
        fontSize: 20,
        color: theme.colors.text,
      }}
    >
      {el.rows.map((row, r) =>
        row.map((cell, c) => (
          <div
            key={`${r}-${c}`}
            style={{
              borderRight: border,
              borderBottom: border,
              padding: "4px 8px",
              overflow: "hidden",
              boxSizing: "border-box",
              background: r === 0 && el.headerFill ? el.headerFill : "transparent",
              color: r === 0 && el.headerFill ? "#fff" : theme.colors.text,
              fontWeight: r === 0 ? 600 : 400,
            }}
          >
            <RenderPM doc={cell.content} />
          </div>
        ))
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
    ...outlineStyle(el.outline),
  };

  // Entrance animation only plays in present mode. `both` holds the start frame
  // during the delay and the end frame afterwards.
  if (presenting && el.anim && el.anim.kind !== "none") {
    base.animation = `anim-${el.anim.kind} ${el.anim.duration}s ease ${el.anim.delay}s both`;
  }

  if (el.type === "text") {
    const justify =
      el.vAlign === "middle" ? "center" : el.vAlign === "bottom" ? "flex-end" : "flex-start";
    const isTitle = el.placeholder === "title";
    return (
      <div
        style={{
          ...base,
          display: "flex",
          flexDirection: "column",
          justifyContent: justify,
          padding: "8px 12px",
          boxSizing: "border-box",
          overflow: "hidden",
          fontFamily: isTitle ? theme.fonts.heading : theme.fonts.body,
          fontSize: isTitle ? 40 : 24,
          fontWeight: isTitle ? 700 : 400,
          lineHeight: 1.25,
          color: theme.colors.text,
        }}
      >
        <RenderPM doc={el.content} />
      </div>
    );
  }

  if (el.type === "image") {
    const c = el.crop;
    // A crop shows only a sub-rectangle of the source, scaled to fill the box.
    if (c && (c.x > 0 || c.y > 0 || c.w < 1 || c.h < 1)) {
      return (
        <div style={{ ...base, overflow: "hidden" }}>
          <img
            src={el.src}
            alt=""
            draggable={false}
            style={{
              position: "absolute",
              width: `${100 / c.w}%`,
              height: `${100 / c.h}%`,
              left: `${(-c.x / c.w) * 100}%`,
              top: `${(-c.y / c.h) * 100}%`,
              userSelect: "none",
            }}
          />
        </div>
      );
    }
    return (
      <img
        src={el.src}
        alt=""
        draggable={false}
        style={{ ...base, objectFit: el.fit ?? "contain", userSelect: "none" }}
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
}
