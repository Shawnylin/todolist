import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Overlay, Panel } from './components/Motion';
import { registerSW } from 'virtual:pwa-register';
import { CalendarDays, CheckCircle2, Sun } from 'lucide-react';
import type { ViewRoute } from './types';
import { useApp } from './store';
import { todayISO } from './utils/date';
import { Sidebar } from './components/Sidebar';
import { BottomNav } from './components/BottomNav';
import { TodayView } from './components/TodayView';
import { PlanView } from './components/PlanView';
import { InsightsView } from './components/InsightsView';
import { SettingsPage } from './components/SettingsPage';
import { SearchOverlay } from './components/SearchOverlay';
import { TaskDetailSheet } from './components/TaskDetailSheet';
import { useToast } from './components/Toast';
import { AppLogo } from './components/icons';
import { DialogAccessibility } from './components/DialogAccessibility';
import { Viewport } from './components/Viewport';

function parseHash(): ViewRoute {
  const h = location.hash.replace(/^#\/?/, '');
  const seg = h.split('/')[0];
  switch (seg) {
    case 'plan':
      return { view: 'plan' };
    case 'insights':
      return { view: 'insights' };
    case 'settings':
      return { view: 'settings' };
    default:
      return { view: 'today' };
  }
}

function routeToHash(r: ViewRoute): string {
  switch (r.view) {
    case 'today':
      return '#/today';
    case 'plan':
      return '#/plan';
    case 'insights':
      return '#/insights';
    case 'settings':
      return '#/settings';
  }
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

export default function App() {
  const { state, dispatch, hydrated, storageError } = useApp();
  const { push } = useToast();
  const [route, setRoute] = useState<ViewRoute>(() => parseHash());
  const reduced = useReducedMotion();
  const routeMotion = useRef({ view: route.view, direction: 1 });
  if (routeMotion.current.view !== route.view) {
    const order = ['today', 'plan', 'insights', 'settings'];
    routeMotion.current = { view: route.view, direction: order.indexOf(route.view) > order.indexOf(routeMotion.current.view) ? 1 : -1 };
  }
  const direction = reduced ? 0 : routeMotion.current.direction;
  const [detailId, setDetailId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [installEvt, setInstallEvt] = useState<BeforeInstallPromptEvent | null>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && !document.querySelector('[role="dialog"]')) { event.preventDefault(); setSearchOpen(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // PWA:新版本提示 + 安装事件捕获
  useEffect(() => {
    const updateSW = registerSW({
      onNeedRefresh() {
        push('发现新版本', { label: '立即更新', fn: () => void updateSW(true) });
      },
    });
    const onBip = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBip);
    return () => window.removeEventListener('beforeinstallprompt', onBip);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const navigate = useCallback((r: ViewRoute) => {
    const h = routeToHash(r);
    if (location.hash !== h) location.hash = h;
    setRoute(r);
    window.scrollTo({ top: 0 });
  }, []);

  const todayCount = useMemo(() => {
    const today = todayISO();
    return state.tasks.filter((t) => !t.done && (!t.due || t.due <= today)).length;
  }, [state.tasks]);

  const onInstall = async () => {
    if (!installEvt) return;
    await installEvt.prompt();
    await installEvt.userChoice;
    setInstallEvt(null);
  };

  return (
    <div className="app">
      <DialogAccessibility />
      <Viewport />
      <Sidebar route={route} navigate={navigate} todayCount={todayCount} />

      <main className="main">
        {storageError && <div className="storage-error" role="alert">{storageError}</div>}
        {!hydrated ? <div className="loading-state" role="status">{storageError ? '加载失败，请刷新' : '加载中…'}</div> : <AnimatePresence mode="wait" initial={false} custom={direction}><motion.div className="main-inner" key={route.view} custom={direction} variants={{ enter: (d: number) => ({ opacity: 0, x: d * 18 }), active: { opacity: 1, x: 0 }, leave: (d: number) => ({ opacity: 0, x: -d * 18 }) }} initial="enter" animate="active" exit="leave" transition={{ duration: reduced ? 0 : .16, ease: [.2, 0, 0, 1] }}>
          {route.view === 'today' && (
            <TodayView openDetail={setDetailId} openSearch={() => setSearchOpen(true)} />
          )}
          {route.view === 'plan' && <PlanView navigate={navigate} openDetail={setDetailId} />}
          {route.view === 'insights' && (
            <InsightsView openDetail={setDetailId} />
          )}
          {route.view === 'settings' && (
            <SettingsPage
              installAvailable={!!installEvt}
              onInstall={onInstall}
            />
          )}
        </motion.div></AnimatePresence>}
      </main>

      <BottomNav route={route} navigate={navigate} />

      <AnimatePresence>{searchOpen && (
        <SearchOverlay onClose={() => setSearchOpen(false)} onOpenDetail={setDetailId} />
      )}</AnimatePresence>
      <AnimatePresence>{detailId && <TaskDetailSheet key={detailId} taskId={detailId} onClose={() => setDetailId(null)} />}</AnimatePresence>

      <AnimatePresence>{hydrated && !state.settings.onboarded && (
        <WelcomeModal
          onDone={() => dispatch({ type: 'setSettings', patch: { onboarded: true } })}
        />
      )}</AnimatePresence>
    </div>
  );
}

function WelcomeModal({ onDone }: { onDone: () => void }) {
  const features = [
    {
      icon: <Sun size={17} />,
      title: '日程',
    },
    {
      icon: <CalendarDays size={17} />,
      title: 'AI 计划',
    },
    {
      icon: <CheckCircle2 size={17} />,
      title: '洞察',
    },
  ];
  return (
    <Overlay className="modal-overlay welcome-overlay">
      <Panel className="welcome-modal" label="欢迎使用拾光清单">
        <AppLogo size={56} />
        <h2 className="welcome-title">拾光清单</h2>
        <ul className="welcome-features">
          {features.map((f) => (
            <li key={f.title}>
              <span className="welcome-f-icon">{f.icon}</span>
              <div>
                <div className="welcome-f-title">{f.title}</div>
              </div>
            </li>
          ))}
        </ul>
        <button type="button" className="btn btn-primary btn-block" onClick={onDone}>
          开始使用
        </button>
      </Panel>
    </Overlay>
  );
}
