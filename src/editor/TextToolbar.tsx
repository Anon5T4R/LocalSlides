// Floating formatting toolbar shown while editing a text box. Rendered inside the
// scaled slide container but counter-scaled so it stays a constant on-screen size,
// anchored just above the box. Buttons use onMouseDown+preventDefault so clicking
// them never steals focus from the editor (which would commit and unmount it).

import type { Editor } from "@tiptap/react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { FONT_FAMILIES, FONT_SIZES } from "./tiptapExtensions";

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
  };
  const curSize = ts.fontSize ? String(parseInt(ts.fontSize, 10)) : "";
  const strokeOn = !!ts.textStroke;
  const strokeColor = ts.textStroke?.split(" ").pop() || "#000000";
  const setMark = (attrs: Record<string, unknown>) =>
    editor.chain().focus().setMark("textStyle", attrs).run();

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
        <label className="tt-color" title="Cor do contorno" onMouseDown={(e) => e.preventDefault()}>
          ◐
          <input
            type="color"
            value={strokeColor}
            onChange={(e) => setMark({ textStroke: `1px ${e.target.value}` })}
          />
        </label>
      )}
      <label className="tt-color" title="Cor do texto" onMouseDown={(e) => e.preventDefault()}>
        A
        <input
          type="color"
          onChange={(e) => chain().setColor(e.target.value).run()}
          defaultValue="#1e293b"
        />
      </label>
    </div>
  );
}
