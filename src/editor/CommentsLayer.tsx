// Authoring comment pins on the canvas (editor-only; never presented/exported).
// Pins live at logical coords but counter-scale so they stay a constant size.
// Clicking a pin opens a small popover to read/edit/resolve/delete the comment.

import { type PointerEvent as ReactPointerEvent } from "react";
import { useStore } from "../state/store";
import type { Comment } from "../model/deck";

export function CommentsLayer({
  comments,
  scale,
  activeId,
  onActivate,
}: {
  comments: Comment[];
  scale: number;
  activeId: string | null;
  onActivate: (id: string | null) => void;
}) {
  const updateComment = useStore((s) => s.updateComment);
  const removeComment = useStore((s) => s.removeComment);

  const stop = (e: ReactPointerEvent) => e.stopPropagation();

  return (
    <>
      {comments.map((c, i) => (
        <div
          key={c.id}
          style={{
            position: "absolute",
            left: c.x,
            top: c.y,
            transform: `scale(${1 / scale})`,
            transformOrigin: "top left",
            zIndex: activeId === c.id ? 31 : 30,
          }}
        >
          <button
            className={"comment-pin" + (c.resolved ? " resolved" : "")}
            title={c.text || "Comentário"}
            onPointerDown={stop}
            onClick={(e) => {
              e.stopPropagation();
              onActivate(activeId === c.id ? null : c.id);
            }}
          >
            {i + 1}
          </button>

          {activeId === c.id && (
            <div className="comment-pop" onPointerDown={stop} onClick={(e) => e.stopPropagation()}>
              <textarea
                autoFocus
                placeholder="Escreva um comentário…"
                value={c.text}
                onChange={(e) => updateComment(c.id, { text: e.target.value })}
              />
              <div className="comment-pop-actions">
                <button onClick={() => updateComment(c.id, { resolved: !c.resolved })}>
                  {c.resolved ? "Reabrir" : "Resolver"}
                </button>
                <button onClick={() => removeComment(c.id)}>Excluir</button>
                <button onClick={() => onActivate(null)}>Fechar</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </>
  );
}
