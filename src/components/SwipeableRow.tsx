import { useRef, useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";

/**
 * Wrapper mobile-friendly: swipe verso sinistra rivela il pulsante "Elimina".
 * Su desktop resta neutro (touch events non partono col mouse).
 */
export function SwipeableRow({
  children,
  onDelete,
  className = "",
}: {
  children: ReactNode;
  onDelete: () => void;
  className?: string;
}) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const locked = useRef<null | "x" | "y">(null);
  const THRESHOLD = 80;
  const MAX = 96;

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    startX.current = t.clientX;
    startY.current = t.clientY;
    locked.current = null;
    setDragging(true);
  }
  function onTouchMove(e: React.TouchEvent) {
    if (!dragging) return;
    const t = e.touches[0];
    const dx = t.clientX - startX.current;
    const dy = t.clientY - startY.current;
    if (locked.current === null) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        locked.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      }
    }
    if (locked.current !== "x") return;
    // solo swipe verso sinistra
    const next = Math.max(-MAX, Math.min(0, dx + (offset < 0 ? offset : 0)));
    setOffset(next);
  }
  function onTouchEnd() {
    setDragging(false);
    if (offset <= -THRESHOLD) {
      setOffset(-MAX);
    } else {
      setOffset(0);
    }
  }

  function handleDelete() {
    setOffset(0);
    onDelete();
  }

  return (
    <div className={`relative overflow-hidden rounded-xl ${className}`}>
      <button
        type="button"
        onClick={handleDelete}
        aria-label="Elimina"
        className="absolute inset-y-0 right-0 flex items-center justify-center bg-destructive text-destructive-foreground px-6"
        style={{ width: 96 }}
      >
        <Trash2 className="size-5" />
      </button>
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragging ? "none" : "transform 200ms ease",
        }}
      >
        {children}
      </div>
    </div>
  );
}
