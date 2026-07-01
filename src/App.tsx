import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, SearchX, Info, X } from "lucide-react";
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
  topFolder,
  selectionToView,
  ALL_FOLDERS,
  ROOT_FOLDER,
  type ViewState,
  type Selection,
} from "./lib/view";
import { findDuplicates, type DupMode } from "./lib/dedup";
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
  const [metaNotice, setMetaNotice] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const anchorRef = useRef<number | null>(null);
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
  const dup = useMemo(() => findDuplicates(lib.items, dupKind), [lib.items, dupKind]);

  // Per-section counts for the sidebar.
  const counts = useMemo(() => {
    const foldersC: Record<string, number> = {};
    const collectionsC: Record<string, number> = {};
    let favorites = 0;
    for (const it of lib.items) {
      if (it.favorite) favorites++;
      const f = topFolder(it.relPath);
      const key = f === "" ? ROOT_FOLDER : f;
      foldersC[key] = (foldersC[key] ?? 0) + 1;
      for (const c of it.collections) collectionsC[c] = (collectionsC[c] ?? 0) + 1;
    }
    return { all: lib.items.length, favorites, folders: foldersC, collections: collectionsC };
  }, [lib.items]);

  const selectionTitle = useMemo(() => {
    switch (selection.kind) {
      case "favorites":
        return "즐겨찾기";
      case "folder":
        return selection.value === ROOT_FOLDER ? "최상위" : selection.value;
      case "collection":
        return lib.collections.find((c) => c.id === selection.id)?.name ?? "컬렉션";
      default:
        return "전체";
    }
  }, [selection, lib.collections]);

  // If the selected collection/folder disappears, fall back to 전체.
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
  }, [selection, lib.collections, folders]);

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
      // A single .wasmi file → restore a backup; otherwise import images.
      const dropped = Array.from(dt.files);
      const backup = dropped.find((f) => f.name.endsWith(".wasmi"));
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
    URL.revokeObjectURL(url);
  };
  const stamp = () => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
  };

  const handleExportFull = useCallback(async () => {
    setBusy(true);
    try {
      download(await lib.exportBackup(), `wasmi-backup-${stamp()}.wasmi`);
    } finally {
      setBusy(false);
    }
  }, [lib]);

  const handleExportMeta = useCallback(() => {
    download(lib.exportMetaBackup(), `wasmi-meta-${stamp()}.wasmi`);
  }, [lib]);

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
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (e.shiftKey && anchorRef.current !== null) {
          const [a, b] = [anchorRef.current, index].sort((x, y) => x - y);
          for (let i = a; i <= b; i++) next.add(activeItems[i].id);
        } else if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
      anchorRef.current = index;
    },
    [activeItems]
  );

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

  // Esc clears selection when no overlay is open.
  useEffect(() => {
    if (selectedIds.size === 0 || lightboxIndex !== null || editingId !== null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearSelection();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedIds.size, lightboxIndex, editingId, clearSelection]);

  const selArr = useMemo(() => [...selectedIds], [selectedIds]);

  const bulkDelete = useCallback(() => {
    const realCount = selArr.filter((id) => lib.hasHandle(id)).length;
    const msg =
      realCount > 0
        ? `${selArr.length}장을 삭제합니다. 이 중 ${realCount}장은 원본 파일까지 영구 삭제돼요. 진행할까요?`
        : `${selArr.length}장을 목록에서 제거할까요?`;
    if (!confirm(msg)) return;
    lib.removeMany(selArr);
    clearSelection();
  }, [selArr, lib, clearSelection]);

  // Delete one image — confirm when it will remove the real file on disk.
  const handleDelete = useCallback(
    (id: string) => {
      if (lib.hasHandle(id)) {
        if (!confirm("원본 파일을 디스크에서 영구 삭제합니다. 되돌릴 수 없어요. 진행할까요?")) {
          return;
        }
      }
      lib.removeItem(id);
    },
    [lib]
  );

  const handleDeleteDupes = useCallback(() => {
    const ids = [...dup.removableIds];
    const realCount = ids.filter((id) => lib.hasHandle(id)).length;
    if (realCount > 0) {
      if (
        !confirm(
          `${ids.length}장을 삭제합니다. 이 중 ${realCount}장은 원본 파일까지 영구 삭제돼요. 진행할까요?`
        )
      ) {
        return;
      }
    }
    lib.removeMany(ids);
  }, [dup.removableIds, lib]);

  const editItem = editingId ? lib.items.find((it) => it.id === editingId) : undefined;
  const hasItems = lib.items.length > 0;
  const noResults = hasItems && !dupMode && visibleItems.length === 0;

  return (
    <Dropzone onDrop={handleDrop}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".wasmi,application/octet-stream"
        className="hidden"
        onChange={onFileChange}
      />
      <div className="flex h-full w-full flex-col">
        {hasItems && (
          <Toolbar
            count={lib.items.length}
            usage={lib.usage}
            importing={lib.importing}
            progress={lib.progress}
            canPick={canPick}
            onPick={handlePick}
            onClear={lib.clear}
            onExportFull={handleExportFull}
            onExportMeta={handleExportMeta}
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
              counts={counts}
              onCreateCollection={(name) => setSelection({ kind: "collection", id: lib.createCollection(name) })}
              onRenameCollection={lib.renameCollection}
              onDeleteCollection={lib.deleteCollection}
              onDropToFavorite={onDropToFavorite}
              onDropToCollection={onDropToCollection}
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
              />
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

            {hasItems && !dupMode && selectedIds.size > 0 && (
              <SelectionBar
                count={selectedIds.size}
                collections={lib.collections}
                onAddToCollection={(colId) => {
                  lib.addToCollection(selArr, colId);
                  clearSelection();
                }}
                onCreateAndAdd={(name) => {
                  lib.addToCollection(selArr, lib.createCollection(name));
                  clearSelection();
                }}
                onFavorite={() => {
                  lib.setFavoriteMany(selArr, true);
                  clearSelection();
                }}
                onDelete={bulkDelete}
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
