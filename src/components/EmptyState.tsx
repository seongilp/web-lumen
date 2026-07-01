import { FolderOpen, Zap, HardDriveDownload, Cpu, Lock, Upload } from "lucide-react";
import { Button } from "./ui/button";

interface EmptyStateProps {
  onPick: () => void;
  onImport: () => void;
  canPick: boolean;
}

const features = [
  { icon: Cpu, title: "WASM 디코딩", desc: "박스 필터 썸네일을 네이티브 속도로" },
  { icon: HardDriveDownload, title: "OPFS 캐시", desc: "한 번 열면 새로고침에도 즉시 복원" },
  { icon: Zap, title: "가상 스크롤", desc: "수천 장도 60fps로 부드럽게" },
];

export function EmptyState({ onPick, onImport, canPick }: EmptyStateProps) {
  return (
    <div className="animate-fade-up flex h-full w-full flex-col items-center justify-center px-6">
      <div className="grid size-24 place-items-center rounded-[2rem] bg-gradient-to-br from-sky-500/20 to-indigo-500/10 ring-1 ring-slate-700/70 shadow-2xl shadow-sky-500/10">
        <FolderOpen className="size-11 text-sky-300" strokeWidth={1.6} />
      </div>

      <h1 className="mt-7 text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">
        폴더를 드롭하세요
      </h1>
      <p className="mt-2 max-w-md text-center text-sm leading-relaxed text-slate-400">
        이미지 폴더를 창 안으로 끌어다 놓으면, 초고속 썸네일 뷰어가 즉시 동작합니다.
      </p>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        {canPick && (
          <Button size="lg" onClick={onPick}>
            <FolderOpen />
            폴더 선택
          </Button>
        )}
        <Button size="lg" variant="secondary" onClick={onImport}>
          <Upload />
          백업 불러오기
        </Button>
      </div>

      <div className="mt-12 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
        {features.map((f) => (
          <div
            key={f.title}
            className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4 transition-colors duration-300 hover:border-slate-700"
          >
            <f.icon className="size-5 text-sky-400" />
            <p className="mt-3 text-sm font-semibold text-slate-100">{f.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">{f.desc}</p>
          </div>
        ))}
      </div>

      <p className="mt-8 flex items-center gap-1.5 text-xs text-slate-500">
        <Lock className="size-3.5" />
        모든 처리는 브라우저 안에서 이뤄지며, 이미지는 어디에도 업로드되지 않습니다.
      </p>
    </div>
  );
}
