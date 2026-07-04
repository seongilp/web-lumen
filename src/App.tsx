import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, SearchX, Info, X, Trash2 } from "lucide-react";
import { Dropzone } from "./components/Dropzone";
import { Toolbar } from "./components/Toolbar";
import { ControlBar } from "./components/ControlBar";
import { Grid } from "./components/Grid";
import { EmptyState } from "./components/EmptyState";
import { RestoreBanner } from "./components/RestoreBanner";
import { DuplicateBar } from "./components/DuplicateBar";
import { SelectionBar } from "./components/SelectionBar";
import { Lightbox } from "./components/Lightbox";
import { Editor } from "./components/Editor";
import { Sidebar } from "./components/Sidebar";
import { useLibrary } from "./lib/useLibrary";
import { ThumbPool } from "./lib/thumb-pool";
import {
  applyView,
  listFolders,
  listTags,
  topFolder,
  selectionToView,
  DENSITY_CELL,
  ALL_FOLDERS,
  ROOT_FOLDER,
  type ViewState,
  type Selection,
  type Density,
} from "./lib/view";
import { findDuplicates, type DupMode } from "./lib/dedup";
import { shareFiles, SHARE_MAX } from "./lib/share";
import { downloadImages, type DownloadDeps } from "./lib/download";
import { faceScanEnabled } from "./lib/face";
import type { ThumbBadge } from "./components/Thumb";
import {
  collectFromDataTransfer,
  collectFromDirectoryPicker,
  directoryPickerSupported,
} from "./lib/collect";

const DEFAULT_VIEW: ViewState = {
  sortKey: "date",
  sortDir: "desc",
  onlyFavorites: false,
  folder: ALL_FOLDERS,
  orientation: "all",
  favFilter: "all",
};

