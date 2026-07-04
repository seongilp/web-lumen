// Zip the currently-visible photos and save them — 100% local, no upload.
// Streams straight to disk via showSaveFilePicker when available so a multi-GB
// folder never has to fit in memory; falls back to an in-memory blob otherwise.

import { downloadZip } from "client-zip";
import type { ImageItem } from "./types";

export type ZipResult = "saved" | "cancelled" | "empty";

/** Make every entry name unique — two folders can hold the same filename. */
export function dedupeNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((raw) => {
    const name = raw || "image";
    const n = seen.get(name.toLowerCase()) ?? 0;
    seen.set(name.toLowerCase(), n + 1);
    if (n === 0) return name;
    const dot = name.lastIndexOf(".");
    return dot > 0
      ? `${name.slice(0, dot)} (${n})${name.slice(dot)}`
      : `${name} (${n})`;
  });
}

/** Strip characters that browsers dislike in a download filename. */
function safeName(s: string): string {
  return s.replace(/[\\/:*?"<>|#]+/g, "_").replace(/\s+/g, " ").trim() || "photos";
}

interface ZipInput {
  name: string;
  input: Blob;
  lastModified: Date;
}

const hasSavePicker = () =>
  typeof (globalThis as unknown as { showSaveFilePicker?: unknown })
    .showSaveFilePicker === "function";

/**
 * Zip `items` (already the visible/filtered list) and save to disk.
 * @param loadOriginal resolves an item id to its original File (or null if gone).
 * @param onProgress called after each original is read (done, total).
 */
export async function downloadPhotosZip(
  items: ImageItem[],
  loadOriginal: (id: string) => Promise<File | null>,
  archiveName: string,
  onProgress?: (done: number, total: number) => void
): Promise<ZipResult> {
  const ready = items.filter((it) => it.status === "ready");
  if (ready.length === 0) return "empty";

  const names = dedupeNames(ready.map((it) => it.name));
  const suggestedName = `${safeName(archiveName)}.zip`;
  const total = ready.length;

  // Ask for the save location up front (needs the click's user gesture) so the
  // stream has somewhere to go before we start reading originals.
  let writable: FileSystemWritableFileStream | null = null;
  if (hasSavePicker()) {
    try {
      const handle = await (
        globalThis as unknown as {
          showSaveFilePicker: (o: unknown) => Promise<FileSystemFileHandle>;
        }
      ).showSaveFilePicker({
        suggestedName,
        types: [{ description: "ZIP archive", accept: { "application/zip": [".zip"] } }],
      });
      writable = await handle.createWritable();
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
      writable = null; // picker failed for another reason → fall back to blob
    }
  }

  // Lazily read one original at a time; the output stream's backpressure keeps
  // memory flat even for thousands of files.
  async function* entries(): AsyncGenerator<ZipInput> {
    let done = 0;
    for (let i = 0; i < ready.length; i++) {
      const it = ready[i];
      const file = await loadOriginal(it.id);
      done++;
      onProgress?.(done, total);
      if (!file) continue; // original missing (e.g. never persisted) → skip
      yield {
        name: names[i],
        input: file,
        lastModified: new Date(it.lastModified),
      };
    }
  }

  const zipped = downloadZip(entries());

  if (writable) {
    await zipped.body!.pipeTo(writable);
    return "saved";
  }

  // Fallback: buffer the whole archive, then trigger a normal download.
  const blob = await zipped.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = suggestedName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return "saved";
}
