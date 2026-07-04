import { useEffect, useRef, useState } from "react";
import {
  Images,
  Star,
  Folder,
  FolderOpen,
  Plus,
  Layers,
  Trash2,
  Check,
  Tag,
} from "lucide-react";
import { Trash } from "lucide-react";
import type { Collection } from "@/lib/types";
import { selectionKey, type Selection } from "@/lib/view";
import { cn } from "@/lib/utils";

interface Counts {
  all: number;
  favorites: number;
  trash: number;
  folders: Record<string, number>;
  collections: Record<string, number>;
}

interface SidebarProps {
  selection: Selection;
  onSelect: (s: Selection) => void;
  folders: { value: string; label: string }[];
  collections: Collection[];
  tags: { value: string; count: number }[];
  counts: Counts;
  onCreateCollection: (name: string) => void;
  onRenameCollection: (id: string, name: string) => void;
  onDeleteCollection: (id: string) => void;
  onDropToFavorite: (itemIds: string[]) => void;
  onDropToCollection: (collectionId: string, itemIds: string[]) => void;
  onDropToTag: (tag: string, itemIds: string[]) => void;
  /** Mobile drawer state. */
  open?: boolean;
  onClose?: () => void;
}

const DRAG_TYPE = "application/x-lumen-id";
const DRAG_TYPE_MULTI = "application/x-lumen-ids";

function readDragIds(dt: DataTransfer): string[] {
  const multi = dt.getData(DRAG_TYPE_MULTI);
  if (multi) {
    try {
      const arr = JSON.parse(multi);
      if (Array.isArray(arr) && arr.length) return arr;
    } catch {
      /* fall through */
    }
  }
  const single = dt.getData(DRAG_TYPE);
  return single ? [single] : [];
}

