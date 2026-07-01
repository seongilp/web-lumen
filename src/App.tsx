import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, SearchX } from "lucide-react";
import { Dropzone } from "./components/Dropzone";
import { Toolbar } from "./components/Toolbar";
import { ControlBar } from "./components/ControlBar";
import { Grid } from "./components/Grid";
import { EmptyState } from "./components/EmptyState";
import { RestoreBanner } from "./components/RestoreBanner";
import { DuplicateBar } from "./components/DuplicateBar";
import { Lightbox } from "./components/Lightbox";
import { Editor } from "./components/Editor";
import { useLibrary } from "./lib/useLibrary";
import { ThumbPool } from "./lib/thumb-pool";
import { applyView, listFolders, ALL_FOLDERS, type ViewState } from "./lib/view";
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
  const [dupMode, setDupMode] = useState(false);
  const [dupKind, setDupKind] = useState<DupMode>("exact");
  const [editingId, setEditingId] = useState<string | null>(null);
  const canPick = directoryPickerSupported();

  // Surface the trust banner once a restored-from-cache library is detected.
  useEffect(() => {
    if (lib.ready && lib.restoredCount > 0) setShowRestore(true);
  }, [lib.ready, lib.restoredCount]);

  // Derived, sorted + filtered display list — what the grid and lightbox use.
  const visibleItems = useMemo(() => applyView(lib.items, view), [lib.items, view]);
  const folders = useMemo(() => listFolders(lib.items), [lib.items]);
  const favCount = useMemo(() => lib.items.filter((it) => it.favorite).length, [lib.items]);
  const dup = useMemo(() => findDuplicates(lib.items, dupKind), [lib.items, dupKind]);

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

  const handleDrop = useCallback(
    async (dt: DataTransfer) => {
      const collected = await collectFromDataTransfer(dt);
      lib.importFiles(collected);
    },
    [lib]
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

  const editItem = editingId ? lib.items.find((it) => it.id === editingId) : undefined;
  const hasItems = lib.items.length > 0;
  const noResults = hasItems && !dupMode && visibleItems.length === 0;

  return (
    <Dropzone onDrop={handleDrop}>
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
            workerCount={ThumbPool.defaultSize()}
          />
        )}

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
            folders={folders}
            shown={visibleItems.length}
            total={lib.items.length}
            favCount={favCount}
            dupCount={dup.removableIds.size}
            dupMode={dupMode}
            onToggleDup={() => setDupMode((d) => !d)}
          />
        )}

        {hasItems && dupMode && (
          <DuplicateBar
            groupCount={dup.groups.length}
            removableCount={dup.removableIds.size}
            kind={dupKind}
            onKindChange={setDupKind}
            onDeleteAll={() => lib.removeMany([...dup.removableIds])}
            onExit={() => setDupMode(false)}
          />
        )}

        <main className="relative min-h-0 flex-1">
          {!lib.ready ? (
            <div className="grid h-full place-items-center text-slate-500">
              <div className="size-6 animate-spin rounded-full border-2 border-slate-700 border-t-sky-400" />
            </div>
          ) : !hasItems ? (
            <EmptyState onPick={handlePick} canPick={canPick} />
          ) : noResults ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-500">
              <SearchX className="size-8" />
              <p className="text-sm">조건에 맞는 이미지가 없습니다.</p>
              <button
                onClick={() => setView(DEFAULT_VIEW)}
                className="text-xs text-sky-400 transition-colors hover:text-sky-300"
              >
                필터 초기화
              </button>
            </div>
          ) : (
            <Grid
              items={activeItems}
              onOpen={openById}
              onToggleFavorite={lib.toggleFavorite}
              badges={dupBadges}
            />
          )}
        </main>

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
          onDelete={lib.removeItem}
          onEdit={setEditingId}
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
