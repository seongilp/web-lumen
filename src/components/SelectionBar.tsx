import { useEffect, useRef, useState } from "react";
import {
  CheckCheck,
  Layers,
  Star,
  Trash2,
  X,
  Plus,
  RotateCcw,
  ListChecks,
  Tag,
  Share2,
} from "lucide-react";
import type { Collection } from "@/lib/types";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

interface SelectionBarProps {
  count: number;
  total: number;
  collections: Collection[];
  tags: string[];
  trashMode?: boolean;
  onSelectAll: () => void;
  onAddToCollection: (collectionId: string) => void;
  onCreateAndAdd: (name: string) => void;
  onAddTag: (tag: string) => void;
  onShare: () => void;
  onFavorite: () => void;
  onDelete: () => void;
  onRestore: () => void;
  onDeleteForever: () => void;
  onClear: () => void;
}

export function SelectionBar({
  count,
  total,
  collections,
  tags,
  trashMode,
  onSelectAll,
  onAddToCollection,
  onCreateAndAdd,
  onAddTag,
  onShare,
  onFavorite,
  onDelete,
  onRestore,
  onDeleteForever,
  onClear,
}: SelectionBarProps) {
  return (
    <div className="animate-fade-up flex flex-wrap items-center gap-2 border-b border-sky-500/25 bg-sky-500/10 px-5 py-2.5">
      <CheckCheck className="size-4 shrink-0 text-sky-300" />
      <span className="text-xs font-semibold text-sky-100">{count}개 선택</span>

      <div className="ml-2 flex flex-wrap items-center gap-2">
        {count < total && (
          <Button variant="secondary" size="sm" onClick={onSelectAll}>
            <ListChecks />
            전체 선택
          </Button>
        )}

        {trashMode ? (
          <>
            <Button variant="secondary" size="sm" onClick={onRestore}>
              <RotateCcw />
              복구
            </Button>
            <Button variant="danger" size="sm" onClick={onDeleteForever}>
              <Trash2 />
              영구 삭제
            </Button>
          </>
        ) : (
          <>
            <CollectionMenu
              collections={collections}
              onAddToCollection={onAddToCollection}
              onCreateAndAdd={onCreateAndAdd}
            />
            <TagMenu tags={tags} onAddTag={onAddTag} />
            <Button variant="secondary" size="sm" onClick={onShare}>
              <Share2 />
              공유
            </Button>
            <Button variant="secondary" size="sm" onClick={onFavorite}>
              <Star />
              즐겨찾기
            </Button>
            <Button variant="danger" size="sm" onClick={onDelete}>
              <Trash2 />
              삭제
            </Button>
          </>
        )}
      </div>

      <button
        onClick={onClear}
        title="선택 해제 (Esc)"
        className="ml-auto grid size-7 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800/70 hover:text-slate-200"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

function TagMenu({
  tags,
  onAddTag,
}: {
  tags: string[];
  onAddTag: (tag: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const add = (t: string) => {
    if (t.trim()) onAddTag(t);
    setValue("");
    setOpen(false);
  };
  const q = value.trim().toLowerCase();
  const suggestions = tags.filter((t) => t.toLowerCase().includes(q)).slice(0, 8);

  return (
    <div ref={ref} className="relative">
      <Button variant="secondary" size="sm" onClick={() => setOpen((o) => !o)}>
        <Tag />
        태그
      </Button>
      {open && (
        <div className="glass animate-pop absolute left-0 z-40 mt-1.5 max-h-72 w-56 overflow-y-auto rounded-xl border border-slate-700/60 p-1 shadow-2xl shadow-black/50">
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add(value)}
            placeholder="태그 입력 후 Enter"
            className="mb-1 h-8 w-full rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-slate-100 outline-none focus:border-sky-500"
          />
          {suggestions.map((t) => (
            <button
              key={t}
              onClick={() => add(t)}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-slate-200 transition-colors hover:bg-slate-800/70"
            >
              <Tag className="size-3.5 shrink-0 text-sky-400" />
              <span className="min-w-0 flex-1 truncate">{t}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CollectionMenu({
  collections,
  onAddToCollection,
  onCreateAndAdd,
}: {
  collections: Collection[];
  onAddToCollection: (id: string) => void;
  onCreateAndAdd: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setAdding(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const create = () => {
    if (name.trim()) onCreateAndAdd(name);
    setName("");
    setAdding(false);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <Button variant="secondary" size="sm" onClick={() => setOpen((o) => !o)}>
        <Layers />
        컬렉션에 추가
      </Button>
      {open && (
        <div className="glass animate-pop absolute left-0 z-40 mt-1.5 max-h-72 w-56 overflow-y-auto rounded-xl border border-slate-700/60 p-1 shadow-2xl shadow-black/50">
          {collections.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                onAddToCollection(c.id);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-slate-200 transition-colors hover:bg-slate-800/70"
            >
              <Layers className="size-3.5 shrink-0 text-sky-400" />
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
            </button>
          ))}

          {adding ? (
            <div className="flex items-center gap-1 p-1">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") create();
                  if (e.key === "Escape") setAdding(false);
                }}
                placeholder="새 컬렉션 이름"
                className="h-7 min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-slate-100 outline-none focus:border-sky-500"
              />
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className={cn(
                "mt-0.5 flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-sky-300 transition-colors hover:bg-slate-800/70",
                collections.length > 0 && "border-t border-slate-800/70"
              )}
            >
              <Plus className="size-3.5 shrink-0" />
              새 컬렉션에 추가
            </button>
          )}
        </div>
      )}
    </div>
  );
}
