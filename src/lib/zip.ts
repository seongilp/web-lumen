// Zip the chosen photos and download them — 100% local, no upload.
// Builds the archive as a Blob and triggers a normal browser download (lands in
// the Downloads folder). Large Blobs are backed by the browser's on-disk blob
// store, so this stays viable even for big selections.

import { downloadZip } from "client-zip";
import type { ImageItem } from "./types";

export interface ZipOutcome {
  result: "saved" | "empty";
  /** How many originals actually made it into the archive. */
  written: number;
  /** Originals that couldn't be read (permission denied / file gone). */
  skipped: number;
}

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

/**
 * Zip `items` and download the archive.
 * @param loadOriginal resolves an item id to its original File (or null if gone).
 * @param onProgress called after each original is read (done, total).
 */
export async function downloadPhotosZip(
  items: ImageItem[],
  loadOriginal: (id: string) => Promise<File | null>,
  archiveName: string,
  onProgress?: (done: number, total: number) => void
): Promise<ZipOutcome> {
  const ready = items.filter((it) => it.status === "ready");
  if (ready.length === 0) return { result: "empty", written: 0, skipped: 0 };

  const names = dedupeNames(ready.map((it) => it.name));
  const suggestedName = `${safeName(archiveName)}.zip`;
  const total = ready.length;

  let written = 0;
  let skipped = 0;

  // Read one original at a time so we never hold them all in memory at once.
  async function* entries() {
    for (let i = 0; i < ready.length; i++) {
      const it = ready[i];
      const file = await loadOriginal(it.id).catch(() => null);
      onProgress?.(i + 1, total);
      if (!file) {
        skipped++;
        continue;
      }
      written++;
      yield {
        name: names[i],
        input: file,
        lastModified: new Date(it.lastModified),
      };
    }
  }

  const blob = await downloadZip(entries()).blob();
  if (written === 0) return { result: "empty", written: 0, skipped };

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = suggestedName;
  a.click();
  // Revoke later — revoking in the same tick can abort a large download.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return { result: "saved", written, skipped };
}
