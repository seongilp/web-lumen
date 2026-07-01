import type { ImageItem } from "@/lib/types";

let seq = 0;

/** Build an ImageItem with sensible defaults; override any field. */
export function makeItem(overrides: Partial<ImageItem> = {}): ImageItem {
  seq += 1;
  return {
    id: `id-${seq}`,
    name: `image-${seq}.png`,
    relPath: `image-${seq}.png`,
    type: "image/png",
    size: 1000,
    lastModified: 1_700_000_000_000 + seq,
    width: 800,
    height: 600,
    dominant: 0x336699,
    status: "ready",
    favorite: false,
    ...overrides,
  };
}
