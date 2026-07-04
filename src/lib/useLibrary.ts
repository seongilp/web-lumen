import { useCallback, useEffect, useRef, useState } from "react";
import { ThumbPool } from "./thumb-pool";
import {
  clearAll,
  deleteItem,
  ensurePersistent,
  estimateUsage,
  opfsSupported,
  readCollections,
  readManifest,
  readOriginal,
  readThumb,
  writeCollections,
  writeManifest,
} from "./opfs";
import type { Collected } from "./collect";
import { exportLibrary, exportMeta as buildMetaBackup, importLibrary } from "./backup";
import { clearRoots, getRoots, putRoot } from "./handle-store";
import { ensureReadPermission, type Permissioned } from "./permissions";
import { fileKey } from "./utils";
import type { Collection, ImageItem, ManifestItem, ThumbResponse } from "./types";

export interface ImportProgress {
  done: number;
  total: number;
}

export interface LibraryState {
  items: ImageItem[];
  importing: boolean;
  progress: ImportProgress;
  usage: number;
  ready: boolean;
  supported: boolean;
  restoredCount: number;
  collections: Collection[];
}

function toManifest(item: ImageItem): ManifestItem {
  return {
    id: item.id,
    name: item.name,
    relPath: item.relPath,
    type: item.type,
    size: item.size,
    lastModified: item.lastModified,
    width: item.width,
    height: item.height,
    dominant: item.dominant,
    favorite: item.favorite,
    hash: item.hash,
    phash: item.phash,
    collections: item.collections,
    tags: item.tags,
    trashed: item.trashed,
    takenAt: item.takenAt,
    camera: item.camera,
    lat: item.lat,
    lon: item.lon,
  };
}

