export type ImageStatus = "pending" | "ready" | "error";

/** A user-created virtual folder that images can be dragged into. */
export interface Collection {
  id: string;
  name: string;
}

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
  /** Content signature (size + head/tail bytes). Identical files share it. */
  hash?: string;
  /** Perceptual hash (64-bit dHash, hex). Near-duplicates are a few bits apart. */
  phash?: string;
  /** Ids of user collections this image belongs to. */
  collections: string[];
  /** Soft-deleted: hidden from normal views, kept until trash is emptied. */
  trashed: boolean;
  /** EXIF: capture time (ms), camera "Make Model", GPS coords. */
  takenAt?: number;
  camera?: string;
  lat?: number;
  lon?: number;
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
  hash?: string;
  phash?: string;
  collections?: string[];
  trashed?: boolean;
  takenAt?: number;
  camera?: string;
  lat?: number;
  lon?: number;
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
      hash: string;
      phash: string;
      takenAt?: number;
      camera?: string;
      lat?: number;
      lon?: number;
      thumb: Blob;
    }
  | {
      id: string;
      ok: false;
      error: string;
    };
