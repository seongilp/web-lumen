// Face detection worker: keeps MediaPipe off the main thread so the UI stays
// smooth during a big scan, and uses the GPU delegate (WebGL in the worker) for
// ~10x faster inference, falling back to CPU where WebGL isn't available.

import { FilesetResolver, FaceDetector } from "@mediapipe/tasks-vision";

type InitMsg = { type: "init"; wasmBase: string; modelPath: string };
type DetectMsg = { type: "detect"; req: number; bitmap: ImageBitmap };
type InMsg = InitMsg | DetectMsg;

let detector: FaceDetector | null = null;

/** A quick detect on a blank bitmap — surfaces a GPU runtime failure (no WebGL)
 *  at init time so we can fall back to CPU before the real scan starts. */
async function warmup(d: FaceDetector): Promise<void> {
  const c = new OffscreenCanvas(64, 64);
  c.getContext("2d");
  const bmp = await createImageBitmap(c);
  try {
    d.detect(bmp);
  } finally {
    bmp.close();
  }
}

async function build(
  vision: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>,
  modelPath: string,
  delegate: "GPU" | "CPU"
): Promise<FaceDetector> {
  return FaceDetector.createFromOptions(vision, {
    baseOptions: { modelAssetPath: modelPath, delegate },
    runningMode: "IMAGE",
    minDetectionConfidence: 0.5,
  });
}

async function init(wasmBase: string, modelPath: string): Promise<void> {
  const vision = await FilesetResolver.forVisionTasks(wasmBase);
  try {
    const gpu = await build(vision, modelPath, "GPU");
    await warmup(gpu); // throws here if the GPU path can't actually run
    detector = gpu;
  } catch {
    const cpu = await build(vision, modelPath, "CPU");
    await warmup(cpu);
    detector = cpu;
  }
}

self.onmessage = async (e: MessageEvent<InMsg>) => {
  const msg = e.data;
  if (msg.type === "init") {
    try {
      await init(msg.wasmBase, msg.modelPath);
      self.postMessage({ type: "ready" });
    } catch (err) {
      self.postMessage({ type: "error", error: String(err) });
    }
    return;
  }
  // detect
  const { req, bitmap } = msg;
  try {
    const count = detector!.detect(bitmap).detections.length;
    self.postMessage({ type: "result", req, count });
  } catch (err) {
    self.postMessage({ type: "result", req, count: -1, error: String(err) });
  } finally {
    bitmap.close();
  }
};
