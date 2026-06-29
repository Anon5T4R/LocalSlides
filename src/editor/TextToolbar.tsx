// Floating formatting toolbar shown while editing a text box. Rendered inside the
// scaled slide container but counter-scaled so it stays a constant on-screen size,
// anchored just above the box. Buttons use onMouseDown+preventDefault so clicking
// them never steals focus from the editor (which would commit and unmount it).

import type { Editor } from "@tiptap/react";
import type { MouseEvent as ReactMouseEvent } from "react";

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
