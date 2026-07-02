// @vitest-environment node
import { describe, it, expect } from "vitest";
import { packContainer, unpackContainer, exportMeta, type BackupEntry } from "./backup";
import type { ImageItem, ManifestItem } from "./types";

function meta(id: string): ManifestItem {
  return {
    id,
    name: `${id}.png`,
    relPath: `folder/${id}.png`,
    type: "image/png",
    size: 1234,
    lastModified: 42,
    width: 800,
    height: 600,
    dominant: 0x112233,
    favorite: true,
    hash: "deadbeef",
    phash: "0f0f0f0f0f0f0f0f",
  };
}

const entries: BackupEntry[] = [
  { meta: meta("a"), thumb: new Uint8Array([1, 2, 3]), orig: new Uint8Array([4, 5, 6, 7]) },
  { meta: meta("b"), thumb: new Uint8Array([8]), orig: new Uint8Array([9, 10]) },
];

describe("backup container", () => {
  it("round-trips metadata and bytes", async () => {
    const blob = packContainer(entries);
    const restored = unpackContainer(await blob.arrayBuffer());

    expect(restored).toHaveLength(2);
    expect(restored[0].meta).toEqual(entries[0].meta);
    expect([...restored[0].thumb]).toEqual([1, 2, 3]);
    expect([...restored[0].orig]).toEqual([4, 5, 6, 7]);
    expect([...restored[1].thumb]).toEqual([8]);
    expect([...restored[1].orig]).toEqual([9, 10]);
  });

  it("handles empty thumb/original slices", async () => {
    const e: BackupEntry[] = [
      { meta: meta("c"), thumb: new Uint8Array(0), orig: new Uint8Array([1]) },
    ];
    const restored = unpackContainer(await packContainer(e).arrayBuffer());
    expect(restored[0].thumb.byteLength).toBe(0);
    expect([...restored[0].orig]).toEqual([1]);
  });

  it("rejects a file without the magic header", async () => {
    const bad = new Blob([new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8])]);
    await expect(bad.arrayBuffer().then(unpackContainer)).rejects.toThrow(/lumen/);
  });

  it("produces an empty container for no entries", async () => {
    const restored = unpackContainer(await packContainer([]).arrayBuffer());
    expect(restored).toEqual([]);
  });
});

describe("exportMeta", () => {
  const item = (over: Partial<ImageItem>): ImageItem => ({
    id: "x",
    name: "x.png",
    relPath: "f/x.png",
    type: "image/png",
    size: 10,
    lastModified: 1,
    width: 100,
    height: 80,
    dominant: 0x123456,
    status: "ready",
    favorite: false,
    collections: [],
    trashed: false,
    ...over,
  });

  it("writes a JSON metadata backup with no image bytes", async () => {
    const blob = exportMeta([item({ favorite: true, hash: "h1" })]);
    expect(blob.type).toBe("application/json");
    const parsed = JSON.parse(await blob.text());
    expect(parsed.lumen).toBe("meta");
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.entries[0].favorite).toBe(true);
    expect(parsed.entries[0].hash).toBe("h1");
    // No pixel data in a meta backup.
    expect(JSON.stringify(parsed)).not.toContain("thumb");
  });

  it("excludes items that are not ready", () => {
    const blob = exportMeta([item({ status: "pending" })]);
    return blob.text().then((t) => expect(JSON.parse(t).entries).toHaveLength(0));
  });
});
