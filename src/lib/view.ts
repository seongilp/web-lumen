// Pure sort + filter helpers for the grid view. Kept separate from data/state
// so the display list is a cheap, deterministic derivation of the library.

import type { ImageItem } from "./types";

export type SortKey = "taken" | "date" | "name" | "size" | "res";
export type Density = "sm" | "md" | "lg";
export type FavFilter = "all" | "fav" | "unfav";

export const FAV_FILTER_LABELS: Record<FavFilter, string> = {
  all: "전체",
  fav: "즐겨찾기만",
  unfav: "즐겨찾기 제외",
};

/** Grid density → target minimum cell width (px). */
export const DENSITY_CELL: Record<Density, number> = { sm: 120, md: 168, lg: 240 };
export type SortDir = "asc" | "desc";
export type Orientation = "all" | "landscape" | "portrait" | "square";

export interface ViewState {
  sortKey: SortKey;
  sortDir: SortDir;
  onlyFavorites: boolean;
  folder: string; // "" = 전체, "__root__" = 최상위, otherwise a top-level folder name
  orientation: Orientation;
  /** When set, only images belonging to this user collection id. */
  collection?: string;
  /** Free-text search over filename + camera. */
  query?: string;
  /** Show trashed (true) vs live (false/undefined) items. */
  trashed?: boolean;
  /** Favorite filter (independent of the sidebar 즐겨찾기 selection). */
  favFilter?: FavFilter;
}

export const ALL_FOLDERS = "";
export const ROOT_FOLDER = "__root__";

/** What the sidebar has selected — drives the base set shown in the grid. */
export type Selection =
  | { kind: "all" }
  | { kind: "favorites" }
  | { kind: "trash" }
  | { kind: "folder"; value: string }
  | { kind: "collection"; id: string };

export function selectionKey(s: Selection): string {
  switch (s.kind) {
    case "folder":
      return `folder:${s.value}`;
    case "collection":
      return `collection:${s.id}`;
    default:
      return s.kind;
  }
}

/** Map a sidebar selection onto the filter fields of a ViewState. */
export function selectionToView(s: Selection): Pick<
  ViewState,
  "onlyFavorites" | "folder" | "collection" | "trashed"
> {
  return {
    onlyFavorites: s.kind === "favorites",
    folder: s.kind === "folder" ? s.value : ALL_FOLDERS,
    collection: s.kind === "collection" ? s.id : undefined,
    trashed: s.kind === "trash",
  };
}

export const SORT_LABELS: Record<SortKey, string> = {
  taken: "촬영일",
  date: "수정일",
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
    if (it.trashed) continue; // trashed-only folders shouldn't appear
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
    case "taken":
      // Fall back to file mtime when a photo has no EXIF capture date.
      return (a.takenAt ?? a.lastModified) - (b.takenAt ?? b.lastModified);
    case "date":
    default:
      return a.lastModified - b.lastModified;
  }
}

/** Filter then sort — always returns a new array (never mutates input). */
export function applyView(items: ImageItem[], v: ViewState): ImageItem[] {
  const q = v.query?.trim().toLowerCase();
  const filtered = items.filter((it) => {
    if (Boolean(it.trashed) !== Boolean(v.trashed)) return false;
    if (v.onlyFavorites && !it.favorite) return false;
    if (v.favFilter === "fav" && !it.favorite) return false;
    if (v.favFilter === "unfav" && it.favorite) return false;
    if (v.collection && !it.collections.includes(v.collection)) return false;
    if (q && !it.name.toLowerCase().includes(q) && !it.camera?.toLowerCase().includes(q)) {
      return false;
    }
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
