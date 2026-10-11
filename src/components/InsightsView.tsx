import { AnimatePresence } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, BarChart3, CheckCircle2, ChevronRight, Clock, Flag, CalendarPlus, Trash2, X } from 'lucide-react';
import { sortTasks, useApp } from '../store';
import { formatDueShort, parseISODate, todayISO } from '../utils/date';
import { buildInsights, completionDate, filterInsightTasks, type InsightFilter, type InsightPeriod } from '../utils/insights';
import { Overlay, Panel, SelectionIndicator } from './Motion';
import { TaskRow } from './TaskRow';
import { Empty } from './Empty';
import { Modal } from './Modal';
import { useToast } from './Toast';

const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六'];
type Selection = { title: string; filter: InsightFilter };

export function InsightsView({ openDetail }: { openDetail: (id: string) => void }) {
  const { state } = useApp();
  const today = todayISO();
  const [period, setPeriod] = useState<InsightPeriod>(7);
  const [selection, setSelection] = useState<Selection | null>(null);
  const insights = useMemo(() => buildInsights(state.tasks, today, period), [state.tasks, today, period]);
  const maxCompleted = Math.max(1, ...insights.completionBars.map((bar) => bar.count));
  const maxScheduled = Math.max(1, ...insights.scheduleBars.map((bar) => bar.count));
  const openCompleted = (start: string, end: string, title: string) =>
    setSelection({ title, filter: { kind: 'completed', start, end } });

  return (
    <div className="task-view insights-view">
      <header className="view-header">
        <h1 className="view-title">洞察</h1>
        {state.tasks.length > 0 && <div className="insight-period segmented" role="group" aria-label="统计范围">
          <SelectionIndicator selector="button.active" />
          {([7, 30] as const).map((days) => (
            <button type="button" className={`seg-btn ${period === days ? 'active' : ''}`}
              key={days} aria-pressed={period === days} onClick={() => setPeriod(days)}>
              {days} 天
            </button>
          ))}
        </div>}
      </header>

      {state.tasks.length === 0 ? <Empty icon={<BarChart3 size={30} />} title="暂无任务" /> : <div className="view-body insights-body">
        <button type="button" className="insight-summary" aria-label={`查看近 ${period} 天完成任务`}
          onClick={() => openCompleted(insights.start, today, `近 ${period} 天完成`)}>
          <div className="insight-summary-main">
            <span>近 {period} 天完成</span>
            <strong>{insights.completed}<small>件</small></strong>
          </div>
          <div className="insight-comparison">
            <span>较前 {period} 天</span>
            <strong>
              {insights.delta > 0 ? <ArrowUpRight size={20} /> : insights.delta < 0 ? <ArrowDownRight size={20} /> : null}
              {insights.delta > 0 ? '+' : ''}{insights.delta}<small>件</small>
            </strong>
          </div>
          <ChevronRight size={18} className="insight-summary-arrow" />
        </button>

        <div className="insight-actions">
          {([
            { kind: 'overdue', label: '逾期', value: insights.overdue, icon: <Clock size={18} /> },
            { kind: 'unscheduled', label: '未安排', value: insights.unscheduled, icon: <CalendarPlus size={18} /> },
            { kind: 'priority', label: 'P1 待办', value: insights.priority, icon: <Flag size={18} /> },
          ] as const).map((item) => (
            <button type="button" className={`insight-action ${item.kind}`} key={item.kind}
              aria-label={`${item.label} ${item.value} 件`}
              onClick={() => setSelection({ title: item.label, filter: { kind: item.kind } })}>
              <span className="insight-action-icon">{item.icon}</span>
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        <div className="insight-chart-grid">
          <section className="chart-card insight-chart" aria-label="完成趋势">
            <div className="chart-card-title"><h2>完成趋势</h2></div>
            <div className="insight-bars" style={{ gridTemplateColumns: `repeat(${insights.completionBars.length}, minmax(0, 1fr))` }}>
              {insights.completionBars.map((bar) => {
                const label = period === 7 ? WEEK_LABELS[parseISODate(bar.from).getDay()] : bar.from.slice(5).replace('-', '/');
                const title = bar.from === bar.to ? `${formatDueShort(bar.from, today)}完成` : `${bar.from.slice(5).replace('-', '/')} — ${bar.to.slice(5).replace('-', '/')} 完成`;
                return <InsightBar key={bar.from} count={bar.count} max={maxCompleted}
                  label={label} current={bar.to === today} ariaLabel={`${title} ${bar.count} 件`}
                  onClick={() => openCompleted(bar.from, bar.to, title)} />;
              })}
            </div>
          </section>

          <section className="chart-card insight-chart" aria-label="未来七天安排">
            <div className="chart-card-title"><h2>未来 7 天</h2><span>{insights.scheduled} 件待办</span></div>
            <div className="insight-bars forecast">
              {insights.scheduleBars.map((bar) => (
                <InsightBar key={bar.date} count={bar.count} max={maxScheduled}
                  label={bar.date === today ? '今天' : WEEK_LABELS[parseISODate(bar.date).getDay()]}
                  current={bar.date === today} ariaLabel={`${formatDueShort(bar.date, today)}待办 ${bar.count} 件`}
                  onClick={() => setSelection({ title: formatDueShort(bar.date, today), filter: { kind: 'scheduled', date: bar.date } })} />
              ))}
            </div>
          </section>
        </div>

        <section className="chart-card insight-recent">
          <div className="chart-card-title">
            <h2>最近完成</h2>
            <button type="button" className="link right" onClick={() => setSelection({ title: '已完成', filter: { kind: 'completed' } })}>
              全部 <ChevronRight size={16} />
            </button>
          </div>
          {insights.recent.length === 0 ? <p className="chart-empty">暂无完成任务</p> : (
            <div className="task-list">
              {insights.recent.map((task) => <TaskRow key={task.id} task={task} showCompletion onOpen={() => openDetail(task.id)} />)}
            </div>
          )}
        </section>
      </div>}

      <AnimatePresence>{selection && <InsightTaskSheet selection={selection} today={today}
        onClose={() => setSelection(null)} onOpen={(id) => { setSelection(null); openDetail(id); }} />}</AnimatePresence>
    </div>
  );
}

function InsightBar({ count, max, label, current, ariaLabel, onClick }: {
  count: number; max: number; label: string; current: boolean; ariaLabel: string; onClick: () => void;
}) {
  return (
    <button type="button" className={`insight-bar ${current ? 'current' : ''}`} aria-label={ariaLabel}
      title={ariaLabel} disabled={count === 0} onClick={onClick}>
      <span className="insight-bar-value">{count}</span>
      <span className="insight-bar-track" aria-hidden="true">
        <span className="insight-bar-fill" style={{ height: `${count / max * 100}%` }} />
      </span>
      <span className="insight-bar-label">{label}</span>
    </button>
  );
}

function InsightTaskSheet({ selection, today, onClose, onOpen }: {
  selection: Selection; today: string; onClose: () => void; onOpen: (id: string) => void;
}) {
  const { state, dispatch } = useApp();
  const { push } = useToast();
  const [confirmClear, setConfirmClear] = useState(false);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !confirmClear) onClose();
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [confirmClear, onClose]);
  const tasks = filterInsightTasks(state.tasks, selection.filter, today);
  const completed = selection.filter.kind === 'completed';
  const canClear = selection.filter.kind === 'completed' && !selection.filter.start && !selection.filter.end;
  const sorted = completed ? [...tasks].sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)) : sortTasks(tasks);
  const groups = new Map<string, typeof tasks>();
  for (const task of sorted) {
    const date = completed ? completionDate(task) ?? 'unknown' : '';
    const group = groups.get(date) ?? [];
    group.push(task);
    groups.set(date, group);
  }

  return (
    <Overlay className="sheet-overlay" onClick={onClose}>
      <Panel className="sheet insight-task-sheet" label={selection.title}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h2 className="sheet-title">{selection.title}<span className="sheet-count">{tasks.length}</span></h2>
          <div className="sheet-header-actions">
            {canClear && tasks.length > 0 && <button type="button" className="btn btn-ghost sm danger-text" onClick={() => setConfirmClear(true)}><Trash2 size={14} /> 清空</button>}
            <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭"><X size={18} /></button>
          </div>
        </div>
        <div className="sheet-scroll">
          {tasks.length === 0 ? <Empty icon={<CheckCircle2 size={30} />} title="暂无任务" /> : [...groups].map(([date, items]) => (
            <section className="section" key={date}>
              {date && <div className="section-header"><span className="section-label">{date === 'unknown' ? '日期未记录' : formatDueShort(date, today)}</span><span className="section-count">{items.length}</span></div>}
              <div className="task-list">{items.map((task) => <TaskRow key={task.id} task={task} showSlot onOpen={() => onOpen(task.id)} />)}</div>
            </section>
          ))}
        </div>
      </Panel>
      <AnimatePresence>{confirmClear && <Modal title="清空已完成任务？" body="永久删除全部已完成任务，无法撤销。"
        confirmLabel="清空" danger onCancel={() => setConfirmClear(false)} onConfirm={() => {
          for (const task of tasks) dispatch({ type: 'deleteTask', id: task.id });
          push('已清空已完成任务');
          setConfirmClear(false);
        }} />}</AnimatePresence>
    </Overlay>
  );
}
