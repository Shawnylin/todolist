import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Inbox,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Sun,
  Trash2,
} from 'lucide-react';
import type { Task, TaskList, ViewRoute } from '../types';
import { INBOX_ID } from '../types';
import { hasAiKey } from '../ai';
import { sortTasks, useApp } from '../store';
import { diffDaysISO, formatDue, todayISO, toISODate } from '../utils/date';
import { QuickAdd } from './QuickAdd';
import { TaskRow } from './TaskRow';
import { Empty } from './Empty';
import { Modal } from './Modal';
import { ListIcon } from './icons';

interface Props {
  route: ViewRoute;
  navigate: (r: ViewRoute) => void;
  openDetail: (id: string) => void;
  openSearch: () => void;
  openPlan: () => void;
  openListEditor: (list?: TaskList) => void;
}

function Section({
  label,
  count,
  children,
}: {
  label: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <section className="section">
      <div className="section-header">
        <span className="section-label">{label}</span>
        {count !== undefined && <span className="section-count">{count}</span>}
      </div>
      <div className="task-list">{children}</div>
    </section>
  );
}

export function TaskView({ route, navigate, openDetail, openSearch, openPlan, openListEditor }: Props) {
  const { state, dispatch } = useApp();
  const [confirmClear, setConfirmClear] = useState(false);
  const [showDoneToday, setShowDoneToday] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const today = todayISO();
  const pending = useMemo(() => state.tasks.filter((t) => !t.done), [state.tasks]);
  const done = useMemo(() => state.tasks.filter((t) => t.done), [state.tasks]);

  const currentList: TaskList | undefined = (() => {
    if (route.view === 'list') return state.lists.find((l) => l.id === route.listId);
    if (route.view === 'inbox') return state.lists.find((l) => l.id === INBOX_ID);
    return undefined;
  })();

  // ---- 各视图数据 ----
  const overdue = pending.filter((t) => t.due && t.due < today);
  const dueToday = pending.filter((t) => t.due === today);
  const doneToday = done.filter(
    (t) => t.completedAt && toISODate(new Date(t.completedAt)) === today,
  );

  const futureGroups = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of pending) {
      if (!t.due || t.due <= today) continue;
      const arr = map.get(t.due) ?? [];
      arr.push(t);
      map.set(t.due, arr);
    }
    return [...map.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([date, tasks]) => ({ date, tasks: sortTasks(tasks) }));
  }, [pending, today]);

  const listTasks = currentList ? sortTasks(pending.filter((t) => t.listId === currentList.id)) : [];

  const completedGroups = useMemo(() => {
    const buckets: Array<{ key: string; label: string; tasks: Task[] }> = [
      { key: 'today', label: '今天', tasks: [] },
      { key: 'yesterday', label: '昨天', tasks: [] },
      { key: 'week', label: '近 7 天', tasks: [] },
      { key: 'earlier', label: '更早', tasks: [] },
    ];
    for (const t of done) {
      const d = t.completedAt ? toISODate(new Date(t.completedAt)) : today;
      const diff = diffDaysISO(d, today);
      const key = diff === 0 ? 'today' : diff === -1 ? 'yesterday' : diff >= -6 ? 'week' : 'earlier';
      buckets.find((b) => b.key === key)!.tasks.push(t);
    }
    return buckets
      .map((b) => ({ ...b, tasks: b.tasks.sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)) }))
      .filter((b) => b.tasks.length > 0);
  }, [done, today]);

  const listCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of pending) m[t.listId] = (m[t.listId] ?? 0) + 1;
    return m;
  }, [pending]);

  // ---- 头部信息 ----
  let title = '今天';
  let subtitle = '';
  let quickAddListId = INBOX_ID;
  if (route.view === 'today') {
    subtitle = formatHeaderSubtitle();
  } else if (route.view === 'upcoming') {
    title = '计划';
    subtitle = `${pending.filter((t) => t.due).length} 个已安排任务`;
  } else if (route.view === 'inbox') {
    title = currentList?.name ?? '收件箱';
    subtitle = `${listCounts[currentList?.id ?? INBOX_ID] ?? 0} 个待办`;
    quickAddListId = currentList?.id ?? INBOX_ID;
  } else if (route.view === 'list' && currentList) {
    title = currentList.name;
    subtitle = `${listCounts[currentList.id] ?? 0} 个待办`;
    quickAddListId = currentList.id;
  } else if (route.view === 'completed') {
    title = '已完成';
    subtitle = `共完成 ${done.length} 个任务`;
  }

  const emptyFor = (() => {
    if (route.view === 'today') {
      if (overdue.length === 0 && dueToday.length === 0) {
        return (
          <Empty
            icon={<Sun size={30} />}
            title="今天没有待办"
            hint="在上方输入框添加任务,试试「明天下午3点开会 p1」"
          />
        );
      }
      return null;
    }
    if (route.view === 'upcoming' && futureGroups.length === 0 && overdue.length === 0 && dueToday.length === 0) {
      return (
        <Empty
          icon={<CalendarDays size={30} />}
          title="暂无计划"
          hint="给任务加上日期,它们会按时间出现在这里"
        />
      );
    }
    if ((route.view === 'inbox' || route.view === 'list') && listTasks.length === 0) {
      return (
        <Empty
          icon={<Inbox size={30} />}
          title={route.view === 'inbox' ? '收件箱是空的' : '这个清单是空的'}
          hint="快速添加一个任务,或用「#清单名」直接归入清单"
        />
      );
    }
    if (route.view === 'completed' && done.length === 0) {
      return (
        <Empty
          icon={<CheckCircle2 size={30} />}
          title="还没有完成的任务"
          hint="完成的任务会归档在这里"
        />
      );
    }
    return null;
  })();

  return (
    <div className="task-view">
      <header className="view-header">
        <div className="view-header-text">
          <div className="view-title-row">
            {(route.view === 'inbox' || route.view === 'list') && currentList ? (
              <div className="list-switcher">
                <button
                  type="button"
                  className="view-title switcher-btn"
                  onClick={() => setSwitcherOpen((v) => !v)}
                >
                  {title}
                  <ChevronDown size={18} />
                </button>
                {switcherOpen && (
                  <>
                    <div className="popover-scrim" onClick={() => setSwitcherOpen(false)} />
                    <div className="popover list-switch-pop">
                      {state.lists.map((l) => (
                        <button
                          type="button"
                          key={l.id}
                          className={`popover-item ${l.id === currentList.id ? 'active' : ''}`}
                          onClick={() => {
                            if (l.id === INBOX_ID) navigate({ view: 'inbox' });
                            else navigate({ view: 'list', listId: l.id });
                            setSwitcherOpen(false);
                          }}
                        >
                          <ListIcon name={l.icon} size={16} className="popover-item-icon" />
                          <span className="popover-item-label">{l.name}</span>
                          <span className="popover-item-count">{listCounts[l.id] ?? 0}</span>
                        </button>
                      ))}
                      <div className="popover-divider" />
                      <button
                        type="button"
                        className="popover-item"
                        onClick={() => {
                          openListEditor();
                          setSwitcherOpen(false);
                        }}
                      >
                        <Plus size={16} className="popover-item-icon" />
                        <span className="popover-item-label">新建清单</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <h1 className="view-title">{title}</h1>
            )}
            {route.view === 'list' && currentList && !currentList.system && (
              <button
                type="button"
                className="icon-btn"
                title="编辑清单"
                aria-label="编辑清单"
                onClick={() => openListEditor(currentList)}
              >
                <Pencil size={16} />
              </button>
            )}
          </div>
          {subtitle && <div className="view-subtitle">{subtitle}</div>}
        </div>
        <div className="view-header-actions">
          {route.view === 'today' && hasAiKey(state.settings) && (
            <button
              type="button"
              className="icon-btn ai"
              title="AI 今日计划"
              aria-label="AI 今日计划"
              onClick={openPlan}
            >
              <Sparkles size={17} />
            </button>
          )}
          <button
            type="button"
            className="icon-btn"
            title="搜索"
            aria-label="搜索"
            onClick={openSearch}
          >
            <Search size={17} />
          </button>
          {route.view === 'completed' && done.length > 0 && (
            <button
              type="button"
              className="icon-btn danger"
              title="清空已完成"
              aria-label="清空已完成"
              onClick={() => setConfirmClear(true)}
            >
              <Trash2 size={17} />
            </button>
          )}
        </div>
      </header>

      <QuickAdd listId={quickAddListId} />

      <div className="view-body">
        {route.view === 'today' && (
          <>
            {overdue.length > 0 && (
              <Section label="已逾期" count={overdue.length}>
                {sortTasks(overdue).map((t) => (
                  <TaskRow key={t.id} task={t} showList onOpen={() => openDetail(t.id)} />
                ))}
              </Section>
            )}
            {dueToday.length > 0 && (
              <Section label="今天" count={dueToday.length}>
                {sortTasks(dueToday).map((t) => (
                  <TaskRow key={t.id} task={t} showList onOpen={() => openDetail(t.id)} />
                ))}
              </Section>
            )}
            {doneToday.length > 0 && (
              <Section label="今天已完成" count={doneToday.length}>
                {(showDoneToday ? doneToday : doneToday.slice(0, 3)).map((t) => (
                  <TaskRow key={t.id} task={t} showList onOpen={() => openDetail(t.id)} />
                ))}
                {doneToday.length > 3 && (
                  <button
                    type="button"
                    className="expand-btn"
                    onClick={() => setShowDoneToday((v) => !v)}
                  >
                    {showDoneToday ? '收起' : `查看全部 ${doneToday.length} 项`}
                    <ChevronDown size={14} className={showDoneToday ? 'flip' : ''} />
                  </button>
                )}
              </Section>
            )}
            {emptyFor}
          </>
        )}

        {route.view === 'upcoming' && (
          <>
            {overdue.length > 0 && (
              <Section label="已逾期" count={overdue.length}>
                {sortTasks(overdue).map((t) => (
                  <TaskRow key={t.id} task={t} showList onOpen={() => openDetail(t.id)} />
                ))}
              </Section>
            )}
            {dueToday.length > 0 && (
              <Section label="今天" count={dueToday.length}>
                {sortTasks(dueToday).map((t) => (
                  <TaskRow key={t.id} task={t} showList onOpen={() => openDetail(t.id)} />
                ))}
              </Section>
            )}
            {futureGroups.map((g) => (
              <Section key={g.date} label={formatDue(g.date)} count={g.tasks.length}>
                {g.tasks.map((t) => (
                  <TaskRow key={t.id} task={t} showList onOpen={() => openDetail(t.id)} />
                ))}
              </Section>
            ))}
            {emptyFor}
          </>
        )}

        {(route.view === 'inbox' || route.view === 'list') && (
          <>
            {listTasks.length > 0 && (
              <Section label="待办" count={listTasks.length}>
                {listTasks.map((t) => (
                  <TaskRow key={t.id} task={t} onOpen={() => openDetail(t.id)} />
                ))}
              </Section>
            )}
            {emptyFor}
          </>
        )}

        {route.view === 'completed' && (
          <>
            {completedGroups.map((g) => (
              <Section key={g.key} label={g.label} count={g.tasks.length}>
                {g.tasks.map((t) => (
                  <TaskRow key={t.id} task={t} showList onOpen={() => openDetail(t.id)} />
                ))}
              </Section>
            ))}
            {emptyFor}
          </>
        )}
      </div>

      {confirmClear && (
        <Modal
          title="清空所有已完成任务?"
          body="该操作将永久删除全部已完成任务,无法撤销。"
          confirmLabel="清空"
          danger
          onCancel={() => setConfirmClear(false)}
          onConfirm={() => {
            for (const t of done) dispatch({ type: 'deleteTask', id: t.id });
            setConfirmClear(false);
          }}
        />
      )}
    </div>
  );
}

function formatHeaderSubtitle(): string {
  const d = new Date();
  const wd = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  return `${d.getMonth() + 1}月${d.getDate()}日 · 周${wd}`;
}
