import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Maximize2,
  Minimize2,
  Star,
  Trash2,
  Pencil,
  Play,
  Pause,
  MapPin,
  Tag,
  Plus,
} from "lucide-react";
import type { ImageItem } from "@/lib/types";
import { Button } from "./ui/button";
import { cn, formatBytes, formatDate, intToRgb } from "@/lib/utils";

const SLIDESHOW_MS = 3500;

interface LightboxProps {
  items: ImageItem[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  loadOriginal: (id: string) => Promise<File | null>;
  onToggleFavorite: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onAddTag: (id: string, tag: string) => void;
  onRemoveTag: (id: string, tag: string) => void;
  /** True when deleting removes the real file on disk (picker imports). */
  canDeleteReal?: boolean;
  /** When true (e.g. the editor is open), keyboard shortcuts are suspended. */
  paused?: boolean;
}

export function Lightbox({
  items,
  index,
  onClose,
  onNavigate,
  loadOriginal,
  onToggleFavorite,
  onDelete,
  onEdit,
  onRename,
  onAddTag,
  onRemoveTag,
  canDeleteReal = false,
  paused = false,
}: LightboxProps) {
  const item = items[index];
  const [fullUrl, setFullUrl] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [tagInput, setTagInput] = useState("");
  const urlRef = useRef<string | null>(null);

  // Load the full-resolution original from OPFS for the current item.
  useEffect(() => {
    let alive = true;
    setFullUrl(null);
    setZoomed(false);
    loadOriginal(item.id).then((file) => {
      if (!alive) return;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      if (file) {
        const url = URL.createObjectURL(file);
        urlRef.current = url;
        setFullUrl(url);
      } else {
        urlRef.current = null;
      }
    });
    return () => {
      alive = false;
    };
    // item.hash changes when the image is edited → reload the new original.
  }, [item.id, item.hash, loadOriginal]);

  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  const go = useCallback(
    (delta: number) => {
      const next = (index + delta + items.length) % items.length;
      onNavigate(next);
    },
    [index, items.length, onNavigate]
  );

  // Slideshow auto-advance.
  useEffect(() => {
    if (!playing || items.length < 2) return;
    const t = setInterval(() => onNavigate((index + 1) % items.length), SLIDESHOW_MS);
    return () => clearInterval(t);
  }, [playing, index, items.length, onNavigate]);

  const commitRename = () => {
    if (nameDraft.trim()) onRename(item.id, nameDraft);
    setRenaming(false);
  };

  useEffect(() => {
    if (paused) return;
    const onKey = (e: KeyboardEvent) => {
      // Ignore shortcuts while typing (e.g. renaming).
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "p":
        case "P":
          setPlaying((v) => !v);
          break;
        case "ArrowRight":
          go(1);
          break;
        case "ArrowLeft":
          go(-1);
          break;
        case "Delete":
        case "Backspace":
          e.preventDefault();
          onDelete(item.id);
          break;
        case " ": // Space → 즐겨찾기
          e.preventDefault();
          onToggleFavorite(item.id);
          break;
        case "e":
        case "E":
          onEdit(item.id);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paused, go, onClose, onDelete, onToggleFavorite, onEdit, item.id]);

  const bg = intToRgb(item.dominant || 0x0f172a);

  return (
    <div className="animate-pop fixed inset-0 z-50 flex flex-col bg-slate-950/90 backdrop-blur-2xl">
      {/* Top bar */}
      <header className="z-10 flex items-center justify-between gap-4 px-5 py-4">
        <div className="min-w-0">
          {renaming ? (
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") setRenaming(false);
              }}
              className="w-64 max-w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-0.5 text-sm text-slate-100 outline-none focus:border-sky-500"
            />
          ) : (
            <p
              className="cursor-text truncate text-sm font-semibold text-slate-100 hover:text-white"
              title="더블클릭해서 이름 변경"
              onDoubleClick={() => {
                setNameDraft(item.name);
                setRenaming(true);
              }}
            >
              {item.name}
            </p>
          )}
          <p className="truncate text-xs text-slate-400">
            {item.width}×{item.height} · {formatBytes(item.size)} · {index + 1} / {items.length}
            {item.takenAt && ` · ${formatDate(item.takenAt)}`}
            {item.camera && ` · ${item.camera}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {item.lat !== undefined && item.lon !== undefined && (
            <a
              href={`https://www.google.com/maps?q=${item.lat},${item.lon}`}
              target="_blank"
              rel="noreferrer"
              title="지도에서 보기"
            >
              <Button variant="ghost" size="icon" className="text-sky-300">
                <MapPin />
              </Button>
            </a>
          )}
          {items.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPlaying((v) => !v)}
              title={playing ? "일시정지 (P)" : "슬라이드쇼 (P)"}
            >
              {playing ? <Pause /> : <Play />}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToggleFavorite(item.id)}
            title={item.favorite ? "즐겨찾기 해제 (Space)" : "즐겨찾기 (Space)"}
          >
            <Star className={cn(item.favorite && "fill-amber-300 text-amber-300")} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(item.id)}
            title="편집 (E)"
          >
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(item.id)}
            title={canDeleteReal ? "원본 파일 삭제 (Del)" : "목록에서 제거 (Del)"}
            className="hover:text-rose-300"
          >
            <Trash2 />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setZoomed((z) => !z)}
            title={zoomed ? "화면에 맞추기" : "화면 폭에 맞춰 크게"}
          >
            {zoomed ? <Minimize2 /> : <Maximize2 />}
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} title="닫기 (Esc)">
            <X />
          </Button>
        </div>
      </header>

      {/* Tag bar */}
      <div className="z-10 flex flex-wrap items-center gap-1.5 px-5 pb-3">
        <Tag className="size-3.5 shrink-0 text-slate-500" />
        {item.tags.map((t) => (
          <span
            key={t}
            className="group/tag flex items-center gap-1 rounded-full border border-slate-700/70 bg-slate-800/60 py-0.5 pl-2.5 pr-1 text-xs text-slate-200"
          >
            {t}
            <button
              onClick={() => onRemoveTag(item.id, t)}
              title="태그 제거"
              className="grid size-4 place-items-center rounded-full text-slate-500 hover:bg-slate-700 hover:text-slate-200"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <div className="flex items-center gap-1 rounded-full border border-dashed border-slate-700/70 py-0.5 pl-2 pr-1">
          <Plus className="size-3 text-slate-500" />
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && tagInput.trim()) {
                onAddTag(item.id, tagInput);
                setTagInput("");
              }
              if (e.key === "Escape") setTagInput("");
            }}
            placeholder="태그 추가"
            className="w-20 bg-transparent text-xs text-slate-100 outline-none placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* Stage. When zoomed we fit to width and scroll vertically, so align to
          the top — otherwise a tall image's top would be clipped and unreachable. */}
      <div
        className={cn(
          "relative flex flex-1 justify-center overflow-auto px-4 pb-6",
          zoomed ? "items-start" : "items-center"
        )}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {/* Placeholder color while the original loads */}
        {!fullUrl && (
          <div
            className="absolute inset-x-10 inset-y-4 animate-pulse rounded-3xl opacity-40"
            style={{ backgroundColor: bg }}
          />
        )}

        <img
          src={fullUrl ?? item.thumbUrl}
          alt={item.name}
          onClick={() => setZoomed((z) => !z)}
          className={cn(
            "rounded-2xl shadow-2xl shadow-black/60 transition-[opacity,filter] duration-300 ease-spring",
            zoomed
              ? "h-auto w-full max-w-none cursor-zoom-out" // fit to screen width
              : "max-h-full max-w-full cursor-zoom-in object-contain", // fit fully
            !fullUrl && "blur-sm"
          )}
          // Don't upscale past the image's own width when fitting to width.
          style={zoomed ? { maxWidth: item.width } : undefined}
        />
      </div>

      {/* Nav buttons */}
      {items.length > 1 && (
        <>
          <NavButton side="left" onClick={() => go(-1)} />
          <NavButton side="right" onClick={() => go(1)} />
        </>
      )}
    </div>
  );
}

function NavButton({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "glass absolute top-1/2 -translate-y-1/2 grid size-12 place-items-center rounded-full text-slate-200 ring-1 ring-slate-700/60 transition-all duration-200 ease-spring hover:scale-110 hover:text-white active:scale-95",
        side === "left" ? "left-5" : "right-5"
      )}
    >
      {side === "left" ? <ChevronLeft className="size-6" /> : <ChevronRight className="size-6" />}
    </button>
  );
}
