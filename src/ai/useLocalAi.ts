import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChatMsg,
  ModelInfo,
  completeChat,
  listModels,
  llmStatus,
  startLlm,
  stopLlm,
  streamChat,
  waitHealthy,
} from "../lib/ai";
import { Settings } from "../lib/settings";
import { useStore } from "../state/store";
import { DECKGEN_SYSTEM, parseDeckSpec, specToSlides } from "./deckgen";

export type Status = "stopped" | "loading" | "ready" | "error";

export interface UiMsg {
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  error?: boolean;
}

export interface LocalAi {
  dir: string;
  setDir: (v: string) => void;
  models: ModelInfo[];
  modelPath: string;
  setModelPath: (v: string) => void;
  ngl: number;
  setNgl: (v: number) => void;
  ctx: number;
  setCtx: (v: number) => void;

  status: Status;
  statusMsg: string;
  ready: boolean;
  port: number;
  messages: UiMsg[];
  streaming: boolean;

  scan: () => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  abort: () => void;
  clear: () => void;
  sendChat: (text: string) => Promise<void>;
  /** Generate a deck from a prompt; mode replaces the deck or appends to it. */
  generateDeck: (prompt: string, mode: "replace" | "append") => Promise<void>;
}

export function useLocalAi(
  settings: Settings,
  onPersist: (patch: Partial<Settings>) => void
): LocalAi {
  const [dir, setDir] = useState(settings.modelsDir);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelPath, setModelPath] = useState(settings.lastModelPath);
  const [ngl, setNgl] = useState(settings.ngl);
  const [ctx, setCtx] = useState(settings.ctx);

  const [status, setStatus] = useState<Status>("stopped");
  const [statusMsg, setStatusMsg] = useState("");
  const [messages, setMessages] = useState<UiMsg[]>([]);
  const [streaming, setStreaming] = useState(false);

  const portRef = useRef(0);
  const [port, setPort] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  // Reconnect to an already-running sidecar (e.g. after a UI reload).
  useEffect(() => {
    llmStatus().then((s) => {
      if (s.running) {
        portRef.current = s.port;
        setPort(s.port);
        setStatus("ready");
        setModelPath(s.model);
      }
    }).catch(() => {});
  }, []);

  const scan = useCallback(async () => {
    try {
      const found = await listModels(dir);
      setModels(found);
      const firstChat = found.find((m) => !m.is_projector);
      if (firstChat && !modelPath) setModelPath(firstChat.path);
    } catch (e) {
      setStatusMsg(String(e));
    }
  }, [dir, modelPath]);

  useEffect(() => {
    scan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = useCallback(async () => {
    if (!modelPath) {
      setStatusMsg("Escolha um modelo primeiro.");
      return;
    }
    onPersist({ modelsDir: dir, lastModelPath: modelPath, ngl, ctx });
    setStatus("loading");
    setStatusMsg("Iniciando llama-server e carregando o modelo…");
    try {
      const p = await startLlm(modelPath, ngl, ctx);
      await waitHealthy(p);
      portRef.current = p;
      setPort(p);
      setStatus("ready");
      setStatusMsg("");
    } catch (e) {
      setStatus("error");
      setStatusMsg(String(e));
    }
  }, [modelPath, ngl, ctx, dir, onPersist]);

  const stop = useCallback(async () => {
    abortRef.current?.abort();
    await stopLlm();
    setStatus("stopped");
    setPort(0);
    portRef.current = 0;
    setStatusMsg("");
  }, []);

  const abort = useCallback(() => abortRef.current?.abort(), []);
  const clear = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
  }, []);

  const sendChat = useCallback(
    async (text: string) => {
      if (status !== "ready" || streaming || !text.trim()) return;
      const history = messages
        .filter((m) => !m.error)
        .map((m) => ({ role: m.role, content: m.content }) as ChatMsg);
      const convo: ChatMsg[] = [
        { role: "system", content: "Você é um assistente útil para criação de apresentações de slides. Responda em português, de forma concisa." },
        ...history,
        { role: "user", content: text },
      ];
      setMessages((m) => [...m, { role: "user", content: text }, { role: "assistant", content: "" }]);
      const ac = new AbortController();
      abortRef.current = ac;
      setStreaming(true);
      try {
        await streamChat(
          portRef.current,
          convo,
          (d) => {
            setMessages((m) => {
              const copy = [...m];
              const last = copy[copy.length - 1];
              copy[copy.length - 1] = {
                ...last,
                content: last.content + (d.content ?? ""),
                reasoning: (last.reasoning ?? "") + (d.reasoning ?? "") || undefined,
              };
              return copy;
            });
          },
          { signal: ac.signal }
        );
      } catch (e) {
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: `⚠️ ${e}`, error: true };
          return copy;
        });
      } finally {
        setStreaming(false);
      }
    },
    [status, streaming, messages]
  );

  const generateDeck = useCallback(
    async (prompt: string, mode: "replace" | "append") => {
      if (status !== "ready" || streaming || !prompt.trim()) return;
      setMessages((m) => [
        ...m,
        { role: "user", content: `🪄 Gerar apresentação: ${prompt}` },
        { role: "assistant", content: "Gerando estrutura dos slides…" },
      ]);
      const ac = new AbortController();
      abortRef.current = ac;
      setStreaming(true);
      try {
        const raw = await completeChat(
          portRef.current,
          [
            { role: "system", content: DECKGEN_SYSTEM },
            { role: "user", content: prompt },
          ],
          { temperature: 0.6, signal: ac.signal }
        );
        const spec = parseDeckSpec(raw);
        const store = useStore.getState();
        const slides = specToSlides(store.deck, spec);

        if (mode === "replace") {
          const deck = { ...store.deck, slides };
          store.loadDeck(deck, store.filePath);
        } else {
          store.apply((d) => { d.slides.push(...slides); });
        }
        useStore.getState().setCurrentSlide(slides[0].id);

        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = {
            role: "assistant",
            content: `✓ ${slides.length} slide(s) ${mode === "replace" ? "criados" : "adicionados"}.`,
          };
          return copy;
        });
      } catch (e) {
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: `⚠️ ${e}`, error: true };
          return copy;
        });
      } finally {
        setStreaming(false);
      }
    },
    [status, streaming]
  );

  return {
    dir, setDir, models, modelPath, setModelPath, ngl, setNgl, ctx, setCtx,
    status, statusMsg, ready: status === "ready", port, messages, streaming,
    scan, start, stop, abort, clear, sendChat, generateDeck,
  };
}
