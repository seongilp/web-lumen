// Local face detection (MediaPipe BlazeFace, short-range). Runs 100% in the
// browser on the WASM runtime and model bundled under public/ — no upload, no
// CDN. Detection runs on the small thumbnail, which is plenty for presence.

import { FilesetResolver, FaceDetector } from "@mediapipe/tasks-vision";

let detectorPromise: Promise<FaceDetector> | null = null;

/** Lazily build the detector once. Loads ~11MB of WASM on first call. */
export function loadFaceDetector(): Promise<FaceDetector> {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const base = import.meta.env.BASE_URL;
      const vision = await FilesetResolver.forVisionTasks(`${base}mediapipe/wasm`);
      // CPU (XNNPACK) delegate: a few ms per thumbnail, and unlike the GPU
      // delegate it needs no WebGL — so it works in every browser, on
      // blocklisted GPUs, and headless. Speed is plenty for small thumbnails.
      return await FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `${base}models/blaze_face_short_range.tflite`,
          delegate: "CPU",
        },
        runningMode: "IMAGE",
        minDetectionConfidence: 0.5,
      });
    })().catch((e) => {
      detectorPromise = null; // let a later attempt retry from scratch
      throw e;
    });
  }
  return detectorPromise;
}

export type FaceImage = ImageBitmap | HTMLImageElement | HTMLCanvasElement;

/** Number of faces detected in the image (0 = none). Throws if the model can't
 *  run (e.g. no WebGL) — callers must treat that as fatal, not "no face". */
export function detectFaceCount(detector: FaceDetector, image: FaceImage): number {
  return detector.detect(image).detections.length;
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
