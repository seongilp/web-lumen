import {
  Cpu,
  HardDriveDownload,
  Zap,
  FolderDown,
  Lock,
  Sparkles,
  Github,
  ArrowRight,
  Gauge,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const REPO = "https://github.com/seongilp/web-lumen";
const BASE = import.meta.env.BASE_URL;
const APP_URL = `${BASE}app/`;
const shot = (name: string) => `${BASE}${name}`;

const features = [
  {
    icon: Cpu,
    title: "WASM 디코딩",
    desc: "AssemblyScript로 작성한 area-average 박스 필터가 Web Worker 안에서 썸네일을 네이티브 속도로 생성합니다.",
  },
  {
    icon: HardDriveDownload,
    title: "OPFS 캐시",
    desc: "썸네일·원본·매니페스트를 Origin Private File System에 저장. 한 번 연 폴더는 새로고침에도 즉시 복원됩니다.",
  },
  {
    icon: FolderDown,
    title: "폴더 드롭",
    desc: "창에 폴더를 끌어다 놓으면 끝. 중첩 폴더까지 재귀 수집하고, 디렉터리 선택 피커도 지원합니다.",
  },
  {
    icon: Zap,
    title: "가상 스크롤",
    desc: "보이는 행만 마운트하는 윈도잉 그리드 + 코어 수만큼의 워커 풀로 수천 장도 60fps로 흐릅니다.",
  },
  {
    icon: Lock,
    title: "100% 로컬",
    desc: "서버도 네트워크 전송도 없습니다. 모든 처리는 브라우저 안에서, 이미지는 어디에도 업로드되지 않습니다.",
  },
  {
    icon: Sparkles,
    title: "토스/애플 디자인",
    desc: "slate 팔레트, 글래스 툴바, 스프링 이징, blur-up 플레이스홀더. 군더더기 없는 부드러운 인터랙션.",
  },
];

const pipeline = [
  { step: "01", label: "폴더 드롭", desc: "webkitGetAsEntry로 이미지 수집" },
  { step: "02", label: "워커 디코딩", desc: "createImageBitmap → OffscreenCanvas" },
  { step: "03", label: "WASM 다운스케일", desc: "box filter + dominant color" },
  { step: "04", label: "OPFS 저장", desc: "webp 썸네일 + 원본 영속화" },
];

const stack = ["React 19", "TypeScript", "Vite", "AssemblyScript", "Tailwind v4", "OPFS"];

export function Landing() {
  return (
    <div className="min-h-full bg-slate-950 text-slate-100">
      {/* Nav */}
      <header className="glass sticky top-0 z-30 border-b border-slate-800/60">
        <nav className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-3.5">
          <div className="grid size-8 place-items-center rounded-lg bg-sky-500/15 ring-1 ring-sky-400/30">
            <Zap className="size-4 text-sky-300" />
          </div>
          <span className="text-sm font-bold tracking-tight">web-lumen</span>
          <nav className="mr-auto ml-4 hidden items-center gap-5 text-sm text-slate-400 sm:flex">
            <a href="#features" className="transition-colors hover:text-slate-100">특징</a>
            <a href="#how" className="transition-colors hover:text-slate-100">동작 원리</a>
            <a href={REPO} className="transition-colors hover:text-slate-100">소스</a>
          </nav>
          <a href={REPO} target="_blank" rel="noreferrer">
            <Button variant="ghost" size="sm">
              <Github />
              <span className="hidden sm:inline">GitHub</span>
            </Button>
          </a>
          <a href={APP_URL}>
            <Button size="sm">바로 체험</Button>
          </a>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-x-0 -top-40 h-96 opacity-50 blur-3xl"
          style={{
            background:
              "radial-gradient(60% 60% at 50% 0%, rgba(56,189,248,0.35), transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-5 pb-10 pt-20 text-center sm:pt-28">
          <a
            href={REPO}
            className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/60 px-3 py-1 text-xs text-slate-300 transition-colors hover:border-slate-700"
          >
            <span className="size-1.5 rounded-full bg-sky-400" />
            WASM · OPFS · 100% 브라우저 로컬
          </a>

          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold leading-[1.12] tracking-tight sm:text-6xl">
            폴더를 드롭하면 동작하는
            <br />
            <span className="bg-gradient-to-r from-sky-300 via-sky-400 to-indigo-400 bg-clip-text text-transparent">
              초고속 이미지 뷰어
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg">
            WASM 썸네일 디코딩과 OPFS 캐시로 수천 장도 60fps. 한 번 열면
            새로고침에도 즉시 복원되고, 이미지는 기기 밖으로 나가지 않습니다.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a href={APP_URL}>
              <Button size="lg">
                바로 체험하기
                <ArrowRight />
              </Button>
            </a>
            <a href={REPO} target="_blank" rel="noreferrer">
              <Button size="lg" variant="secondary">
                <Github />
                GitHub
              </Button>
            </a>
          </div>

          {/* Screenshot */}
          <div className="relative mx-auto mt-14 max-w-5xl">
            <div className="pointer-events-none absolute -inset-x-8 -top-8 bottom-0 rounded-[2rem] bg-sky-500/10 blur-2xl" />
            <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 shadow-2xl shadow-black/60 ring-1 ring-white/5">
              <div className="flex items-center gap-1.5 border-b border-slate-800/80 bg-slate-900/80 px-4 py-3">
                <span className="size-3 rounded-full bg-rose-400/70" />
                <span className="size-3 rounded-full bg-amber-400/70" />
                <span className="size-3 rounded-full bg-emerald-400/70" />
                <span className="ml-3 truncate text-xs text-slate-500">
                  seongilp.github.io/web-lumen/app
                </span>
              </div>
              <img
                src={shot("shot-grid.png")}
                alt="web-lumen 그리드 화면"
                className="w-full"
                loading="eager"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Tech badges */}
      <section className="mx-auto max-w-6xl px-5 py-8">
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          {stack.map((t) => (
            <span
              key={t}
              className="rounded-full border border-slate-800 bg-slate-900/50 px-3 py-1 text-xs font-medium text-slate-400"
            >
              {t}
            </span>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-5 py-16">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">속도와 프라이버시, 둘 다</h2>
          <p className="mt-3 text-slate-400">브라우저 안에서 끝나는, 군더더기 없는 뷰어.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 transition-all duration-300 ease-spring hover:-translate-y-0.5 hover:border-slate-700 hover:bg-slate-900/70"
            >
              <div className="grid size-11 place-items-center rounded-xl bg-sky-500/10 ring-1 ring-sky-400/20 transition-colors group-hover:bg-sky-500/15">
                <f.icon className="size-5 text-sky-400" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-50">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-y border-slate-800/60 bg-slate-900/20">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">파이프라인</h2>
            <p className="mt-3 text-slate-400">드롭 한 번에 일어나는 일.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {pipeline.map((p, i) => (
              <div key={p.step} className="relative rounded-2xl border border-slate-800/80 bg-slate-950/40 p-5">
                <span className="font-mono text-xs font-semibold text-sky-400/80">{p.step}</span>
                <h3 className="mt-2 text-sm font-semibold text-slate-100">{p.label}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{p.desc}</p>
                {i < pipeline.length - 1 && (
                  <ArrowRight className="absolute -right-3 top-1/2 hidden size-4 -translate-y-1/2 text-slate-700 lg:block" />
                )}
              </div>
            ))}
          </div>

          {/* Secondary screenshots */}
          <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2">
            {[
              { src: "shot-lightbox.png", icon: ImageIcon, cap: "원본 라이트박스 — OPFS에서 풀해상도 로드" },
              { src: "shot-banner.png", icon: Gauge, cap: "재방문 시 캐시에서 즉시 복원 + 투명한 안내" },
            ].map((s) => (
              <figure key={s.src} className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40">
                <img src={shot(s.src)} alt={s.cap} className="w-full" loading="lazy" />
                <figcaption className="flex items-center gap-2 border-t border-slate-800/80 px-4 py-3 text-xs text-slate-400">
                  <s.icon className="size-3.5 text-sky-400" />
                  {s.cap}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-5 py-20 text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">지금 폴더를 드롭해보세요</h2>
        <p className="mx-auto mt-4 max-w-md text-slate-400">
          설치 없음. 로그인 없음. 브라우저만 있으면 됩니다.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a href={APP_URL}>
            <Button size="lg">
              바로 체험하기
              <ArrowRight />
            </Button>
          </a>
          <a href={REPO} target="_blank" rel="noreferrer">
            <Button size="lg" variant="outline">
              <Github />
              소스 보기
            </Button>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 text-xs text-slate-500 sm:flex-row">
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-sky-400" />
            <span className="font-semibold text-slate-400">web-lumen</span>
            <span>· WASM × OPFS image viewer</span>
          </div>
          <a href={REPO} className="transition-colors hover:text-slate-300">
            github.com/seongilp/web-lumen
          </a>
        </div>
      </footer>
    </div>
  );
}
