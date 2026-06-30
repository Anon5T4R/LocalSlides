// Floating formatting toolbar shown while editing a text box. Rendered inside the
// scaled slide container but counter-scaled so it stays a constant on-screen size,
// anchored just above the box. Buttons use onMouseDown+preventDefault so clicking
// them never steals focus from the editor (which would commit and unmount it).

import type { Editor } from "@tiptap/react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { FONT_FAMILIES, FONT_SIZES } from "./tiptapExtensions";
import { ColorPicker } from "../ui/ColorPicker";
import { useStore } from "../state/store";
import { pickAndLoadFont } from "../lib/fonts";

const IMPORT_FONT = "__import_font__";

const LINE_HEIGHTS = [
  { label: "Padrão", value: "" },
  { label: "1×", value: "1" },
  { label: "1.15×", value: "1.15" },
  { label: "1.5×", value: "1.5" },
  { label: "2×", value: "2" },
];

const LETTER_SPACINGS = [
  { label: "Normal", value: "" },
  { label: "-5%", value: "-0.05em" },
  { label: "+8%", value: "0.08em" },
  { label: "+16%", value: "0.16em" },
];

const DEFAULT_HIGHLIGHT = "#fde68a";

/** Small highlighter-marker icon (currentColor stroke). */
function MarkerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3l6 6-9 9-6 1 1-6 9-9z" />
      <path d="M5 19h6" />
    </svg>
  );
}

function Btn({
  active,
  onRun,
  title,
  children,
}: {
  active?: boolean;
  onRun: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      className={"tt-btn" + (active ? " active" : "")}
      title={title}
      onMouseDown={(e: ReactMouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onRun();
      }}
    >
      {children}
    </button>
  );
}

