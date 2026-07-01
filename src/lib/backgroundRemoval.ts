// Onda 15.1 — offline background removal via onnxruntime-web (WASM), no cloud
// call. This module does NOT bundle a model (u2net-family weights run
// 5–170MB and have their own licenses) — on first use the app asks the user
// to pick a `.onnx` file from disk (any U2Net/u2netp/silueta export, e.g.
// from the `rembg` project). The chosen path is remembered in localStorage
// so future sessions reload silently.
//
// Assumed model contract — the near-universal U2Net ONNX export shape:
//   input:  1x3xNxN RGB, ImageNet-normalized ((px/255 − mean) / std)
//   output: 1x1xNxN saliency map (sigmoid applied or raw logits — we detect
//           which by checking whether values fall outside [0,1])
// N is read from the actual output tensor, not assumed, but the *input* the
// image is resampled to is fixed at 320×320 (the standard u2net/u2netp
// training resolution). A model trained at a different resolution will still
// run — ONNX doesn't expose that constraint at the JS layer — but may give
// a lower-quality mask. There is no reliable way to detect a mismatched
// model from the outside, so treat results as best-effort.

import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import * as ort from "onnxruntime-web";

ort.env.wasm.wasmPaths = "/ort/";
ort.env.wasm.numThreads = 1; // avoid the threaded WASM build (needs COOP/COEP we don't set)

const MODEL_PATH_KEY = "localslides.bgremove.modelpath";
const INPUT_DIM = 320;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

let cachedSession: ort.InferenceSession | null = null;

export function hasModel(): boolean {
  return !!cachedSession;
}

export function getRememberedModelPath(): string | null {
  return localStorage.getItem(MODEL_PATH_KEY);
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function loadModel(bytes: ArrayBuffer, rememberPath: string): Promise<void> {
  cachedSession = await ort.InferenceSession.create(new Uint8Array(bytes), { executionProviders: ["wasm"] });
  localStorage.setItem(MODEL_PATH_KEY, rememberPath);
}

/** Prompt the user for a .onnx file and load it. Returns false if cancelled. */
export async function pickAndLoadModel(): Promise<boolean> {
  const selected = await openDialog({ multiple: false, filters: [{ name: "Modelo ONNX (U2Net/rembg)", extensions: ["onnx"] }] });
  if (!selected || Array.isArray(selected)) return false;
  const b64 = await invoke<string>("read_file_base64", { path: selected });
  await loadModel(base64ToArrayBuffer(b64), selected);
  return true;
}

/** Load the remembered model silently; falls back to the file picker if that fails. */
export async function ensureModelLoaded(): Promise<boolean> {
  if (hasModel()) return true;
  const remembered = getRememberedModelPath();
  if (remembered) {
    try {
      const b64 = await invoke<string>("read_file_base64", { path: remembered });
      await loadModel(base64ToArrayBuffer(b64), remembered);
      return true;
    } catch {
      // File moved/deleted — fall through to prompting again.
    }
  }
  return pickAndLoadModel();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/** Run background removal on an image; returns a PNG data URL with alpha. */
export async function removeBackground(imageSrc: string): Promise<string> {
  const session = cachedSession;
  if (!session) throw new Error("Nenhum modelo carregado.");

  const img = await loadImage(imageSrc);

  const off = document.createElement("canvas");
  off.width = INPUT_DIM;
  off.height = INPUT_DIM;
  const octx = off.getContext("2d");
  if (!octx) throw new Error("Canvas 2D indisponível.");
  octx.drawImage(img, 0, 0, INPUT_DIM, INPUT_DIM);
  const { data } = octx.getImageData(0, 0, INPUT_DIM, INPUT_DIM);

  const plane = INPUT_DIM * INPUT_DIM;
  const chw = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    chw[i] = (data[i * 4] / 255 - MEAN[0]) / STD[0];
    chw[plane + i] = (data[i * 4 + 1] / 255 - MEAN[1]) / STD[1];
    chw[plane * 2 + i] = (data[i * 4 + 2] / 255 - MEAN[2]) / STD[2];
  }

  const inputName = session.inputNames[0];
  const tensor = new ort.Tensor("float32", chw, [1, 3, INPUT_DIM, INPUT_DIM]);
  const results = await session.run({ [inputName]: tensor });
  const out = results[session.outputNames[0]];
  const outData = out.data as Float32Array;

  let min = Infinity, max = -Infinity;
  for (let i = 0; i < outData.length; i++) {
    if (outData[i] < min) min = outData[i];
    if (outData[i] > max) max = outData[i];
  }
  const needsSigmoid = min < -0.001 || max > 1.001;

  const dims = out.dims;
  const outH = dims[dims.length - 2] ?? INPUT_DIM;
  const outW = dims[dims.length - 1] ?? INPUT_DIM;

  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = outW;
  maskCanvas.height = outH;
  const mctx = maskCanvas.getContext("2d");
  if (!mctx) throw new Error("Canvas 2D indisponível.");
  const maskImg = mctx.createImageData(outW, outH);
  for (let i = 0; i < outW * outH; i++) {
    const raw = needsSigmoid ? sigmoid(outData[i]) : outData[i];
    const a = Math.max(0, Math.min(1, raw)) * 255;
    maskImg.data[i * 4] = 255;
    maskImg.data[i * 4 + 1] = 255;
    maskImg.data[i * 4 + 2] = 255;
    maskImg.data[i * 4 + 3] = a;
  }
  mctx.putImageData(maskImg, 0, 0);

  const outCanvas = document.createElement("canvas");
  outCanvas.width = img.naturalWidth;
  outCanvas.height = img.naturalHeight;
  const octx2 = outCanvas.getContext("2d");
  if (!octx2) throw new Error("Canvas 2D indisponível.");
  octx2.drawImage(img, 0, 0);
  octx2.globalCompositeOperation = "destination-in";
  octx2.drawImage(maskCanvas, 0, 0, outCanvas.width, outCanvas.height);

  return outCanvas.toDataURL("image/png");
}
