// Library backup: pack the whole library (metadata + thumbnails + originals)
// into one downloadable file, and restore it later — even on another browser or
// machine where OPFS started empty.
//
// Container layout:
//   "WASMI1\n"                       7-byte magic
//   uint32 LE                        header JSON length
//   header JSON (utf-8)              { v, entries: [{ meta, thumb:{off,len}, orig:{off,len} }] }
//   data section                     all thumb + original bytes, at their offsets
//
// Offsets in the header are relative to the start of the data section.

import type { ImageItem, ManifestItem } from "./types";
import {
  readManifest,
  readOriginal,
  readThumb,
  writeManifest,
  writeOriginal,
  writeThumb,
} from "./opfs";

const MAGIC = "WASMI1\n";
const MAGIC_LEN = MAGIC.length;

export interface BackupEntry {
  meta: ManifestItem;
  thumb: Uint8Array;
  orig: Uint8Array;
}

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
  };
}

/** Pure: serialize entries into the container Blob. */
export function packContainer(entries: BackupEntry[]): Blob {
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

  const headerBytes = new TextEncoder().encode(JSON.stringify({ v: 1, entries: index }));
  const lenBytes = new Uint8Array(4);
  new DataView(lenBytes.buffer).setUint32(0, headerBytes.byteLength, true);

  return new Blob([MAGIC, lenBytes, headerBytes, ...parts], {
    type: "application/octet-stream",
  });
}

/** Pure: parse a container back into entries. Throws on a bad file. */
export function unpackContainer(buffer: ArrayBuffer): BackupEntry[] {
  const bytes = new Uint8Array(buffer);
  const magic = new TextDecoder().decode(bytes.subarray(0, MAGIC_LEN));
  if (magic !== MAGIC) throw new Error("올바른 wasmi 백업 파일이 아닙니다.");

  const headerLen = new DataView(buffer, MAGIC_LEN, 4).getUint32(0, true);
  const headerStart = MAGIC_LEN + 4;
  const header = JSON.parse(
    new TextDecoder().decode(bytes.subarray(headerStart, headerStart + headerLen))
  );
  const dataStart = headerStart + headerLen;

  return (header.entries as Array<{
    meta: ManifestItem;
    thumb: { off: number; len: number };
    orig: { off: number; len: number };
  }>).map((e) => ({
    meta: e.meta,
    thumb: bytes.subarray(dataStart + e.thumb.off, dataStart + e.thumb.off + e.thumb.len),
    orig: bytes.subarray(dataStart + e.orig.off, dataStart + e.orig.off + e.orig.len),
  }));
}

/** Read the whole library out of OPFS into a downloadable backup Blob. */
export async function exportLibrary(items: ImageItem[]): Promise<Blob> {
  const ready = items.filter((it) => it.status === "ready");
  const entries: BackupEntry[] = [];
  for (const it of ready) {
    const [thumb, orig] = await Promise.all([readThumb(it.id), readOriginal(it.id)]);
    entries.push({
      meta: toMeta(it),
      thumb: thumb ? new Uint8Array(await thumb.arrayBuffer()) : new Uint8Array(0),
      orig: orig ? new Uint8Array(await orig.arrayBuffer()) : new Uint8Array(0),
    });
  }
  return packContainer(entries);
}

/**
 * Restore a backup file into OPFS, merging with whatever is already there
 * (same-id entries are overwritten). Returns how many items were imported.
 */
export async function importLibrary(file: File): Promise<number> {
  const entries = unpackContainer(await file.arrayBuffer());

  const existing = await readManifest();
  const byId = new Map<string, ManifestItem>(existing.map((m) => [m.id, m]));

  for (const e of entries) {
    // .slice() yields a right-sized, standalone ArrayBuffer for OPFS to write.
    if (e.thumb.byteLength) await writeThumb(e.meta.id, e.thumb.slice().buffer);
    if (e.orig.byteLength) await writeOriginal(e.meta.id, e.orig.slice().buffer);
    byId.set(e.meta.id, e.meta);
  }

  await writeManifest([...byId.values()]);
  return entries.length;
}
