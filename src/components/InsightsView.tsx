import { useMemo, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Flame,
  Settings,
  Target,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import type { Task, TimeSlot, ViewRoute } from '../types';
import { useApp } from '../store';
import { addDaysISO, diffDaysISO, parseISODate, todayISO, toISODate } from '../utils/date';
import { SLOT_LABEL, slotOf } from '../utils/slot';
import { TaskRow } from './TaskRow';
import { Empty } from './Empty';
import { Modal } from './Modal';
import { useToast } from './Toast';

const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六'];
const PRIORITY_COLOR: Record<number, string> = { 1: '#E5484D', 2: '#F76B15', 3: '#2F6FEB' };
const SLOT_COLOR: Record<string, string> = {
  morning: '#F76B15',
  afternoon: '#2F6FEB',
  evening: '#6E56CF',
  none: '#9AA0AA',
};

interface Props {
  navigate: (r: ViewRoute) => void;
  openDetail: (id: string) => void;
}

export function InsightsView({ navigate, openDetail }: Props) {
  const { state } = useApp();
  const today = todayISO();
  const [sheetOpen, setSheetOpen] = useState(false);

  const done = useMemo(() => state.tasks.filter((t) => t.done), [state.tasks]);
  const pending = useMemo(() => state.tasks.filter((t) => !t.done), [state.tasks]);

  const todayDone = done.filter((t) => t.completedAt && toISODate(new Date(t.completedAt)) === today);

  const weekBars = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const iso = addDaysISO(today, i - 6);
      const count = done.filter(
        (t) => t.completedAt && toISODate(new Date(t.completedAt)) === iso,
      ).length;
      return { iso, label: WEEK_LABELS[parseISODate(iso).getDay()], count };
    });
  }, [done, today]);

  const maxBar = Math.max(1, ...weekBars.map((b) => b.count));
  const weekDone = weekBars.reduce((s, b) => s + b.count, 0);
  const total = state.tasks.length;
  const rate = total ? Math.round((done.length / total) * 100) : 0;

  const doneDays = useMemo(
    () => new Set(done.map((t) => (t.completedAt ? toISODate(new Date(t.completedAt)) : ''))),
    [done],
  );
  const streak = useMemo(() => {
    let cursor = doneDays.has(today) ? today : addDaysISO(today, -1);
    let n = 0;
    while (doneDays.has(cursor)) {
      n++;
      cursor = addDaysISO(cursor, -1);
    }
    return n;
  }, [doneDays, today]);

  const slotDist = useMemo(() => {
    const m = new Map<string, { key: string; label: string; color: string; count: number }>();
    for (const t of pending) {
      const s: TimeSlot | undefined = slotOf(t);
      const key = s ?? 'none';
      const cur = m.get(key) ?? {
        key,
        label: s ? SLOT_LABEL[s] : '未安排',
        color: SLOT_COLOR[key],
        count: 0,
      };
      cur.count++;
      m.set(key, cur);
    }
    return [...m.values()].sort((a, b) => b.count - a.count);
  }, [pending]);

  const priorityDist = useMemo(() => {
    const d = [0, 0, 0, 0];
    for (const t of pending) d[t.priority]++;
    return d; // [无, P1, P2, P3]
  }, [pending]);
  const maxPri = Math.max(1, ...priorityDist);

  const recentDone = useMemo(
    () => [...done].sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)).slice(0, 5),
    [done],
  );

  const C = 2 * Math.PI * 38;
  let acc = 0;

  return (
    <div className="task-view insights-view">
      <header className="view-header">
        <div className="view-header-text">
          <h1 className="view-title">洞察</h1>
        </div>
        <div className="view-header-actions">
          <button
            type="button"
            className="icon-btn"
            title="设置"
            aria-label="设置"
            onClick={() => navigate({ view: 'settings' })}
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      {total === 0 ? (
        <Empty
          icon={<BarChart3 size={30} />}
          title="还没有数据"
          hint="先去「今天」页添加并完成任务,这里就会出现统计图表"
        />
      ) : (
        <div className="view-body">
          {/* 统计卡片 */}
          <div className="stat-grid">
            <div className="stat-card">
              <span className="stat-icon ok">
                <CheckCircle2 size={17} />
              </span>
              <span className="stat-num">{todayDone.length}</span>
              <span className="stat-label">今日完成</span>
            </div>
            <div className="stat-card">
              <span className="stat-icon accent">
                <TrendingUp size={17} />
              </span>
              <span className="stat-num">{weekDone}</span>
              <span className="stat-label">近 7 天完成</span>
            </div>
            <div className="stat-card">
              <span className="stat-icon target">
                <Target size={17} />
              </span>
              <span className="stat-num">{rate}%</span>
              <span className="stat-label">总完成率</span>
            </div>
            <div className="stat-card">
              <span className="stat-icon flame">
                <Flame size={17} />
              </span>
              <span className="stat-num">{streak}</span>
              <span className="stat-label">连续打卡(天)</span>
            </div>
          </div>

          {/* 近7天完成柱状图 */}
          <section className="chart-card">
            <div className="chart-card-title">近 7 天完成</div>
            <div className="bar-chart">
              {weekBars.map((b) => (
                <div className="bar-col" key={b.iso}>
                  <span className={`bar-val ${b.count === 0 ? 'zero' : ''}`}>{b.count}</span>
                  <div className="bar-track">
                    <div
                      className={`bar-fill ${b.iso === today ? 'today' : ''}`}
                      style={{ height: `${(b.count / maxBar) * 100}%` }}
                    />
                  </div>
                  <span className={`bar-label ${b.iso === today ? 'today' : ''}`}>{b.label}</span>
                </div>
              ))}
            </div>
          </section>

          <div className="chart-row">
            {/* 待办时段分布 */}
            <section className="chart-card half">
              <div className="chart-card-title">待办时段分布</div>
              {pending.length === 0 ? (
                <p className="chart-empty">暂无待办</p>
              ) : (
                <>
                  <div className="donut-wrap">
                    <svg viewBox="0 0 100 100" className="donut">
                      <circle cx="50" cy="50" r="38" fill="none" stroke="var(--surface-2)" strokeWidth="14" />
                      {slotDist.map((l) => {
                        const frac = l.count / pending.length;
                        const dash = `${frac * C} ${C}`;
                        const off = -acc * C;
                        acc += frac;
                        return (
                          <circle
                            key={l.key}
                            cx="50"
                            cy="50"
                            r="38"
                            fill="none"
                            stroke={l.color}
                            strokeWidth="14"
                            strokeDasharray={dash}
                            strokeDashoffset={off}
                            transform="rotate(-90 50 50)"
                          />
                        );
                      })}
                    </svg>
                    <div className="donut-center">
                      <span className="donut-num">{pending.length}</span>
                      <span className="donut-label">待办</span>
                    </div>
                  </div>
                  <ul className="donut-legend">
                    {slotDist.slice(0, 5).map((l) => (
                      <li key={l.key}>
                        <span className="legend-dot" style={{ background: l.color }} />
                        <span className="legend-name">{l.label}</span>
                        <span className="legend-count">{l.count}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>

            {/* 优先级分布 */}
            <section className="chart-card half">
              <div className="chart-card-title">优先级分布</div>
              {pending.length === 0 ? (
                <p className="chart-empty">暂无待办</p>
              ) : (
                <div className="pri-bars">
                  {[
                    { label: 'P1', color: PRIORITY_COLOR[1], v: priorityDist[1] },
                    { label: 'P2', color: PRIORITY_COLOR[2], v: priorityDist[2] },
                    { label: 'P3', color: PRIORITY_COLOR[3], v: priorityDist[3] },
                    { label: '无', color: 'var(--text-3)', v: priorityDist[0] },
                  ].map((p) => (
                    <div className="pri-row" key={p.label}>
                      <span className="pri-label">{p.label}</span>
                      <div className="pri-track">
                        <div
                          className="pri-fill"
                          style={{ width: `${(p.v / maxPri) * 100}%`, background: p.color }}
                        />
                      </div>
                      <span className="pri-val">{p.v}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* 最近完成 */}
          <section className="chart-card">
            <div className="chart-card-title">
              最近完成
              {done.length > 0 && (
                <button type="button" className="link right" onClick={() => setSheetOpen(true)}>
                  查看全部 <ChevronRight size={13} />
                </button>
              )}
            </div>
            {recentDone.length === 0 ? (
              <p className="chart-empty">还没有完成的任务</p>
            ) : (
              <div className="task-list">
                {recentDone.map((t) => (
                  <TaskRow key={t.id} task={t} showSlot onOpen={() => openDetail(t.id)} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {sheetOpen && <CompletedSheet onClose={() => setSheetOpen(false)} onOpen={openDetail} />}
    </div>
  );
}

// ---------- 已完成归档 ----------
function CompletedSheet({ onClose, onOpen }: { onClose: () => void; onOpen: (id: string) => void }) {
  const { state, dispatch } = useApp();
  const { push } = useToast();
  const [confirmClear, setConfirmClear] = useState(false);
  const today = todayISO();

  const groups = useMemo(() => {
    const buckets: Array<{ key: string; label: string; tasks: Task[] }> = [
      { key: 'today', label: '今天', tasks: [] },
      { key: 'yesterday', label: '昨天', tasks: [] },
      { key: 'week', label: '近 7 天', tasks: [] },
      { key: 'earlier', label: '更早', tasks: [] },
    ];
    for (const t of state.tasks) {
      if (!t.done) continue;
      const d = t.completedAt ? toISODate(new Date(t.completedAt)) : today;
      const diff = diffDaysISO(d, today);
      const key = diff === 0 ? 'today' : diff === -1 ? 'yesterday' : diff >= -6 ? 'week' : 'earlier';
      buckets.find((b) => b.key === key)!.tasks.push(t);
    }
    return buckets
      .map((b) => ({
        ...b,
        tasks: b.tasks.sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)),
      }))
      .filter((b) => b.tasks.length > 0);
  }, [state.tasks, today]);

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet completed-sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <div className="sheet-title">已完成</div>
          <div className="sheet-header-actions">
            {groups.length > 0 && (
              <button type="button" className="btn btn-ghost sm danger-text" onClick={() => setConfirmClear(true)}>
                <Trash2 size={14} /> 清空
              </button>
            )}
            <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭">
              ✕
            </button>
          </div>
        </div>
        <div className="sheet-scroll">
          {groups.length === 0 ? (
            <Empty icon={<CheckCircle2 size={30} />} title="还没有完成的任务" hint="完成的任务会归档在这里" />
          ) : (
            groups.map((g) => (
              <div className="section" key={g.key}>
                <div className="section-header">
                  <span className="section-label">{g.label}</span>
                  <span className="section-count">{g.tasks.length}</span>
                </div>
                <div className="task-list">
                  {g.tasks.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      showSlot
                      onOpen={() => {
                        onOpen(t.id);
                        onClose();
                      }}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      {confirmClear && (
        <Modal
          title="清空所有已完成任务?"
          body="将永久删除全部已完成任务,无法撤销。"
          confirmLabel="清空"
          danger
          onCancel={() => setConfirmClear(false)}
          onConfirm={() => {
            for (const t of state.tasks.filter((x) => x.done)) {
              dispatch({ type: 'deleteTask', id: t.id });
            }
            push('已清空所有已完成任务');
            setConfirmClear(false);
          }}
        />
      )}
    </div>
  );
}
