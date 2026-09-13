import { BarChart3, Settings, Sparkles, Sun } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ViewRoute } from '../types';
import { SelectionIndicator } from './Motion';

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
      key: 'settings',
      label: '设置',
      icon: <Settings size={21} />,
      active: route.view === 'settings',
      onClick: () => navigate({ view: 'settings' }),
    },
    {
      key: 'today',
      label: '今天',
      icon: <Sun size={21} />,
      active: route.view === 'today',
      onClick: () => navigate({ view: 'today' }),
    },
    {
      key: 'plan',
      label: '计划',
      icon: <Sparkles size={21} />,
      active: route.view === 'plan',
      onClick: () => navigate({ view: 'plan' }),
    },
    {
      key: 'insights',
      label: '洞察',
      icon: <BarChart3 size={21} />,
      active: route.view === 'insights',
      onClick: () => navigate({ view: 'insights' }),
    },
  ];
  return (
    <nav className="bottom-nav">
      <SelectionIndicator selector=".bottom-nav-item.active .bottom-nav-content" />
      {[...items.slice(1), items[0]].map((it) => (
        <button
          type="button"
          key={it.key}
          aria-current={it.active ? 'page' : undefined}
          className={`bottom-nav-item ${it.active ? 'active' : ''}`}
          onClick={it.onClick}
        >
          <span className="bottom-nav-content">
            {it.icon}
            <span className="bottom-nav-label">{it.label}</span>
          </span>
        </button>
      ))}
    </nav>
  );
}
