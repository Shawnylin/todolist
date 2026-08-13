import { useCallback, useEffect, useMemo, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { CalendarDays, CheckCircle2, KeyRound, Sparkles } from 'lucide-react';
import type { TaskList, ViewRoute } from './types';
import { INBOX_ID } from './types';
import { useApp } from './store';
import { todayISO } from './utils/date';
import { Sidebar } from './components/Sidebar';
import { BottomNav } from './components/BottomNav';
import { TaskView } from './components/TaskView';
import { SettingsPage, ListEditorModal } from './components/SettingsPage';
import { SearchOverlay } from './components/SearchOverlay';
import { TaskDetailSheet } from './components/TaskDetailSheet';
import { AiPlanSheet } from './components/AiPlanSheet';
import { useToast } from './components/Toast';
import { AppLogo } from './components/icons';

function parseHash(): ViewRoute {
  const h = location.hash.replace(/^#\/?/, '');
  const [seg, param] = h.split('/');
  switch (seg) {
    case 'upcoming':
      return { view: 'upcoming' };
    case 'inbox':
      return { view: 'inbox' };
    case 'completed':
      return { view: 'completed' };
    case 'settings':
      return { view: 'settings' };
    case 'list':
      return { view: 'list', listId: param };
    default:
      return { view: 'today' };
  }
}

function routeToHash(r: ViewRoute): string {
  switch (r.view) {
    case 'today':
      return '#/today';
    case 'upcoming':
      return '#/upcoming';
    case 'inbox':
      return '#/inbox';
    case 'completed':
      return '#/completed';
    case 'settings':
      return '#/settings';
    case 'search':
      return '#/today';
    case 'list':
      return `#/list/${r.listId}`;
  }
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

export default function App() {
  const { state, dispatch, hydrated } = useApp();
  const { push } = useToast();
  const [route, setRoute] = useState<ViewRoute>(() => parseHash());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [listEditor, setListEditor] = useState<{ list?: TaskList } | null>(null);
  const [installEvt, setInstallEvt] = useState<BeforeInstallPromptEvent | null>(null);

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

  // 清单被删除后,回退到收件箱
  const effRoute: ViewRoute = useMemo(() => {
    if (route.view === 'list' && !state.lists.some((l) => l.id === route.listId)) {
      return { view: 'inbox' };
    }
    return route;
  }, [route, state.lists]);

  const counts = useMemo(() => {
    const today = todayISO();
    const pending = state.tasks.filter((t) => !t.done);
    const perList: Record<string, number> = {};
    for (const t of pending) perList[t.listId] = (perList[t.listId] ?? 0) + 1;
    return {
      today: pending.filter((t) => t.due && t.due <= today).length,
      upcoming: pending.filter((t) => t.due).length,
      inbox: perList[INBOX_ID] ?? 0,
      completed: state.tasks.length - pending.length,
      perList,
    };
  }, [state.tasks]);

  const openListEditor = (list?: TaskList) => setListEditor(list ? { list } : {});

  const onInstall = async () => {
    if (!installEvt) return;
    await installEvt.prompt();
    await installEvt.userChoice;
    setInstallEvt(null);
  };

  return (
    <div className="app">
      <Sidebar
        route={effRoute}
        navigate={navigate}
        counts={counts}
        lists={state.lists}
        onNewList={() => openListEditor()}
      />

      <main className="main">
        <div className="main-inner">
          {effRoute.view === 'settings' ? (
            <SettingsPage
              openListEditor={openListEditor}
              installAvailable={!!installEvt}
              onInstall={onInstall}
            />
          ) : (
            <TaskView
              route={effRoute}
              navigate={navigate}
              openDetail={setDetailId}
              openSearch={() => setSearchOpen(true)}
              openPlan={() => setPlanOpen(true)}
              openListEditor={openListEditor}
            />
          )}
        </div>
      </main>

      <BottomNav route={effRoute} navigate={navigate} />

      {searchOpen && (
        <SearchOverlay onClose={() => setSearchOpen(false)} onOpenDetail={setDetailId} />
      )}
      {detailId && <TaskDetailSheet taskId={detailId} onClose={() => setDetailId(null)} />}
      {planOpen && <AiPlanSheet onClose={() => setPlanOpen(false)} />}
      {listEditor && <ListEditorModal list={listEditor.list} onClose={() => setListEditor(null)} />}

      {hydrated && !state.settings.onboarded && (
        <WelcomeModal
          onDone={() => dispatch({ type: 'setSettings', patch: { onboarded: true } })}
        />
      )}
    </div>
  );
}

function WelcomeModal({ onDone }: { onDone: () => void }) {
  const features = [
    {
      icon: <Sparkles size={17} />,
      title: '自然语言快速录入',
      desc: '直接输入「明天下午3点开会 #工作 p1」,日期、时间、清单、优先级自动识别。',
    },
    {
      icon: <CalendarDays size={17} />,
      title: '计划与重复任务',
      desc: '在「今天 / 计划」视图安排日程,支持每天、每周、工作日等重复规则。',
    },
    {
      icon: <CheckCircle2 size={17} />,
      title: '离线可用,数据本机保存',
      desc: 'PWA 应用可安装到主屏幕,断网也能用,数据只存在你的设备里。',
    },
    {
      icon: <KeyRound size={17} />,
      title: 'DeepSeek AI 助手(可选)',
      desc: '在设置中填入自己的 API Key,解锁 AI 解析、任务拆解与今日计划建议。',
    },
  ];
  return (
    <div className="modal-overlay welcome-overlay">
      <div className="welcome-modal" role="dialog" aria-modal="true">
        <AppLogo size={56} />
        <h2 className="welcome-title">欢迎使用拾光清单</h2>
        <p className="welcome-sub">一个漂亮、好用的移动端待办应用</p>
        <ul className="welcome-features">
          {features.map((f) => (
            <li key={f.title}>
              <span className="welcome-f-icon">{f.icon}</span>
              <div>
                <div className="welcome-f-title">{f.title}</div>
                <div className="welcome-f-desc">{f.desc}</div>
              </div>
            </li>
          ))}
        </ul>
        <button type="button" className="btn btn-primary btn-block" onClick={onDone}>
          开始使用
        </button>
      </div>
    </div>
  );
}
