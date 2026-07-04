import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RectangleHorizontal,
  Copy,
  Search,
  X,
  Grid3x3,
  LayoutGrid,
  Grid2x2,
  Star,
  ScanFace,
  Loader2,
} from "lucide-react";
import { Dropdown, type DropdownOption } from "./ui/Dropdown";
import { cn } from "@/lib/utils";
import {
  FAV_FILTER_LABELS,
  FACE_FILTER_LABELS,
  ORIENTATION_LABELS,
  SORT_LABELS,
  type Density,
  type FavFilter,
  type FaceFilter,
  type Orientation,
  type SortKey,
  type ViewState,
} from "@/lib/view";

interface ControlBarProps {
  view: ViewState;
  onChange: (patch: Partial<ViewState>) => void;
  title: string;
  shown: number;
  total: number;
  dupCount: number;
  dupMode: boolean;
  onToggleDup: () => void;
  density: Density;
  onDensityChange: (d: Density) => void;
  /** Photos not yet face-scanned (drives the scan button). */
  unscanned: number;
  /** Photos already face-scanned in this scope (drives the re-scan button). */
  scanned: number;
  scanning: boolean;
  scanDone: number;
  scanTotal: number;
  onScanFaces: () => void;
  onRescanFaces: () => void;
}

const DENSITIES: { value: Density; icon: typeof Grid3x3; label: string }[] = [
  { value: "sm", icon: Grid3x3, label: "작게" },
  { value: "md", icon: LayoutGrid, label: "보통" },
  { value: "lg", icon: Grid2x2, label: "크게" },
];

const sortOptions: DropdownOption<SortKey>[] = (
  Object.keys(SORT_LABELS) as SortKey[]
).map((k) => ({ value: k, label: SORT_LABELS[k] }));

const orientationOptions: DropdownOption<Orientation>[] = (
  Object.keys(ORIENTATION_LABELS) as Orientation[]
).map((o) => ({ value: o, label: ORIENTATION_LABELS[o] }));

const favOptions: DropdownOption<FavFilter>[] = (
  Object.keys(FAV_FILTER_LABELS) as FavFilter[]
).map((f) => ({ value: f, label: FAV_FILTER_LABELS[f] }));

const faceOptions: DropdownOption<FaceFilter>[] = (
  Object.keys(FACE_FILTER_LABELS) as FaceFilter[]
).map((f) => ({ value: f, label: FACE_FILTER_LABELS[f] }));

