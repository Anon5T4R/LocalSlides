// Local AI bridge — same shape as the Writer/Sheets: thin Rust command wrappers
// around the llama-server sidecar, plus an OpenAI-compatible streaming client.
// The sidecar listens on 127.0.0.1; the Rust side picks a free port (8100+),
// so we always read the real port back from start_llm / llm_status.

import { invoke } from "@tauri-apps/api/core";

export interface ModelInfo {
  name: string;
  path: string;
  size_gb: number;
  is_projector: boolean;
}

export interface LlmStatus {
  running: boolean;
  port: number;
  model: string;
}

export interface ChatMsg {
  role: "system" | "user" | "assistant";
  content: string;
}

export const DEFAULT_MODELS_DIR = "D:\\LocalAIModels\\.lmstudio\\hub\\models";

// --- Rust command wrappers (Tauri v2 expects camelCase arg keys) ---

export const listModels = (dir: string) => invoke<ModelInfo[]>("list_models", { dir });

export const startLlm = (modelPath: string, nGpuLayers: number, ctxSize: number) =>
  invoke<number>("start_llm", { modelPath, nGpuLayers, ctxSize });

export const stopLlm = () => invoke<void>("stop_llm");

export const llmStatus = () => invoke<LlmStatus>("llm_status");

// --- llama-server HTTP (OpenAI-compatible, 127.0.0.1:port) ---

/** Poll /health until the model is fully loaded, or time out. */
export async function waitHealthy(port: number, timeoutMs = 180000): Promise<void> {
  const start = Date.now();
  for (;;) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/health`);
      if (r.ok) return;
    } catch {
      /* server still warming up */
    }
    if (Date.now() - start > timeoutMs) throw new Error("o modelo demorou demais para carregar");
    await new Promise((res) => setTimeout(res, 500));
  }
}

export interface StreamDelta {
  content?: string;
  reasoning?: string;
}

/**
 * Stream a chat completion. Calls onDelta for each chunk, separating the model's
 * reasoning ("thinking") from the final answer — either the server's
 * `reasoning_content` field or inline <think>…</think> tags.
 */
export async function streamChat(
  port: number,
  messages: ChatMsg[],
  onDelta: (d: StreamDelta) => void,
  opts: { temperature?: number; signal?: AbortSignal } = {}
): Promise<void> {
  const res = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages,
      stream: true,
      temperature: opts.temperature ?? 0.7,
    }),
    signal: opts.signal,
  });
  if (!res.ok || !res.body) throw new Error(`a IA respondeu ${res.status}`);

  let inThink = false;
  const routeContent = (text: string) => {
    while (text.length) {
      if (!inThink) {
        const i = text.indexOf("<think>");
        if (i === -1) {
          onDelta({ content: text });
          return;
        }
        if (i > 0) onDelta({ content: text.slice(0, i) });
        inThink = true;
        text = text.slice(i + "<think>".length);
      } else {
        const j = text.indexOf("</think>");
        if (j === -1) {
          onDelta({ reasoning: text });
          return;
        }
        if (j > 0) onDelta({ reasoning: text.slice(0, j) });
        inThink = false;
        text = text.slice(j + "</think>".length);
      }
    }
  };

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        const delta = JSON.parse(data).choices?.[0]?.delta;
        if (!delta) continue;
        if (delta.reasoning_content) onDelta({ reasoning: delta.reasoning_content });
        if (delta.content) routeContent(delta.content);
      } catch {
        /* ignore partial/keepalive lines */
      }
    }
  }
}

/** Non-streaming convenience: accumulate a full completion into one string. */
export async function completeChat(
  port: number,
  messages: ChatMsg[],
  opts: { temperature?: number; signal?: AbortSignal } = {}
): Promise<string> {
  let out = "";
  await streamChat(port, messages, (d) => { if (d.content) out += d.content; }, opts);
  return out;
}
