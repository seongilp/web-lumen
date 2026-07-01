import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  RotateCcw,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Crop,
  Sun,
  Contrast,
  Droplet,
  Check,
  X,
  Undo2,
} from "lucide-react";
import type { ImageItem } from "@/lib/types";
import { Button } from "./ui/button";
import { useElementSize } from "@/hooks/useElementSize";
import { cn } from "@/lib/utils";

interface EditorProps {
  item: ImageItem;
  loadOriginal: (id: string) => Promise<File | null>;
  onSave: (file: File) => void;
  onClose: () => void;
}

interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
} // normalized 0..1 on the oriented image

const FULL_CROP: CropRect = { x: 0, y: 0, w: 1, h: 1 };
const MIN_CROP = 0.06;
type Handle = "nw" | "ne" | "sw" | "se" | "move";

export function Editor({ item, loadOriginal, onSave, onClose }: EditorProps) {
  const [bmp, setBmp] = useState<ImageBitmap | null>(null);
  const [rotation, setRotation] = useState(0); // 0/90/180/270
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturate, setSaturate] = useState(100);
  const [cropOn, setCropOn] = useState(false);
  const [crop, setCrop] = useState<CropRect>(FULL_CROP);
  const [saving, setSaving] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { ref: stageRef, size: stage } = useElementSize<HTMLDivElement>();
  const drag = useRef<{ handle: Handle; start: CropRect; px: number; py: number } | null>(null);

  const filter = useMemo(
    () => `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%)`,
    [brightness, contrast, saturate]
  );

  // Load the full-resolution original once.
  useEffect(() => {
    let alive = true;
    let created: ImageBitmap | null = null;
    loadOriginal(item.id).then(async (file) => {
      if (!file || !alive) return;
      const b = await createImageBitmap(file, { imageOrientation: "from-image" });
      created = b;
      if (alive) setBmp(b);
      else b.close();
    });
    return () => {
      alive = false;
      created?.close();
    };
  }, [item.id, loadOriginal]);

  const swap = rotation % 180 !== 0;
  const orientedW = bmp ? (swap ? bmp.height : bmp.width) : 0;
  const orientedH = bmp ? (swap ? bmp.width : bmp.height) : 0;

  // Fit the oriented image into the available stage area.
  const display = useMemo(() => {
    if (!orientedW || !orientedH || !stage.width || !stage.height) {
      return { cw: 0, ch: 0, k: 0 };
    }
    const pad = 32;
    const k = Math.min(
      (stage.width - pad) / orientedW,
      (stage.height - pad) / orientedH
    );
    return { cw: Math.round(orientedW * k), ch: Math.round(orientedH * k), k };
  }, [orientedW, orientedH, stage.width, stage.height]);

  // Draw the oriented + colour-adjusted image onto a canvas at the given scale.
  const paint = useCallback(
    (ctx: CanvasRenderingContext2D, k: number) => {
      if (!bmp) return;
      const cw = orientedW * k;
      const ch = orientedH * k;
      ctx.clearRect(0, 0, cw, ch);
      ctx.save();
      ctx.filter = filter;
      ctx.imageSmoothingQuality = "high";
      ctx.translate(cw / 2, ch / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      ctx.drawImage(bmp, (-bmp.width * k) / 2, (-bmp.height * k) / 2, bmp.width * k, bmp.height * k);
      ctx.restore();
    },
    [bmp, orientedW, orientedH, rotation, flipH, flipV, filter]
  );

  // Live preview.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !display.cw) return;
    canvas.width = display.cw;
    canvas.height = display.ch;
    const ctx = canvas.getContext("2d");
    if (ctx) paint(ctx, display.k);
  }, [display, paint]);

  const resetCrop = () => setCrop(FULL_CROP);
  const rotate = (delta: number) => {
    setRotation((r) => (r + delta + 360) % 360);
    resetCrop();
  };

  // Crop-box pointer handling (corners + move), in normalized coords.
  const onPointerDown = (handle: Handle) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { handle, start: crop, px: e.clientX, py: e.clientY };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || !display.cw) return;
    const { handle, start, px, py } = drag.current;
    const dx = (e.clientX - px) / display.cw;
    const dy = (e.clientY - py) / display.ch;
    let { x, y, w, h } = start;

    if (handle === "move") {
      x = Math.min(Math.max(0, start.x + dx), 1 - start.w);
      y = Math.min(Math.max(0, start.y + dy), 1 - start.h);
    } else {
      const right = start.x + start.w;
      const bottom = start.y + start.h;
      if (handle === "nw") {
        x = Math.min(Math.max(0, start.x + dx), right - MIN_CROP);
        y = Math.min(Math.max(0, start.y + dy), bottom - MIN_CROP);
        w = right - x;
        h = bottom - y;
      } else if (handle === "ne") {
        y = Math.min(Math.max(0, start.y + dy), bottom - MIN_CROP);
        w = Math.min(Math.max(MIN_CROP, start.w + dx), 1 - start.x);
        h = bottom - y;
      } else if (handle === "sw") {
        x = Math.min(Math.max(0, start.x + dx), right - MIN_CROP);
        w = right - x;
        h = Math.min(Math.max(MIN_CROP, start.h + dy), 1 - start.y);
      } else {
        w = Math.min(Math.max(MIN_CROP, start.w + dx), 1 - start.x);
        h = Math.min(Math.max(MIN_CROP, start.h + dy), 1 - start.y);
      }
    }
    setCrop({ x, y, w, h });
  };
  const onPointerUp = () => (drag.current = null);

  const dirty =
    rotation !== 0 ||
    flipH ||
    flipV ||
    brightness !== 100 ||
    contrast !== 100 ||
    saturate !== 100 ||
    crop.w < 1 ||
    crop.h < 1;

  const handleSave = async () => {
    if (!bmp) return;
    setSaving(true);
    try {
      // Full-resolution oriented + adjusted render, then crop.
      const full = document.createElement("canvas");
      full.width = orientedW;
      full.height = orientedH;
      paint(full.getContext("2d")!, 1);

      const sx = Math.round(crop.x * orientedW);
      const sy = Math.round(crop.y * orientedH);
      const sw = Math.max(1, Math.round(crop.w * orientedW));
      const sh = Math.max(1, Math.round(crop.h * orientedH));

      const out = document.createElement("canvas");
      out.width = sw;
      out.height = sh;
      out.getContext("2d")!.drawImage(full, sx, sy, sw, sh, 0, 0, sw, sh);

      const type = item.type === "image/jpeg" ? "image/jpeg" : "image/png";
      const blob: Blob | null = await new Promise((res) =>
        out.toBlob(res, type, 0.92)
      );
      if (!blob) throw new Error("encode failed");
      onSave(new File([blob], item.name, { type, lastModified: item.lastModified }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-pop fixed inset-0 z-[60] flex flex-col bg-slate-950/95 backdrop-blur-2xl">
      <header className="flex items-center justify-between gap-4 px-5 py-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-100">{item.name} · 편집</p>
          <p className="text-xs text-slate-400">회전 · 반전 · 크롭 · 색보정</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X /> 취소
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!dirty || saving}>
            <Check /> {saving ? "저장 중…" : "저장"}
          </Button>
        </div>
      </header>

      <div ref={stageRef} className="relative flex min-h-0 flex-1 items-center justify-center p-4">
        <div className="relative" style={{ width: display.cw, height: display.ch }}>
          <canvas ref={canvasRef} className="rounded-xl shadow-2xl shadow-black/60" />

          {/* Crop overlay */}
          {cropOn && display.cw > 0 && (
            <div className="absolute inset-0" onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
              <div className="absolute inset-0 bg-black/50" />
              <div
                className="absolute cursor-move border-2 border-sky-400 shadow-[0_0_0_9999px_rgba(2,6,23,0.5)]"
                style={{
                  left: `${crop.x * 100}%`,
                  top: `${crop.y * 100}%`,
                  width: `${crop.w * 100}%`,
                  height: `${crop.h * 100}%`,
                }}
                onPointerDown={onPointerDown("move")}
              >
                {(["nw", "ne", "sw", "se"] as Handle[]).map((h) => (
                  <span
                    key={h}
                    onPointerDown={onPointerDown(h)}
                    className={cn(
                      "absolute size-3.5 rounded-full border-2 border-sky-400 bg-slate-950",
                      h === "nw" && "-left-2 -top-2 cursor-nwse-resize",
                      h === "ne" && "-right-2 -top-2 cursor-nesw-resize",
                      h === "sw" && "-bottom-2 -left-2 cursor-nesw-resize",
                      h === "se" && "-bottom-2 -right-2 cursor-nwse-resize"
                    )}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="glass border-t border-slate-800/70 px-5 py-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {/* Transform row */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <ToolButton icon={RotateCcw} label="왼쪽" onClick={() => rotate(-90)} />
            <ToolButton icon={RotateCw} label="오른쪽" onClick={() => rotate(90)} />
            <ToolButton
              icon={FlipHorizontal}
              label="좌우"
              active={flipH}
              onClick={() => {
                setFlipH((v) => !v);
                resetCrop();
              }}
            />
            <ToolButton
              icon={FlipVertical}
              label="상하"
              active={flipV}
              onClick={() => {
                setFlipV((v) => !v);
                resetCrop();
              }}
            />
            <ToolButton
              icon={Crop}
              label="크롭"
              active={cropOn}
              onClick={() => {
                setCropOn((v) => !v);
                if (cropOn) resetCrop();
              }}
            />
          </div>

          {/* Adjustment sliders */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Slider icon={Sun} label="밝기" value={brightness} onChange={setBrightness} />
            <Slider icon={Contrast} label="대비" value={contrast} onChange={setContrast} />
            <Slider icon={Droplet} label="채도" value={saturate} onChange={setSaturate} />
          </div>

          <div className="flex justify-center">
            <button
              onClick={() => {
                setRotation(0);
                setFlipH(false);
                setFlipV(false);
                setBrightness(100);
                setContrast(100);
                setSaturate(100);
                setCropOn(false);
                resetCrop();
              }}
              className="flex items-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-slate-200"
            >
              <Undo2 className="size-3.5" /> 원본으로 되돌리기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof Crop;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-colors duration-200 ease-spring",
        active
          ? "border-sky-400/50 bg-sky-500/15 text-sky-200"
          : "border-slate-700/60 bg-slate-800/60 text-slate-200 hover:bg-slate-700/60"
      )}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}

function Slider({
  icon: Icon,
  label,
  value,
  onChange,
}: {
  icon: typeof Sun;
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon className="size-4 shrink-0 text-slate-400" />
      <span className="w-8 shrink-0 text-xs text-slate-400">{label}</span>
      <input
        type="range"
        min={0}
        max={200}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-slate-700 accent-sky-400"
      />
      <span className="w-9 shrink-0 text-right text-xs tabular-nums text-slate-300">{value}%</span>
    </div>
  );
}
