import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, SearchX } from "lucide-react";
import { Dropzone } from "./components/Dropzone";
import { Toolbar } from "./components/Toolbar";
import { ControlBar } from "./components/ControlBar";
import { Grid } from "./components/Grid";
import { EmptyState } from "./components/EmptyState";
import { RestoreBanner } from "./components/RestoreBanner";
import { Lightbox } from "./components/Lightbox";
import { useLibrary } from "./lib/useLibrary";
import { ThumbPool } from "./lib/thumb-pool";
import { applyView, listFolders, ALL_FOLDERS, type ViewState } from "./lib/view";
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
  const canPick = directoryPickerSupported();

  // Surface the trust banner once a restored-from-cache library is detected.
  useEffect(() => {
    if (lib.ready && lib.restoredCount > 0) setShowRestore(true);
  }, [lib.ready, lib.restoredCount]);

  // Derived, sorted + filtered display list — what the grid and lightbox use.
  const visibleItems = useMemo(() => applyView(lib.items, view), [lib.items, view]);
  const folders = useMemo(() => listFolders(lib.items), [lib.items]);
  const favCount = useMemo(() => lib.items.filter((it) => it.favorite).length, [lib.items]);

  // Keep the lightbox index valid as the visible list changes (delete / filter).
  useEffect(() => {
    if (lightboxIndex === null) return;
    if (lightboxIndex >= visibleItems.length) {
      setLightboxIndex(visibleItems.length > 0 ? visibleItems.length - 1 : null);
    }
  }, [visibleItems.length, lightboxIndex]);

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
      const idx = visibleItems.findIndex((it) => it.id === id);
      if (idx >= 0) setLightboxIndex(idx);
    },
    [visibleItems]
  );

  const hasItems = lib.items.length > 0;
  const noResults = hasItems && visibleItems.length === 0;

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
            <Grid items={visibleItems} onOpen={openById} onToggleFavorite={lib.toggleFavorite} />
          )}
        </main>

        {!lib.supported && (
          <div className="glass absolute inset-x-0 bottom-0 z-30 flex items-center justify-center gap-2 border-t border-amber-500/20 px-4 py-2 text-xs text-amber-300/90">
            <AlertTriangle className="size-3.5" />
            이 브라우저는 OPFS를 지원하지 않아 새로고침 시 캐시가 유지되지 않습니다.
          </div>
        )}
      </div>

      {lightboxIndex !== null && visibleItems[lightboxIndex] && (
        <Lightbox
          items={visibleItems}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
          loadOriginal={lib.openOriginal}
          onToggleFavorite={lib.toggleFavorite}
          onDelete={lib.removeItem}
        />
      )}
    </Dropzone>
  );
}
