// Right-hand inspector. Shows properties for the single selected element
// (opacity, outline, z-order, animation, per-type options) or, when nothing is
// selected, the current slide's properties (background, transition). Every change
// flows through the store, so all of it is undoable.

import { useState, type ChangeEvent } from "react";
import { useStore } from "../state/store";
import {
  findSlide,
  plainTextToPM,
  type AnimKind,
  type Element,
  type ShapeKind,
  type StrokeStyle,
  type TransitionKind,
} from "../model/deck";
import { THEME_PRESETS, findThemePreset } from "../model/themes";
import { LAYOUTS } from "../model/layouts";

const ANIMS: { value: AnimKind; label: string }[] = [
  { value: "none", label: "Nenhuma" },
  { value: "fadeIn", label: "Surgir (fade)" },
  { value: "slideUp", label: "Subir" },
  { value: "slideLeft", label: "Entrar da direita" },
  { value: "zoomIn", label: "Zoom" },
];

const TRANSITIONS: { value: TransitionKind; label: string }[] = [
  { value: "none", label: "Nenhuma" },
  { value: "fade", label: "Fade" },
  { value: "slide", label: "Deslizar" },
  { value: "push", label: "Empurrar" },
];

const STROKE_STYLES: { value: StrokeStyle; label: string }[] = [
  { value: "solid", label: "Normal" },
  { value: "dash", label: "Tracejado" },
  { value: "dot", label: "Pontilhado" },
  { value: "chalk", label: "Giz" },
  { value: "smudge", label: "Esfumaçado" },
];

const SHAPES: { value: ShapeKind; label: string }[] = [
  { value: "rect", label: "Retângulo" },
  { value: "roundRect", label: "Arredondado" },
  { value: "ellipse", label: "Elipse" },
  { value: "triangle", label: "Triângulo" },
  { value: "diamond", label: "Losango" },
  { value: "pentagon", label: "Pentágono" },
  { value: "hexagon", label: "Hexágono" },
  { value: "star", label: "Estrela" },
  { value: "arrow", label: "Seta" },
  { value: "doubleArrow", label: "Seta dupla" },
  { value: "chevron", label: "Chevron" },
  { value: "line", label: "Linha" },
  { value: "speech", label: "Balão de fala" },
  { value: "thought", label: "Balão de pensamento" },
];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="insp-row">
      <span className="insp-label">{label}</span>
      <span className="insp-control">{children}</span>
    </label>
  );
}

/** Collapsible section with a clickable header + chevron. */
function Section({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="insp-section">
      <button className="insp-section-head" onClick={() => setOpen((v) => !v)}>
        <span className={"insp-chevron" + (open ? " open" : "")}>▸</span>
        {title}
      </button>
      {open && <div className="insp-section-body">{children}</div>}
    </div>
  );
}

function typeLabel(el: Element): string {
  return el.type === "text"
    ? "Texto"
    : el.type === "image"
    ? "Imagem"
    : el.type === "video"
    ? "Vídeo"
    : el.type === "table"
    ? "Tabela"
    : el.type === "ink"
    ? "Desenho"
    : "Forma";
}

