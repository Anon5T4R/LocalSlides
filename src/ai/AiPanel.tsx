import { useEffect, useRef, useState } from "react";
import { LocalAi } from "./useLocalAi";
import { t } from "../lib/i18n";

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
        <strong>{t("aip.title")}</strong>
        <span className="ai-spacer" />
        <button className="tb-btn" onClick={ai.clear} disabled={!ai.messages.length} title={t("aip.clearTitle")}>🗑</button>
        <button className="tb-btn" onClick={onClose} title={t("aip.closeTitle")}>✕</button>
      </div>

      <div className="ai-config">
        <label className="ai-field">
          <span>{t("aip.modelsFolder")}</span>
          <div className="ai-row">
            <input value={ai.dir} onChange={(e) => ai.setDir(e.target.value)} spellCheck={false} />
            <button className="tb-btn" onClick={ai.scan}>{t("aip.scan")}</button>
          </div>
        </label>

        <label className="ai-field">
          <span>{t("aip.modelCount", { n: ai.models.filter((m) => !m.is_projector).length })}</span>
          <select value={ai.modelPath} onChange={(e) => ai.setModelPath(e.target.value)} disabled={configDisabled}>
            <option value="">{t("aip.choose")}</option>
            {ai.models.filter((m) => !m.is_projector).map((m) => (
              <option key={m.path} value={m.path}>{m.name} · {m.size_gb.toFixed(2)} GB</option>
            ))}
          </select>
        </label>

        <div className="ai-row ai-tune">
          <label title={t("aip.gpuTitle")}>
            {t("aip.gpuLayers")}
            <input type="number" min={0} max={999} value={ai.ngl} onChange={(e) => ai.setNgl(Number(e.target.value))} disabled={configDisabled} />
          </label>
          <label title={t("aip.ctxTitle")}>
            {t("aip.ctx")}
            <input type="number" min={512} step={512} value={ai.ctx} onChange={(e) => ai.setCtx(Number(e.target.value))} disabled={configDisabled} />
          </label>
          {ai.status === "ready" ? (
            <button className="tb-btn ai-stop" onClick={ai.stop}>{t("aip.stop")}</button>
          ) : (
            <button className="tb-btn ai-start" onClick={ai.start} disabled={ai.status === "loading"}>
              {ai.status === "loading" ? t("aip.loading") : t("aip.start")}
            </button>
          )}
        </div>

        {ai.status === "ready" && ai.port > 0 && <div className="ai-status-msg">{t("aip.serverPort", { port: ai.port })}</div>}
        {ai.statusMsg && <div className="ai-status-msg">{ai.statusMsg}</div>}
      </div>

      <div className="ai-gen">
        <span className="ai-gen-title">{t("aip.genTitle")}</span>
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder={t("aip.topicPlaceholder")}
          disabled={!ai.ready || ai.streaming}
          rows={2}
        />
        <div className="ai-row">
          <button
            className="tb-btn ai-start"
            onClick={() => ai.generateDeck(topic, "replace")}
            disabled={!ai.ready || ai.streaming || !topic.trim()}
            title={t("aip.replaceTitle")}
          >
            {t("aip.genNew")}
          </button>
          <button
            className="tb-btn"
            onClick={() => ai.generateDeck(topic, "append")}
            disabled={!ai.ready || ai.streaming || !topic.trim()}
            title={t("aip.appendTitle")}
          >
            {t("aip.genAppend")}
          </button>
        </div>
      </div>

      <div className="ai-messages" ref={scrollRef}>
        {ai.messages.length === 0 && (
          <div className="ai-empty">
            {t("aip.empty")}
          </div>
        )}
        {ai.messages.map((m, i) => (
          <div key={i} className={`ai-msg ai-${m.role}`}>
            {m.role === "assistant" && m.reasoning && (
              <details className="ai-reasoning" open={!m.content}>
                <summary>{t("aip.reasoning")}</summary>
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
          placeholder={ai.ready ? t("aip.inputReady") : t("aip.inputIdle")}
          disabled={!ai.ready}
          rows={2}
        />
        {ai.streaming ? (
          <button type="button" className="tb-btn" onClick={ai.abort}>{t("aip.stop")}</button>
        ) : (
          <button type="submit" className="tb-btn ai-start" disabled={!ai.ready || !input.trim()}>{t("aip.send")}</button>
        )}
      </form>
    </aside>
  );
}
