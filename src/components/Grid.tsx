import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ImageItem } from "@/lib/types";
import { useElementSize } from "@/hooks/useElementSize";
import { Thumb } from "./Thumb";

interface GridProps {
  items: ImageItem[];
  onOpen: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}

const GAP = 14;
const MIN_CELL = 168;
const OVERSCAN_ROWS = 3;

/**
 * Windowed square grid. Only the rows intersecting the viewport (plus a small
 * overscan) are mounted, so a 10,000-image folder scrolls at 60fps.
 */
export function Grid({ items, onOpen, onToggleFavorite }: GridProps) {
  const { ref: outerRef, size } = useElementSize<HTMLDivElement>();
  const [scrollTop, setScrollTop] = useState(0);
  const rafRef = useRef(0);

  const width = size.width;
  const height = size.height;

  const cols = Math.max(1, Math.floor((width + GAP) / (MIN_CELL + GAP)));
  const cell = cols > 0 ? (width - GAP * (cols - 1)) / cols : MIN_CELL;
  const rowHeight = cell + GAP;
  const rowCount = Math.ceil(items.length / cols);
  const totalHeight = Math.max(0, rowCount * rowHeight - GAP);

  const firstRow = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN_ROWS);
  const visibleRows = Math.ceil(height / rowHeight) + OVERSCAN_ROWS * 2;
  const lastRow = Math.min(rowCount, firstRow + visibleRows);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const onScroll = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => setScrollTop(el.scrollTop));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafRef.current);
    };
  }, [outerRef]);

  const cells: ReactNode[] = [];
  if (width > 0) {
    for (let row = firstRow; row < lastRow; row++) {
      for (let col = 0; col < cols; col++) {
        const index = row * cols + col;
        if (index >= items.length) break;
        const item = items[index];
        cells.push(
          <div
            key={item.id}
            style={{
              position: "absolute",
              transform: `translate(${col * (cell + GAP)}px, ${row * rowHeight}px)`,
            }}
          >
            <Thumb
              item={item}
              size={cell}
              onOpen={onOpen}
              onToggleFavorite={onToggleFavorite}
            />
          </div>
        );
      }
    }
  }

  return (
    <div ref={outerRef} className="h-full w-full overflow-y-auto overflow-x-hidden px-5 pb-24 pt-4">
      <div style={{ position: "relative", height: totalHeight, width: "100%" }}>
        {cells}
      </div>
    </div>
  );
}
