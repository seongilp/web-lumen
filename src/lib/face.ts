// Local face detection (MediaPipe BlazeFace, short-range). Runs 100% in the
// browser on the WASM runtime and model bundled under public/ — no upload, no
// CDN. Detection runs in a Web Worker (off the main thread) using the GPU
// delegate for speed, on the small thumbnail which is plenty for presence.

/** A worker-backed detector. `detect` transfers the bitmap (closed by worker). */
export interface FaceScanner {
  detect(bitmap: ImageBitmap): Promise<number>;
  close(): void;
}

/** Spin up the detection worker and wait until the model is ready. Throws if
 *  the model can't run at all (neither GPU nor CPU) — callers treat as fatal. */
export async function createFaceScanner(): Promise<FaceScanner> {
  const worker = new Worker(new URL("../workers/face.worker.ts", import.meta.url), {
    type: "module",
  });
  const base = import.meta.env.BASE_URL;
  const wasmBase = new URL(`${base}mediapipe/wasm`, self.location.href).href;
  const modelPath = new URL(
    `${base}models/blaze_face_short_range.tflite`,
    self.location.href
  ).href;

  await new Promise<void>((resolve, reject) => {
    const onInit = (e: MessageEvent) => {
      if (e.data?.type === "ready") {
        worker.removeEventListener("message", onInit);
        resolve();
      } else if (e.data?.type === "error") {
        worker.removeEventListener("message", onInit);
        reject(new Error(e.data.error));
      }
    };
    worker.addEventListener("message", onInit);
    worker.postMessage({ type: "init", wasmBase, modelPath });
  });

  let seq = 0;
  const pending = new Map<number, { resolve: (n: number) => void }>();
  worker.addEventListener("message", (e: MessageEvent) => {
    const m = e.data;
    if (m?.type !== "result") return;
    const p = pending.get(m.req);
    if (!p) return;
    pending.delete(m.req);
    p.resolve(m.count); // count === -1 signals a detection error (fatal upstream)
  });

  return {
    detect(bitmap: ImageBitmap): Promise<number> {
      const req = seq++;
      return new Promise<number>((resolve) => {
        pending.set(req, { resolve });
        worker.postMessage({ type: "detect", req, bitmap }, [bitmap]);
      });
    },
    close() {
      worker.terminate();
    },
  };
}

/** True once at least one face scan has run, so new imports auto-scan. */
const ENABLED_KEY = "web-lumen:face-scan-enabled";

export function faceScanEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === "1";
  } catch {
    return false;
  }
}

export function setFaceScanEnabled(): void {
  try {
    localStorage.setItem(ENABLED_KEY, "1");
  } catch {
    /* private mode — auto-scan just won't persist across reloads */
  }
}
