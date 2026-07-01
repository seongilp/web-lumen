import { describe, it, expect } from "vitest";
import { findDuplicates, SIMILAR_THRESHOLD } from "./dedup";
import { makeItem } from "@/test/factories";

describe("findDuplicates – exact (content hash)", () => {
  it("groups items that share a content hash", () => {
    const items = [
      makeItem({ hash: "aaaa" }),
      makeItem({ hash: "aaaa" }),
      makeItem({ hash: "bbbb" }),
    ];
    const { groups, removableIds, keeperIds } = findDuplicates(items, "exact");
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(2);
    expect(removableIds.size).toBe(1);
    expect(keeperIds.size).toBe(1);
  });

  it("keeps the highest-resolution item, marks the rest removable", () => {
    const big = makeItem({ hash: "z", width: 1000, height: 1000 });
    const small = makeItem({ hash: "z", width: 100, height: 100 });
    const { keeperIds, removableIds } = findDuplicates([small, big], "exact");
    expect(keeperIds.has(big.id)).toBe(true);
    expect(removableIds.has(small.id)).toBe(true);
  });

  it("ignores items with no hash or not ready", () => {
    const items = [
      makeItem({ hash: undefined }),
      makeItem({ hash: undefined }),
      makeItem({ hash: "x", status: "pending" }),
      makeItem({ hash: "x", status: "pending" }),
    ];
    expect(findDuplicates(items, "exact").groups).toHaveLength(0);
  });

  it("does not treat different hashes as duplicates", () => {
    const items = [makeItem({ hash: "a" }), makeItem({ hash: "b" })];
    expect(findDuplicates(items, "exact").removableIds.size).toBe(0);
  });
});

describe("findDuplicates – similar (perceptual hash)", () => {
  it("clusters near-duplicates within the Hamming threshold", () => {
    // distance(a,b) = 2 bits (within threshold); c is far away.
    const a = makeItem({ phash: "0000000000000000" });
    const b = makeItem({ phash: "0000000000000003" });
    const c = makeItem({ phash: "ffffffffffffffff" });
    const { groups, removableIds } = findDuplicates([a, b, c], "similar");
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(2);
    expect(removableIds.size).toBe(1);
  });

  it("keeps images just over the threshold apart separate", () => {
    // 9 bits set → distance 9 > SIMILAR_THRESHOLD (8).
    expect(SIMILAR_THRESHOLD).toBe(8);
    const a = makeItem({ phash: "0000000000000000" });
    const b = makeItem({ phash: "00000000000001ff" }); // 9 bits
    expect(findDuplicates([a, b], "similar").groups).toHaveLength(0);
  });

  it("chains transitively via union-find", () => {
    // a~b (5 bits), b~d (5 bits) but a~d (10 bits) > threshold: only connected
    // through b, yet union-find still merges all three into one cluster.
    const a = makeItem({ phash: "0000000000000000" }); // 0x000
    const b = makeItem({ phash: "000000000000001f" }); // 0x01f (5 bits)
    const d = makeItem({ phash: "00000000000003ff" }); // 0x3ff (10 bits)
    const { groups } = findDuplicates([a, b, d], "similar");
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(3);
  });
});
