// @vitest-environment node
import { describe, it, expect } from "vitest";
import { packContainer, unpackContainer, type BackupEntry } from "./backup";
import type { ManifestItem } from "./types";

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
    await expect(bad.arrayBuffer().then(unpackContainer)).rejects.toThrow(/wasmi/);
  });

  it("produces an empty container for no entries", async () => {
    const restored = unpackContainer(await packContainer([]).arrayBuffer());
    expect(restored).toEqual([]);
  });
});
