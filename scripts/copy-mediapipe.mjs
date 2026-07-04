// Copy the MediaPipe vision WASM runtime into public/ so it ships with the app
// (100% local — no CDN fetch at runtime). These files are ~11MB each, so we
// generate them from node_modules at build time instead of committing them.
import { mkdir, copyFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const dest = join(root, "public", "mediapipe", "wasm");

// SIMD build + no-SIMD fallback. FilesetResolver picks the right one per browser.
const files = [
  "vision_wasm_internal.js",
  "vision_wasm_internal.wasm",
  "vision_wasm_nosimd_internal.js",
  "vision_wasm_nosimd_internal.wasm",
];

await mkdir(dest, { recursive: true });
for (const f of files) {
  const from = join(src, f);
  try {
    await access(from);
  } catch {
    console.error(`[copy-mediapipe] missing ${from} — is @mediapipe/tasks-vision installed?`);
    process.exit(1);
  }
  await copyFile(from, join(dest, f));
}
console.log(`[copy-mediapipe] copied ${files.length} files → public/mediapipe/wasm`);