export function useLibrary() {
  const [items, setItems] = useState<ImageItem[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress>({ done: 0, total: 0 });
  const [usage, setUsage] = useState(0);
  const [ready, setReady] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  // How many items were restored from OPFS at startup (drives the trust banner).
  const [restoredCount, setRestoredCount] = useState(0);

  const supported = opfsSupported();

  // Authoritative copy mirrors `items` so async callbacks mutate the latest.
  const itemsRef = useRef<ImageItem[]>([]);
  const indexRef = useRef<Map<string, number>>(new Map());
  const collectionsRef = useRef<Collection[]>([]);
  // Parent-directory handles for picker imports → real (on-disk) deletion.
  const handlesRef = useRef<Map<string, { parent: FileSystemDirectoryHandle; name: string }>>(
    new Map()
  );
  // Picked root handles (name → handle), persisted so delete works after reload.
  const rootsRef = useRef<Map<string, FileSystemDirectoryHandle>>(new Map());
  const poolRef = useRef<ThumbPool | null>(null);
  const flushScheduled = useRef(false);

  const getPool = useCallback(() => {
    if (!poolRef.current) poolRef.current = new ThumbPool();
    return poolRef.current;
  }, []);

  const reindex = useCallback(() => {
    const map = new Map<string, number>();
    itemsRef.current.forEach((it, i) => map.set(it.id, i));
    indexRef.current = map;
  }, []);

  // Persist the manifest of every successfully-decoded item (favorites included).
  const persistManifest = useCallback(async () => {
    const manifest = itemsRef.current
      .filter((it) => it.status === "ready")
      .map(toManifest);
    await writeManifest(manifest);
  }, []);

  // Coalesce many per-thumbnail updates into one render per frame.
  const scheduleFlush = useCallback(() => {
    if (flushScheduled.current) return;
    flushScheduled.current = true;
    requestAnimationFrame(() => {
      flushScheduled.current = false;
      setItems(itemsRef.current.slice());
    });
  }, []);

  const refreshUsage = useCallback(() => {
    estimateUsage().then(setUsage);
  }, []);

  // Rebuild the in-memory library from the OPFS manifest + thumbnails. Used on
  // first mount and after importing a backup.
  const restoreFromOpfs = useCallback(
    async (markRestored: boolean) => {
      const [manifest, cols, roots] = await Promise.all([
        readManifest(),
        readCollections(),
        getRoots(),
      ]);
      collectionsRef.current = cols;
      setCollections(cols);
      rootsRef.current = new Map(roots.map((r) => [r.name, r]));
      const restored: ImageItem[] = [];
      for (const m of manifest) {
        const thumb = await readThumb(m.id);
        restored.push({
          ...m,
          favorite: m.favorite ?? false,
          hash: m.hash,
          phash: m.phash,
          collections: m.collections ?? [],
          tags: m.tags ?? [],
          trashed: m.trashed ?? false,
          takenAt: m.takenAt,
          camera: m.camera,
          lat: m.lat,
          lon: m.lon,
          status: thumb ? "ready" : "pending",
          thumbUrl: thumb ? URL.createObjectURL(thumb) : undefined,
        });
      }
      for (const it of itemsRef.current) {
        if (it.thumbUrl) URL.revokeObjectURL(it.thumbUrl);
      }
      itemsRef.current = restored;
      reindex();
      setItems(restored.slice());
      if (markRestored) setRestoredCount(restored.length);
      refreshUsage();
    },
    [reindex, refreshUsage]
  );

  // ---- Restore from OPFS on first mount --------------------------------
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!supported) {
        setReady(true);
        return;
      }
      await ensurePersistent();
      if (alive) await restoreFromOpfs(true);
      if (alive) setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [supported, restoreFromOpfs]);

  // Clean up object URLs + workers on unmount.
  useEffect(() => {
    return () => {
      for (const it of itemsRef.current) {
        if (it.thumbUrl) URL.revokeObjectURL(it.thumbUrl);
      }
      poolRef.current?.terminate();
    };
  }, []);

  const applyResult = useCallback(
    (res: ThumbResponse) => {
      const idx = indexRef.current.get(res.id);
      if (idx === undefined) return;
      const prev = itemsRef.current[idx];
      if (res.ok) {
        itemsRef.current[idx] = {
          ...prev,
          status: "ready",
          width: res.width,
          height: res.height,
          dominant: res.dominant,
          hash: res.hash,
          phash: res.phash,
          takenAt: res.takenAt,
          camera: res.camera,
          lat: res.lat,
          lon: res.lon,
          thumbUrl: URL.createObjectURL(res.thumb),
        };
      } else {
        itemsRef.current[idx] = { ...prev, status: "error" };
      }
      scheduleFlush();
    },
    [scheduleFlush]
  );

  const importFiles = useCallback(
    async (collected: Collected[]) => {
      if (collected.length === 0) return;

      // Decide what to process. New files get a placeholder item; files that
      // match an existing (e.g. meta-restored) placeholder are re-processed in
      // place so favorites/organization survive.
      const newItems: ImageItem[] = [];
      const jobs: { id: string; file: File; persistOriginal: boolean }[] = [];
      const seen = new Set<string>();
      const newRoots = new Map<string, FileSystemDirectoryHandle>();
      for (const { file, relPath, parent, root } of collected) {
        const id = fileKey(relPath, file.size, file.lastModified);
        if (seen.has(id)) continue; // dup within this drop
        seen.add(id);
        if (parent) handlesRef.current.set(id, { parent, name: file.name });
        if (root && !rootsRef.current.has(root.name)) newRoots.set(root.name, root);
        // Picker imports keep a disk handle → read originals from disk, DON'T
        // copy them into OPFS (avoids duplicating huge libraries / crashing).
        const persistOriginal = !parent;
        const existingIdx = indexRef.current.get(id);
        if (existingIdx !== undefined) {
          if (itemsRef.current[existingIdx].status === "ready") continue; // already have pixels
          jobs.push({ id, file, persistOriginal }); // fill placeholder, keep favorite
        } else {
          newItems.push({
            id,
            name: file.name,
            relPath,
            type: file.type || "image/*",
            size: file.size,
            lastModified: file.lastModified,
            width: 0,
            height: 0,
            dominant: 0x1e293b, // slate-800 placeholder
            status: "pending",
            favorite: false,
            collections: [],
            tags: [],
            trashed: false,
          });
          jobs.push({ id, file, persistOriginal });
        }
      }

      // Persist any newly-picked roots so on-disk delete survives reloads.
      for (const [name, handle] of newRoots) {
        rootsRef.current.set(name, handle);
        putRoot(handle);
      }

      if (jobs.length === 0) return;

      // Show placeholders immediately.
      if (newItems.length > 0) {
        itemsRef.current = itemsRef.current.concat(newItems);
        reindex();
      }
      setItems(itemsRef.current.slice());

      setImporting(true);
      setProgress({ done: 0, total: jobs.length });

      const pool = getPool();
      let done = 0;
      await Promise.all(
        jobs.map(({ id, file, persistOriginal }) =>
          pool
            .process({ id, file, persistOriginal })
            .then((res) => {
              applyResult(res);
              done++;
              setProgress({ done, total: jobs.length });
            })
        )
      );

      // Persist the manifest of everything that decoded successfully.
      await persistManifest();

      setImporting(false);
      refreshUsage();
    },
    [applyResult, getPool, persistManifest, reindex, refreshUsage]
  );

  const toggleFavorite = useCallback(
    (id: string) => {
      const idx = indexRef.current.get(id);
      if (idx === undefined) return;
      const prev = itemsRef.current[idx];
      itemsRef.current[idx] = { ...prev, favorite: !prev.favorite };
      setItems(itemsRef.current.slice());
      persistManifest();
    },
    [persistManifest]
  );

  // Replace an item's pixels with an edited version: overwrite OPFS original,
  // regenerate thumbnail + hashes + dimensions, keeping the same id/name/favorite.
  const replaceItem = useCallback(
    async (id: string, file: File) => {
      const idx = indexRef.current.get(id);
      if (idx === undefined) return;
      const prev = itemsRef.current[idx];
      if (prev.thumbUrl) URL.revokeObjectURL(prev.thumbUrl);
      itemsRef.current[idx] = {
        ...prev,
        size: file.size,
        status: "pending",
        thumbUrl: undefined,
      };
      setItems(itemsRef.current.slice());

      const res = await getPool().process({ id, file, persistOriginal: true });
      applyResult(res);
      await persistManifest();
      refreshUsage();
    },
    [applyResult, getPool, persistManifest, refreshUsage]
  );

  // ---- Collections ------------------------------------------------------
  const persistCollections = useCallback(async () => {
    await writeCollections(collectionsRef.current);
  }, []);

  const createCollection = useCallback(
    (name: string): string => {
      const trimmed = name.trim() || "새 컬렉션";
      const id = `col-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      collectionsRef.current = [...collectionsRef.current, { id, name: trimmed }];
      setCollections(collectionsRef.current);
      persistCollections();
      return id;
    },
    [persistCollections]
  );

  const renameCollection = useCallback(
    (id: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      collectionsRef.current = collectionsRef.current.map((c) =>
        c.id === id ? { ...c, name: trimmed } : c
      );
      setCollections(collectionsRef.current);
      persistCollections();
    },
    [persistCollections]
  );

  const deleteCollection = useCallback(
    (id: string) => {
      collectionsRef.current = collectionsRef.current.filter((c) => c.id !== id);
      setCollections(collectionsRef.current);
      // Strip membership from every item.
      let touched = false;
      itemsRef.current = itemsRef.current.map((it) => {
        if (!it.collections.includes(id)) return it;
        touched = true;
        return { ...it, collections: it.collections.filter((c) => c !== id) };
      });
      if (touched) {
        setItems(itemsRef.current.slice());
        persistManifest();
      }
      persistCollections();
    },
    [persistCollections, persistManifest]
  );

  const addToCollection = useCallback(
    (ids: string[], collectionId: string) => {
      const set = new Set(ids);
      let touched = false;
      itemsRef.current = itemsRef.current.map((it) => {
        if (!set.has(it.id) || it.collections.includes(collectionId)) return it;
        touched = true;
        return { ...it, collections: [...it.collections, collectionId] };
      });
      if (touched) {
        setItems(itemsRef.current.slice());
        persistManifest();
      }
    },
    [persistManifest]
  );

  const setFavoriteMany = useCallback(
    (ids: string[], value: boolean) => {
      const set = new Set(ids);
      let touched = false;
      itemsRef.current = itemsRef.current.map((it) => {
        if (!set.has(it.id) || it.favorite === value) return it;
        touched = true;
        return { ...it, favorite: value };
      });
      if (touched) {
        setItems(itemsRef.current.slice());
        persistManifest();
      }
    },
    [persistManifest]
  );

  // ---- Tags -------------------------------------------------------------
  const addTag = useCallback(
    (ids: string[], rawTag: string) => {
      const tag = rawTag.trim();
      if (!tag) return;
      const set = new Set(ids);
      let touched = false;
      itemsRef.current = itemsRef.current.map((it) => {
        if (!set.has(it.id) || it.tags.includes(tag)) return it;
        touched = true;
        return { ...it, tags: [...it.tags, tag] };
      });
      if (touched) {
        setItems(itemsRef.current.slice());
        persistManifest();
      }
    },
    [persistManifest]
  );

  const removeTag = useCallback(
    (id: string, tag: string) => {
      const idx = indexRef.current.get(id);
      if (idx === undefined) return;
      const prev = itemsRef.current[idx];
      if (!prev.tags.includes(tag)) return;
      itemsRef.current[idx] = { ...prev, tags: prev.tags.filter((t) => t !== tag) };
      setItems(itemsRef.current.slice());
      persistManifest();
    },
    [persistManifest]
  );

  // Soft delete / restore — the real files stay until the trash is emptied.
  const setTrashed = useCallback(
    (ids: string[], value: boolean) => {
      const set = new Set(ids);
      let touched = false;
      itemsRef.current = itemsRef.current.map((it) => {
        if (!set.has(it.id) || it.trashed === value) return it;
        touched = true;
        return { ...it, trashed: value };
      });
      if (touched) {
        setItems(itemsRef.current.slice());
        persistManifest();
      }
    },
    [persistManifest]
  );
  const trashItems = useCallback((ids: string[]) => setTrashed(ids, true), [setTrashed]);
  const restoreItems = useCallback((ids: string[]) => setTrashed(ids, false), [setTrashed]);

  const removeFromCollection = useCallback(
    (id: string, collectionId: string) => {
      const idx = indexRef.current.get(id);
      if (idx === undefined) return;
      const prev = itemsRef.current[idx];
      if (!prev.collections.includes(collectionId)) return;
      itemsRef.current[idx] = {
        ...prev,
        collections: prev.collections.filter((c) => c !== collectionId),
      };
      setItems(itemsRef.current.slice());
      persistManifest();
    },
    [persistManifest]
  );

  // The picked root that owns an item (matched by the first path segment).
  const rootFor = useCallback((id: string): FileSystemDirectoryHandle | undefined => {
    const idx = indexRef.current.get(id);
    if (idx === undefined) return undefined;
    const first = itemsRef.current[idx].relPath.split("/")[0];
    return rootsRef.current.get(first);
  }, []);

  // Whether an item can be deleted from disk (this session or via a saved root).
  const hasHandle = useCallback(
    (id: string) => handlesRef.current.has(id) || rootFor(id) !== undefined,
    [rootFor]
  );

  // Best-effort deletion of the real file on disk (File System Access).
  const deleteRealFile = useCallback(
    async (id: string) => {
      // Fast path: parent handle from the current session.
      const h = handlesRef.current.get(id);
      if (h) {
        try {
          await h.parent.removeEntry(h.name);
        } catch {
          /* denied or already gone */
        }
        handlesRef.current.delete(id);
        return;
      }
      // Reload path: navigate from the persisted root, requesting permission.
      const root = rootFor(id);
      if (!root) return;
      const idx = indexRef.current.get(id);
      if (idx === undefined) return;
      const seg = itemsRef.current[idx].relPath.split("/");
      try {
        const rw = { mode: "readwrite" as const };
        const perm = root as unknown as {
          queryPermission(o: typeof rw): Promise<PermissionState>;
          requestPermission(o: typeof rw): Promise<PermissionState>;
        };
        let state = await perm.queryPermission(rw);
        if (state !== "granted") state = await perm.requestPermission(rw);
        if (state !== "granted") return;

        let dir = root;
        for (let i = 1; i < seg.length - 1; i++) dir = await dir.getDirectoryHandle(seg[i]);
        await dir.removeEntry(seg[seg.length - 1]);
      } catch {
        /* denied or already gone */
      }
    },
    [rootFor]
  );

  // Rename an image. For picker imports, also renames the real file on disk
  // (FileSystemFileHandle.move). The OPFS id stays stable.
  const renameItem = useCallback(
    async (id: string, rawName: string) => {
      const idx = indexRef.current.get(id);
      if (idx === undefined) return;
      const prev = itemsRef.current[idx];
      const name = rawName.trim();
      if (!name || name === prev.name || name.includes("/")) return;

      const h = handlesRef.current.get(id);
      if (h) {
        try {
          const fh = (await h.parent.getFileHandle(h.name)) as unknown as {
            move(name: string): Promise<void>;
          };
          await fh.move(name);
          h.name = name;
        } catch {
          /* move() unsupported or denied — fall back to display-only rename */
        }
      }

      const segs = prev.relPath.split("/");
      segs[segs.length - 1] = name;
      itemsRef.current[idx] = { ...prev, name, relPath: segs.join("/") };
      setItems(itemsRef.current.slice());
      persistManifest();
    },
    [persistManifest]
  );

  const removeItem = useCallback(
    async (id: string) => {
      const idx = indexRef.current.get(id);
      if (idx === undefined) return;
      const target = itemsRef.current[idx];
      if (target.thumbUrl) URL.revokeObjectURL(target.thumbUrl);
      itemsRef.current = itemsRef.current.filter((it) => it.id !== id);
      reindex();
      setItems(itemsRef.current.slice());
      await deleteRealFile(id);
      await deleteItem(id);
      await persistManifest();
      refreshUsage();
    },
    [deleteRealFile, persistManifest, reindex, refreshUsage]
  );

  const removeMany = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      const set = new Set(ids);
      for (const it of itemsRef.current) {
        if (set.has(it.id) && it.thumbUrl) URL.revokeObjectURL(it.thumbUrl);
      }
      itemsRef.current = itemsRef.current.filter((it) => !set.has(it.id));
      reindex();
      setItems(itemsRef.current.slice());
      await Promise.all(ids.map((id) => deleteRealFile(id)));
      await Promise.all(ids.map((id) => deleteItem(id)));
      await persistManifest();
      refreshUsage();
    },
    [deleteRealFile, persistManifest, reindex, refreshUsage]
  );

  const clear = useCallback(async () => {
    for (const it of itemsRef.current) {
      if (it.thumbUrl) URL.revokeObjectURL(it.thumbUrl);
    }
    itemsRef.current = [];
    reindex();
    setItems([]);
    collectionsRef.current = [];
    setCollections([]);
    handlesRef.current.clear();
    rootsRef.current.clear();
    await clearRoots();
    await clearAll();
    refreshUsage();
  }, [reindex, refreshUsage]);

  // Navigate a persisted root down an item's relative path to its parent dir.
  const resolveParent = useCallback(
    async (id: string): Promise<{ parent: FileSystemDirectoryHandle; name: string } | null> => {
      const idx = indexRef.current.get(id);
      if (idx === undefined) return null;
      const seg = itemsRef.current[idx].relPath.split("/");
      const root = rootsRef.current.get(seg[0]);
      if (!root) return null;
      try {
        const rw = { mode: "read" as const };
        const perm = root as unknown as {
          queryPermission(o: typeof rw): Promise<PermissionState>;
          requestPermission(o: typeof rw): Promise<PermissionState>;
        };
        let state = await perm.queryPermission(rw);
        if (state !== "granted") state = await perm.requestPermission(rw);
        if (state !== "granted") return null;
        let dir = root;
        for (let i = 1; i < seg.length - 1; i++) dir = await dir.getDirectoryHandle(seg[i]);
        return { parent: dir, name: seg[seg.length - 1] };
      } catch {
        return null;
      }
    },
    []
  );

  // Read the full-res original: disk handle (picker) → persisted root → OPFS.
  const openOriginal = useCallback(
    async (id: string): Promise<File | null> => {
      const h = handlesRef.current.get(id) ?? (await resolveParent(id));
      if (h) {
        try {
          return await (await h.parent.getFileHandle(h.name)).getFile();
        } catch {
          /* moved/removed — fall through */
        }
      }
      return readOriginal(id);
    },
    [resolveParent]
  );

  // Grant read permission on every disk root the given items belong to, one
  // prompt per root. MUST be called straight from a user gesture (the download
  // click) — requestPermission needs transient activation, which is gone once
  // the zip stream starts reading originals one by one.
  const ensureReadable = useCallback(async (ids: string[]): Promise<void> => {
    const keys = new Set<string>();
    for (const id of ids) {
      const idx = indexRef.current.get(id);
      if (idx === undefined) continue;
      keys.add(itemsRef.current[idx].relPath.split("/")[0]);
    }
    // rootsRef has no entry for OPFS-only items → undefined, skipped downstream.
    const roots = [...keys].map(
      (k) => rootsRef.current.get(k) as unknown as Permissioned | undefined
    );
    await ensureReadPermission(roots);
  }, []);

  // Regenerate thumbnails for items missing them (e.g. an interrupted import),
  // reading originals from disk handle or OPFS. Must be called from a gesture
  // (picker permission re-request). Returns how many were healed.
  const regenerateThumbnails = useCallback(async (): Promise<number> => {
    const targets = itemsRef.current.filter(
      (it) => it.status !== "ready" && !it.trashed
    );
    if (targets.length === 0) return 0;
    const pool = getPool();
    let healed = 0;
    await Promise.all(
      targets.map(async (it) => {
        const file = await openOriginal(it.id);
        if (!file) return;
        const res = await pool.process({ id: it.id, file, persistOriginal: false });
        applyResult(res);
        if (res.ok) healed++;
      })
    );
    await persistManifest();
    refreshUsage();
    return healed;
  }, [applyResult, getPool, openOriginal, persistManifest, refreshUsage]);

  const exportBackup = useCallback(
    () => exportLibrary(itemsRef.current, collectionsRef.current),
    []
  );
  const exportMetaBackup = useCallback(
    () => buildMetaBackup(itemsRef.current, collectionsRef.current),
    []
  );

  const importBackup = useCallback(
    async (file: File) => {
      const result = await importLibrary(file);
      await restoreFromOpfs(false);
      return result;
    },
    [restoreFromOpfs]
  );

  const state: LibraryState = {
    items,
    importing,
    progress,
    usage,
    ready,
    supported,
    restoredCount,
    collections,
  };
  return {
    ...state,
    importFiles,
    clear,
    openOriginal,
    ensureReadable,
    toggleFavorite,
    removeItem,
    removeMany,
    replaceItem,
    exportBackup,
    exportMetaBackup,
    importBackup,
    createCollection,
    renameCollection,
    deleteCollection,
    addToCollection,
    removeFromCollection,
    setFavoriteMany,
    renameItem,
    trashItems,
    restoreItems,
    regenerateThumbnails,
    addTag,
    removeTag,
    hasHandle,
  };
}
