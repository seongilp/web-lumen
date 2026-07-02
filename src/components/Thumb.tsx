import { memo, useState } from "react";
import { ImageOff, Star, Check } from "lucide-react";
import type { ImageItem } from "@/lib/types";
import { cn, intToRgb } from "@/lib/utils";

export type ThumbBadge = "keep" | "dupe";

interface ThumbProps {
  item: ImageItem;
  size: number;
  onOpen: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  badge?: ThumbBadge;
  /** Multi-select: provided only when selection is enabled (not in dup mode). */
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string, e: React.MouseEvent) => void;
  /** Ids to carry when dragging (all selected, or just this one). */
  dragIds?: string[];
}

function ThumbBase({
  item,
  size,
  onOpen,
  onToggleFavorite,
  badge,
  selectable,
  selected,
  onSelect,
  dragIds,
}: ThumbProps) {
  const [loaded, setLoaded] = useState(false);
  const bg = intToRgb(item.dominant || 0x1e293b);

  return (
    <button
      onClick={(e) => {
        if (selectable && (e.shiftKey || e.metaKey || e.ctrlKey)) {
          onSelect?.(item.id, e);
          return;
        }
        if (item.status === "ready") onOpen(item.id);
      }}
      draggable={item.status === "ready"}
      onDragStart={(e) => {
        const ids = dragIds && dragIds.length > 1 ? dragIds : [item.id];
        e.dataTransfer.setData("application/x-lumen-id", item.id);
        if (ids.length > 1) {
          e.dataTransfer.setData("application/x-lumen-ids", JSON.stringify(ids));
        }
        e.dataTransfer.effectAllowed = "copy";
      }}
      style={{ width: size, height: size, backgroundColor: bg }}
      className={cn(
        "group relative overflow-hidden rounded-2xl outline-none ring-1 transition-[transform,box-shadow] duration-300 ease-spring hover:z-10 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-black/50 focus-visible:ring-2 focus-visible:ring-sky-400",
        selected
          ? "ring-2 ring-sky-400"
          : badge === "dupe"
            ? "ring-2 ring-rose-500/70"
            : badge === "keep"
              ? "ring-2 ring-emerald-500/60"
              : "ring-slate-800/80 hover:ring-slate-600"
      )}
    >
      {item.status === "error" ? (
        <div className="flex h-full w-full items-center justify-center text-slate-500">
          <ImageOff className="size-6" />
        </div>
      ) : (
        item.thumbUrl && (
          <img
            src={item.thumbUrl}
            alt={item.name}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            style={{ opacity: loaded ? 1 : 0 }}
            className="h-full w-full object-cover transition-opacity duration-500 ease-spring group-hover:scale-[1.04] motion-safe:[transition:opacity_0.5s,transform_0.4s]"
          />
        )
      )}

      {/* Shimmer while pending */}
      {item.status === "pending" && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-800/40 to-slate-900/40" />
      )}

      {/* Multi-select checkbox — visible when selected, else on hover */}
      {selectable && item.status === "ready" && (
        <span
          role="checkbox"
          aria-checked={selected}
          aria-label="선택"
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.(item.id, e);
          }}
          className={cn(
            "absolute left-2 top-2 grid size-6 place-items-center rounded-full border-2 backdrop-blur-sm transition-all duration-200 ease-spring hover:scale-110",
            selected
              ? "border-sky-400 bg-sky-500 text-white opacity-100"
              : "border-white/70 bg-black/25 text-transparent opacity-0 group-hover:opacity-100"
          )}
        >
          <Check className="size-3.5" strokeWidth={3} />
        </span>
      )}

      {/* Duplicate-mode badge */}
      {badge && (
        <span
          className={cn(
            "absolute left-2 top-2 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm",
            badge === "dupe" ? "bg-rose-500/85" : "bg-emerald-500/85"
          )}
        >
          {badge === "dupe" ? "중복" : "유지"}
        </span>
      )}

      {/* Caption on hover */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-2.5 pt-6 opacity-0 transition-all duration-300 ease-spring group-hover:translate-y-0 group-hover:opacity-100">
        <p className="truncate text-left text-[11px] font-medium text-white/90">
          {item.name}
        </p>
      </div>

      {/* Favorite toggle — always visible when starred, otherwise on hover */}
      {item.status === "ready" && (
        <span
          role="button"
          tabIndex={-1}
          aria-label={item.favorite ? "즐겨찾기 해제" : "즐겨찾기"}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(item.id);
          }}
          className={cn(
            "absolute right-2 top-2 grid size-7 place-items-center rounded-full text-white/90 backdrop-blur-sm transition-all duration-200 ease-spring hover:scale-110",
            item.favorite
              ? "bg-black/30 opacity-100"
              : "bg-black/25 opacity-0 group-hover:opacity-100"
          )}
        >
          <Star
            className={cn("size-4", item.favorite && "fill-amber-300 text-amber-300")}
          />
        </span>
      )}
    </button>
  );
}

export const Thumb = memo(ThumbBase);
