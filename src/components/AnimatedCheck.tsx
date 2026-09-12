import { useLayoutEffect, useRef } from 'react';
import { useMotionPreference } from '../utils/useMotionPreference';

function useCheckMotion<T extends Element>(
  checked: boolean,
  property: 'strokeDashoffset' | 'backgroundSize',
  off: string,
  on: string,
) {
  const ref = useRef<T>(null);
  const previous = useRef(checked);
  const animation = useRef<Animation>();
  const reduced = useMotionPreference();
  useLayoutEffect(() => {
    const node = ref.current;
    if (reduced) animation.current?.cancel();
    if (!node || previous.current === checked) return;
    const from =
      animation.current?.playState === 'running'
        ? getComputedStyle(node)[property]
        : previous.current
          ? on
          : off;
    animation.current?.cancel();
    previous.current = checked;
    if (reduced) return;
    animation.current = node.animate([{ [property]: from }, { [property]: checked ? on : off }], {
      duration: 300,
      easing: 'cubic-bezier(.2,0,0,1)',
    });
  }, [checked, reduced, property, off, on]);
  useLayoutEffect(() => () => animation.current?.cancel(), []);
  return ref;
}

export function AnimatedCheck({ checked }: { checked: boolean }) {
  const ref = useCheckMotion<SVGPathElement>(checked, 'strokeDashoffset', '1', '0');
  return (
    <svg className="animated-check" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        ref={ref}
        className="tick-path"
        d="M5 12.5 10 17 19 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength="1"
        strokeDasharray="1"
        strokeDashoffset={checked ? 0 : 1}
      />
    </svg>
  );
}

export function AnimatedTaskTitle({ checked, title }: { checked: boolean; title: string }) {
  const ref = useCheckMotion<HTMLSpanElement>(checked, 'backgroundSize', '0% 1.5px', '100% 1.5px');
  return (
    <span ref={ref} className="task-title-text">
      {title}
    </span>
  );
}