function ElementInspector({ el }: { el: Element }) {
  const updateElement = useStore((s) => s.updateElement);
  const reorder = useStore((s) => s.reorder);
  const deleteElements = useStore((s) => s.deleteElements);
  const setCropping = useStore((s) => s.setCropping);

  const set = (recipe: (e: Element) => void) => updateElement(el.id, recipe);

  return (
    <>
      <div className="insp-head">{typeLabel(el)}</div>

      <Row label="Opacidade">
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round((el.opacity ?? 1) * 100)}
          onChange={(e) => set((x) => (x.opacity = Number(e.target.value) / 100))}
        />
        <span className="insp-num">{Math.round((el.opacity ?? 1) * 100)}%</span>
      </Row>

      {/* Outline ("contorno") */}
      <Row label="Contorno">
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
          <Row label="Cor do contorno">
            <input
              type="color"
              value={el.outline.color}
              onChange={(e) => set((x) => x.outline && (x.outline.color = e.target.value))}
            />
          </Row>
          <Row label="Espessura">
            <input
              type="range"
              min={1}
              max={24}
              value={el.outline.width}
              onChange={(e) => set((x) => x.outline && (x.outline.width = Number(e.target.value)))}
            />
            <span className="insp-num">{el.outline.width}px</span>
          </Row>
          <Row label="Estilo">
            <select
              value={el.outline.style ?? el.outline.dash ?? "solid"}
              onChange={(e) => set((x) => x.outline && (x.outline.style = e.target.value as StrokeStyle))}
            >
              {STROKE_STYLES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Row>
        </>
      )}

      {/* Animation */}
      <Row label="Animação">
        <select
          value={el.anim?.kind ?? "none"}
          onChange={(e) => {
            const kind = e.target.value as AnimKind;
            set((x) => (x.anim = kind === "none" ? undefined : { kind, duration: 0.5, delay: 0 }));
          }}
        >
          {ANIMS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
      </Row>
      {el.anim && (
        <Row label="Atraso (s)">
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
        <Row label="Alinhar vert.">
          <select
            value={el.vAlign ?? "top"}
            onChange={(e) =>
              set((x) => x.type === "text" && (x.vAlign = e.target.value as "top" | "middle" | "bottom"))
            }
          >
            <option value="top">Topo</option>
            <option value="middle">Meio</option>
            <option value="bottom">Base</option>
          </select>
        </Row>
      )}

      {(el.type === "image" || el.type === "video") && (
        <Row label="Ajuste">
          <select
            value={el.fit ?? "contain"}
            onChange={(e) =>
              set((x) => (x.type === "image" || x.type === "video") && (x.fit = e.target.value as "contain" | "cover"))
            }
          >
            <option value="contain">Conter</option>
            <option value="cover">Preencher</option>
          </select>
        </Row>
      )}

      {el.type === "image" && (
        <Row label="Cortar">
          <div className="insp-zorder">
            <button className="insp-mini" onClick={() => setCropping(el.id)} title="Recortar imagem">
              Recortar
            </button>
            {el.crop && (
              <button
                className="insp-mini"
                onClick={() => set((x) => x.type === "image" && (x.crop = undefined))}
                title="Remover corte"
              >
                Remover
              </button>
            )}
          </div>
        </Row>
      )}

      {el.type === "video" && (
        <>
          <Row label="Autoplay">
            <input
              type="checkbox"
              checked={!!el.autoplay}
              onChange={(e) => set((x) => x.type === "video" && (x.autoplay = e.target.checked))}
            />
          </Row>
          <Row label="Repetir">
            <input
              type="checkbox"
              checked={!!el.loop}
              onChange={(e) => set((x) => x.type === "video" && (x.loop = e.target.checked))}
            />
          </Row>
          <Row label="Mudo">
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
          <Row label="Forma">
            <select
              value={el.shape}
              onChange={(e) => set((x) => x.type === "shape" && (x.shape = e.target.value as ShapeKind))}
            >
              {SHAPES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Preenchimento">
            <input
              type="checkbox"
              checked={el.fill?.kind !== "none"}
              onChange={(e) =>
                set((x) => x.type === "shape" && (x.fill = e.target.checked ? { kind: "solid", color: "#2563eb" } : { kind: "none" }))
              }
            />
          </Row>
          {el.fill?.kind !== "none" && (
            <Row label="Cor">
              <input
                type="color"
                value={el.fill?.kind === "solid" ? el.fill.color : "#2563eb"}
                onChange={(e) =>
                  set((x) => x.type === "shape" && (x.fill = { kind: "solid", color: e.target.value }))
                }
              />
            </Row>
          )}
          <Row label="Traço">
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
              <Row label="Cor do traço">
                <input
                  type="color"
                  value={el.stroke.color}
                  onChange={(e) => set((x) => x.type === "shape" && x.stroke && (x.stroke.color = e.target.value))}
                />
              </Row>
              <Row label="Espessura">
                <input
                  type="range"
                  min={1}
                  max={32}
                  value={el.stroke.width}
                  onChange={(e) => set((x) => x.type === "shape" && x.stroke && (x.stroke.width = Number(e.target.value)))}
                />
                <span className="insp-num">{el.stroke.width}px</span>
              </Row>
              <Row label="Estilo">
                <select
                  value={el.stroke.style ?? el.stroke.dash ?? "solid"}
                  onChange={(e) => set((x) => x.type === "shape" && x.stroke && (x.stroke.style = e.target.value as StrokeStyle))}
                >
                  {STROKE_STYLES.map((s) => (
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
          <div className="insp-head">Tabela</div>
          <Row label="Linhas">
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
          <Row label="Colunas">
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
          <Row label="Cabeçalho">
            <input
              type="color"
              value={el.headerFill ?? "#2563eb"}
              onChange={(e) => set((x) => x.type === "table" && (x.headerFill = e.target.value))}
            />
          </Row>
        </>
      )}

      {/* Transform: flip + quick rotate */}
      <div className="insp-head">Transformar</div>
      <div className="insp-zorder">
        <button onClick={() => set((x) => (x.flipH = !x.flipH))} title="Espelhar horizontal">⇋</button>
        <button onClick={() => set((x) => (x.flipV = !x.flipV))} title="Espelhar vertical">⥮</button>
        <button
          onClick={() => set((x) => (x.geom.rotation = ((x.geom.rotation ?? 0) + 90) % 360))}
          title="Girar 90°"
        >
          ⟳
        </button>
        <button
          onClick={() => set((x) => (x.geom.rotation = ((x.geom.rotation ?? 0) + 270) % 360))}
          title="Girar -90°"
        >
          ⟲
        </button>
      </div>

      {/* Z-order */}
      <div className="insp-head">Camadas</div>
      <div className="insp-zorder">
        <button onClick={() => reorder(el.id, "front")} title="Trazer para frente">⤒</button>
        <button onClick={() => reorder(el.id, "forward")} title="Avançar">↑</button>
        <button onClick={() => reorder(el.id, "backward")} title="Recuar">↓</button>
        <button onClick={() => reorder(el.id, "back")} title="Enviar para trás">⤓</button>
      </div>

      <button className="insp-delete" onClick={() => deleteElements([el.id])}>
        Excluir elemento
      </button>
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
  if (!slide) return null;

  const bgColor = slide.background?.kind === "solid" ? slide.background.color : deck.theme.colors.bg;
  const onBg = (e: ChangeEvent<HTMLInputElement>) =>
    updateCurrentSlide((s) => (s.background = { kind: "solid", color: e.target.value }));
  const activeTheme = findThemePreset(deck.theme);

  return (
    <>
      <Section title="Tema da apresentação">
      <div className="insp-themes">
        {THEME_PRESETS.map((p) => (
          <button
            key={p.id}
            className={"theme-swatch" + (activeTheme?.id === p.id ? " active" : "")}
            title={p.name}
            onClick={() => setTheme(p.theme)}
            style={{ background: p.theme.colors.bg, color: p.theme.colors.text }}
          >
            <span className="theme-dot" style={{ background: p.theme.colors.accent1 }} />
            <span className="theme-dot" style={{ background: p.theme.colors.accent2 }} />
            <span className="theme-name" style={{ fontFamily: p.theme.fonts.heading }}>
              {p.name}
            </span>
          </button>
        ))}
      </div>
      </Section>

      <Section title="Layout do slide">
      <div className="insp-layouts">
        {LAYOUTS.map((l) => (
          <div key={l.id} className="insp-layout-row">
            <button className="insp-mini" onClick={() => applyLayout(l.id)} title={`Aplicar "${l.name}" a este slide`}>
              {l.name}
            </button>
            <button
              className="insp-mini insp-layout-add"
              onClick={() => addSlide(l.id)}
              title={`Novo slide "${l.name}"`}
            >
              ＋
            </button>
          </div>
        ))}
      </div>
      </Section>

      <div className="insp-head">Slide</div>
      <Row label="Fundo">
        <input type="color" value={bgColor} onChange={onBg} />
      </Row>
      <Row label="Usar tema">
        <button
          className="insp-mini"
          onClick={() => updateCurrentSlide((s) => (s.background = undefined))}
        >
          Restaurar
        </button>
      </Row>

      <div className="insp-head">Transição de entrada</div>
      <Row label="Tipo">
        <select
          value={slide.transition?.kind ?? "none"}
          onChange={(e) => {
            const kind = e.target.value as TransitionKind;
            updateCurrentSlide((s) =>
              (s.transition = kind === "none" ? undefined : { kind, duration: 0.5 })
            );
          }}
        >
          {TRANSITIONS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </Row>
      {slide.transition && (
        <Row label="Duração (s)">
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
    </>
  );
}

function MultiInspector({ count }: { count: number }) {
  const align = useStore((s) => s.align);
  const distribute = useStore((s) => s.distribute);
  const group = useStore((s) => s.group);
  const ungroup = useStore((s) => s.ungroup);

  return (
    <>
      <div className="insp-head">{count} elementos</div>
      <div className="insp-head">Alinhar</div>
      <div className="insp-align">
        <button onClick={() => align("left")} title="Esquerda">⫷</button>
        <button onClick={() => align("hcenter")} title="Centro horizontal">⊟</button>
        <button onClick={() => align("right")} title="Direita">⫸</button>
        <button onClick={() => align("top")} title="Topo">⫶</button>
        <button onClick={() => align("vcenter")} title="Centro vertical">⊞</button>
        <button onClick={() => align("bottom")} title="Base">⫶</button>
      </div>
      <div className="insp-head">Distribuir</div>
      <div className="insp-zorder">
        <button onClick={() => distribute("h")} title="Horizontal">↔</button>
        <button onClick={() => distribute("v")} title="Vertical">↕</button>
      </div>
      <div className="insp-head">Grupo</div>
      <div className="insp-zorder">
        <button onClick={group} title="Agrupar (Ctrl+G)">Agrupar</button>
        <button onClick={ungroup} title="Desagrupar (Ctrl+Shift+G)">Desagrupar</button>
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
