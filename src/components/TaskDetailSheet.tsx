import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Flag,
  Loader2,
  Plus,
  Repeat,
  Sparkles,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import type { Priority, Repeat as RepeatType, Task, TimeSlot } from '../types';
import { aiBreakdown, hasAiKey } from '../ai';
import { useApp } from '../store';
import { formatDue, pad2, parseISODate, repeatLabel, todayISO, toISODate, uid } from '../utils/date';
import { SLOT_LABEL, SLOT_ORDER } from '../utils/slot';
import { useToast } from './Toast';
import { ListIcon } from './icons';

const PRIORITY_COLOR: Record<number, string> = { 1: '#E5484D', 2: '#F76B15', 3: '#2F6FEB' };

export function TaskDetailSheet({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const { state, dispatch } = useApp();
  const { push } = useToast();
  const task = state.tasks.find((t) => t.id === taskId);

  const [calOpen, setCalOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [slotOpen, setSlotOpen] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const el = titleRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [task?.title]);

  if (!task) return null;

  const patch = (p: Partial<Task>) => dispatch({ type: 'updateTask', id: task.id, patch: p });
  const list = state.lists.find((l) => l.id === task.listId);
  const doneSubs = task.subtasks.filter((s) => s.done).length;

  const toggleDone = () => {
    dispatch({ type: 'toggleTask', id: task.id });
    if (!task.done && task.repeat) {
      push(`已完成,已生成下一次任务:${repeatLabel(task.repeat)}`);
    }
  };

  const deleteTask = () => {
    dispatch({ type: 'deleteTask', id: task.id });
    push(`已删除「${task.title}」`, {
      label: '撤销',
      fn: () => dispatch({ type: 'undoDelete' }),
    });
    onClose();
  };

  const onAiBreakdown = async () => {
    if (!hasAiKey(state.settings)) {
      push('请先在「设置 → AI 助手」填写 DeepSeek API Key');
      return;
    }
    setAiBusy(true);
    try {
      const subs = await aiBreakdown(state.settings, task);
      const existing = task.subtasks.filter((s) => !s.done);
      const fresh = subs.map((t) => ({ id: uid(), title: t, done: false }));
      patch({ subtasks: [...existing, ...fresh] });
      push(`AI 已添加 ${subs.length} 个子任务`);
    } catch (e) {
      push(e instanceof Error ? e.message : 'AI 拆解失败');
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div
        className="sheet task-detail"
        role="dialog"
        aria-modal="true"
        aria-label="任务详情"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" />
        <div className="sheet-header">
          <button
            type="button"
            className={`detail-check ${task.done ? 'checked' : ''}`}
            style={task.done ? { background: list?.color ?? 'var(--accent)' } : undefined}
            onClick={toggleDone}
            aria-label={task.done ? '标记为未完成' : '标记为完成'}
          >
            {task.done && <Check size={17} strokeWidth={3} />}
          </button>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </div>

        <div className="sheet-scroll">
          <textarea
            ref={titleRef}
            className={`detail-title ${task.done ? 'strike' : ''}`}
            value={task.title}
            rows={1}
            placeholder="任务标题"
            onChange={(e) => patch({ title: e.target.value })}
          />

          {/* 元信息 */}
          <div className="detail-meta">
            <button
              type="button"
              className={`meta-row ${calOpen ? 'open' : ''}`}
              onClick={() => {
                setCalOpen((v) => !v);
                setListOpen(false);
                setRepeatOpen(false);
                setSlotOpen(false);
              }}
            >
              <Calendar size={17} className="meta-row-icon" />
              <span className="meta-row-label">日期</span>
              <span className={`meta-row-value ${task.due && task.due < todayISO() && !task.done ? 'overdue' : ''}`}>
                {task.due ? formatDue(task.due) : '未设置'}
              </span>
              <ChevronDown size={15} className="meta-row-chev" />
            </button>
            {calOpen && (
              <CalendarPanel
                value={task.due}
                onSelect={(d) => {
                  patch({ due: d });
                  if (d) setCalOpen(false);
                }}
              />
            )}

            <div className="meta-row">
              <ClockIcon />
              <span className="meta-row-label">时间</span>
              <input
                type="time"
                className="meta-time-input"
                value={task.dueTime ?? ''}
                onChange={(e) => patch({ dueTime: e.target.value || undefined })}
              />
            </div>

            <button
              type="button"
              className={`meta-row ${slotOpen ? 'open' : ''}`}
              onClick={() => {
                setSlotOpen((v) => !v);
                setCalOpen(false);
                setListOpen(false);
                setRepeatOpen(false);
              }}
            >
              <SunriseIcon />
              <span className="meta-row-label">时段</span>
              <span className="meta-row-value">
                {task.slot ? SLOT_LABEL[task.slot] : '未设置'}
              </span>
              <ChevronDown size={15} className="meta-row-chev" />
            </button>
            {slotOpen && (
              <div className="inline-panel">
                <div className="repeat-chips">
                  <button
                    type="button"
                    className={`chip chip-btn ${!task.slot ? 'active' : ''}`}
                    onClick={() => {
                      patch({ slot: undefined });
                      setSlotOpen(false);
                    }}
                  >
                    未设置
                  </button>
                  {SLOT_ORDER.map((s: TimeSlot) => (
                    <button
                      type="button"
                      key={s}
                      className={`chip chip-btn ${task.slot === s ? 'active' : ''}`}
                      onClick={() => {
                        patch({ slot: s });
                        setSlotOpen(false);
                      }}
                    >
                      {SLOT_LABEL[s]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              className={`meta-row ${listOpen ? 'open' : ''}`}
              onClick={() => {
                setListOpen((v) => !v);
                setCalOpen(false);
                setRepeatOpen(false);
                setSlotOpen(false);
              }}
            >
              <ListIcon name={list?.icon ?? 'inbox'} size={17} className="meta-row-icon" />
              <span className="meta-row-label">清单</span>
              <span className="meta-row-value" style={{ color: list?.color }}>
                {list?.name ?? '收件箱'}
              </span>
              <ChevronDown size={15} className="meta-row-chev" />
            </button>
            {listOpen && (
              <div className="inline-panel">
                {state.lists.map((l) => (
                  <button
                    type="button"
                    key={l.id}
                    className={`popover-item ${l.id === task.listId ? 'active' : ''}`}
                    onClick={() => {
                      patch({ listId: l.id });
                      setListOpen(false);
                    }}
                  >
                    <ListIcon name={l.icon} size={16} className="popover-item-icon" />
                    <span className="popover-item-label">{l.name}</span>
                    {l.id === task.listId && <Check size={15} className="popover-item-check" />}
                  </button>
                ))}
              </div>
            )}

            <div className="meta-row priority-row">
              <Flag size={17} className="meta-row-icon" />
              <span className="meta-row-label">优先级</span>
              <div className="priority-picker">
                {([1, 2, 3] as Priority[]).map((p) => (
                  <button
                    type="button"
                    key={p}
                    className={`priority-btn ${task.priority === p ? 'active' : ''}`}
                    style={{ color: PRIORITY_COLOR[p] }}
                    onClick={() => patch({ priority: task.priority === p ? 0 : p })}
                    aria-label={`优先级 P${p}`}
                  >
                    <Flag size={15} fill={task.priority === p ? 'currentColor' : 'none'} />
                  </button>
                ))}
                <button
                  type="button"
                  className={`priority-btn none ${task.priority === 0 ? 'active' : ''}`}
                  onClick={() => patch({ priority: 0 })}
                  aria-label="无优先级"
                >
                  无
                </button>
              </div>
            </div>

            <button
              type="button"
              className={`meta-row ${repeatOpen ? 'open' : ''}`}
              onClick={() => {
                setRepeatOpen((v) => !v);
                setCalOpen(false);
                setListOpen(false);
                setSlotOpen(false);
              }}
            >
              <Repeat size={17} className="meta-row-icon" />
              <span className="meta-row-label">重复</span>
              <span className="meta-row-value">{task.repeat ? repeatLabel(task.repeat) : '不重复'}</span>
              <ChevronDown size={15} className="meta-row-chev" />
            </button>
            {repeatOpen && (
              <RepeatPanel
                value={task.repeat}
                onChange={(r) => {
                  patch({ repeat: r });
                  if (!task.due && r) patch({ due: todayISO() });
                }}
              />
            )}
          </div>

          {/* 子任务 */}
          <div className="detail-section">
            <div className="detail-section-head">
              <span>子任务</span>
              {task.subtasks.length > 0 && (
                <span className="subtask-progress">
                  {doneSubs}/{task.subtasks.length}
                </span>
              )}
            </div>
            {task.subtasks.length > 0 && (
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${(doneSubs / task.subtasks.length) * 100}%` }}
                />
              </div>
            )}
            {task.subtasks.map((s) => (
              <div className="subtask-row" key={s.id}>
                <button
                  type="button"
                  className={`mini-check ${s.done ? 'checked' : ''}`}
                  onClick={() =>
                    dispatch({ type: 'toggleSubtask', id: task.id, subId: s.id })
                  }
                  aria-label={s.done ? '标记子任务未完成' : '标记子任务完成'}
                >
                  {s.done && <Check size={12} strokeWidth={3} />}
                </button>
                <span className={`subtask-title ${s.done ? 'done' : ''}`}>{s.title}</span>
                <button
                  type="button"
                  className="icon-btn subtle"
                  aria-label="删除子任务"
                  onClick={() =>
                    patch({ subtasks: task.subtasks.filter((x) => x.id !== s.id) })
                  }
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            <SubtaskInput
              onAdd={(title) =>
                patch({ subtasks: [...task.subtasks, { id: uid(), title, done: false }] })
              }
            />
          </div>

          {/* 标签 */}
          <div className="detail-section">
            <div className="detail-section-head">
              <span>
                <Tag size={14} className="inline-icon" /> 标签
              </span>
            </div>
            {task.tags.length > 0 && (
              <div className="tag-row">
                {task.tags.map((t) => (
                  <span className="chip tag-chip" key={t}>
                    #{t}
                    <button
                      type="button"
                      aria-label={`删除标签 ${t}`}
                      onClick={() => patch({ tags: task.tags.filter((x) => x !== t) })}
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <TagInput onAdd={(t) => patch({ tags: [...task.tags, t] })} />
          </div>

          {/* 备注 */}
          <div className="detail-section">
            <div className="detail-section-head">
              <span>备注</span>
            </div>
            <textarea
              className="notes-input"
              placeholder="补充细节、链接、想法…"
              value={task.notes}
              rows={3}
              onChange={(e) => patch({ notes: e.target.value })}
            />
          </div>

          {/* AI 助手 */}
          <div className="ai-card">
            <div className="ai-card-head">
              <Sparkles size={17} />
              <span>AI 助手</span>
            </div>
            <p className="ai-card-text">让 DeepSeek 把这个任务拆解成可执行的小步骤,帮你理清思路。</p>
            <button
              type="button"
              className="btn btn-ai"
              disabled={aiBusy}
              onClick={onAiBreakdown}
            >
              {aiBusy ? (
                <>
                  <Loader2 size={15} className="spin" /> 拆解中…
                </>
              ) : (
                <>
                  <Sparkles size={15} /> 拆解为子任务
                </>
              )}
            </button>
          </div>

          <div className="detail-footer">
            <span className="created-at">
              创建于 {new Date(task.createdAt).toLocaleDateString('zh-CN')}
            </span>
            <button type="button" className="btn btn-ghost danger-text" onClick={deleteTask}>
              <Trash2 size={15} /> 删除任务
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- 日历面板 ----------
function CalendarPanel({
  value,
  onSelect,
}: {
  value?: string;
  onSelect: (d?: string) => void;
}) {
  const [ym, setYm] = useState(() => {
    const d = value ? parseISODate(value) : new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const today = todayISO();

  const cells = useMemo(() => {
    const first = new Date(ym.y, ym.m, 1);
    const offset = first.getDay();
    const days = new Date(ym.y, ym.m + 1, 0).getDate();
    const arr: Array<string | null> = [];
    for (let i = 0; i < offset; i++) arr.push(null);
    for (let d = 1; d <= days; d++) arr.push(`${ym.y}-${pad2(ym.m + 1)}-${pad2(d)}`);
    return arr;
  }, [ym]);

  const nextMonday = () => {
    const d = new Date();
    let delta = (1 - d.getDay() + 7) % 7;
    if (delta === 0) delta = 7;
    const r = new Date(d);
    r.setDate(r.getDate() + delta);
    return toISODate(r);
  };
  const tomorrow = () => {
    const r = new Date();
    r.setDate(r.getDate() + 1);
    return toISODate(r);
  };

  return (
    <div className="inline-panel cal-panel">
      <div className="cal-head">
        <button
          type="button"
          className="icon-btn"
          aria-label="上个月"
          onClick={() => setYm(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }))}
        >
          <ChevronLeft size={16} />
        </button>
        <span className="cal-title">
          {ym.y}年{ym.m + 1}月
        </span>
        <button
          type="button"
          className="icon-btn"
          aria-label="下个月"
          onClick={() => setYm(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }))}
        >
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="cal-grid">
        {['日', '一', '二', '三', '四', '五', '六'].map((w) => (
          <span className="cal-week" key={w}>
            {w}
          </span>
        ))}
        {cells.map((d, i) =>
          d ? (
            <button
              type="button"
              key={i}
              className={`cal-cell ${d === value ? 'selected' : ''} ${d === today ? 'today' : ''}`}
              onClick={() => onSelect(d)}
            >
              {Number(d.slice(-2))}
            </button>
          ) : (
            <span key={i} />
          ),
        )}
      </div>
      <div className="cal-quick">
        <button type="button" className="cal-quick-btn" onClick={() => onSelect(today)}>
          今天
        </button>
        <button type="button" className="cal-quick-btn" onClick={() => onSelect(tomorrow())}>
          明天
        </button>
        <button type="button" className="cal-quick-btn" onClick={() => onSelect(nextMonday())}>
          下周一
        </button>
        {value && (
          <button type="button" className="cal-quick-btn clear" onClick={() => onSelect(undefined)}>
            清除日期
          </button>
        )}
      </div>
    </div>
  );
}

// ---------- 重复面板 ----------
function RepeatPanel({
  value,
  onChange,
}: {
  value?: RepeatType;
  onChange: (r?: RepeatType) => void;
}) {
  const presets: Array<{ label: string; r?: RepeatType }> = [
    { label: '不重复', r: undefined },
    { label: '每天', r: { freq: 'day', interval: 1 } },
    { label: '工作日', r: { freq: 'weekday', interval: 1 } },
    { label: '每周', r: { freq: 'week', interval: 1 } },
    { label: '每月', r: { freq: 'month', interval: 1 } },
    { label: '每年', r: { freq: 'year', interval: 1 } },
  ];
  const unitLabel: Record<RepeatType['freq'], string> = {
    day: '天',
    week: '周',
    month: '月',
    year: '年',
    weekday: '工作日',
  };
  const activeKey = !value
    ? ''
    : value.freq === 'day' && value.interval === 1
      ? '每天'
      : value.freq === 'weekday'
        ? '工作日'
        : value.freq === 'week' && value.interval === 1
          ? '每周'
          : value.freq === 'month' && value.interval === 1
            ? '每月'
            : value.freq === 'year' && value.interval === 1
              ? '每年'
              : 'custom';

  return (
    <div className="inline-panel">
      <div className="repeat-chips">
        {presets.map((p) => (
          <button
            type="button"
            key={p.label}
            className={`chip chip-btn ${activeKey === p.label ? 'active' : ''}`}
            onClick={() => onChange(p.r)}
          >
            {p.label}
          </button>
        ))}
      </div>
      {value && value.freq !== 'weekday' && (
        <div className="repeat-custom">
          <span>每</span>
          <input
            type="number"
            min={1}
            max={99}
            value={value.interval}
            onChange={(e) => {
              const n = Math.max(1, Math.min(99, Number(e.target.value) || 1));
              onChange({ ...value, interval: n });
            }}
          />
          <span>{unitLabel[value.freq]}</span>
        </div>
      )}
    </div>
  );
}

// ---------- 子任务 / 标签输入 ----------
function SubtaskInput({ onAdd }: { onAdd: (title: string) => void }) {
  const [v, setV] = useState('');
  return (
    <div className="subtask-add">
      <Plus size={15} />
      <input
        type="text"
        placeholder="添加子任务,回车确认"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing && v.trim()) {
            onAdd(v.trim());
            setV('');
          }
        }}
      />
    </div>
  );
}

function TagInput({ onAdd }: { onAdd: (tag: string) => void }) {
  const [v, setV] = useState('');
  return (
    <div className="subtask-add">
      <Tag size={14} />
      <input
        type="text"
        placeholder="添加标签,回车确认"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing && v.trim()) {
            onAdd(v.trim());
            setV('');
          }
        }}
      />
    </div>
  );
}

function ClockIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="meta-row-icon"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function SunriseIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="meta-row-icon"
    >
      <path d="M12 2v8" />
      <path d="m4.93 10.93 1.41 1.41" />
      <path d="M2 18h2" />
      <path d="M20 18h2" />
      <path d="m19.07 10.93-1.41 1.41" />
      <path d="M22 22H2" />
      <path d="m8 6 4-4 4 4" />
      <path d="M16 18a4 4 0 0 0-8 0" />
    </svg>
  );
}