export function Sidebar({
  selection,
  onSelect,
  folders,
  collections,
  tags,
  counts,
  onCreateCollection,
  onRenameCollection,
  onDeleteCollection,
  onDropToFavorite,
  onDropToCollection,
  onDropToTag,
  open = false,
  onClose,
}: SidebarProps) {
  const active = selectionKey(selection);
  const select = (s: Selection) => {
    onSelect(s);
    onClose?.(); // close the drawer on mobile after choosing
  };
  const [dropKey, setDropKey] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const addRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) addRef.current?.focus();
  }, [adding]);

  const commitNew = () => {
    if (newName.trim()) onCreateCollection(newName);
    setNewName("");
    setAdding(false);
  };
  const commitEdit = () => {
    if (editingId && editName.trim()) onRenameCollection(editingId, editName);
    setEditingId(null);
  };

  const dropProps = (key: string, handle: (ids: string[]) => void) => ({
    onDragOver: (e: React.DragEvent) => {
      if (e.dataTransfer.types.includes(DRAG_TYPE)) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setDropKey(key);
      }
    },
    onDragLeave: () => setDropKey((k) => (k === key ? null : k)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      const ids = readDragIds(e.dataTransfer);
      setDropKey(null);
      if (ids.length) handle(ids);
    },
  });

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}
      <aside
        className={cn(
          "w-60 shrink-0 flex-col overflow-y-auto border-r border-slate-800/70 p-3",
          open
            ? "fixed inset-y-0 left-0 z-50 flex bg-slate-950 shadow-2xl shadow-black/60 md:static md:z-auto md:bg-slate-950/40 md:shadow-none"
            : "hidden bg-slate-950/40 md:flex"
        )}
      >
      <Section title="라이브러리">
        <Row
          icon={Images}
          label="전체"
          count={counts.all}
          active={active === "all"}
          onClick={() => select({ kind: "all" })}
        />
        <Row
          icon={Star}
          label="즐겨찾기"
          count={counts.favorites}
          active={active === "favorites"}
          onClick={() => select({ kind: "favorites" })}
          starred
          dropTarget={dropKey === "favorites"}
          {...dropProps("favorites", onDropToFavorite)}
        />
        {counts.trash > 0 && (
          <Row
            icon={Trash}
            label="휴지통"
            count={counts.trash}
            active={active === "trash"}
            onClick={() => select({ kind: "trash" })}
          />
        )}
      </Section>

      {folders.length > 0 && (
        <Section title="폴더">
          {folders.map((f) => {
            const key = `folder:${f.value}`;
            return (
              <Row
                key={key}
                icon={active === key ? FolderOpen : Folder}
                label={f.label}
                count={counts.folders[f.value] ?? 0}
                active={active === key}
                onClick={() => select({ kind: "folder", value: f.value })}
              />
            );
          })}
        </Section>
      )}

      <Section
        title="컬렉션"
        action={
          <button
            onClick={() => setAdding(true)}
            title="새 컬렉션"
            className="grid size-5 place-items-center rounded-md text-slate-400 transition-colors hover:bg-slate-800/70 hover:text-slate-200"
          >
            <Plus className="size-3.5" />
          </button>
        }
      >
        {adding && (
          <div className="mb-1 flex items-center gap-1 px-1">
            <input
              ref={addRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitNew();
                if (e.key === "Escape") {
                  setAdding(false);
                  setNewName("");
                }
              }}
              placeholder="컬렉션 이름"
              className="h-7 min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-slate-100 outline-none focus:border-sky-500"
            />
            <button onClick={commitNew} className="text-sky-400 hover:text-sky-300">
              <Check className="size-4" />
            </button>
          </div>
        )}

        {collections.length === 0 && !adding && (
          <p className="px-2 py-1 text-[11px] leading-relaxed text-slate-500">
            + 로 컬렉션을 만들고, 사진을 여기로 드래그하세요.
          </p>
        )}

        {collections.map((c) => {
          const key = `collection:${c.id}`;
          const editing = editingId === c.id;
          return (
            <div key={c.id} className="group/col relative">
              {editing ? (
                <div className="flex items-center gap-1 px-1">
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="h-7 min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-slate-100 outline-none focus:border-sky-500"
                  />
                </div>
              ) : (
                <Row
                  icon={Layers}
                  label={c.name}
                  count={counts.collections[c.id] ?? 0}
                  active={active === key}
                  onClick={() => select({ kind: "collection", id: c.id })}
                  onDoubleClick={() => {
                    setEditingId(c.id);
                    setEditName(c.name);
                  }}
                  dropTarget={dropKey === key}
                  {...dropProps(key, (ids) => onDropToCollection(c.id, ids))}
                  trailing={
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteCollection(c.id);
                      }}
                      title="컬렉션 삭제"
                      className="hidden size-5 place-items-center rounded text-slate-500 hover:text-rose-300 group-hover/col:grid"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  }
                />
              )}
            </div>
          );
        })}
      </Section>

      {tags.length > 0 && (
        <Section title="태그">
          {tags.map((t) => {
            const key = `tag:${t.value}`;
            return (
              <Row
                key={key}
                icon={Tag}
                label={t.value}
                count={t.count}
                active={active === key}
                onClick={() => select({ kind: "tag", value: t.value })}
                dropTarget={dropKey === key}
                {...dropProps(key, (ids) => onDropToTag(t.value, ids))}
              />
            );
          })}
        </Section>
      )}
      </aside>
    </>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <div className="mb-1 flex items-center justify-between px-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </span>
        {action}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  count,
  active,
  starred,
  dropTarget,
  onClick,
  onDoubleClick,
  trailing,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  icon: typeof Images;
  label: string;
  count: number;
  active: boolean;
  starred?: boolean;
  dropTarget?: boolean;
  onClick: () => void;
  onDoubleClick?: () => void;
  trailing?: React.ReactNode;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-sky-400",
        active ? "bg-sky-500/15 text-sky-100" : "text-slate-300 hover:bg-slate-800/60",
        dropTarget && "bg-sky-500/10 ring-2 ring-inset ring-sky-400"
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0",
          starred && active ? "fill-amber-300 text-amber-300" : active ? "text-sky-300" : "text-slate-400"
        )}
      />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailing}
      <span className="shrink-0 text-[11px] tabular-nums text-slate-500">{count}</span>
    </div>
  );
}
