import { useLayoutEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useMotionPreference } from '../utils/useMotionPreference';
import type { Task } from '../types';
import { TaskRow } from './TaskRow';

/** Position ownership stays on a stable wrapper, separate from swipe and check motion. */
export function TaskList({
  tasks,
  onOpen,
  showSlot = false,
}: {
  tasks: Task[];
  onOpen: (id: string) => void;
  showSlot?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const previous = useRef(new Map<string, number>());
  const animations = useRef(new Map<string, Animation>());
  const reduced = useMotionPreference();
  useLayoutEffect(() => {
    const nodes = root.current?.querySelectorAll<HTMLElement>('[data-task-position]');
    const positions = new Map<string, number>();
    nodes?.forEach((node) => {
      const id = node.dataset.taskPosition!;
      const top = node.offsetTop;
      positions.set(id, top);
      const old = previous.current.get(id);
      if (reduced) {
        animations.current.get(id)?.cancel();
        return;
      }
      if (old === undefined || old === top) return;
      const current = new DOMMatrixReadOnly(getComputedStyle(node).transform).m42;
      animations.current.get(id)?.cancel();
      const animation = node.animate(
        [{ transform: `translateY(${old - top + current}px)` }, { transform: 'translateY(0)' }],
        { duration: 420, delay: 70, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' },
      );
      animations.current.set(id, animation);
      animation.onfinish = () => {
        animation.cancel();
        if (animations.current.get(id) === animation) animations.current.delete(id);
      };
    });
    for (const [id, animation] of animations.current)
      if (!positions.has(id)) {
        animation.cancel();
        animations.current.delete(id);
      }
    previous.current = positions;
  }, [tasks, reduced]);
  useLayoutEffect(
    () => () => {
      animations.current.forEach((animation) => animation.cancel());
    },
    [],
  );
  return (
    <div className="task-list moving-task-list" ref={root}>
      <AnimatePresence initial={false}>
        {tasks.map((task) => (
          <motion.div
            key={task.id}
            className="task-position"
            data-task-position={task.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: reduced ? 0 : 0.2 }}
          >
            <TaskRow task={task} showSlot={showSlot} onOpen={() => onOpen(task.id)} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
