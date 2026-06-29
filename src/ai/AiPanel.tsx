import { useEffect, useRef, useState } from "react";
import { LocalAi } from "./useLocalAi";

interface AiPanelProps {
  ai: LocalAi;
  onClose: () => void;
}

export function AiPanel({ ai, onClose }: AiPanelProps) {
  const [input, setInput] = useState("");
  const [topic, setTopic] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [ai.messages]);

  const statusDot =
    ai.status === "ready" ? "#22c55e" : ai.status === "loading" ? "#eab308" : ai.status === "error" ? "#ef4444" : "#9ca3af";

  const configDisabled = ai.status === "ready" || ai.status === "loading";

  return (
    <aside className="ai-panel">
      <div className="ai-header">
        <span className="ai-dot" style={{ background: statusDot }} />
        <strong>IA local</strong>
        <span className="ai-spacer" />
        <button className="tb-btn" onClick={ai.clear} disabled={!ai.messages.length} title="Limpar conversa">🗑</button>
        <button className="tb-btn" onClick={onClose} title="Fechar painel">✕</button>
      </div>

      <div className="ai-config">
        <label className="ai-field">
          <span>Pasta de modelos</span>
          <div className="ai-row">
            <input value={ai.dir} onChange={(e) => ai.setDir(e.target.value)} spellCheck={false} />
            <button className="tb-btn" onClick={ai.scan}>Escanear</button>
          </div>
        </label>

        <label className="ai-field">
          <span>Modelo ({ai.models.filter((m) => !m.is_projector).length} encontrados)</span>
          <select value={ai.modelPath} onChange={(e) => ai.setModelPath(e.target.value)} disabled={configDisabled}>
            <option value="">— escolher —</option>
            {ai.models.filter((m) => !m.is_projector).map((m) => (
              <option key={m.path} value={m.path}>{m.name} · {m.size_gb.toFixed(2)} GB</option>
            ))}
          </select>
        </label>

        <div className="ai-row ai-tune">
          <label title="Camadas na GPU (0 = só CPU)">
            GPU layers
            <input type="number" min={0} max={999} value={ai.ngl} onChange={(e) => ai.setNgl(Number(e.target.value))} disabled={configDisabled} />
          </label>
          <label title="Tamanho do contexto">
            Contexto
            <input type="number" min={512} step={512} value={ai.ctx} onChange={(e) => ai.setCtx(Number(e.target.value))} disabled={configDisabled} />
          </label>
          {ai.status === "ready" ? (
            <button className="tb-btn ai-stop" onClick={ai.stop}>Parar</button>
          ) : (
            <button className="tb-btn ai-start" onClick={ai.start} disabled={ai.status === "loading"}>
              {ai.status === "loading" ? "Carregando…" : "Iniciar"}
            </button>
          )}
        </div>

        {ai.status === "ready" && ai.port > 0 && <div className="ai-status-msg">Servidor na porta {ai.port}.</div>}
        {ai.statusMsg && <div className="ai-status-msg">{ai.statusMsg}</div>}
      </div>

      <div className="ai-gen">
        <span className="ai-gen-title">🪄 Gerar apresentação</span>
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Tema/assunto (ex.: 'Introdução à fotossíntese para o ensino médio')"
          disabled={!ai.ready || ai.streaming}
          rows={2}
        />
        <div className="ai-row">
          <button
            className="tb-btn ai-start"
            onClick={() => ai.generateDeck(topic, "replace")}
            disabled={!ai.ready || ai.streaming || !topic.trim()}
            title="Substitui o deck atual pelos slides gerados"
          >
            Gerar (novo deck)
          </button>
          <button
            className="tb-btn"
            onClick={() => ai.generateDeck(topic, "append")}
            disabled={!ai.ready || ai.streaming || !topic.trim()}
            title="Adiciona os slides gerados ao deck atual"
          >
            Adicionar ao deck
          </button>
        </div>
      </div>

      <div className="ai-messages" ref={scrollRef}>
        {ai.messages.length === 0 && (
          <div className="ai-empty">
            Inicie um modelo, depois gere uma apresentação a partir de um tema ou converse com a IA.
          </div>
        )}
        {ai.messages.map((m, i) => (
          <div key={i} className={`ai-msg ai-${m.role}`}>
            {m.role === "assistant" && m.reasoning && (
              <details className="ai-reasoning" open={!m.content}>
                <summary>💭 Raciocínio</summary>
                <div className="ai-reasoning-body">{m.reasoning}</div>
              </details>
            )}
            <div className="ai-msg-body">
              {m.content || (ai.streaming && i === ai.messages.length - 1 && !m.reasoning ? "…" : "")}
            </div>
          </div>
        ))}
      </div>

      <form className="ai-input" onSubmit={(e) => { e.preventDefault(); ai.sendChat(input); setInput(""); }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ai.sendChat(input);
              setInput("");
            }
          }}
          placeholder={ai.ready ? "Pergunte algo… (Enter envia, Shift+Enter quebra linha)" : "Inicie um modelo para conversar"}
          disabled={!ai.ready}
          rows={2}
        />
        {ai.streaming ? (
          <button type="button" className="tb-btn" onClick={ai.abort}>Parar</button>
        ) : (
          <button type="submit" className="tb-btn ai-start" disabled={!ai.ready || !input.trim()}>Enviar</button>
        )}
      </form>
    </aside>
  );
}