export function TextToolbar({ editor, scale, themeColors }: { editor: Editor; scale: number; themeColors?: string[] }) {
  // Re-render on selection/transaction so active states stay in sync.
  void editor.state.selection;
  const customFonts = useStore((s) => s.customFonts);
  const addCustomFont = useStore((s) => s.addCustomFont);
  const chain = () => editor.chain().focus();
  const ts = editor.getAttributes("textStyle") as {
    fontFamily?: string;
    fontSize?: string;
    textStroke?: string;
    letterSpacing?: string;
    highlight?: string;
    color?: string;
  };
  const paraAttrs = editor.getAttributes("paragraph") as { lineHeight?: string };
  const curSize = ts.fontSize ? String(parseInt(ts.fontSize, 10)) : "";
  const strokeOn = !!ts.textStroke;
  const strokeColor = ts.textStroke?.split(" ").pop() || "#000000";

  // Set a textStyle attribute; passing null cleanly removes it (and drops the
  // textStyle mark entirely when nothing else is left on it).
  const setStyle = (attr: string, value: string | null) => {
    if (value == null) {
      editor.chain().focus().setMark("textStyle", { [attr]: null }).removeEmptyTextStyle().run();
    } else {
      editor.chain().focus().setMark("textStyle", { [attr]: value }).run();
    }
  };
  // Line height lives on the block node (paragraph/heading), not textStyle.
  const setLineHeight = (value: string | null) =>
    editor.chain().focus()
      .updateAttributes("paragraph", { lineHeight: value })
      .updateAttributes("heading", { lineHeight: value })
      .run();

  const onFontChange = async (v: string) => {
    if (v === IMPORT_FONT) {
      try {
        const font = await pickAndLoadFont();
        if (font) {
          addCustomFont(font.label, font.value);
          setStyle("fontFamily", font.value); // apply to the current selection
        }
      } catch (e) {
        window.alert(`Não foi possível carregar a fonte:\n${e}`);
      }
      return;
    }
    setStyle("fontFamily", v || null);
  };

  return (
    <div
      className="text-toolbar"
      style={{
        position: "absolute",
        left: 0,
        bottom: "100%",
        marginBottom: 8 / scale,
        transform: `scale(${1 / scale})`,
        transformOrigin: "bottom left",
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Btn title="Negrito (Ctrl+B)" active={editor.isActive("bold")} onRun={() => chain().toggleBold().run()}>
        <b>B</b>
      </Btn>
      <Btn title="Itálico (Ctrl+I)" active={editor.isActive("italic")} onRun={() => chain().toggleItalic().run()}>
        <i>I</i>
      </Btn>
      <Btn title="Sublinhado (Ctrl+U)" active={editor.isActive("underline")} onRun={() => chain().toggleUnderline().run()}>
        <u>U</u>
      </Btn>
      <Btn title="Tachado" active={editor.isActive("strike")} onRun={() => chain().toggleStrike().run()}>
        <s>S</s>
      </Btn>

      <span className="tt-sep" />

      {/* Text color — "A" with a colored underline (Canva-style). */}
      <span className="tt-color-wrap" onMouseDown={(e) => e.preventDefault()}>
        <ColorPicker
          glyph={<b>A</b>}
          title="Cor do texto"
          active={!!ts.color}
          value={ts.color ?? "#1e293b"}
          themeColors={themeColors}
          onChange={(c) => chain().setColor(c).run()}
          onClear={() => chain().unsetColor().run()}
        />
      </span>
      {/* Highlight — marker icon with a colored underline; "Nenhuma" removes it. */}
      <span className="tt-color-wrap" onMouseDown={(e) => e.preventDefault()}>
        <ColorPicker
          glyph={<MarkerIcon />}
          title="Realce (marca-texto)"
          active={!!ts.highlight}
          value={ts.highlight ?? DEFAULT_HIGHLIGHT}
          themeColors={themeColors}
          onChange={(c) => setStyle("highlight", c)}
          onClear={() => setStyle("highlight", null)}
        />
      </span>
      {/* Letter outline. */}
      <Btn
        title="Contorno da letra"
        active={strokeOn}
        onRun={() => setStyle("textStroke", strokeOn ? null : `1px ${strokeColor}`)}
      >
        <span style={{ WebkitTextStroke: "1px currentColor", color: "transparent" }}>O</span>
      </Btn>
      {strokeOn && (
        <span className="tt-color-wrap" onMouseDown={(e) => e.preventDefault()}>
          <ColorPicker
            value={strokeColor}
            themeColors={themeColors}
            title="Cor do contorno"
            onChange={(c) => setStyle("textStroke", `1px ${c}`)}
          />
        </span>
      )}

      <span className="tt-sep" />

      {/* Lists */}
      <Btn title="Lista com marcadores" active={editor.isActive("bulletList")} onRun={() => chain().toggleBulletList().run()}>
        •
      </Btn>
      <Btn title="Lista numerada" active={editor.isActive("orderedList")} onRun={() => chain().toggleOrderedList().run()}>
        1.
      </Btn>

      <span className="tt-sep" />

      {/* Alignment (incl. justify) */}
      <Btn title="Alinhar à esquerda" active={editor.isActive({ textAlign: "left" })} onRun={() => chain().setTextAlign("left").run()}>
        ⯇
      </Btn>
      <Btn title="Centralizar" active={editor.isActive({ textAlign: "center" })} onRun={() => chain().setTextAlign("center").run()}>
        ⊟
      </Btn>
      <Btn title="Alinhar à direita" active={editor.isActive({ textAlign: "right" })} onRun={() => chain().setTextAlign("right").run()}>
        ⯈
      </Btn>
      <Btn title="Justificar" active={editor.isActive({ textAlign: "justify" })} onRun={() => chain().setTextAlign("justify").run()}>
        ≣
      </Btn>

      <span className="tt-sep" />

      {/* Font family + size */}
      <select
        className="tt-select"
        title="Fonte"
        value={ts.fontFamily ?? ""}
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => onFontChange(e.target.value)}
      >
        {FONT_FAMILIES.map((f) => (
          <option key={f.label} value={f.value} style={{ fontFamily: f.value || undefined }}>
            {f.label}
          </option>
        ))}
        {customFonts.length > 0 && (
          <optgroup label="Importadas">
            {customFonts.map((f) => (
              <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                {f.label}
              </option>
            ))}
          </optgroup>
        )}
        <option value={IMPORT_FONT}>＋ Importar fonte do PC…</option>
      </select>
      <input
        className="tt-select tt-size"
        type="number"
        title="Tamanho da fonte"
        list="tt-size-list"
        min={4}
        max={400}
        placeholder="Auto"
        value={curSize}
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => setStyle("fontSize", e.target.value ? `${e.target.value}px` : null)}
      />
      <datalist id="tt-size-list">
        {FONT_SIZES.map((s) => <option key={s} value={s} />)}
      </datalist>

      <span className="tt-sep" />

      {/* Line height */}
      <select
        className="tt-select"
        title="Espaçamento entre linhas"
        value={paraAttrs.lineHeight ?? ""}
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => setLineHeight(e.target.value || null)}
      >
        {LINE_HEIGHTS.map((lh) => (
          <option key={lh.value} value={lh.value}>{lh.label}</option>
        ))}
      </select>
      {/* Letter spacing */}
      <select
        className="tt-select"
        title="Espaçamento entre letras"
        value={ts.letterSpacing ?? ""}
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => setStyle("letterSpacing", e.target.value || null)}
      >
        {LETTER_SPACINGS.map((ls) => (
          <option key={ls.value} value={ls.value}>{ls.label}</option>
        ))}
      </select>
    </div>
  );
}
