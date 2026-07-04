import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { dedupeNames, downloadPhotosZip } from "./zip";
import type { ImageItem } from "./types";

describe("dedupeNames", () => {
  it("keeps unique names untouched", () => {
    expect(dedupeNames(["a.jpg", "b.png"])).toEqual(["a.jpg", "b.png"]);
  });

  it("suffixes duplicates before the extension", () => {
    expect(dedupeNames(["img.jpg", "img.jpg", "img.jpg"])).toEqual([
      "img.jpg",
      "img (1).jpg",
      "img (2).jpg",
    ]);
  });

  it("is case-insensitive when detecting collisions", () => {
    expect(dedupeNames(["Photo.JPG", "photo.jpg"])).toEqual([
      "Photo.JPG",
      "photo (1).jpg",
    ]);
  });

  it("handles names without an extension", () => {
    expect(dedupeNames(["shot", "shot"])).toEqual(["shot", "shot (1)"]);
  });

  it("falls back to a name for empty strings", () => {
    expect(dedupeNames(["", ""])).toEqual(["image", "image (1)"]);
  });
});

function makeItem(over: Partial<ImageItem> = {}): ImageItem {
  return {
    id: over.id ?? "id1",
    name: over.name ?? "photo.png",
    relPath: over.relPath ?? "photo.png",
    type: over.type ?? "image/png",
    size: over.size ?? 3,
    lastModified: over.lastModified ?? 1700000000000,
    width: 10,
    height: 10,
    dominant: 0,
    status: over.status ?? "ready",
    favorite: false,
    collections: [],
    tags: [],
    trashed: false,
    ...over,
  };
}

const png = (name: string) =>
  new File([new Uint8Array([1, 2, 3, 4])], name, { type: "image/png" });

describe("downloadPhotosZip", () => {
  let clicked: { name: string; blob: Blob }[];
  let lastBlob: Blob | null;

  beforeEach(() => {
    clicked = [];
    lastBlob = null;
    // jsdom has no createObjectURL — stub it and capture the Blob + download.
    URL.createObjectURL = (b: Blob | MediaSource) => {
      lastBlob = b as Blob;
      return "blob:mock";
    };
    URL.revokeObjectURL = () => {};
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      if (this.download && lastBlob) clicked.push({ name: this.download, blob: lastBlob });
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it("zips all ready originals and triggers one download", async () => {
    const items = [
      makeItem({ id: "a", name: "a.png" }),
      makeItem({ id: "b", name: "b.png" }),
    ];
    const load = vi.fn(async (id: string) => png(`${id}.png`));

    const out = await downloadPhotosZip(items, load, "my-album");

    expect(out).toEqual({ result: "saved", written: 2, skipped: 0 });
    expect(clicked).toHaveLength(1);
    expect(clicked[0].name).toBe("my-album.zip");
    // A real archive was produced (byte-level ZIP validity is covered by the
    // browser smoke test; jsdom's cross-realm Blob makes byte reads unreliable).
    expect(clicked[0].blob.size).toBeGreaterThan(0);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("skips originals that fail to load and reports the count", async () => {
    const items = [makeItem({ id: "a" }), makeItem({ id: "b" }), makeItem({ id: "c" })];
    const load = vi.fn(async (id: string) => (id === "b" ? null : png(`${id}.png`)));

    const out = await downloadPhotosZip(items, load, "album");

    expect(out).toEqual({ result: "saved", written: 2, skipped: 1 });
    expect(clicked).toHaveLength(1);
  });

  it("treats a throwing loadOriginal as a skip, not a crash", async () => {
    const items = [makeItem({ id: "a" }), makeItem({ id: "b" })];
    const load = vi.fn(async (id: string) => {
      if (id === "a") throw new Error("permission denied");
      return png("b.png");
    });

    const out = await downloadPhotosZip(items, load, "album");

    expect(out).toEqual({ result: "saved", written: 1, skipped: 1 });
  });

  it("returns empty and downloads nothing when no items are ready", async () => {
    const items = [makeItem({ status: "pending" }), makeItem({ status: "error" })];
    const load = vi.fn(async () => png("x.png"));

    const out = await downloadPhotosZip(items, load, "album");

    expect(out).toEqual({ result: "empty", written: 0, skipped: 0 });
    expect(load).not.toHaveBeenCalled();
    expect(clicked).toHaveLength(0);
  });

  it("returns empty (no download) when every original is missing", async () => {
    const items = [makeItem({ id: "a" }), makeItem({ id: "b" })];
    const load = vi.fn(async () => null);

    const out = await downloadPhotosZip(items, load, "album");

    expect(out).toEqual({ result: "empty", written: 0, skipped: 2 });
    expect(clicked).toHaveLength(0);
  });

  it("reports progress for every ready item", async () => {
    const items = [makeItem({ id: "a" }), makeItem({ id: "b" }), makeItem({ id: "c" })];
    const load = vi.fn(async (id: string) => png(`${id}.png`));
    const seen: Array<[number, number]> = [];

    await downloadPhotosZip(items, load, "album", (d, t) => seen.push([d, t]));

    expect(seen).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });

  it("sanitizes filesystem-unsafe characters in the archive name", async () => {
    const items = [makeItem({ id: "a" })];
    const load = vi.fn(async () => png("a.png"));

    await downloadPhotosZip(items, load, "fav/photos:2024");

    expect(clicked[0].name).toBe("fav_photos_2024.zip");
  });
});
