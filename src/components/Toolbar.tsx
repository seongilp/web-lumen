import { useEffect, useRef, useState } from "react";
import {
  FolderOpen,
  Trash2,
  Images,
  Loader2,
  Zap,
  Download,
  Upload,
  HardDrive,
  FileJson,
} from "lucide-react";
import { Button } from "./ui/button";
import { cn, formatBytes } from "@/lib/utils";
import type { ImportProgress } from "@/lib/useLibrary";

interface ToolbarProps {
  count: number;
  usage: number;
  importing: boolean;
  progress: ImportProgress;
  canPick: boolean;
  onPick: () => void;
  onClear: () => void;
  onExportFull: () => void;
  onExportMeta: () => void;
  onImport: () => void;
  busy: boolean;
  workerCount: number;
}

export function Toolbar({
  count,
  usage,
  importing,
  progress,
  canPick,
  onPick,
  onClear,
  onExportFull,
  onExportMeta,
  onImport,
  busy,
  workerCount,
}: ToolbarProps) {
  const pct =
    progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <header className="glass sticky top-0 z-30 border-b border-slate-800/70">
      <div className="flex items-center gap-3 px-5 py-3">
        <a
          href={import.meta.env.BASE_URL}
          className="grid size-9 place-items-center rounded-xl bg-sky-500/15 ring-1 ring-sky-400/30 transition-transform duration-200 ease-spring hover:scale-105"
          title="wasmi 홈"
        >
          <Zap className="size-5 text-sky-300" />
        </a>
        <div className="mr-auto min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold tracking-tight text-slate-50">wasmi</h1>
            <span className="rounded-md bg-slate-800/80 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
              WASM · OPFS
            </span>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-slate-400">
            <Images className="size-3" />
            {count.toLocaleString()}장
            <span className="text-slate-600">·</span>
            {formatBytes(usage)}
            <span className="hidden text-slate-600 sm:inline">·</span>
            <span className="hidden sm:inline">워커 {workerCount}</span>
          </p>
        </div>

        {importing && (
          <div className="hidden items-center gap-2 text-xs text-slate-300 sm:flex">
            <Loader2 className="size-3.5 animate-spin text-sky-400" />
            <span className="tabular-nums">
              {progress.done}/{progress.total}
            </span>
            <div className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-sky-400 transition-[width] duration-200 ease-spring"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={onImport}
          disabled={busy}
          title="백업 불러오기"
        >
          <Upload className="text-slate-400" />
        </Button>
        {count > 0 && (
          <ExportMenu busy={busy} onFull={onExportFull} onMeta={onExportMeta} />
        )}
        {canPick && (
          <Button variant="secondary" size="sm" onClick={onPick}>
            <FolderOpen />
            <span className="hidden sm:inline">폴더 추가</span>
          </Button>
        )}
        {count > 0 && (
          <Button variant="ghost" size="icon" onClick={onClear} title="라이브러리 비우기">
            <Trash2 className="text-slate-400" />
          </Button>
        )}
      </div>
    </header>
  );
}

function ExportMenu({
  busy,
  onFull,
  onMeta,
}: {
  busy: boolean;
  onFull: () => void;
  onMeta: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const pick = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        title="백업(내보내기)"
      >
        {busy ? (
          <Loader2 className="animate-spin text-slate-400" />
        ) : (
          <Download className="text-slate-400" />
        )}
      </Button>

      {open && (
        <div className="glass animate-pop absolute right-0 z-40 mt-1.5 w-60 rounded-xl border border-slate-700/60 p-1 shadow-2xl shadow-black/50">
          <MenuItem
            icon={HardDrive}
            title="전체 백업"
            desc="사진 원본까지 · 어디서든 완전 복원"
            onClick={() => pick(onFull)}
          />
          <MenuItem
            icon={FileJson}
            title="메타 정보만"
            desc="즐겨찾기·정리 상태만 (작음). 복원 후 폴더 다시 드롭"
            onClick={() => pick(onMeta)}
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  title,
  desc,
  onClick,
}: {
  icon: typeof HardDrive;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-slate-800/70"
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0 text-sky-400" />
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-slate-100">{title}</span>
        <span className="block text-[11px] leading-snug text-slate-400">{desc}</span>
      </span>
    </button>
  );
}
