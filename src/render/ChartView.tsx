// SVG renderer for chart elements (bar / line / pie). Pure + deterministic so it
// works in the editor, thumbnails, present mode, and html-to-image exports alike.

import type { ChartEl, Theme } from "../model/deck";

function resolvePalette(el: ChartEl, theme: Theme): string[] {
  const base = [
    theme.colors.accent1,
    theme.colors.accent2,
    "#f59e0b",
    "#ef4444",
    "#10b981",
    "#8b5cf6",
    "#ec4899",
    "#14b8a6",
  ];
  return el.palette && el.palette.length ? el.palette : base;
}

/** Nice-ish rounded max for the value axis. */
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

export function ChartView({ el, theme }: { el: ChartEl; theme: Theme }) {
  const { w, h } = el.geom;
  const palette = resolvePalette(el, theme);
  const text = theme.colors.text;
  const titleH = el.title ? 26 : 8;
  const legendH = el.showLegend ? 24 : 8;
  const fontFamily = theme.fonts.body;

  const labels =
    el.chart === "pie"
      ? el.categories
      : el.series.map((s, i) => s.name || `Série ${i + 1}`);
  const legend = el.showLegend ? (
    <g>
      {labels.map((lab, i) => {
        const itemW = Math.min(140, w / Math.max(1, labels.length));
        const x = 8 + i * itemW;
        const y = h - legendH + 12;
        return (
          <g key={i} transform={`translate(${x}, ${y})`}>
            <rect x={0} y={-8} width={11} height={11} rx={2} fill={palette[i % palette.length]} />
            <text x={16} y={1} fontSize={12} fill={text} fontFamily={fontFamily} dominantBaseline="middle">
              {lab}
            </text>
          </g>
        );
      })}
    </g>
  ) : null;

  const title = el.title ? (
    <text x={w / 2} y={18} fontSize={15} fontWeight={600} fill={text} fontFamily={fontFamily} textAnchor="middle">
      {el.title}
    </text>
  ) : null;

  let body: React.ReactNode = null;

  if (el.chart === "pie") {
    const vals = (el.series[0]?.values ?? []).map((v) => Math.max(0, v));
    const total = vals.reduce((a, b) => a + b, 0) || 1;
    const cx = w / 2;
    const cy = titleH + (h - titleH - legendH) / 2;
    const r = Math.max(10, Math.min(w, h - titleH - legendH) / 2 - 8);
    let a0 = -Math.PI / 2;
    body = (
      <g>
        {vals.map((v, i) => {
          const frac = v / total;
          const a1 = a0 + frac * 2 * Math.PI;
          const large = a1 - a0 > Math.PI ? 1 : 0;
          const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
          const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
          const mid = (a0 + a1) / 2;
          const lx = cx + r * 0.6 * Math.cos(mid), ly = cy + r * 0.6 * Math.sin(mid);
          const d = `M ${cx} ${cy} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
          a0 = a1;
          return (
            <g key={i}>
              <path d={d} fill={palette[i % palette.length]} stroke="#fff" strokeWidth={1} />
              {el.showValues && frac > 0.04 && (
                <text x={lx} y={ly} fontSize={11} fill="#fff" fontFamily={fontFamily} textAnchor="middle" dominantBaseline="middle">
                  {Math.round(frac * 100)}%
                </text>
              )}
            </g>
          );
        })}
      </g>
    );
  } else {
    // Bar / line share a value axis + category axis.
    const padL = 40, padR = 12, padB = 26;
    const x0 = padL, x1 = w - padR;
    const y0 = titleH;
    const y1 = h - legendH - padB;
    const plotW = Math.max(1, x1 - x0);
    const plotH = Math.max(1, y1 - y0);
    const cats = el.categories.length || 1;
    const allVals = el.series.flatMap((s) => s.values);
    const maxV = niceMax(Math.max(1, ...allVals.map((v) => Math.max(0, v))));
    const yOf = (v: number) => y1 - (Math.max(0, v) / maxV) * plotH;

    const grid = [0, 0.25, 0.5, 0.75, 1].map((f, i) => {
      const gy = y1 - f * plotH;
      return (
        <g key={`g-${i}`}>
          <line x1={x0} y1={gy} x2={x1} y2={gy} stroke="#e2e8f0" strokeWidth={1} />
          <text x={x0 - 6} y={gy} fontSize={10} fill={text} fontFamily={fontFamily} textAnchor="end" dominantBaseline="middle">
            {Math.round(maxV * f)}
          </text>
        </g>
      );
    });

    const catW = plotW / cats;
    const catLabels = el.categories.map((c, i) => (
      <text
        key={`c-${i}`}
        x={x0 + catW * (i + 0.5)}
        y={y1 + 14}
        fontSize={11}
        fill={text}
        fontFamily={fontFamily}
        textAnchor="middle"
      >
        {c}
      </text>
    ));

    let series: React.ReactNode;
    if (el.chart === "bar") {
      const ns = el.series.length || 1;
      const groupPad = catW * 0.18;
      const barW = (catW - groupPad * 2) / ns;
      series = el.series.map((s, si) =>
        s.values.map((v, ci) => {
          const bx = x0 + catW * ci + groupPad + si * barW;
          const by = yOf(v);
          return (
            <g key={`b-${si}-${ci}`}>
              <rect x={bx} y={by} width={Math.max(1, barW - 2)} height={Math.max(0, y1 - by)} fill={palette[si % palette.length]} rx={2} />
              {el.showValues && (
                <text x={bx + barW / 2 - 1} y={by - 3} fontSize={9} fill={text} fontFamily={fontFamily} textAnchor="middle">
                  {v}
                </text>
              )}
            </g>
          );
        })
      );
    } else {
      // line
      series = el.series.map((s, si) => {
        const pts = s.values
          .map((v, ci) => `${(x0 + catW * (ci + 0.5)).toFixed(1)},${yOf(v).toFixed(1)}`)
          .join(" ");
        return (
          <g key={`l-${si}`}>
            <polyline points={pts} fill="none" stroke={palette[si % palette.length]} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            {s.values.map((v, ci) => (
              <circle key={ci} cx={x0 + catW * (ci + 0.5)} cy={yOf(v)} r={3} fill={palette[si % palette.length]} />
            ))}
          </g>
        );
      });
    }

    body = (
      <g>
        {grid}
        <line x1={x0} y1={y1} x2={x1} y2={y1} stroke="#94a3b8" strokeWidth={1} />
        {series}
        {catLabels}
      </g>
    );
  }

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block" }}>
      <rect x={0} y={0} width={w} height={h} fill="transparent" />
      {title}
      {body}
      {legend}
    </svg>
  );
}
