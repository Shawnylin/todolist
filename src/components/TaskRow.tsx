import { useRef, useState } from 'react';
import { Check, CheckSquare, Clock, Flag, Repeat, Trash2 } from 'lucide-react';
import type { Task } from '../types';
import { useApp } from '../store';
import { formatDueShort, isOverdue, repeatLabel } from '../utils/date';
import { SLOT_LABEL } from '../utils/slot';
import { useToast } from './Toast';

const PRIORITY_COLOR: Record<number, string> = { 1: '#E5484D', 2: '#F76B15', 3: '#2F6FEB' };

export function TaskRow({
  task,
  showSlot = false,
  onOpen,
}: {
  task: Task;
  showSlot?: boolean;
  onOpen: () => void;
}) {
  const { dispatch } = useApp();
  const { push } = useToast();
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const dragging = useRef(false);
  const dxRef = useRef(0);
  const justSwiped = useRef(false);

  const overdue = isOverdue(task);
  const doneSubs = task.subtasks.filter((s) => s.done).length;

  const toggle = () => dispatch({ type: 'toggleTask', id: task.id });

  const onDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch({ type: 'deleteTask', id: task.id });
    push(`已删除「${task.title}」`, { label: '撤销', fn: () => dispatch({ type: 'undoDelete' }) });
    setDx(0);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, input, textarea, a')) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    dragging.current = false;
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = start.current;
    if (!s || e.pointerId !== s.id) return;
    const dxNow = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (!dragging.current) {
      if (Math.abs(dxNow) < 6 && Math.abs(dy) < 6) return;
      if (Math.abs(dy) > Math.abs(dxNow)) return; // 让位给纵向滚动
      dragging.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    dxRef.current = Math.max(-92, Math.min(92, dxNow));
    setDx(dxRef.current);
  };
  const onPointerEnd = () => {
    if (!dragging.current) return;
    dragging.current = false;
    start.current = null;
    justSwiped.current = true; // 阻止紧随其后的 click 打开详情
    const v = dxRef.current;
    dxRef.current = 0;
    if (v > 64) {
      setDx(0);
      toggle();
    } else {
      setDx(v < -44 ? -92 : 0);
    }
  };

  const onClickRow = () => {
    if (justSwiped.current) {
      justSwiped.current = false;
      return;
    }
    onOpen();
  };

  return (
    <div className="task-row-wrap">
      <button type="button" className="task-swipe-del" onClick={onDelete} aria-label="删除任务">
        <Trash2 size={15} />
        删除
      </button>
      <div
        className={`task-row ${task.done ? 'done' : ''}`}
        style={{ transform: `translateX(${dx}px)` }}
        role="button"
        tabIndex={0}
        aria-label={`${task.title}${task.done ? '(已完成)' : ''}`}
        onClick={onClickRow}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpen();
          }
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        <button
          type="button"
          className={`check ${task.done ? 'checked' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            toggle();
          }}
          aria-label={task.done ? '标记为未完成' : '标记为完成'}
        >
          {task.done && <Check size={15} strokeWidth={3} />}
        </button>

        <div className="task-main">
          <div className="task-title">{task.title}</div>
          {(task.due ||
            task.dueTime ||
            task.tags.length > 0 ||
            task.subtasks.length > 0 ||
            task.repeat ||
            (showSlot && task.slot)) && (
            <div className="task-meta">
              {showSlot && task.slot && (
                <span className="meta-chip slot">
                  <Clock size={12} />
                  {SLOT_LABEL[task.slot]}
                </span>
              )}
              {task.due && (
                <span className={`meta-chip due ${overdue ? 'overdue' : ''}`}>
                  <CalendarIcon />
                  {formatDueShort(task.due)}
                  {task.dueTime ? ` ${task.dueTime}` : ''}
                </span>
              )}
              {!task.due && task.dueTime && (
                <span className="meta-chip due">
                  <Clock size={12} />
                  {task.dueTime}
                </span>
              )}
              {task.repeat && (
                <span className="meta-chip">
                  <Repeat size={12} />
                  {repeatLabel(task.repeat)}
                </span>
              )}
              {task.subtasks.length > 0 && (
                <span className={`meta-chip ${doneSubs === task.subtasks.length ? 'subs-done' : ''}`}>
                  <CheckSquare size={12} />
                  {doneSubs}/{task.subtasks.length} 子任务
                </span>
              )}
              {task.tags.slice(0, 3).map((t) => (
                <span className="meta-chip tag" key={t}>
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>

        {task.priority > 0 && (
          <span className="task-priority" style={{ color: PRIORITY_COLOR[task.priority] }}>
            <Flag size={15} fill="currentColor" />
          </span>
        )}
      </div>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
