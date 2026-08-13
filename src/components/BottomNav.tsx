import { CalendarDays, ClipboardList, Settings, Sun } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ViewRoute } from '../types';

export function BottomNav({
  route,
  navigate,
}: {
  route: ViewRoute;
  navigate: (r: ViewRoute) => void;
}) {
  const items: Array<{
    key: string;
    label: string;
    icon: ReactNode;
    active: boolean;
    onClick: () => void;
  }> = [
    {
      key: 'today',
      label: '今天',
      icon: <Sun size={21} />,
      active: route.view === 'today',
      onClick: () => navigate({ view: 'today' }),
    },
    {
      key: 'upcoming',
      label: '计划',
      icon: <CalendarDays size={21} />,
      active: route.view === 'upcoming',
      onClick: () => navigate({ view: 'upcoming' }),
    },
    {
      key: 'inbox',
      label: '清单',
      icon: <ClipboardList size={21} />,
      active: route.view === 'inbox' || route.view === 'list',
      onClick: () => navigate({ view: 'inbox' }),
    },
    {
      key: 'settings',
      label: '设置',
      icon: <Settings size={21} />,
      active: route.view === 'settings',
      onClick: () => navigate({ view: 'settings' }),
    },
  ];
  return (
    <nav className="bottom-nav">
      {items.map((it) => (
        <button
          type="button"
          key={it.key}
          className={`bottom-nav-item ${it.active ? 'active' : ''}`}
          onClick={it.onClick}
        >
          {it.icon}
          <span>{it.label}</span>
        </button>
      ))}
    </nav>
  );
}
