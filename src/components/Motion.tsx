import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'motion/react';

export function Expand({ open, children }: { open: boolean; children: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          className="motion-expand"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.24, ease: [0.2, 0, 0, 1] }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Overlay({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className: string;
  onClick?: () => void;
}) {
  const reduced = useReducedMotion();
  const present = useIsPresent();
  return createPortal(
    <motion.div
      className={className}
      data-motion-overlay
      data-exiting={!present || undefined}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0 : 0.22 }}
      onClick={present ? onClick : undefined}
    >
      {children}
    </motion.div>,
    document.body,
  );
}

export function Panel({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className: string;
  label: string;
}) {
  const reduced = useReducedMotion();
  const [desktop] = useState(() => window.matchMedia('(min-width: 960px)').matches);
  const sheet = className.split(' ').includes('sheet');
  const offset = reduced
    ? { x: 0, y: 0 }
    : sheet
      ? desktop
        ? { x: '100%', y: 0 }
        : { x: 0, y: '100%' }
      : { x: 0, y: 18 };
  return (
    <motion.div
      className={className}
      data-motion-panel
      role="dialog"
      aria-modal="true"
      aria-label={label}
      initial={offset}
      animate={{ x: 0, y: 0 }}
      exit={offset}
      transition={{ duration: reduced ? 0 : 0.3, ease: [0.2, 0.8, 0.2, 1] }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </motion.div>
  );
}

/** One persistent surface moves between targets; no outgoing/incoming crossfade. */
export function SelectionIndicator({ selector }: { selector: string }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const [rect, setRect] = useState<{ x: number; y: number; width: number; height: number } | null>(
    null,
  );
  useLayoutEffect(() => {
    const group = anchor.current?.parentElement;
    if (!group) return;
    const measure = () => {
      const active = group.querySelector<HTMLElement>(selector);
      if (!active || !group.getClientRects().length) {
        setRect(null);
        return;
      }
      const parent = group.getBoundingClientRect(),
        box = active.getBoundingClientRect();
      const next = {
        x: box.left - parent.left + group.scrollLeft,
        y: box.top - parent.top + group.scrollTop,
        width: box.width,
        height: box.height,
      };
      setRect((previous) =>
        previous &&
        Object.keys(next).every(
          (key) =>
            Math.abs(previous[key as keyof typeof next] - next[key as keyof typeof next]) < 0.5,
        )
          ? previous
          : next,
      );
    };
    const observer = new MutationObserver(measure);
    observer.observe(group, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'aria-pressed', 'aria-current'],
    });
    const resize = new ResizeObserver(measure);
    resize.observe(group);
    group.querySelectorAll('button').forEach((el) => resize.observe(el));
    window.addEventListener('resize', measure);
    measure();
    return () => {
      observer.disconnect();
      resize.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [selector]);
  return (
    <>
      <span ref={anchor} hidden />
      {rect && (
        <span
          aria-hidden="true"
          className="selection-indicator"
          style={{
            width: rect.width,
            height: rect.height,
            transform: `translate(${rect.x}px, ${rect.y}px)`,
          }}
        />
      )}
    </>
  );
}
