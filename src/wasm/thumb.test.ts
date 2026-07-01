// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

interface Wasm {
  memory: WebAssembly.Memory;
  alloc(size: number): number;
  release(ptr: number): void;
  downscale(s: number, sw: number, sh: number, d: number, dw: number, dh: number): void;
  dominantColor(ptr: number, pixels: number): number;
  dhash(ptr: number, sw: number, sh: number, outPtr: number): void;
}

let wasm: Wasm;

beforeAll(async () => {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const bytes = readFileSync(path.resolve(dir, "../../public/wasm/thumb.wasm"));
  const { instance } = await WebAssembly.instantiate(bytes, {
    env: {
      abort() {
        throw new Error("wasm abort");
      },
    },
  });
  wasm = instance.exports as unknown as Wasm;
});

// Write an RGBA pixel array into wasm memory, returning the pointer.
function writeRGBA(pixels: number[]): number {
  const ptr = wasm.alloc(pixels.length);
  new Uint8Array(wasm.memory.buffer, ptr, pixels.length).set(pixels);
  return ptr;
}

describe("wasm downscale", () => {
  it("area-averages a 2x2 image down to 1x1", () => {
    // Four corners: black, red, green, blue.
    const src = writeRGBA([
      0, 0, 0, 255, 255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255,
    ]);
    const dst = wasm.alloc(4);
    wasm.downscale(src, 2, 2, dst, 1, 1);
    const out = new Uint8Array(wasm.memory.buffer, dst, 4);
    // Average of the four: r=g=b = (0+255)/4 rounded = 63, alpha 255.
    expect([...out]).toEqual([63, 63, 63, 255]);
    wasm.release(src);
    wasm.release(dst);
  });

  it("keeps a solid color unchanged", () => {
    const px = [10, 20, 30, 255];
    const src = writeRGBA([...px, ...px, ...px, ...px]);
    const dst = wasm.alloc(4);
    wasm.downscale(src, 2, 2, dst, 1, 1);
    expect([...new Uint8Array(wasm.memory.buffer, dst, 4)]).toEqual(px);
  });
});

describe("wasm dominantColor", () => {
  it("returns the packed average color", () => {
    const src = writeRGBA([
      0, 0, 0, 255, 255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255,
    ]);
    const packed = wasm.dominantColor(src, 4) >>> 0;
    // r=g=b=63 → 0x3f3f3f
    expect(packed).toBe(0x3f3f3f);
  });
});

describe("wasm dhash", () => {
  // Build a sw x sh grayscale image from a per-column value function.
  function gradientHash(sw: number, sh: number, valAt: (col: number) => number): string {
    const px: number[] = [];
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const v = valAt(x);
        px.push(v, v, v, 255);
      }
    }
    const src = writeRGBA(px);
    const outPtr = wasm.alloc(8);
    wasm.dhash(src, sw, sh, outPtr);
    const w = new Uint32Array(wasm.memory.buffer, outPtr, 2);
    const hex =
      (w[1] >>> 0).toString(16).padStart(8, "0") +
      (w[0] >>> 0).toString(16).padStart(8, "0");
    wasm.release(src);
    wasm.release(outPtr);
    return hex;
  }

  it("is identical for identical inputs", () => {
    const h1 = gradientHash(9, 8, (c) => c * 20);
    const h2 = gradientHash(9, 8, (c) => c * 20);
    expect(h1).toBe(h2);
  });

  it("increasing gradient → all bits 0 (left < right everywhere)", () => {
    expect(gradientHash(9, 8, (c) => c * 20)).toBe("0000000000000000");
  });

  it("decreasing gradient → all 64 bits set (left > right everywhere)", () => {
    expect(gradientHash(9, 8, (c) => 200 - c * 20)).toBe("ffffffffffffffff");
  });

  it("different images produce different hashes", () => {
    const inc = gradientHash(9, 8, (c) => c * 20);
    const dec = gradientHash(9, 8, (c) => 200 - c * 20);
    expect(inc).not.toBe(dec);
  });
});
