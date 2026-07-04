// Orchestrates "download these photos": grant folder permission first (inside
// the click gesture), then either hand back a single raw original or zip the
// batch. Kept dependency-injected so it's testable without rendering the app.

import type { ImageItem } from "./types";
import { downloadPhotosZip, type ZipOutcome } from "./zip";

export interface DownloadDeps {
  /** Pre-grant read permission on the items' disk folders (needs the gesture). */
  ensureReadable: (ids: string[]) => Promise<void>;
  openOriginal: (id: string) => Promise<File | null>;
  /** Trigger a browser download for a blob (App's anchor-click helper). */
  saveFile: (blob: Blob, name: string) => void;
  onToast: (message: string) => void;
  onBusy?: (busy: boolean) => void;
  /** Injected for tests; defaults to the real zip builder. */
  zip?: typeof downloadPhotosZip;
}

/** Toast copy for a finished zip, mentioning any skipped originals. */
export function zipToast(out: ZipOutcome): string {
  if (out.result === "empty") {
    return out.skipped > 0
      ? "원본을 찾지 못해 다운로드하지 못했어요. 폴더 권한을 확인해 주세요."
      : "다운로드할 사진이 없어요.";
  }
  return out.skipped > 0
    ? `${out.written}장을 ZIP으로 저장했어요. (${out.skipped}장은 원본을 못 찾아 제외)`
    : `${out.written}장을 ZIP으로 저장했어요.`;
}

/**
 * Download `ready` (already status==="ready", in display order).
 * @param singleAsRaw when a single photo is chosen, download the raw original
 *   instead of a one-file zip. The view-wide "download everything" action
 *   leaves this off so it always produces a zip.
 */
export async function downloadImages(
  ready: ImageItem[],
  archiveName: string,
  deps: DownloadDeps,
  opts: { singleAsRaw?: boolean } = {}
): Promise<void> {
  if (ready.length === 0) {
    deps.onToast("다운로드할 사진이 없어요.");
    return;
  }

  // Must run inside the click gesture — requestPermission needs activation.
  await deps.ensureReadable(ready.map((it) => it.id));

  if (opts.singleAsRaw && ready.length === 1) {
    const it = ready[0];
    const orig = await deps.openOriginal(it.id);
    if (!orig) {
      deps.onToast("원본을 찾지 못했어요. 폴더 권한을 확인해 주세요.");
      return;
    }
    // OPFS originals are named by id with no MIME — rebuild with the real name.
    deps.saveFile(
      new File([orig], it.name, {
        type: it.type || orig.type || "application/octet-stream",
      }),
      it.name
    );
    deps.onToast(`${it.name} 다운로드했어요.`);
    return;
  }

  const zip = deps.zip ?? downloadPhotosZip;
  deps.onBusy?.(true);
  deps.onToast(`사진 ${ready.length}장 압축 중…`);
  try {
    const out = await zip(ready, deps.openOriginal, archiveName, (done, total) =>
      deps.onToast(`압축 중… ${done}/${total}`)
    );
    deps.onToast(zipToast(out));
  } catch (err) {
    deps.onToast(err instanceof Error ? err.message : "압축에 실패했어요.");
  } finally {
    deps.onBusy?.(false);
  }
}
