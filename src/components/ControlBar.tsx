import {
  Star,
  Folder,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RectangleHorizontal,
} from "lucide-react";
import { Dropdown, type DropdownOption } from "./ui/Dropdown";
import { cn } from "@/lib/utils";
import {
  ALL_FOLDERS,
  ORIENTATION_LABELS,
  SORT_LABELS,
  type Orientation,
  type SortKey,
  type ViewState,
} from "@/lib/view";

interface ControlBarProps {
  view: ViewState;
  onChange: (patch: Partial<ViewState>) => void;
  folders: { value: string; label: string }[];
  shown: number;
  total: number;
  favCount: number;
}

const sortOptions: DropdownOption<SortKey>[] = (
  Object.keys(SORT_LABELS) as SortKey[]
).map((k) => ({ value: k, label: SORT_LABELS[k] }));

const orientationOptions: DropdownOption<Orientation>[] = (
  Object.keys(ORIENTATION_LABELS) as Orientation[]
).map((o) => ({ value: o, label: ORIENTATION_LABELS[o] }));

export function ControlBar({
  view,
  onChange,
  folders,
  shown,
  total,
  favCount,
}: ControlBarProps) {
  const folderOptions: DropdownOption<string>[] = [
    { value: ALL_FOLDERS, label: "모든 폴더" },
    ...folders,
  ];

  return (
    <div className="glass sticky top-[60px] z-20 border-b border-slate-800/60">
      <div className="flex flex-wrap items-center gap-2 px-5 py-2.5">
        {/* Favorites filter */}
        <button
          onClick={() => onChange({ onlyFavorites: !view.onlyFavorites })}
          className={cn(
            "flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors duration-200 ease-spring",
            view.onlyFavorites
              ? "border-amber-400/40 bg-amber-400/15 text-amber-200"
              : "border-slate-700/60 bg-slate-800/60 text-slate-200 hover:bg-slate-700/60"
          )}
        >
          <Star
            className={cn("size-3.5", view.onlyFavorites && "fill-amber-300 text-amber-300")}
          />
          즐겨찾기
          {favCount > 0 && (
            <span
              className={cn(
                "tabular-nums",
                view.onlyFavorites ? "text-amber-300/80" : "text-slate-500"
              )}
            >
              {favCount}
            </span>
          )}
        </button>

        {/* Folder filter (only when there's more than one group) */}
        {folders.length >= 2 && (
          <Dropdown
            value={view.folder}
            options={folderOptions}
            onChange={(folder) => onChange({ folder })}
            icon={Folder}
            ariaLabel="폴더 필터"
          />
        )}

        {/* Orientation filter */}
        <Dropdown
          value={view.orientation}
          options={orientationOptions}
          onChange={(orientation) => onChange({ orientation })}
          icon={RectangleHorizontal}
          ariaLabel="방향 필터"
        />

        <div className="mx-1 hidden text-xs tabular-nums text-slate-500 sm:block">
          {shown === total ? `${total.toLocaleString()}장` : `${shown.toLocaleString()} / ${total.toLocaleString()}`}
        </div>

        {/* Sort — pushed to the right */}
        <div className="ml-auto flex items-center gap-2">
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
