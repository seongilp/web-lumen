// Local face detection (MediaPipe BlazeFace, short-range). Runs 100% in the
// browser on the WASM runtime + model bundled under public/ — no upload, no CDN.
// Runs on the main thread (MediaPipe's WASM loader doesn't initialize inside a
// module worker — "ModuleFactory not set"), using the GPU delegate for speed
// and falling back to CPU. The scan loop yields between images so the UI stays
// responsive. Detection uses the small thumbnail, which is plenty for presence.

import { FilesetResolver, FaceDetector } from "@mediapipe/tasks-vision";

/** A ready detector. `detect` returns the face count; -1 means it couldn't run. */
export interface FaceScanner {
  detect(bitmap: ImageBitmap): Promise<number>;
}

let vision: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>> | null = null;
let modelPath = "";
let detector: FaceDetector | null = null;
let delegate: "GPU" | "CPU" = "GPU";
let loadPromise: Promise<FaceScanner> | null = null;

async function build(del: "GPU" | "CPU"): Promise<void> {
  detector?.close();
  detector = await FaceDetector.createFromOptions(vision!, {
    baseOptions: { modelAssetPath: modelPath, delegate: del },
    runningMode: "IMAGE",
    minDetectionConfidence: 0.5,
  });
  delegate = del;
}

/** Lazily load the detector once. Fetches ~11MB of WASM on first call. */
export function loadFaceScanner(): Promise<FaceScanner> {
  if (!loadPromise) {
    loadPromise = (async () => {
      const base = import.meta.env.BASE_URL;
      vision = await FilesetResolver.forVisionTasks(`${base}mediapipe/wasm`);
      modelPath = `${base}models/blaze_face_short_range.tflite`;
      // Prefer GPU; if this browser can't even create a GPU detector, use CPU.
      try {
        await build("GPU");
      } catch {
        await build("CPU");
      }
      return {
        async detect(bitmap: ImageBitmap): Promise<number> {
          try {
            return detector!.detect(bitmap).detections.length;
          } catch (e) {
            // GPU created but can't actually run here → switch to CPU once, retry.
            if (delegate === "GPU") {
              await build("CPU");
              return detector!.detect(bitmap).detections.length;
            }
            throw e;
          }
        },
      };
    })().catch((e) => {
      loadPromise = null; // allow a later retry from scratch
      throw e;
    });
  }
  return loadPromise;
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
