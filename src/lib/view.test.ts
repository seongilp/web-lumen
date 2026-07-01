import { describe, it, expect } from "vitest";
import {
  applyView,
  listFolders,
  topFolder,
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
});
