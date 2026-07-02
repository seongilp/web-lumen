/// <reference lib="webworker" />
// Thumbnail worker: decode → WASM downscale → encode → persist to OPFS.
// All heavy lifting happens here so the main thread never janks while the
// user scrolls a freshly-dropped folder of thousands of images.

import exifr from "exifr";
import { writeThumb, writeOriginalStream } from "../lib/opfs";
import { mapExif, EXIF_PICK, type Exif } from "../lib/exif";
import type { ThumbRequest, ThumbResponse } from "../lib/types";

// Best-effort EXIF extraction: capture date, camera, GPS. Non-EXIF formats
// (PNG/webp/gif) just return an empty object.
async function readExif(file: File): Promise<Exif> {
  try {
    return mapExif(await exifr.parse(file, { pick: EXIF_PICK, gps: true }));
  } catch {
    return {};
  }
}

const THUMB_MAX = 320; // longest edge of the stored thumbnail
const DECODE_MAX = 640; // longest edge fed into the WASM box filter

interface WasmExports {
  memory: WebAssembly.Memory;
  alloc(size: number): number;
  release(ptr: number): void;
  downscale(
    srcPtr: number,
    sw: number,
    sh: number,
    dstPtr: number,
    dw: number,
    dh: number
  ): void;
  dominantColor(srcPtr: number, pixels: number): number;
  dhash(srcPtr: number, sw: number, sh: number, outPtr: number): void;
}

let wasmReady: Promise<WasmExports> | null = null;

function initWasm(): Promise<WasmExports> {
  if (wasmReady) return wasmReady;
  wasmReady = (async () => {
    const importObject = {
      env: {
        abort() {
          throw new Error("wasm: abort()");
        },
      },
    };
    // Respect Vite's base path (e.g. "/wasmi/") so the .wasm resolves both on
    // localhost ("/") and under the GitHub Pages project subpath.
    const url = new URL(`${import.meta.env.BASE_URL}wasm/thumb.wasm`, self.location.href).href;
    let instance: WebAssembly.Instance;
    try {
      const res = await WebAssembly.instantiateStreaming(fetch(url), importObject);
      instance = res.instance;
    } catch {
      // Fallback when the server doesn't send application/wasm.
      const bytes = await fetch(url).then((r) => r.arrayBuffer());
      const res = await WebAssembly.instantiate(bytes, importObject);
      instance = res.instance;
    }
    return instance.exports as unknown as WasmExports;
  })();
  return wasmReady;
}

function fit(w: number, h: number, max: number): [number, number] {
  const scale = Math.min(1, max / Math.max(w, h));
  return [Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale))];
}

const SIG_BYTES = 32 * 1024; // head + tail sample size for the signature

function fnv1aHex(bytes: Uint8Array): string {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/**
 * Stable content signature: size + first/last 32 KB, hashed. Two files with
 * identical bytes always share it — memory-safe even for huge images since we
 * never read the whole file. SHA-256 when available, FNV fallback otherwise.
 */
async function fileSignature(file: File): Promise<string> {
  const head = new Uint8Array(await file.slice(0, SIG_BYTES).arrayBuffer());
  const tail =
    file.size > SIG_BYTES
      ? new Uint8Array(await file.slice(file.size - SIG_BYTES).arrayBuffer())
      : new Uint8Array(0);

  const meta = new Uint8Array(8);
  new DataView(meta.buffer).setFloat64(0, file.size);

  const buf = new Uint8Array(meta.length + head.length + tail.length);
  buf.set(meta, 0);
  buf.set(head, meta.length);
  buf.set(tail, meta.length + head.length);

  if (crypto?.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 32);
  }
  return `${file.size.toString(16)}-${fnv1aHex(head)}-${fnv1aHex(tail)}`;
}

async function makeThumb(
  wasm: WasmExports,
  file: File
): Promise<{
  width: number;
  height: number;
  dominant: number;
  phash: string;
  thumb: Blob;
}> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const natW = bmp.width;
  const natH = bmp.height;

  // 1) GPU-assisted downscale to a bounded intermediate, then read RGBA.
  const [dw, dh] = fit(natW, natH, DECODE_MAX);
  const stage = new OffscreenCanvas(dw, dh);
  const sctx = stage.getContext("2d", { willReadFrequently: true })!;
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = "high";
  sctx.drawImage(bmp, 0, 0, dw, dh);
  bmp.close();
  const src = sctx.getImageData(0, 0, dw, dh);

  // 2) WASM area-average box filter to the final thumbnail size.
  const [tw, th] = fit(dw, dh, THUMB_MAX);
  const srcLen = src.data.length;
  const srcPtr = wasm.alloc(srcLen);
  new Uint8Array(wasm.memory.buffer, srcPtr, srcLen).set(src.data);

  const dstLen = tw * th * 4;
  const dstPtr = wasm.alloc(dstLen); // may grow memory; srcPtr stays valid
  wasm.downscale(srcPtr, dw, dh, dstPtr, tw, th);
  const dominant = wasm.dominantColor(srcPtr, dw * dh);

  // Perceptual hash (dHash) from the same source buffer.
  const hashPtr = wasm.alloc(8);
  wasm.dhash(srcPtr, dw, dh, hashPtr);
  const words = new Uint32Array(wasm.memory.buffer, hashPtr, 2);
  const phash =
    (words[1] >>> 0).toString(16).padStart(8, "0") +
    (words[0] >>> 0).toString(16).padStart(8, "0");
  wasm.release(hashPtr);

  const out = new Uint8ClampedArray(dstLen);
  out.set(new Uint8Array(wasm.memory.buffer, dstPtr, dstLen));
  wasm.release(srcPtr);
  wasm.release(dstPtr);

  // 3) Encode the thumbnail.
  const tc = new OffscreenCanvas(tw, th);
  tc.getContext("2d")!.putImageData(new ImageData(out, tw, th), 0, 0);
  const thumb = await tc.convertToBlob({ type: "image/webp", quality: 0.82 });

  return { width: natW, height: natH, dominant, phash, thumb };
}

self.onmessage = async (e: MessageEvent<ThumbRequest>) => {
  const { id, file, persistOriginal } = e.data;
  try {
    const wasm = await initWasm();
    const [{ width, height, dominant, phash, thumb }, hash, exif] = await Promise.all([
      makeThumb(wasm, file),
      fileSignature(file),
      readExif(file),
    ]);

    // Persist the thumbnail to OPFS for instant reloads. Retry once on a
    // transient failure (e.g. write contention during a big burst).
    try {
      await writeThumb(id, thumb);
    } catch {
      try {
        await new Promise((r) => setTimeout(r, 50));
        await writeThumb(id, thumb);
      } catch {
        /* no OPFS — in-memory only */
      }
    }
    if (persistOriginal) {
      // Fire-and-forget: don't block thumbnail delivery on the larger write.
      writeOriginalStream(id, file).catch(() => void 0);
    }

    const res: ThumbResponse = {
      id,
      ok: true,
      width,
      height,
      dominant,
      hash,
      phash,
      thumb,
      ...exif,
    };
    self.postMessage(res);
  } catch (err) {
    const res: ThumbResponse = {
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(res);
  }
};
