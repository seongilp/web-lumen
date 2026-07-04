import { describe, it, expect } from "vitest";
import { dedupeNames } from "./zip";

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
