import { describe, it, expect } from "vitest";
import {
  applyView,
  listFolders,
  listTags,
  topFolder,
  selectionToView,
  selectionKey,
  ALL_FOLDERS,
  ROOT_FOLDER,
  type ViewState,
} from "./view";
import { makeItem } from "@/test/factories";

const base: ViewState = {
  sortKey: "date",
  sortDir: "asc",
  onlyFavorites: false,
  folder: ALL_FOLDERS,
  orientation: "all",
};

describe("topFolder", () => {
  it("extracts the first path segment, empty for root files", () => {
    expect(topFolder("a/b/c.png")).toBe("a");
    expect(topFolder("photo.png")).toBe("");
  });
});

describe("listFolders", () => {
  it("returns distinct folders plus a root entry, sorted", () => {
    const items = [
      makeItem({ relPath: "b/x.png" }),
      makeItem({ relPath: "a/y.png" }),
      makeItem({ relPath: "a/z.png" }),
      makeItem({ relPath: "top.png" }),
    ];
    const folders = listFolders(items);
    expect(folders.map((f) => f.value)).toEqual(["a", "b", ROOT_FOLDER]);
  });
});

describe("applyView – sorting", () => {
  const a = makeItem({ name: "a.png", size: 300, width: 100, height: 100, lastModified: 1 });
  const b = makeItem({ name: "b.png", size: 100, width: 400, height: 400, lastModified: 3 });
  const c = makeItem({ name: "c.png", size: 200, width: 200, height: 200, lastModified: 2 });
  const items = [a, b, c];

  it("sorts by name", () => {
    const r = applyView(items, { ...base, sortKey: "name", sortDir: "asc" });
    expect(r.map((i) => i.name)).toEqual(["a.png", "b.png", "c.png"]);
  });

  it("sorts by size ascending and descending", () => {
    expect(applyView(items, { ...base, sortKey: "size", sortDir: "asc" }).map((i) => i.size)).toEqual([
      100, 200, 300,
    ]);
    expect(
      applyView(items, { ...base, sortKey: "size", sortDir: "desc" }).map((i) => i.size)
    ).toEqual([300, 200, 100]);
  });

  it("sorts by resolution (area)", () => {
    const r = applyView(items, { ...base, sortKey: "res", sortDir: "desc" });
    expect(r.map((i) => i.width)).toEqual([400, 200, 100]);
  });

  it("sorts by date", () => {
    const r = applyView(items, { ...base, sortKey: "date", sortDir: "asc" });
    expect(r.map((i) => i.lastModified)).toEqual([1, 2, 3]);
  });

  it("sorts by EXIF capture date, falling back to mtime", () => {
    const x = makeItem({ name: "x", lastModified: 100, takenAt: 5000 });
    const y = makeItem({ name: "y", lastModified: 200 }); // no EXIF → uses mtime 200
    const z = makeItem({ name: "z", lastModified: 300, takenAt: 9000 });
    const r = applyView([x, y, z], { ...base, sortKey: "taken", sortDir: "asc" });
    // effective: y=200, x=5000, z=9000
    expect(r.map((i) => i.name)).toEqual(["y", "x", "z"]);
  });

  it("does not mutate the input array", () => {
    const snapshot = [...items];
    applyView(items, { ...base, sortKey: "size", sortDir: "desc" });
    expect(items).toEqual(snapshot);
  });
});

