import { AnimatePresence } from 'motion/react';
import { Overlay, Panel, SelectionIndicator } from './Motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Moon,
  Plus,
  RotateCcw,
  Search,
  Sunrise,
  Sun,
  X,
} from 'lucide-react';
import type { Task, TimeSlot } from '../types';
import { INBOX_ID } from '../types';
import { buildTask, sortTasks, useApp } from '../store';
import { parseInput } from '../utils/parse';
import { addDaysISO, formatDue, parseISODate, todayISO, toISODate } from '../utils/date';
import { SLOT_LABEL, SLOT_ORDER, slotOf } from '../utils/slot';
import { useToast } from './Toast';
import { TaskList } from './TaskList';

const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

const SLOT_ICONS: Record<TimeSlot, React.ReactNode> = {
  morning: <Sunrise size={15} />,
  afternoon: <Sun size={15} />,
  evening: <Moon size={15} />,
};

interface Props {
  openDetail: (id: string) => void;
  openSearch: () => void;
}

function sundayOf(d: Date): Date {
  const r = new Date(d);
  r.setDate(r.getDate() - r.getDay());
  return r;
}

export function TodayView({ openDetail, openSearch }: Props) {
  const { state } = useApp();
  const today = todayISO();
  const [selected, setSelected] = useState(today);
  const [weekStart, setWeekStart] = useState<Date>(() => sundayOf(new Date()));
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all');

  // 周历条滑动换周
  const swipeStart = useRef<{ x: number; y: number; id: number } | null>(null);
  const swiping = useRef(false);
  const justSwiped = useRef(false);

  const days = useMemo(() => {
    const out: { iso: string; wd: string; num: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = addDaysISO(toISODate(weekStart), i);
      out.push({
        iso: d,
        wd: WEEK_LABELS[parseISODate(d).getDay()],
        num: Number(d.slice(-2)),
      });
    }
    return out;
  }, [weekStart]);

  const isTodaySel = selected === today;

  const goWeek = (dir: number) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + dir * 7);
    setWeekStart(d);
    setSelected((date) => addDaysISO(date, dir * 7));
  };

  const backToToday = () => {
    setSelected(today);
    setWeekStart(sundayOf(new Date()));
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.week-nav')) return;
    swipeStart.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    swiping.current = false;
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = swipeStart.current;
    if (!s || e.pointerId !== s.id) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (!swiping.current) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dy) > Math.abs(dx)) return;
      swiping.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    if (swiping.current) e.preventDefault();
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = swipeStart.current;
    if (!s || !swiping.current) return;
    swiping.current = false;
    swipeStart.current = null;
    const dx = e.clientX - s.x;
    if (Math.abs(dx) > 48) {
      justSwiped.current = true;
      goWeek(dx < 0 ? 1 : -1);
    }
  };

  // 某天要展示的任务:未完成(当天到期/今天含逾期/今天含未设日期的任务) + 当天完成的
  const tasksOf = (iso: string): Task[] => {
    const isTodayIso = iso === today;
    return state.tasks.filter((t) => {
      if (!t.done) {
        if (t.due === iso) return true;
        if (isTodayIso && t.due && t.due < iso) return true; // 逾期归到今天
        if (isTodayIso && !t.due) return true; // 未设日期的任务默认归入今天的「未安排」
        return false;
      }
      return !!t.completedAt && toISODate(new Date(t.completedAt)) === iso;
    });
  };

  const allTasks = tasksOf(selected);
  const bySlot = useMemo(() => {
    const m: Record<string, Task[]> = { morning: [], afternoon: [], evening: [], none: [] };
    for (const t of allTasks) {
      const s = slotOf(t);
      (s ? m[s] : m.none).push(t);
    }
    for (const k of Object.keys(m)) {
      m[k] = [
        ...sortTasks(m[k].filter((t) => !t.done)),
        ...m[k].filter((t) => t.done).sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)),
      ];
    }
    return m;
  }, [allTasks]);

  const visibleTasks = (tasks: Task[]) =>
    tasks.filter((t) => filter === 'all' || (filter === 'done' ? t.done : !t.done));
  const title = isTodaySel ? '今天' : formatDue(selected, today);

  return (
    <div className="task-view">
      <header className="view-header today-header">
        <div className="view-header-text">
          <h1 className="view-title">{title}</h1>
        </div>
        <div className="view-header-actions">
          <button
            type="button"
            className="icon-btn"
            title="搜索"
            aria-label="搜索"
            onClick={openSearch}
          >
            <Search size={17} />
          </button>
          {!isTodaySel && (
            <button type="button" className="btn btn-secondary sm back-today" onClick={backToToday}>
              <RotateCcw size={13} />
              回到今天
            </button>
          )}
        </div>
      </header>

      <div className="calendar-heading">
        <h2>一周安排</h2>
        <span>
          {days[0].iso.slice(5).replace('-', '/')} — {days[6].iso.slice(5).replace('-', '/')}
        </span>
      </div>

      {/* 周历条:周日-周六,可点击选日期,左右滑动换周 */}
      <div
        className="week-strip"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          swipeStart.current = null;
          swiping.current = false;
          justSwiped.current = false;
        }}
      >
        <button type="button" className="week-nav" onClick={() => goWeek(-1)} aria-label="上一周">
          <ChevronLeft size={16} />
        </button>
        <div
          className="week-days"
          onClick={() => justSwiped.current && (justSwiped.current = false)}
        >
          <SelectionIndicator selector=".week-day.sel" />
          {days.map((d) => (
            <button
              type="button"
              key={d.iso}
              aria-label={d.iso}
              aria-pressed={selected === d.iso}
              className={`week-day ${selected === d.iso ? 'sel' : ''} ${d.iso === today ? 'today' : ''}`}
              onClick={() => {
                if (justSwiped.current) {
                  justSwiped.current = false;
                  return;
                }
                setSelected(d.iso);
              }}
            >
              <span className="week-wd">{d.wd}</span>
              <span className="week-num">{d.num}</span>
              {d.iso === today && !(selected === d.iso) && <span className="week-dot" />}
            </button>
          ))}
        </div>
        <button type="button" className="week-nav" onClick={() => goWeek(1)} aria-label="下一周">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="view-body">
        <div className="day-toolbar">
          <h2>
            我的日程 <span>{allTasks.length}</span>
          </h2>
          <div className="day-filters" aria-label="任务状态筛选">
            <SelectionIndicator selector="button.active" />
            {(
              [
                { key: 'all', label: '全部' },
                { key: 'pending', label: '待办' },
                { key: 'done', label: '已完成' },
              ] as const
            ).map((item) => (
              <button
                type="button"
                key={item.key}
                aria-pressed={filter === item.key}
                className={filter === item.key ? 'active' : ''}
                onClick={() => setFilter(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        {SLOT_ORDER.map((slot) => (
          <SlotSection
            key={slot}
            slot={slot}
            tasks={visibleTasks(bySlot[slot])}
            selectedDate={selected}
            onOpen={openDetail}
          />
        ))}

        {visibleTasks(bySlot.none).length > 0 && (
          <div className="section">
            <div className="section-header">
              <span className="section-label">未安排</span>
              <span className="section-count">{bySlot.none.length}</span>
            </div>
            <TaskList tasks={visibleTasks(bySlot.none)} onOpen={openDetail} />
          </div>
        )}
      </div>
    </div>
  );
}

function SlotSection({
  slot,
  tasks,
  selectedDate,
  onOpen,
}: {
  slot: TimeSlot;
  tasks: Task[];
  selectedDate: string;
  onOpen: (id: string) => void;
}) {
  const { state, dispatch } = useApp();
  const { push } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [value, setValue] = useState('');
  const pending = tasks.filter((t) => !t.done).length;
  useEffect(() => {
    if (!addOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAddOpen(false);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [addOpen]);

  const add = () => {
    const text = value.trim();
    if (!text) return;
    const parsed = parseInput(text);
    const task = buildTask(
      text,
      { ...parsed, due: parsed.due ?? selectedDate },
      state.lists,
      INBOX_ID,
      slot,
    );
    dispatch({ type: 'addTask', task });
    push(`已添加：${formatDue(task.due!)} · ${SLOT_LABEL[slot]}`);
    setValue('');
    setAddOpen(false);
  };

  return (
    <section className={`section slot-section period-${slot}`}>
      <div className="slot-head">
        <span className={`slot-icon slot-${slot}`}>{SLOT_ICONS[slot]}</span>
        <span className="slot-label">{SLOT_LABEL[slot]}</span>
        <span className="slot-time">
          {slot === 'morning'
            ? '开启新的一天'
            : slot === 'afternoon'
              ? '留一段专注时间'
              : '收获与放松'}
        </span>
        {pending > 0 && <span className="slot-count">{pending}</span>}
        <button
          type="button"
          className="slot-plus-btn"
          onClick={() => {
            setValue('');
            setAddOpen(true);
          }}
          aria-label={`添加${SLOT_LABEL[slot]}的任务`}
        >
          <Plus size={17} />
        </button>
      </div>
      {tasks.length === 0 && (
        <button type="button" className="slot-empty" onClick={() => setAddOpen(true)}>
          <Plus size={16} /> 留白也很好，或添加一件事
        </button>
      )}
      <TaskList tasks={tasks} onOpen={onOpen} />

      <AnimatePresence>
        {addOpen && (
          <Overlay className="sheet-overlay" onClick={() => setAddOpen(false)}>
            <Panel className="sheet add-sheet" label={`添加到${SLOT_LABEL[slot]}`}>
              <div className="sheet-handle" />
              <div className="sheet-header">
                <div className="sheet-title">
                  {SLOT_ICONS[slot]} 添加到{SLOT_LABEL[slot]}
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setAddOpen(false)}
                  aria-label="关闭"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="sheet-scroll">
                <div className="add-sheet-date">{formatDue(selectedDate)}</div>
                <input
                  type="text"
                  className="add-sheet-input"
                  placeholder="输入任务标题"
                  aria-label="任务标题"
                  autoFocus
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      add();
                    }
                  }}
                />
                <p className="input-hint">支持「明天 9点 开会 p1」「每天 阅读 @学习」</p>
                <button
                  type="button"
                  className="btn btn-primary btn-block"
                  disabled={!value.trim()}
                  onClick={add}
                >
                  添加任务
                </button>
              </div>
            </Panel>
          </Overlay>
        )}
      </AnimatePresence>
    </section>
  );
}
