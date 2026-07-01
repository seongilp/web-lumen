export type ImageStatus = "pending" | "ready" | "error";

export interface ImageItem {
  id: string;
  name: string;
  relPath: string;
  type: string;
  size: number;
  lastModified: number;
  /** Natural dimensions, filled once decoded. */
  width: number;
  height: number;
  /** Dominant color packed as 0x00RRGGBB, used for blur-up placeholder. */
  dominant: number;
  status: ImageStatus;
  /** User-starred. Persisted to the manifest. */
  favorite: boolean;
  /** Object URL for the thumbnail (grid). Created on the main thread. */
  thumbUrl?: string;
}

export interface ManifestItem {
  id: string;
  name: string;
  relPath: string;
  type: string;
  size: number;
  lastModified: number;
  width: number;
  height: number;
  dominant: number;
  /** Optional for backward compatibility with older manifests. */
  favorite?: boolean;
}

/** Message sent to the thumbnail worker. */
export interface ThumbRequest {
  id: string;
  file: File;
  /** Skip original persistence (e.g. when re-importing already-cached files). */
  persistOriginal: boolean;
}

/** Message returned from the thumbnail worker. */
export type ThumbResponse =
  | {
      id: string;
      ok: true;
      width: number;
      height: number;
      dominant: number;
      thumb: Blob;
    }
  | {
      id: string;
      ok: false;
      error: string;
    };
