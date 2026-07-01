import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DropdownOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

interface DropdownProps<T extends string> {
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  icon?: LucideIcon;
  ariaLabel?: string;
  align?: "left" | "right";
}

/** Compact, dependency-free select menu matching the app's glass aesthetic. */
export function Dropdown<T extends string>({
  value,
  options,
  onChange,
  icon: Icon,
  ariaLabel,
  align = "left",
}: DropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-8 items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-800/60 px-2.5 text-xs font-medium text-slate-200 transition-colors duration-200 ease-spring hover:bg-slate-700/60",
          open && "border-slate-600 bg-slate-700/60"
        )}
      >
        {Icon && <Icon className="size-3.5 text-slate-400" />}
        <span className="max-w-28 truncate">{current?.label ?? ""}</span>
        <ChevronDown
          className={cn("size-3.5 text-slate-500 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div
          className={cn(
            "glass animate-pop absolute z-40 mt-1.5 min-w-40 rounded-xl border border-slate-700/60 p-1 shadow-2xl shadow-black/50",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {options.map((o) => (
            <button
              key={o.value}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors",
                o.value === value
                  ? "bg-sky-500/15 text-sky-200"
                  : "text-slate-300 hover:bg-slate-800/70"
              )}
            >
              {o.icon && <o.icon className="size-3.5 shrink-0" />}
              <span className="flex-1 truncate">{o.label}</span>
              {o.value === value && <Check className="size-3.5 shrink-0 text-sky-300" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
