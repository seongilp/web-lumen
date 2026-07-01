// Collect image files from a dropped folder (DataTransfer) or the File System
// Access directory picker. Returns flat { file, relPath } records; relPath is
// used both for display and as part of the cache key.

export interface Collected {
  file: File;
  relPath: string;
  /** Parent directory handle (only from the picker) — enables real deletion. */
  parent?: FileSystemDirectoryHandle;
  /** The picked root directory handle (shared by the whole import). */
  root?: FileSystemDirectoryHandle;
}

const IMAGE_EXT = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "avif",
  "bmp",
  "svg",
]);

function isImage(name: string, type: string): boolean {
  if (type.startsWith("image/")) return true;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_EXT.has(ext);
}

// ---- DataTransfer (drag & drop) ----------------------------------------

function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  const all: FileSystemEntry[] = [];
  return new Promise((resolve, reject) => {
    const next = () => {
      reader.readEntries((batch) => {
        if (batch.length === 0) {
          resolve(all);
          return;
        }
        all.push(...batch);
        next(); // readEntries is paginated — keep going until empty
      }, reject);
    };
    next();
  });
}

function entryToFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

async function walkEntry(entry: FileSystemEntry, out: Collected[]): Promise<void> {
  if (entry.isFile) {
    const file = await entryToFile(entry as FileSystemFileEntry);
    if (isImage(file.name, file.type)) {
      out.push({ file, relPath: entry.fullPath.replace(/^\//, "") });
    }
  } else if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const children = await readAllEntries(reader);
    for (const child of children) await walkEntry(child, out);
  }
}

export async function collectFromDataTransfer(dt: DataTransfer): Promise<Collected[]> {
  const out: Collected[] = [];
  const entries: FileSystemEntry[] = [];

  for (const item of Array.from(dt.items)) {
    if (item.kind !== "file") continue;
    const entry = item.webkitGetAsEntry?.();
    if (entry) entries.push(entry);
  }

  if (entries.length > 0) {
    for (const entry of entries) await walkEntry(entry, out);
    return out;
  }

  // Fallback: plain files. Preserve folder structure when the browser exposes
  // it via webkitRelativePath (e.g. <input webkitdirectory>).
  for (const file of Array.from(dt.files)) {
    if (isImage(file.name, file.type)) {
      out.push({ file, relPath: file.webkitRelativePath || file.name });
    }
  }
  return out;
}

// ---- File System Access directory picker -------------------------------

export function directoryPickerSupported(): boolean {
  return typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker ===
    "function";
}

// `entries()` async-iterator typings vary across TS lib versions, so we read
// it through a minimal structural type instead of relying on lib.dom.
type DirEntries = {
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
};

async function walkHandle(
  dir: FileSystemDirectoryHandle,
  root: FileSystemDirectoryHandle,
  prefix: string,
  out: Collected[]
): Promise<void> {
  for await (const [name, handle] of (dir as unknown as DirEntries).entries()) {
    const relPath = prefix ? `${prefix}/${name}` : name;
    if (handle.kind === "file") {
      const file = await (handle as FileSystemFileHandle).getFile();
      // `parent`/`root` let us delete the real file later (this session and
      // — via the persisted root — after a reload too).
      if (isImage(file.name, file.type)) out.push({ file, relPath, parent: dir, root });
    } else {
      await walkHandle(handle as FileSystemDirectoryHandle, root, relPath, out);
    }
  }
}

export async function collectFromDirectoryPicker(): Promise<Collected[]> {
  const pick = (window as unknown as {
    showDirectoryPicker: (opts?: { mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandle>;
  }).showDirectoryPicker;
  // Request read-write so the user can delete originals from within the app.
  const dir = await pick({ mode: "readwrite" });
  const out: Collected[] = [];
  await walkHandle(dir, dir, dir.name, out);
  return out;
}
