// Duplicate detection by content signature. Files with identical bytes share a
// hash regardless of name or folder, so this finds true copies with zero false
// positives. Within each group one item is kept and the rest are removable.

import type { ImageItem } from "./types";

export type DupMode = "exact" | "similar";

/** Max dHash bit-distance to treat two images as near-duplicates. */
export const SIMILAR_THRESHOLD = 8;

export interface DupResult {
  /** Duplicate groups (each ≥ 2 items), keeper first. */
  groups: ImageItem[][];
  /** All duplicate items, flattened group-by-group for adjacent display. */
  ordered: ImageItem[];
  keeperIds: Set<string>;
  removableIds: Set<string>;
}

// Keeper = highest resolution, then largest file, then oldest, then name.
function keeperRank(a: ImageItem, b: ImageItem): number {
  const areaA = a.width * a.height;
  const areaB = b.width * b.height;
  if (areaA !== areaB) return areaB - areaA;
  if (a.size !== b.size) return b.size - a.size;
  if (a.lastModified !== b.lastModified) return a.lastModified - b.lastModified;
  return a.name.localeCompare(b.name, "ko");
}

function popcount(n: number): number {
  n = n - ((n >>> 1) & 0x55555555);
  n = (n & 0x33333333) + ((n >>> 2) & 0x33333333);
  return (((n + (n >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

/** Bit distance between two 64-bit hex hashes (hi 8 chars + lo 8 chars). */
function hamming(a: string, b: string): number {
  const aHi = parseInt(a.slice(0, 8), 16);
  const aLo = parseInt(a.slice(8, 16), 16);
  const bHi = parseInt(b.slice(0, 8), 16);
  const bLo = parseInt(b.slice(8, 16), 16);
  return popcount(aHi ^ bHi) + popcount(aLo ^ bLo);
}

function buildGroups(clusters: Map<number, ImageItem[]>): DupResult {
  const groups: ImageItem[][] = [];
  const keeperIds = new Set<string>();
  const removableIds = new Set<string>();

  for (const bucket of clusters.values()) {
    if (bucket.length < 2) continue;
    const sorted = [...bucket].sort(keeperRank);
    keeperIds.add(sorted[0].id);
    for (let i = 1; i < sorted.length; i++) removableIds.add(sorted[i].id);
    groups.push(sorted);
  }

  // Largest groups first so the worst offenders are up top.
  groups.sort((a, b) => b.length - a.length);
  const ordered = groups.flat();
  return { groups, ordered, keeperIds, removableIds };
}

// Exact duplicates: group by content signature (identical bytes).
function findExact(items: ImageItem[]): DupResult {
  const byHash = new Map<string, ImageItem[]>();
  for (const it of items) {
    if (it.status !== "ready" || it.trashed || !it.hash) continue;
    const bucket = byHash.get(it.hash);
    if (bucket) bucket.push(it);
    else byHash.set(it.hash, [it]);
  }
  // Map<string,...> → Map<number,...> for buildGroups; index is arbitrary.
  const clusters = new Map<number, ImageItem[]>();
  let i = 0;
  for (const bucket of byHash.values()) clusters.set(i++, bucket);
  return buildGroups(clusters);
}

// Near-duplicates: union-find clustering by perceptual-hash bit distance.
function findSimilar(items: ImageItem[]): DupResult {
  const pool = items.filter((it) => it.status === "ready" && !it.trashed && it.phash);
  const n = pool.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => {
    let root = x;
    while (parent[root] !== root) root = parent[root];
    while (parent[x] !== root) {
      const next = parent[x];
      parent[x] = root;
      x = next;
    }
    return root;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (hamming(pool[i].phash!, pool[j].phash!) <= SIMILAR_THRESHOLD) union(i, j);
    }
  }

  const clusters = new Map<number, ImageItem[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    const bucket = clusters.get(root);
    if (bucket) bucket.push(pool[i]);
    else clusters.set(root, [pool[i]]);
  }
  return buildGroups(clusters);
}

export function findDuplicates(items: ImageItem[], mode: DupMode = "exact"): DupResult {
  return mode === "similar" ? findSimilar(items) : findExact(items);
}