export default function App() {
  const lib = useLibrary();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showRestore, setShowRestore] = useState(false);
  const [view, setView] = useState<ViewState>(DEFAULT_VIEW);
  const [selection, setSelection] = useState<Selection>({ kind: "all" });
  const [dupMode, setDupMode] = useState(false);
  const [dupKind, setDupKind] = useState<DupMode>("exact");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanProg, setScanProg] = useState({ done: 0, total: 0 });
  const [metaNotice, setMetaNotice] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [density, setDensity] = useState<Density>("md");
  const [toast, setToast] = useState<
    { message: string; action?: { label: string; run: () => void } } | null
  >(null);
  const anchorRef = useRef<string | null>(null);

  // Auto-dismiss the toast.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canPick = directoryPickerSupported();

  // Surface the trust banner once a restored-from-cache library is detected.
  useEffect(() => {
    if (lib.ready && lib.restoredCount > 0) setShowRestore(true);
  }, [lib.ready, lib.restoredCount]);

  // Sidebar selection is merged into the view's filter fields.
  const effectiveView = useMemo<ViewState>(
    () => ({ ...view, ...selectionToView(selection) }),
    [view, selection]
  );

  // Derived, sorted + filtered display list — what the grid and lightbox use.
  const visibleItems = useMemo(
    () => applyView(lib.items, effectiveView),
    [lib.items, effectiveView]
  );
  const folders = useMemo(() => listFolders(lib.items), [lib.items]);
  const tags = useMemo(() => listTags(lib.items), [lib.items]);
  const tagNames = useMemo(() => tags.map((t) => t.value), [tags]);
  const dup = useMemo(() => findDuplicates(lib.items, dupKind), [lib.items, dupKind]);
  const missingThumbs = useMemo(
    () => lib.items.filter((it) => it.status === "pending" && !it.trashed).length,
    [lib.items]
  );

  const healThumbnails = useCallback(async () => {
    setBusy(true);
    try {
      const n = await lib.regenerateThumbnails();
      setToast({ message: n > 0 ? `썸네일 ${n}개를 복구했어요.` : "복구할 원본을 찾지 못했어요." });
    } finally {
      setBusy(false);
    }
  }, [lib]);

  // Photos not yet run through local face detection.
  const unscanned = useMemo(
    () =>
      lib.items.filter(
        (it) => it.status === "ready" && !it.trashed && it.faces === undefined
      ).length,
    [lib.items]
  );

  const runScan = useCallback(
    async (announce: boolean) => {
      setScanning(true);
      setScanProg({ done: 0, total: 0 });
      if (announce) setToast({ message: "얼굴을 찾는 중이에요… (기기 안에서만 처리)" });
      try {
        const withFace = await lib.scanFaces({
          onProgress: (done, total) => setScanProg({ done, total }),
        });
        if (announce) setToast({ message: `얼굴이 있는 사진 ${withFace}장을 찾았어요.` });
      } catch {
        if (announce)
          setToast({ message: "얼굴 인식 모델을 불러오지 못했어요. 잠시 후 다시 시도하세요." });
      } finally {
        setScanning(false);
      }
    },
    [lib]
  );

  const scanFacesNow = useCallback(() => runScan(true), [runScan]);

  // Auto-scan freshly imported photos once the user has run a scan at least once.
  const wasImporting = useRef(false);
  useEffect(() => {
    if (wasImporting.current && !lib.importing && faceScanEnabled() && !scanning) {
      void runScan(false);
    }
    wasImporting.current = lib.importing;
  }, [lib.importing, scanning, runScan]);

  // Per-section counts for the sidebar.
  const counts = useMemo(() => {
    const foldersC: Record<string, number> = {};
    const collectionsC: Record<string, number> = {};
    let all = 0;
    let favorites = 0;
    let trash = 0;
    for (const it of lib.items) {
      if (it.trashed) {
        trash++;
        continue; // trashed items don't count toward live sections
      }
      all++;
      if (it.favorite) favorites++;
      const f = topFolder(it.relPath);
      const key = f === "" ? ROOT_FOLDER : f;
      foldersC[key] = (foldersC[key] ?? 0) + 1;
      for (const c of it.collections) collectionsC[c] = (collectionsC[c] ?? 0) + 1;
    }
    return { all, favorites, trash, folders: foldersC, collections: collectionsC };
  }, [lib.items]);

  const selectionTitle = useMemo(() => {
    switch (selection.kind) {
      case "favorites":
        return "즐겨찾기";
      case "trash":
        return "휴지통";
      case "folder":
        return selection.value === ROOT_FOLDER ? "최상위" : selection.value;
      case "collection":
        return lib.collections.find((c) => c.id === selection.id)?.name ?? "컬렉션";
      case "tag":
        return `#${selection.value}`;
      default:
        return "전체";
    }
  }, [selection, lib.collections]);

  // If the selected collection/folder/trash disappears, fall back to 전체.
  useEffect(() => {
    if (selection.kind === "collection" && !lib.collections.some((c) => c.id === selection.id)) {
      setSelection({ kind: "all" });
    }
    if (
      selection.kind === "folder" &&
      !folders.some((f) => f.value === selection.value)
    ) {
      setSelection({ kind: "all" });
    }
    if (selection.kind === "trash" && counts.trash === 0) {
      setSelection({ kind: "all" });
    }
    if (selection.kind === "tag" && !tags.some((t) => t.value === selection.value)) {
      setSelection({ kind: "all" });
    }
  }, [selection, lib.collections, folders, counts.trash, tags]);

  // In duplicate mode, the grid/lightbox operate on the grouped duplicate list.
  const activeItems = dupMode ? dup.ordered : visibleItems;

  const dupBadges = useMemo(() => {
    if (!dupMode) return undefined;
    const m = new Map<string, ThumbBadge>();
    for (const id of dup.keeperIds) m.set(id, "keep");
    for (const id of dup.removableIds) m.set(id, "dupe");
    return m;
  }, [dupMode, dup]);

  // Leave duplicate mode automatically once nothing is left to clean.
  useEffect(() => {
    if (dupMode && dup.removableIds.size === 0) setDupMode(false);
  }, [dupMode, dup.removableIds.size]);

  // Keep the lightbox index valid as the active list changes (delete / filter).
  useEffect(() => {
    if (lightboxIndex === null) return;
    if (lightboxIndex >= activeItems.length) {
      setLightboxIndex(activeItems.length > 0 ? activeItems.length - 1 : null);
    }
  }, [activeItems.length, lightboxIndex]);

  const patchView = useCallback((patch: Partial<ViewState>) => {
    setView((v) => ({ ...v, ...patch }));
  }, []);

  const importBackupFile = useCallback(
    async (file: File) => {
      setBusy(true);
      try {
        const { mode, count } = await lib.importBackup(file);
        setMetaNotice(mode === "meta" ? count : null);
      } catch (err) {
        alert(err instanceof Error ? err.message : "백업을 불러오지 못했습니다.");
      } finally {
        setBusy(false);
      }
    },
    [lib]
  );

  const handleDrop = useCallback(
    async (dt: DataTransfer) => {
      // A single .lumen file → restore a backup; otherwise import images.
      const dropped = Array.from(dt.files);
      const backup = dropped.find((f) => f.name.endsWith(".lumen"));
      if (backup && dropped.length === 1) {
        importBackupFile(backup);
        return;
      }
      const collected = await collectFromDataTransfer(dt);
      setMetaNotice(null); // photos are being re-attached
      lib.importFiles(collected);
    },
    [lib, importBackupFile]
  );

  const download = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    // Revoke later — revoking in the same tick can abort large downloads.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };
  const stamp = () => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
  };

  const handleExportFull = useCallback(async () => {
    setBusy(true);
    try {
      download(await lib.exportBackup(), `web-lumen-backup-${stamp()}.lumen`);
    } finally {
      setBusy(false);
    }
  }, [lib]);

  const handleExportMeta = useCallback(() => {
    download(lib.exportMetaBackup(), `web-lumen-meta-${stamp()}.lumen`);
  }, [lib]);

  // Shared download plumbing (permission → single-raw or zip → toast/busy).
  const downloadDeps = useCallback(
    (): DownloadDeps => ({
      ensureReadable: lib.ensureReadable,
      openOriginal: lib.openOriginal,
      saveFile: download,
      onToast: (message) => setToast({ message }),
      onBusy: setBusy,
    }),
    [lib]
  );

  // Zip and download exactly what's on screen now (collection → collection only,
  // favorites → favorites only). Always a zip, even for one photo.
  const handleDownloadPhotos = useCallback(async () => {
    const ready = visibleItems.filter((it) => it.status === "ready");
    await downloadImages(ready, `web-lumen-${selectionTitle}-${stamp()}`, downloadDeps());
  }, [visibleItems, selectionTitle, downloadDeps]);

  const handleImportClick = useCallback(() => fileInputRef.current?.click(), []);

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) importBackupFile(file);
      e.target.value = "";
    },
    [importBackupFile]
  );

  const handlePick = useCallback(async () => {
    try {
      const collected = await collectFromDirectoryPicker();
      lib.importFiles(collected);
    } catch {
      /* user cancelled the picker */
    }
  }, [lib]);

  const openById = useCallback(
    (id: string) => {
      const idx = activeItems.findIndex((it) => it.id === id);
      if (idx >= 0) setLightboxIndex(idx);
    },
    [activeItems]
  );

  const onDropToFavorite = useCallback(
    (ids: string[]) => lib.setFavoriteMany(ids, true),
    [lib]
  );
  const onDropToCollection = useCallback(
    (collectionId: string, ids: string[]) => lib.addToCollection(ids, collectionId),
    [lib]
  );
  const onDropToTag = useCallback((tag: string, ids: string[]) => lib.addTag(ids, tag), [lib]);

  // Native share (Web Share API). The file must already be loaded so we call
  // navigator.share synchronously in the click — awaiting first loses the
  // transient activation and the share is rejected. Fallback to download.
  const shareOne = useCallback(async (file: File | null) => {
    if (!file) {
      setToast({ message: "이미지를 불러오는 중이에요. 잠시 후 다시 시도하세요." });
      return;
    }
    const r = await shareFiles([file], file.name);
    if (r === "unsupported" || r === "error") {
      download(file, file.name);
      setToast({ message: "공유가 안 돼서 다운로드했어요." });
    }
  }, []);

  const shareMany = useCallback(
    async (ids: string[]) => {
      const picked = ids.slice(0, SHARE_MAX);
      const loaded = await Promise.all(
        picked.map(async (id) => {
          const orig = await lib.openOriginal(id);
          if (!orig) return null;
          const it = lib.items.find((i) => i.id === id);
          // Rebuild with the manifest name/type (OPFS files are named by id).
          return new File([orig], it?.name ?? orig.name, {
            type: it?.type || orig.type || "application/octet-stream",
          });
        })
      );
      const files = loaded.filter((f): f is File => f !== null);
      if (files.length === 0) return;
      const r = await shareFiles(files, `${files.length}장`);
      if (r === "unsupported") {
        setToast({ message: "이 브라우저는 여러 장 공유를 지원하지 않아요." });
      } else if (r === "shared" && ids.length > SHARE_MAX) {
        setToast({ message: `한 번에 ${SHARE_MAX}장까지 공유했어요.` });
      }
    },
    [lib]
  );
  const resetView = useCallback(() => {
    setView(DEFAULT_VIEW);
    setSelection({ kind: "all" });
  }, []);

  // ---- Multi-select ----------------------------------------------------
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    anchorRef.current = null;
  }, []);

  const handleSelect = useCallback(
    (id: string, e: React.MouseEvent) => {
      const index = activeItems.findIndex((it) => it.id === id);
      if (index < 0) return; // item vanished between render and click
      setSelectedIds((prev) => {
        const next = new Set(prev);
        // Anchor is an id so it stays valid even if the list re-sorts/filters.
        const anchorIdx =
          e.shiftKey && anchorRef.current
            ? activeItems.findIndex((it) => it.id === anchorRef.current)
            : -1;
        if (anchorIdx >= 0) {
          const [a, b] = [anchorIdx, index].sort((x, y) => x - y);
          for (let i = a; i <= b; i++) next.add(activeItems[i].id);
        } else if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
      anchorRef.current = id;
    },
    [activeItems]
  );

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(activeItems.map((it) => it.id)));
  }, [activeItems]);

  // Prune selection to ids that still exist; clear when switching sections.
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const alive = new Set(lib.items.map((it) => it.id));
      const next = new Set([...prev].filter((id) => alive.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [lib.items]);

  useEffect(() => {
    clearSelection();
  }, [selection, clearSelection]);

  // Esc clears selection; Cmd/Ctrl+A selects all — when no overlay is open.
  useEffect(() => {
    if (lightboxIndex !== null || editingId !== null) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Escape" && selectedIds.size > 0) clearSelection();
      if ((e.metaKey || e.ctrlKey) && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        selectAll();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedIds.size, lightboxIndex, editingId, clearSelection, selectAll]);

  const selArr = useMemo(() => [...selectedIds], [selectedIds]);

  const bulkDelete = useCallback(() => {
    const ids = selArr;
    lib.trashItems(ids);
    clearSelection();
    setToast({
      message: `${ids.length}장을 휴지통으로 옮겼어요.`,
      action: { label: "실행취소", run: () => lib.restoreItems(ids) },
    });
  }, [selArr, lib, clearSelection]);

  const bulkRestore = useCallback(() => {
    lib.restoreItems(selArr);
    clearSelection();
  }, [selArr, lib, clearSelection]);

  const bulkDeleteForever = useCallback(() => {
    lib.removeMany(selArr);
    clearSelection();
  }, [selArr, lib, clearSelection]);

  // Download the selected photos: one → raw original, several → a zip.
  const downloadSelected = useCallback(async () => {
    const chosen = new Set(selArr);
    const picked = visibleItems.filter((it) => chosen.has(it.id) && it.status === "ready");
    await downloadImages(picked, `web-lumen-선택-${stamp()}`, downloadDeps(), {
      singleAsRaw: true,
    });
  }, [selArr, visibleItems, downloadDeps]);

  const emptyTrash = useCallback(() => {
    lib.removeMany(lib.items.filter((it) => it.trashed).map((it) => it.id));
  }, [lib]);

  const inTrash = selection.kind === "trash";

  // Delete = move to trash (recoverable). Trashed items delete permanently.
  const handleDelete = useCallback(
    (id: string) => {
      const item = lib.items.find((i) => i.id === id);
      if (item?.trashed) {
        lib.removeItem(id); // permanent (already in trash)
        return;
      }
      lib.trashItems([id]);
      setToast({
        message: "휴지통으로 옮겼어요.",
        action: { label: "실행취소", run: () => lib.restoreItems([id]) },
      });
    },
    [lib]
  );

  const handleDeleteDupes = useCallback(() => {
    const ids = [...dup.removableIds];
    lib.trashItems(ids);
    setToast({
      message: `중복 ${ids.length}장을 휴지통으로 옮겼어요.`,
      action: { label: "실행취소", run: () => lib.restoreItems(ids) },
    });
  }, [dup.removableIds, lib]);

  const editItem = editingId ? lib.items.find((it) => it.id === editingId) : undefined;
  const hasItems = lib.items.length > 0;
  const noResults = hasItems && !dupMode && visibleItems.length === 0;

  return (
    <Dropzone onDrop={handleDrop}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".lumen,application/octet-stream"
        className="hidden"
        onChange={onFileChange}
      />
      <div className="flex h-full w-full flex-col">
        {hasItems && (
          <Toolbar
            count={counts.all}
            usage={lib.usage}
            importing={lib.importing}
            progress={lib.progress}
            canPick={canPick}
            onPick={handlePick}
            onClear={lib.clear}
            onExportFull={handleExportFull}
            onExportMeta={handleExportMeta}
            onDownloadPhotos={handleDownloadPhotos}
            photoCount={visibleItems.filter((it) => it.status === "ready").length}
            viewName={selectionTitle}
            onImport={handleImportClick}
            onToggleSidebar={() => setSidebarOpen((o) => !o)}
            busy={busy}
            workerCount={ThumbPool.defaultSize()}
          />
        )}

        <div className="flex min-h-0 flex-1">
          {hasItems && (
            <Sidebar
              selection={selection}
              onSelect={setSelection}
              folders={folders}
              collections={lib.collections}
              tags={tags}
              counts={counts}
              onCreateCollection={(name) => setSelection({ kind: "collection", id: lib.createCollection(name) })}
              onRenameCollection={lib.renameCollection}
              onDeleteCollection={lib.deleteCollection}
              onDropToFavorite={onDropToFavorite}
              onDropToCollection={onDropToCollection}
              onDropToTag={onDropToTag}
              open={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
            />
          )}

          <div className="flex min-h-0 flex-1 flex-col">
            {hasItems && showRestore && (
              <RestoreBanner
                count={lib.restoredCount}
                onClear={() => {
                  setShowRestore(false);
                  lib.clear();
                }}
                onDismiss={() => setShowRestore(false)}
              />
            )}

            {hasItems && (
              <ControlBar
                view={view}
                onChange={patchView}
                title={selectionTitle}
                shown={visibleItems.length}
                total={lib.items.length}
                dupCount={dup.removableIds.size}
                dupMode={dupMode}
                onToggleDup={() => setDupMode((d) => !d)}
                density={density}
                onDensityChange={setDensity}
                unscanned={unscanned}
                scanning={scanning}
                scanDone={scanProg.done}
                scanTotal={scanProg.total}
                onScanFaces={scanFacesNow}
              />
            )}

            {hasItems && missingThumbs > 0 && !inTrash && !lib.importing && metaNotice === null && (
              <div className="animate-fade-up flex items-center gap-3 border-b border-amber-500/20 bg-amber-500/10 px-5 py-2.5">
                <AlertTriangle className="size-4 shrink-0 text-amber-300" />
                <p className="min-w-0 flex-1 text-xs leading-relaxed text-slate-200">
                  썸네일 <span className="font-semibold text-amber-200">{missingThumbs}개</span>가 저장되지 않았어요.
                  <span className="text-slate-400"> 원본에서 다시 생성합니다.</span>
                </p>
                <button
                  onClick={healThumbnails}
                  disabled={busy}
                  className="shrink-0 rounded-lg bg-amber-500/90 px-2.5 py-1 text-xs font-medium text-slate-900 hover:bg-amber-400 disabled:opacity-50"
                >
                  {busy ? "복구 중…" : "썸네일 복구"}
                </button>
              </div>
            )}

            {metaNotice !== null && (
              <div className="animate-fade-up flex items-center gap-3 border-b border-sky-500/20 bg-sky-500/10 px-5 py-2.5">
                <Info className="size-4 shrink-0 text-sky-300" />
                <p className="min-w-0 flex-1 text-xs leading-relaxed text-slate-200">
                  메타 정보 <span className="font-semibold text-sky-200">{metaNotice.toLocaleString()}개</span>를 불러왔어요.
                  <span className="text-slate-400"> 원본 폴더를 다시 드롭하면 사진이 채워지고 즐겨찾기·정리 상태가 복원됩니다.</span>
                </p>
                <button
                  onClick={() => setMetaNotice(null)}
                  title="닫기"
                  className="grid size-7 shrink-0 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-800/70 hover:text-slate-300"
                >
                  <X className="size-4" />
                </button>
              </div>
            )}

            {hasItems && !dupMode && inTrash && (
              <div className="animate-fade-up flex items-center gap-3 border-b border-rose-500/20 bg-rose-500/10 px-5 py-2.5">
                <Trash2 className="size-4 shrink-0 text-rose-300" />
                <p className="min-w-0 flex-1 text-xs text-slate-200">
                  휴지통 · <span className="font-semibold text-rose-200">{counts.trash}장</span>
                  <span className="ml-1 text-slate-400">비우면 원본 파일까지 영구 삭제됩니다.</span>
                </p>
                {counts.trash > 0 && (
                  <button
                    onClick={emptyTrash}
                    className="shrink-0 rounded-lg bg-rose-500/90 px-2.5 py-1 text-xs font-medium text-white hover:bg-rose-500"
                  >
                    휴지통 비우기
                  </button>
                )}
              </div>
            )}

            {hasItems && !dupMode && selectedIds.size > 0 && (
              <SelectionBar
                count={selectedIds.size}
                total={activeItems.length}
                collections={lib.collections}
                tags={tagNames}
                trashMode={inTrash}
                onSelectAll={selectAll}
                onAddToCollection={(colId) => {
                  lib.addToCollection(selArr, colId);
                  clearSelection();
                }}
                onCreateAndAdd={(name) => {
                  lib.addToCollection(selArr, lib.createCollection(name));
                  clearSelection();
                }}
                onAddTag={(tag) => {
                  lib.addTag(selArr, tag);
                  clearSelection();
                }}
                onShare={() => shareMany(selArr)}
                onDownload={downloadSelected}
                onFavorite={() => {
                  lib.setFavoriteMany(selArr, true);
                  clearSelection();
                }}
                onDelete={bulkDelete}
                onRestore={bulkRestore}
                onDeleteForever={bulkDeleteForever}
                onClear={clearSelection}
              />
            )}

            {hasItems && dupMode && (
              <DuplicateBar
                groupCount={dup.groups.length}
                removableCount={dup.removableIds.size}
                kind={dupKind}
                onKindChange={setDupKind}
                onDeleteAll={handleDeleteDupes}
                onExit={() => setDupMode(false)}
              />
            )}

            <main className="relative min-h-0 flex-1">
              {!lib.ready ? (
                <div className="grid h-full place-items-center text-slate-500">
                  <div className="size-6 animate-spin rounded-full border-2 border-slate-700 border-t-sky-400" />
                </div>
              ) : !hasItems ? (
                <EmptyState onPick={handlePick} onImport={handleImportClick} canPick={canPick} />
              ) : noResults ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-500">
                  <SearchX className="size-8" />
                  <p className="text-sm">여기엔 사진이 없습니다.</p>
                  <button
                    onClick={resetView}
                    className="text-xs text-sky-400 transition-colors hover:text-sky-300"
                  >
                    전체 보기
                  </button>
                </div>
              ) : (
                <Grid
                  items={activeItems}
                  onOpen={openById}
                  onToggleFavorite={lib.toggleFavorite}
                  badges={dupBadges}
                  selectable={!dupMode}
                  selectedIds={selectedIds}
                  onSelect={handleSelect}
                  minCell={DENSITY_CELL[density]}
                />
              )}
            </main>
          </div>
        </div>

        {!lib.supported && (
          <div className="glass absolute inset-x-0 bottom-0 z-30 flex items-center justify-center gap-2 border-t border-amber-500/20 px-4 py-2 text-xs text-amber-300/90">
            <AlertTriangle className="size-3.5" />
            이 브라우저는 OPFS를 지원하지 않아 새로고침 시 캐시가 유지되지 않습니다.
          </div>
        )}
      </div>

      {toast && (
        <div className="animate-fade-up fixed inset-x-0 bottom-5 z-[70] flex justify-center px-4">
          <div className="glass flex max-w-xl items-center gap-3 rounded-xl border border-slate-700/70 px-4 py-3 text-xs leading-relaxed text-slate-200 shadow-2xl shadow-black/50">
            <Info className="size-4 shrink-0 text-sky-300" />
            <span className="flex-1">{toast.message}</span>
            {toast.action && (
              <button
                onClick={() => {
                  toast.action!.run();
                  setToast(null);
                }}
                className="shrink-0 rounded-md bg-sky-500 px-2.5 py-1 font-medium text-white hover:bg-sky-400"
              >
                {toast.action.label}
              </button>
            )}
            <button
              onClick={() => setToast(null)}
              className="shrink-0 text-slate-500 hover:text-slate-300"
              aria-label="닫기"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      {lightboxIndex !== null && activeItems[lightboxIndex] && (
        <Lightbox
          items={activeItems}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
          loadOriginal={lib.openOriginal}
          onToggleFavorite={lib.toggleFavorite}
          onDelete={handleDelete}
          onEdit={setEditingId}
          onRename={lib.renameItem}
          onAddTag={(id, tag) => lib.addTag([id], tag)}
          onRemoveTag={lib.removeTag}
          onShare={shareOne}
          canDeleteReal={lib.hasHandle(activeItems[lightboxIndex].id)}
          paused={editingId !== null}
        />
      )}

      {editingId && editItem && (
        <Editor
          item={editItem}
          loadOriginal={lib.openOriginal}
          onSave={async (file) => {
            await lib.replaceItem(editingId, file);
            setEditingId(null);
          }}
          onClose={() => setEditingId(null)}
        />
      )}
    </Dropzone>
  );
}
