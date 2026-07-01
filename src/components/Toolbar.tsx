import {
  FolderOpen,
  Trash2,
  Images,
  Loader2,
  Cpu,
  Download,
  Upload,
} from "lucide-react";
import { Button } from "./ui/button";
import { formatBytes } from "@/lib/utils";
import type { ImportProgress } from "@/lib/useLibrary";

interface ToolbarProps {
  count: number;
  usage: number;
  importing: boolean;
  progress: ImportProgress;
  canPick: boolean;
  onPick: () => void;
  onClear: () => void;
  onExport: () => void;
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
  onExport,
  onImport,
  busy,
  workerCount,
}: ToolbarProps) {
  const pct =
    progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <header className="glass sticky top-0 z-30 border-b border-slate-800/70">
      <div className="flex items-center gap-3 px-5 py-3">
        <div className="grid size-9 place-items-center rounded-xl bg-sky-500/15 ring-1 ring-sky-400/30">
          <Cpu className="size-5 text-sky-300" />
        </div>
        <div className="mr-auto min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold tracking-tight text-slate-50">Flash</h1>
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
          <Button
            variant="ghost"
            size="icon"
            onClick={onExport}
            disabled={busy}
            title="라이브러리 백업(내보내기)"
          >
            {busy ? <Loader2 className="animate-spin text-slate-400" /> : <Download className="text-slate-400" />}
          </Button>
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