describe("applyView – filtering", () => {
  it("filters favorites only", () => {
    const items = [makeItem({ favorite: true }), makeItem({ favorite: false })];
    const r = applyView(items, { ...base, onlyFavorites: true });
    expect(r).toHaveLength(1);
    expect(r[0].favorite).toBe(true);
  });

  it("filters by favorite tri-state (all / fav / unfav)", () => {
    const items = [makeItem({ favorite: true }), makeItem({ favorite: false })];
    expect(applyView(items, { ...base, favFilter: "all" })).toHaveLength(2);
    expect(applyView(items, { ...base, favFilter: "fav" }).map((i) => i.favorite)).toEqual([true]);
    expect(applyView(items, { ...base, favFilter: "unfav" }).map((i) => i.favorite)).toEqual([
      false,
    ]);
  });

  it("filters by face presence (with / without / all)", () => {
    const items = [
      makeItem({ name: "a", faces: 2 }), // has faces
      makeItem({ name: "b", faces: 0 }), // scanned, no face
      makeItem({ name: "c" }), // faces undefined → not yet scanned
    ];
    expect(applyView(items, { ...base, faceFilter: "all" })).toHaveLength(3);
    expect(applyView(items, { ...base, faceFilter: "with" }).map((i) => i.name)).toEqual(["a"]);
    expect(applyView(items, { ...base, faceFilter: "without" }).map((i) => i.name)).toEqual(["b"]);
  });

  it("keeps unscanned items out of both with and without", () => {
    const items = [makeItem({ name: "u" })]; // faces undefined
    expect(applyView(items, { ...base, faceFilter: "with" })).toHaveLength(0);
    expect(applyView(items, { ...base, faceFilter: "without" })).toHaveLength(0);
  });

  it("filters by folder and root", () => {
    const items = [
      makeItem({ relPath: "trip/a.png" }),
      makeItem({ relPath: "trip/b.png" }),
      makeItem({ relPath: "root.png" }),
    ];
    expect(applyView(items, { ...base, folder: "trip" })).toHaveLength(2);
    expect(applyView(items, { ...base, folder: ROOT_FOLDER })).toHaveLength(1);
  });

  it("filters by orientation", () => {
    const items = [
      makeItem({ width: 400, height: 300 }), // landscape
      makeItem({ width: 300, height: 400 }), // portrait
      makeItem({ width: 300, height: 300 }), // square
    ];
    expect(applyView(items, { ...base, orientation: "landscape" })).toHaveLength(1);
    expect(applyView(items, { ...base, orientation: "portrait" })).toHaveLength(1);
    expect(applyView(items, { ...base, orientation: "square" })).toHaveLength(1);
  });

  it("excludes undecoded (0x0) items from orientation filters", () => {
    const items = [makeItem({ width: 0, height: 0, status: "pending" })];
    expect(applyView(items, { ...base, orientation: "landscape" })).toHaveLength(0);
    expect(applyView(items, { ...base, orientation: "all" })).toHaveLength(1);
  });

  it("searches over filename and camera", () => {
    const items = [
      makeItem({ name: "beach.jpg" }),
      makeItem({ name: "city.png", camera: "SONY A7" }),
      makeItem({ name: "forest.png" }),
    ];
    expect(applyView(items, { ...base, query: "beach" })).toHaveLength(1);
    expect(applyView(items, { ...base, query: "sony" })).toHaveLength(1); // camera match
    expect(applyView(items, { ...base, query: "  " })).toHaveLength(3); // blank = no filter
    expect(applyView(items, { ...base, query: "zzz" })).toHaveLength(0);
  });

  it("separates trashed from live items", () => {
    const items = [
      makeItem({ trashed: false }),
      makeItem({ trashed: true }),
      makeItem({ trashed: true }),
    ];
    expect(applyView(items, { ...base })).toHaveLength(1); // live only
    expect(applyView(items, { ...base, trashed: true })).toHaveLength(2); // trash
  });

  it("filters by collection membership", () => {
    const items = [
      makeItem({ collections: ["c1"] }),
      makeItem({ collections: ["c1", "c2"] }),
      makeItem({ collections: [] }),
    ];
    expect(applyView(items, { ...base, collection: "c1" })).toHaveLength(2);
    expect(applyView(items, { ...base, collection: "c2" })).toHaveLength(1);
    expect(applyView(items, { ...base, collection: "none" })).toHaveLength(0);
  });

  it("filters by tag and searches tags", () => {
    const items = [
      makeItem({ name: "a.png", tags: ["여행", "음식"] }),
      makeItem({ name: "b.png", tags: ["여행"] }),
      makeItem({ name: "c.png", tags: [] }),
    ];
    expect(applyView(items, { ...base, tag: "여행" })).toHaveLength(2);
    expect(applyView(items, { ...base, tag: "음식" })).toHaveLength(1);
    expect(applyView(items, { ...base, query: "음식" })).toHaveLength(1); // tag match via search
  });
});

describe("selection", () => {
  it("maps selections to view filter fields", () => {
    expect(selectionToView({ kind: "all" })).toEqual({
      onlyFavorites: false,
      folder: ALL_FOLDERS,
      collection: undefined,
      trashed: false,
    });
    expect(selectionToView({ kind: "favorites" }).onlyFavorites).toBe(true);
    expect(selectionToView({ kind: "folder", value: "trip" }).folder).toBe("trip");
    expect(selectionToView({ kind: "collection", id: "c1" }).collection).toBe("c1");
    expect(selectionToView({ kind: "trash" }).trashed).toBe(true);
  });

  it("builds stable keys for equality checks", () => {
    expect(selectionKey({ kind: "all" })).toBe("all");
    expect(selectionKey({ kind: "favorites" })).toBe("favorites");
    expect(selectionKey({ kind: "folder", value: "a" })).toBe("folder:a");
    expect(selectionKey({ kind: "collection", id: "c1" })).toBe("collection:c1");
    expect(selectionKey({ kind: "tag", value: "여행" })).toBe("tag:여행");
  });
});

describe("listTags", () => {
  it("lists distinct live tags with counts, sorted", () => {
    const items = [
      makeItem({ tags: ["여행", "음식"] }),
      makeItem({ tags: ["여행"] }),
      makeItem({ tags: ["음식"], trashed: true }), // trashed excluded
    ];
    expect(listTags(items)).toEqual([
      { value: "여행", count: 2 },
      { value: "음식", count: 1 },
    ]);
  });
});
