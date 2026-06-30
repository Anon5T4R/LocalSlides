// Floating formatting toolbar shown while editing a text box. Rendered inside the
// scaled slide container but counter-scaled so it stays a constant on-screen size,
// anchored just above the box. Buttons use onMouseDown+preventDefault so clicking
// them never steals focus from the editor (which would commit and unmount it).

import type { Editor } from "@tiptap/react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { FONT_FAMILIES, FONT_SIZES } from "./tiptapExtensions";
import { ColorPicker } from "../ui/ColorPicker";

const LINE_HEIGHTS = [
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

export function TextToolbar({ editor, scale }: { editor: Editor; scale: number }) {
  // Re-render on selection/transaction so active states stay in sync.
  void editor.state.selection;
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
  const highlightOn = !!ts.highlight;
  const setMark = (attrs: Record<string, unknown>) =>
    editor.chain().focus().setMark("textStyle", attrs).run();
  const setParaAttr = (attr: string, value: string | null) =>
    editor.chain().focus().updateAttributes("paragraph", { [attr]: value }).run();

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
      <Btn title="Lista" active={editor.isActive("bulletList")} onRun={() => chain().toggleBulletList().run()}>
        •
      </Btn>
      <Btn title="Lista numerada" active={editor.isActive("orderedList")} onRun={() => chain().toggleOrderedList().run()}>
        1.
      </Btn>
      <span className="tt-sep" />
      <Btn title="Alinhar à esquerda" active={editor.isActive({ textAlign: "left" })} onRun={() => chain().setTextAlign("left").run()}>
        ⬅
      </Btn>
      <Btn title="Centralizar" active={editor.isActive({ textAlign: "center" })} onRun={() => chain().setTextAlign("center").run()}>
        ⬌
      </Btn>
      <Btn title="Alinhar à direita" active={editor.isActive({ textAlign: "right" })} onRun={() => chain().setTextAlign("right").run()}>
        ➡
      </Btn>
      <span className="tt-sep" />
      <select
        className="tt-select"
        title="Fonte"
        value={ts.fontFamily ?? ""}
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => setMark({ fontFamily: e.target.value || null })}
      >
        {FONT_FAMILIES.map((f) => (
          <option key={f.label} value={f.value} style={{ fontFamily: f.value || undefined }}>
            {f.label}
          </option>
        ))}
      </select>
      <select
        className="tt-select tt-size"
        title="Tamanho"
        value={curSize}
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => setMark({ fontSize: e.target.value ? `${e.target.value}px` : null })}
      >
        <option value="">Auto</option>
        {FONT_SIZES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <span className="tt-sep" />
      <Btn
        title="Contorno da letra"
        active={strokeOn}
        onRun={() => setMark({ textStroke: strokeOn ? null : `1px ${strokeColor}` })}
      >
        <span style={{ WebkitTextStroke: "1px currentColor", color: "transparent" }}>O</span>
      </Btn>
      {strokeOn && (
        <span className="tt-color-wrap" onMouseDown={(e) => e.preventDefault()}>
          <ColorPicker
            value={strokeColor}
            onChange={(c) => setMark({ textStroke: `1px ${c}` })}
          />
        </span>
      )}
      <span className="tt-sep" />
      {/* Highlight / realce */}
      <Btn
        title="Realce"
        active={highlightOn}
        onRun={() => setMark({ highlight: highlightOn ? null : "#fde68a" })}
      >
        <span style={{ background: ts.highlight ?? "#fde68a", padding: "0 2px", borderRadius: 2 }}>H</span>
      </Btn>
      {highlightOn && (
        <span className="tt-color-wrap" onMouseDown={(e) => e.preventDefault()}>
          <ColorPicker
            value={ts.highlight ?? "#fde68a"}
            onChange={(c) => setMark({ highlight: c })}
          />
        </span>
      )}
      <span className="tt-sep" />
      {/* Text color */}
      <span className="tt-color-wrap" title="Cor do texto" onMouseDown={(e) => e.preventDefault()}>
        <ColorPicker
          value={ts.color ?? "#1e293b"}
          onChange={(c) => chain().setColor(c).run()}
        />
      </span>
      <span className="tt-sep" />
      {/* Line height */}
      <select
        className="tt-select"
        title="Espaçamento entre linhas"
        value={paraAttrs.lineHeight ?? ""}
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => setParaAttr("lineHeight", e.target.value || null)}
      >
        <option value="">Auto</option>
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
        onChange={(e) => setMark({ letterSpacing: e.target.value || null })}
      >
        {LETTER_SPACINGS.map((ls) => (
          <option key={ls.value} value={ls.value}>{ls.label}</option>
        ))}
      </select>
    </div>
  );
}
