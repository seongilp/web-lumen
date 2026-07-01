// Pure sort + filter helpers for the grid view. Kept separate from data/state
// so the display list is a cheap, deterministic derivation of the library.

import type { ImageItem } from "./types";

export type SortKey = "date" | "name" | "size" | "res";
export type SortDir = "asc" | "desc";
export type Orientation = "all" | "landscape" | "portrait" | "square";

export interface ViewState {
  sortKey: SortKey;
  sortDir: SortDir;
  onlyFavorites: boolean;
  folder: string; // "" = 전체, "__root__" = 최상위, otherwise a top-level folder name
  orientation: Orientation;
}

export const ALL_FOLDERS = "";
export const ROOT_FOLDER = "__root__";

export const SORT_LABELS: Record<SortKey, string> = {
  date: "날짜",
  name: "이름",
  size: "크기",
  res: "해상도",
};

export const ORIENTATION_LABELS: Record<Orientation, string> = {
  all: "모든 방향",
  landscape: "가로",
  portrait: "세로",
  square: "정사각",
};

/** Top-level folder of a relative path ("" when the file sits at the root). */
export function topFolder(relPath: string): string {
  const i = relPath.indexOf("/");
  return i >= 0 ? relPath.slice(0, i) : "";
}

function orientationOf(it: ImageItem): Orientation | null {
  if (!it.width || !it.height) return null; // not decoded yet
  if (it.width === it.height) return "square";
  return it.width > it.height ? "landscape" : "portrait";
}

/** Distinct top-level folders present in the library, sorted. */
export function listFolders(items: ImageItem[]): { value: string; label: string }[] {
  const set = new Set<string>();
  let hasRoot = false;
  for (const it of items) {
    const f = topFolder(it.relPath);
    if (f) set.add(f);
    else hasRoot = true;
  }
  const folders = [...set]
    .sort((a, b) => a.localeCompare(b, "ko"))
    .map((f) => ({ value: f, label: f }));
  if (hasRoot) folders.push({ value: ROOT_FOLDER, label: "최상위" });
  return folders;
}

function compare(a: ImageItem, b: ImageItem, key: SortKey): number {
  switch (key) {
    case "name":
      return a.name.localeCompare(b.name, "ko", { numeric: true });
    case "size":
      return a.size - b.size;
    case "res":
      return a.width * a.height - b.width * b.height;
    case "date":
    default:
      return a.lastModified - b.lastModified;
  }
}

/** Filter then sort — always returns a new array (never mutates input). */
export function applyView(items: ImageItem[], v: ViewState): ImageItem[] {
  const filtered = items.filter((it) => {
    if (v.onlyFavorites && !it.favorite) return false;
    if (v.folder) {
      const f = topFolder(it.relPath);
      if (v.folder === ROOT_FOLDER ? f !== "" : f !== v.folder) return false;
    }
    if (v.orientation !== "all") {
      const o = orientationOf(it);
      if (o !== v.orientation) return false;
    }
    return true;
  });

  const dir = v.sortDir === "asc" ? 1 : -1;
  return filtered.sort((a, b) => compare(a, b, v.sortKey) * dir);
}
