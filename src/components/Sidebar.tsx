import { BarChart3, Settings, Sparkles, Sun } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ViewRoute } from '../types';
import { AppLogo } from './icons';

interface Props {
  route: ViewRoute;
  navigate: (r: ViewRoute) => void;
  todayCount: number;
}

function NavItem({
  active,
  icon,
  label,
  count,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`nav-item ${active ? 'active' : ''}`}
      onClick={onClick}
    >
      <span className="nav-icon">{icon}</span>
      <span className="nav-label">{label}</span>
      {count !== undefined && count > 0 && <span className="nav-count">{count}</span>}
    </button>
  );
}

export function Sidebar({ route, navigate, todayCount }: Props) {
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
          count={todayCount}
          onClick={() => navigate({ view: 'today' })}
        />
        <NavItem
          active={route.view === 'plan'}
          icon={<Sparkles size={19} />}
          label="计划"
          onClick={() => navigate({ view: 'plan' })}
        />
        <NavItem
          active={route.view === 'insights'}
          icon={<BarChart3 size={19} />}
          label="洞察"
          onClick={() => navigate({ view: 'insights' })}
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
