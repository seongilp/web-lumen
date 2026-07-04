import { describe, it, expect, vi } from "vitest";
import { downloadImages, zipToast, type DownloadDeps } from "./download";
import type { ImageItem } from "./types";
import type { ZipOutcome } from "./zip";

function makeItem(over: Partial<ImageItem> = {}): ImageItem {
  return {
    id: "id1",
    name: "photo.png",
    relPath: "photo.png",
    type: "image/png",
    size: 3,
    lastModified: 1700000000000,
    width: 10,
    height: 10,
    dominant: 0,
    status: "ready",
    favorite: false,
    collections: [],
    tags: [],
    trashed: false,
    ...over,
  };
}

/** Deps whose every call is appended to a shared `calls` log for ordering. */
function makeDeps(
  over: Partial<DownloadDeps> & { calls?: string[]; original?: File | null } = {}
) {
  const calls = over.calls ?? [];
  const original =
    over.original !== undefined
      ? over.original
      : new File([new Uint8Array([1, 2, 3])], "stored-by-id", { type: "" });
  const zip = vi.fn(
    async (
      items: ImageItem[],
      _load: unknown,
      name: string
    ): Promise<ZipOutcome> => {
      calls.push(`zip:${name}:${items.length}`);
      return { result: "saved", written: items.length, skipped: 0 };
    }
  );
  const deps: DownloadDeps = {
    ensureReadable: vi.fn(async (ids: string[]) => {
      calls.push(`ensure:${ids.join(",")}`);
    }),
    openOriginal: vi.fn(async (id: string) => {
      calls.push(`open:${id}`);
      return original;
    }),
    saveFile: vi.fn((_blob: Blob, n: string) => calls.push(`save:${n}`)),
    onToast: vi.fn(),
    onBusy: vi.fn(),
    zip,
    ...over,
  };
  return { deps, calls, zip };
}

const toasts = (deps: DownloadDeps) =>
  (deps.onToast as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);

describe("downloadImages", () => {
  it("does nothing but warn when there are no photos", async () => {
    const { deps } = makeDeps();
    await downloadImages([], "archive", deps);
    expect(deps.ensureReadable).not.toHaveBeenCalled();
    expect(deps.saveFile).not.toHaveBeenCalled();
    expect(deps.zip).not.toHaveBeenCalled();
    expect(toasts(deps)).toContain("다운로드할 사진이 없어요.");
  });

  it("grants permission before reading any original", async () => {
    const { deps, calls } = makeDeps();
    await downloadImages([makeItem({ id: "a" })], "arc", deps, { singleAsRaw: true });
    expect(calls[0]).toBe("ensure:a"); // permission first, then open
    expect(calls[1]).toBe("open:a");
  });

  it("single selection downloads the raw original (no zip)", async () => {
    const { deps } = makeDeps();
    const item = makeItem({ id: "a", name: "trip.jpg", type: "image/jpeg" });

    await downloadImages([item], "arc", deps, { singleAsRaw: true });

    expect(deps.zip).not.toHaveBeenCalled();
    expect(deps.saveFile).toHaveBeenCalledTimes(1);
    const [blob, name] = (deps.saveFile as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(name).toBe("trip.jpg");
    expect((blob as File).name).toBe("trip.jpg"); // renamed from the id-named original
    expect((blob as File).type).toBe("image/jpeg"); // MIME restored from the item
    expect(toasts(deps)).toContain("trip.jpg 다운로드했어요.");
  });

  it("warns and saves nothing when the single original is missing", async () => {
    const { deps } = makeDeps({ original: null });
    await downloadImages([makeItem({ id: "a" })], "arc", deps, { singleAsRaw: true });
    expect(deps.saveFile).not.toHaveBeenCalled();
    expect(deps.zip).not.toHaveBeenCalled();
    expect(toasts(deps)).toContain("원본을 찾지 못했어요. 폴더 권한을 확인해 주세요.");
  });

  it("two selections are zipped, not raw-downloaded", async () => {
    const { deps, zip } = makeDeps();
    const items = [makeItem({ id: "a" }), makeItem({ id: "b" })];

    await downloadImages(items, "web-lumen-선택-X", deps, { singleAsRaw: true });

    expect(deps.saveFile).not.toHaveBeenCalled();
    expect(zip).toHaveBeenCalledTimes(1);
    // zip receives the ready items, the openOriginal fn, and the archive name.
    expect(zip.mock.calls[0][0]).toEqual(items);
    expect(zip.mock.calls[0][1]).toBe(deps.openOriginal);
    expect(zip.mock.calls[0][2]).toBe("web-lumen-선택-X");
  });

  it("the view-wide action always zips, even for one photo", async () => {
    const { deps, zip } = makeDeps();
    // singleAsRaw omitted → menu "download everything" behavior.
    await downloadImages([makeItem({ id: "a" })], "web-lumen-전체-X", deps);
    expect(deps.saveFile).not.toHaveBeenCalled();
    expect(zip).toHaveBeenCalledTimes(1);
  });

  it("toggles busy around a zip and reports the outcome", async () => {
    const { deps } = makeDeps();
    await downloadImages([makeItem({ id: "a" }), makeItem({ id: "b" })], "arc", deps);
    expect(deps.onBusy).toHaveBeenNthCalledWith(1, true);
    expect(deps.onBusy).toHaveBeenLastCalledWith(false);
    expect(toasts(deps)).toContain("2장을 ZIP으로 저장했어요.");
  });

  it("surfaces a zip failure as a toast and clears busy", async () => {
    const zip = vi.fn(async () => {
      throw new Error("boom");
    });
    const { deps } = makeDeps({ zip });
    await downloadImages([makeItem({ id: "a" }), makeItem({ id: "b" })], "arc", deps);
    expect(toasts(deps)).toContain("boom");
    expect(deps.onBusy).toHaveBeenLastCalledWith(false);
  });
});

describe("zipToast", () => {
  const out = (o: Partial<ZipOutcome>): ZipOutcome => ({
    result: "saved",
    written: 0,
    skipped: 0,
    ...o,
  });

  it("reports a clean save", () => {
    expect(zipToast(out({ written: 5 }))).toBe("5장을 ZIP으로 저장했어요.");
  });

  it("mentions skipped originals on a partial save", () => {
    expect(zipToast(out({ written: 4, skipped: 2 }))).toBe(
      "4장을 ZIP으로 저장했어요. (2장은 원본을 못 찾아 제외)"
    );
  });

  it("explains an all-missing empty result", () => {
    expect(zipToast(out({ result: "empty", skipped: 3 }))).toBe(
      "원본을 찾지 못해 다운로드하지 못했어요. 폴더 권한을 확인해 주세요."
    );
  });

  it("says nothing to download for a truly empty result", () => {
    expect(zipToast(out({ result: "empty" }))).toBe("다운로드할 사진이 없어요.");
  });
});
