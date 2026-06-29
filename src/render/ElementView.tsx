// Static render of a single element at logical coordinates. The parent applies
// the zoom scale; here everything is in logical px. Used by both the editor
// stage and the (non-interactive) thumbnails.

import type { CSSProperties } from "react";
import type { Element, Fill, Geom, ShapeEl, Stroke, TableEl, Theme } from "../model/deck";
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

function fillToCss(fill: Fill | undefined, fallback = "transparent"): string {
  if (!fill || fill.kind === "none") return fallback;
  return fill.color;
}

function ShapeSvg({ el }: { el: ShapeEl }) {
  const { w, h } = el.geom;
  const fill = fillToCss(el.fill, "#cbd5e1");
  const stroke = el.stroke?.color ?? "none";
  const strokeWidth = el.stroke?.width ?? 0;
  const dash =
    el.stroke?.dash === "dash" ? "12 8" : el.stroke?.dash === "dot" ? "2 6" : undefined;
  const common = { fill, stroke, strokeWidth, strokeDasharray: dash };
  let shape;
  switch (el.shape) {
    case "ellipse":
      shape = <ellipse cx={w / 2} cy={h / 2} rx={w / 2 - strokeWidth / 2} ry={h / 2 - strokeWidth / 2} {...common} />;
      break;
    case "triangle":
      shape = <polygon points={`${w / 2},0 ${w},${h} 0,${h}`} {...common} />;
      break;
    case "roundRect":
      shape = <rect x={strokeWidth / 2} y={strokeWidth / 2} width={w - strokeWidth} height={h - strokeWidth} rx={Math.min(w, h) * 0.12} {...common} />;
      break;
    default:
      shape = <rect x={strokeWidth / 2} y={strokeWidth / 2} width={w - strokeWidth} height={h - strokeWidth} {...common} />;
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
