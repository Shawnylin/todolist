import { CalendarDays, CheckCircle2, Inbox, Plus, Settings, Sun } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import type { TaskList, ViewRoute } from '../types';
import { INBOX_ID } from '../types';
import { ListIcon, AppLogo } from './icons';

interface Props {
  route: ViewRoute;
  navigate: (r: ViewRoute) => void;
  counts: {
    today: number;
    upcoming: number;
    inbox: number;
    completed: number;
    perList: Record<string, number>;
  };
  lists: TaskList[];
  onNewList: () => void;
}

function NavItem({
  active,
  icon,
  label,
  count,
  color,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  count?: number;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`nav-item ${active ? 'active' : ''}`}
      onClick={onClick}
      style={active && color ? ({ '--nav-accent': color } as CSSProperties) : undefined}
    >
      <span className="nav-icon">{icon}</span>
      <span className="nav-label">{label}</span>
      {count !== undefined && count > 0 && <span className="nav-count">{count}</span>}
    </button>
  );
}

export function Sidebar({ route, navigate, counts, lists, onNewList }: Props) {
  const customLists = lists.filter((l) => l.id !== INBOX_ID);
  return (
    <aside className="sidebar">
      <div className="brand">
        <AppLogo size={34} />
        <div>
          <div className="brand-name">拾光清单</div>
          <div className="brand-sub">TidyTodo</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <NavItem
          active={route.view === 'today'}
          icon={<Sun size={19} />}
          label="今天"
          count={counts.today}
          onClick={() => navigate({ view: 'today' })}
        />
        <NavItem
          active={route.view === 'upcoming'}
          icon={<CalendarDays size={19} />}
          label="计划"
          count={counts.upcoming}
          onClick={() => navigate({ view: 'upcoming' })}
        />
        <NavItem
          active={route.view === 'inbox'}
          icon={<Inbox size={19} />}
          label="收件箱"
          count={counts.inbox}
          onClick={() => navigate({ view: 'inbox' })}
        />

        <div className="nav-group-label">
          <span>清单</span>
          <button
            type="button"
            className="icon-btn"
            title="新建清单"
            aria-label="新建清单"
            onClick={onNewList}
          >
            <Plus size={16} />
          </button>
        </div>
        {customLists.map((l) => (
          <NavItem
            key={l.id}
            active={route.view === 'list' && route.listId === l.id}
            icon={<ListIcon name={l.icon} size={18} />}
            label={l.name}
            count={counts.perList[l.id]}
            color={l.color}
            onClick={() => navigate({ view: 'list', listId: l.id })}
          />
        ))}
        {customLists.length === 0 && (
          <div className="nav-empty-hint">点击 + 创建你的第一个清单</div>
        )}

        <NavItem
          active={route.view === 'completed'}
          icon={<CheckCircle2 size={19} />}
          label="已完成"
          count={counts.completed}
          onClick={() => navigate({ view: 'completed' })}
        />
      </nav>

      <div className="sidebar-footer">
        <NavItem
          active={route.view === 'settings'}
          icon={<Settings size={19} />}
          label="设置"
          onClick={() => navigate({ view: 'settings' })}
        />
      </div>
    </aside>
  );
}
