// Thin OPFS (Origin Private File System) helpers shared by the main thread
// and the thumbnail worker. Layout:
//
//   /thumbs/{id}      webp/jpeg thumbnail bytes
//   /originals/{id}   original image bytes (for full-res viewing after reload)
//   /manifest.json    array of ManifestItem describing the library
//
// OPFS gives us fast, persistent, same-origin storage with no quota prompts
// for reasonable sizes — perfect for an instant-reload image library.

import type { ManifestItem } from "./types";

const THUMBS = "thumbs";
const ORIGINALS = "originals";
const MANIFEST = "manifest.json";

export function opfsSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "storage" in navigator &&
    typeof navigator.storage?.getDirectory === "function"
  );
}

/**
 * Ask the browser to mark our storage as persistent so it isn't evicted under
 * disk pressure — the library then survives a full browser quit + relaunch.
 * Best-effort: returns the granted state (some browsers grant silently).
 */
export async function ensurePersistent(): Promise<boolean> {
  try {
    if ((await navigator.storage.persisted?.()) === true) return true;
    return (await navigator.storage.persist?.()) ?? false;
  } catch {
    return false;
  }
}

async function root(): Promise<FileSystemDirectoryHandle> {
  return navigator.storage.getDirectory();
}

async function subdir(name: string): Promise<FileSystemDirectoryHandle> {
  const r = await root();
  return r.getDirectoryHandle(name, { create: true });
}

async function writeBlob(dir: string, key: string, data: Blob | ArrayBuffer): Promise<void> {
  const d = await subdir(dir);
  const handle = await d.getFileHandle(key, { create: true });
  const writable = await handle.createWritable();
  await writable.write(data);
  await writable.close();
}

async function readFileMaybe(dir: string, key: string): Promise<File | null> {
  try {
    const d = await subdir(dir);
    const handle = await d.getFileHandle(key, { create: false });
    return await handle.getFile();
  } catch {
    return null;
  }
}

export async function writeThumb(id: string, blob: Blob): Promise<void> {
  await writeBlob(THUMBS, id, blob);
}

export async function readThumb(id: string): Promise<File | null> {
  return readFileMaybe(THUMBS, id);
}

/** Stream an original file into OPFS without buffering it fully in memory. */
export async function writeOriginalStream(id: string, file: File): Promise<void> {
  const d = await subdir(ORIGINALS);
  const handle = await d.getFileHandle(id, { create: true });
  const writable = await handle.createWritable();
  await file.stream().pipeTo(writable);
}

export async function readOriginal(id: string): Promise<File | null> {
  return readFileMaybe(ORIGINALS, id);
}

export async function readManifest(): Promise<ManifestItem[]> {
  try {
    const r = await root();
    const handle = await r.getFileHandle(MANIFEST, { create: false });
    const f = await handle.getFile();
    const parsed = JSON.parse(await f.text());
    return Array.isArray(parsed) ? (parsed as ManifestItem[]) : [];
  } catch {
    return [];
  }
}

export async function writeManifest(items: ManifestItem[]): Promise<void> {
  const r = await root();
  const handle = await r.getFileHandle(MANIFEST, { create: true });
  const writable = await handle.createWritable();
  await writable.write(new Blob([JSON.stringify(items)], { type: "application/json" }));
  await writable.close();
}

/** Delete a single image's thumbnail + original from OPFS. */
export async function deleteItem(id: string): Promise<void> {
  for (const dir of [THUMBS, ORIGINALS]) {
    try {
      const d = await subdir(dir);
      await d.removeEntry(id);
    } catch {
      /* already gone — ignore */
    }
  }
}

/** Delete everything we manage. Used by the "Clear library" action. */
export async function clearAll(): Promise<void> {
  const r = await root();
  for (const name of [THUMBS, ORIGINALS, MANIFEST]) {
    try {
      await r.removeEntry(name, { recursive: true });
    } catch {
      /* not present — ignore */
    }
  }
}

/** Approximate bytes used across thumbs + originals. */
export async function estimateUsage(): Promise<number> {
  try {
    const est = await navigator.storage.estimate();
    return est.usage ?? 0;
  } catch {
    return 0;
  }
}
