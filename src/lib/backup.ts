// Library backup: pack the whole library (metadata + thumbnails + originals)
// into one downloadable file, and restore it later — even on another browser or
// machine where OPFS started empty.
//
// Container layout:
//   "LUMEN1\n"                       7-byte magic
//   uint32 LE                        header JSON length
//   header JSON (utf-8)              { v, collections, entries:[{ meta, thumb, orig }] }
//   data section                     all thumb + original bytes, at their offsets
//
// Offsets in the header are relative to the start of the data section.

import type { Collection, ImageItem, ManifestItem } from "./types";
import {
  readCollections,
  readManifest,
  readOriginal,
  readThumb,
  writeCollections,
  writeManifest,
  writeOriginal,
  writeThumb,
} from "./opfs";

const MAGIC = "LUMEN1\n";
const MAGIC_LEN = MAGIC.length;

export interface BackupEntry {
  meta: ManifestItem;
  thumb: Uint8Array;
  orig: Uint8Array;
}

// Preserve the full manifest shape — collections, trash state and EXIF included.
function toMeta(it: ImageItem): ManifestItem {
  return {
    id: it.id,
    name: it.name,
    relPath: it.relPath,
    type: it.type,
    size: it.size,
    lastModified: it.lastModified,
    width: it.width,
    height: it.height,
    dominant: it.dominant,
    favorite: it.favorite,
    hash: it.hash,
    phash: it.phash,
    collections: it.collections,
    tags: it.tags,
    trashed: it.trashed,
    takenAt: it.takenAt,
    camera: it.camera,
    lat: it.lat,
    lon: it.lon,
  };
}

/** Pure: serialize entries + collections into the container Blob. */
export function packContainer(entries: BackupEntry[], collections: Collection[] = []): Blob {
  const parts: BlobPart[] = [];
  const index: unknown[] = [];
  let off = 0;
  for (const e of entries) {
    index.push({
      meta: e.meta,
      thumb: { off, len: e.thumb.byteLength },
      orig: { off: off + e.thumb.byteLength, len: e.orig.byteLength },
    });
    parts.push(e.thumb as BlobPart, e.orig as BlobPart);
    off += e.thumb.byteLength + e.orig.byteLength;
  }

  const headerBytes = new TextEncoder().encode(
    JSON.stringify({ v: 1, collections, entries: index })
  );
  const lenBytes = new Uint8Array(4);
  new DataView(lenBytes.buffer).setUint32(0, headerBytes.byteLength, true);

  return new Blob([MAGIC, lenBytes, headerBytes, ...parts], {
    type: "application/octet-stream",
  });
}

export interface UnpackedContainer {
  entries: BackupEntry[];
  collections: Collection[];
}

/** Pure: parse a container back into entries + collections. Throws on a bad file. */
export function unpackContainer(buffer: ArrayBuffer): UnpackedContainer {
  const bytes = new Uint8Array(buffer);
  const magic = new TextDecoder().decode(bytes.subarray(0, MAGIC_LEN));
  if (magic !== MAGIC) throw new Error("올바른 lumen 백업 파일이 아닙니다.");

  const headerLen = new DataView(buffer, MAGIC_LEN, 4).getUint32(0, true);
  const headerStart = MAGIC_LEN + 4;
  const header = JSON.parse(
    new TextDecoder().decode(bytes.subarray(headerStart, headerStart + headerLen))
  );
  const dataStart = headerStart + headerLen;

  const entries = (header.entries as Array<{
    meta: ManifestItem;
    thumb: { off: number; len: number };
    orig: { off: number; len: number };
  }>).map((e) => ({
    meta: e.meta,
    thumb: bytes.subarray(dataStart + e.thumb.off, dataStart + e.thumb.off + e.thumb.len),
    orig: bytes.subarray(dataStart + e.orig.off, dataStart + e.orig.off + e.orig.len),
  }));
  return { entries, collections: Array.isArray(header.collections) ? header.collections : [] };
}

/**
 * Metadata-only backup: a small JSON of the manifest (favorites, collections,
 * trash, EXIF, hashes) with NO image bytes. Restore this, then re-drop the
 * source folder — matching ids re-attach organization without the huge payload.
 */
export function exportMeta(items: ImageItem[], collections: Collection[] = []): Blob {
  // Trashed items are still "ready", so trash state is preserved.
  const entries = items.filter((it) => it.status === "ready").map(toMeta);
  return new Blob([JSON.stringify({ lumen: "meta", v: 1, collections, entries })], {
    type: "application/json",
  });
}

/** Read the whole library out of OPFS into a downloadable backup Blob. */
export async function exportLibrary(
  items: ImageItem[],
  collections: Collection[] = []
): Promise<Blob> {
  const entries: BackupEntry[] = [];
  for (const it of items.filter((i) => i.status === "ready")) {
    const [thumb, orig] = await Promise.all([readThumb(it.id), readOriginal(it.id)]);
    entries.push({
      meta: toMeta(it),
      thumb: thumb ? new Uint8Array(await thumb.arrayBuffer()) : new Uint8Array(0),
      orig: orig ? new Uint8Array(await orig.arrayBuffer()) : new Uint8Array(0),
    });
  }
  return packContainer(entries, collections);
}

// Merge imported collections into existing OPFS collections (by id).
async function mergeCollections(incoming: Collection[]): Promise<void> {
  if (!incoming.length) return;
  const existing = await readCollections();
  const byId = new Map(existing.map((c) => [c.id, c]));
  for (const c of incoming) byId.set(c.id, c);
  await writeCollections([...byId.values()]);
}

export type ImportMode = "full" | "meta";

/**
 * Restore a backup file into OPFS, auto-detecting full (binary container with
 * image bytes) vs meta-only (JSON). Merges with existing entries (same id wins).
 */
export async function importLibrary(
  file: File
): Promise<{ count: number; mode: ImportMode }> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const head = new TextDecoder().decode(bytes.subarray(0, MAGIC_LEN));

  const existing = await readManifest();
  const byId = new Map<string, ManifestItem>(existing.map((m) => [m.id, m]));

  if (head === MAGIC) {
    const { entries, collections } = unpackContainer(buffer);
    for (const e of entries) {
      // .slice() yields a right-sized, standalone ArrayBuffer for OPFS to write.
      if (e.thumb.byteLength) await writeThumb(e.meta.id, e.thumb.slice().buffer);
      if (e.orig.byteLength) await writeOriginal(e.meta.id, e.orig.slice().buffer);
      byId.set(e.meta.id, e.meta);
    }
    await writeManifest([...byId.values()]);
    await mergeCollections(collections);
    return { count: entries.length, mode: "full" };
  }

  // Metadata-only JSON backup.
  let parsed: { lumen?: string; entries?: ManifestItem[]; collections?: Collection[] };
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error("올바른 lumen 백업 파일이 아닙니다.");
  }
  if (parsed?.lumen !== "meta" || !Array.isArray(parsed.entries)) {
    throw new Error("올바른 lumen 백업 파일이 아닙니다.");
  }
  for (const m of parsed.entries) byId.set(m.id, m);
  await writeManifest([...byId.values()]);
  await mergeCollections(Array.isArray(parsed.collections) ? parsed.collections : []);
  return { count: parsed.entries.length, mode: "meta" };
}