export function ControlBar({
  view,
  onChange,
  title,
  shown,
  total,
  dupCount,
  dupMode,
  onToggleDup,
  density,
  onDensityChange,
  unscanned,
  scanned,
  scanning,
  scanDone,
  scanTotal,
  onScanFaces,
  onRescanFaces,
}: ControlBarProps) {
  const query = view.query ?? "";
  const scanPct = scanTotal > 0 ? Math.round((scanDone / scanTotal) * 100) : 0;
  // Once everything in view is scanned, the button offers a re-scan instead.
  const rescanMode = !scanning && unscanned === 0 && scanned > 0;
  return (
    <div className="glass sticky top-[60px] z-20 border-b border-slate-800/60">
      <div className="flex flex-wrap items-center gap-2 px-5 py-2.5">
        {/* Current selection title + count */}
        <div className="mr-1 flex min-w-0 items-baseline gap-2">
          <span className="truncate text-sm font-semibold text-slate-100">{title}</span>
          <span className="shrink-0 text-xs tabular-nums text-slate-500">
            {shown === total
              ? `${total.toLocaleString()}`
              : `${shown.toLocaleString()} / ${total.toLocaleString()}`}
          </span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(e) => onChange({ query: e.target.value })}
            placeholder="검색"
            aria-label="검색"
            className="h-8 w-28 rounded-lg border border-slate-700/60 bg-slate-800/60 pl-7 pr-6 text-xs text-slate-100 outline-none transition-[width] duration-200 placeholder:text-slate-500 focus:w-44 focus:border-slate-600"
          />
          {query && (
            <button
              onClick={() => onChange({ query: "" })}
              aria-label="검색 지우기"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Favorite filter */}
        <Dropdown
          value={view.favFilter ?? "all"}
          options={favOptions}
          onChange={(favFilter) => onChange({ favFilter })}
          icon={Star}
          ariaLabel="즐겨찾기 필터"
        />

        {/* Face filter */}
        <Dropdown
          value={view.faceFilter ?? "all"}
          options={faceOptions}
          onChange={(faceFilter) => onChange({ faceFilter })}
          icon={ScanFace}
          ariaLabel="얼굴 필터"
        />

        {/* Face scan — scan new photos, re-scan a finished scope, or show progress */}
        {(unscanned > 0 || scanning || rescanMode) && (
          <button
            onClick={rescanMode ? onRescanFaces : onScanFaces}
            disabled={scanning}
            title={
              rescanMode
                ? `'${title}'의 사진을 다시 검사해요 (기기 안에서만 처리)`
                : `'${title}'에 보이는 사진에서만 얼굴을 찾아요 (기기 안에서만 처리)`
            }
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors duration-200 ease-spring",
              scanning
                ? "border-sky-400/50 bg-sky-500/15 text-sky-200"
                : "border-slate-700/60 bg-slate-800/60 text-slate-200 hover:bg-slate-700/60"
            )}
          >
            {scanning ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span className="tabular-nums">
                  {scanDone}/{scanTotal}
                </span>
                <span className="h-1.5 w-10 overflow-hidden rounded-full bg-slate-800">
                  <span
                    className="block h-full rounded-full bg-sky-400 transition-[width] duration-200"
                    style={{ width: `${scanPct}%` }}
                  />
                </span>
              </>
            ) : rescanMode ? (
              <>
                <ScanFace className="size-3.5" />
                얼굴 재스캔
              </>
            ) : (
              <>
                <ScanFace className="size-3.5" />
                얼굴 스캔
                <span className="tabular-nums text-slate-500">{unscanned}</span>
              </>
            )}
          </button>
        )}

        {/* Orientation filter */}
        <Dropdown
          value={view.orientation}
          options={orientationOptions}
          onChange={(orientation) => onChange({ orientation })}
          icon={RectangleHorizontal}
          ariaLabel="방향 필터"
        />

        {/* Duplicate cleanup entry — only when copies exist */}
        {(dupCount > 0 || dupMode) && (
          <button
            onClick={onToggleDup}
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors duration-200 ease-spring",
              dupMode
                ? "border-rose-400/50 bg-rose-500/15 text-rose-200"
                : "border-slate-700/60 bg-slate-800/60 text-slate-200 hover:bg-slate-700/60"
            )}
          >
            <Copy className="size-3.5" />
            중복
            {dupCount > 0 && (
              <span
                className={cn(
                  "tabular-nums",
                  dupMode ? "text-rose-300/80" : "text-slate-500"
                )}
              >
                {dupCount}
              </span>
            )}
          </button>
        )}

        {/* Density + Sort — pushed to the right */}
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden rounded-lg border border-slate-700/60 bg-slate-800/60 p-0.5 sm:flex">
            {DENSITIES.map((d) => (
              <button
                key={d.value}
                onClick={() => onDensityChange(d.value)}
                aria-label={`썸네일 ${d.label}`}
                title={`썸네일 ${d.label}`}
                className={cn(
                  "grid size-7 place-items-center rounded-md transition-colors",
                  density === d.value
                    ? "bg-slate-700/70 text-slate-100"
                    : "text-slate-400 hover:text-slate-200"
                )}
              >
                <d.icon className="size-4" />
              </button>
            ))}
          </div>
          <Dropdown
            value={view.sortKey}
            options={sortOptions}
            onChange={(sortKey) => onChange({ sortKey })}
            icon={ArrowUpDown}
            ariaLabel="정렬 기준"
            align="right"
          />
          <button
            onClick={() => onChange({ sortDir: view.sortDir === "asc" ? "desc" : "asc" })}
            aria-label={view.sortDir === "asc" ? "오름차순" : "내림차순"}
            title={view.sortDir === "asc" ? "오름차순" : "내림차순"}
            className="grid size-8 place-items-center rounded-lg border border-slate-700/60 bg-slate-800/60 text-slate-300 transition-colors hover:bg-slate-700/60"
          >
            {view.sortDir === "asc" ? (
              <ArrowUp className="size-4" />
            ) : (
              <ArrowDown className="size-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
