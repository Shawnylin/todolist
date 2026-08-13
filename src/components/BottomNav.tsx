import { BarChart3, Sparkles, Sun } from 'lucide-react';
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
