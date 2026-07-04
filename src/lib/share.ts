// Native sharing via the Web Share API — no server, images go straight to the
// OS share sheet (Messages, AirDrop, etc.). Falls back to "unsupported" so the
// caller can download instead.

export type ShareResult = "shared" | "cancelled" | "unsupported" | "error";

/** At most this many files per share — guards memory on huge selections. */
export const SHARE_MAX = 20;

export function shareSupported(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.canShare === "function";
}

export async function shareFiles(files: File[], title?: string): Promise<ShareResult> {
  if (files.length === 0) return "error";
  if (!shareSupported() || !navigator.canShare({ files })) return "unsupported";
  try {
    await navigator.share({ files, title });
    return "shared";
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
    return "error";
  }
}
