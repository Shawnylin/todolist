import { AnimatePresence } from 'motion/react';
import { Expand, SelectionIndicator } from './Motion';
import { AiSettings } from './AiSettings';
import { useRef, useState } from 'react';
import { parseBackup } from '../utils/backup';
import {
  BookOpen,
  Check,
  ChevronDown,
  Database,
  Download,
  Monitor,
  Moon,
  Palette,
  Smartphone,
  Sun,
  Trash2,
  Upload,
} from 'lucide-react';
import type { Settings, Task, TaskList } from '../types';
import { INBOX_ID } from '../types';
import { useApp } from '../store';
import { todayISO } from '../utils/date';
import { useToast } from './Toast';
import { Modal } from './Modal';

interface Props {
  installAvailable: boolean;
  onInstall: () => void;
}

export function SettingsPage({ installAvailable, onInstall }: Props) {
  const { state, dispatch } = useApp();
  const { push } = useToast();
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [pendingImport, setPendingImport] = useState<{ tasks: Task[]; lists: TaskList[] } | null>(
    null,
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const s = state.settings;
  const setS = (patch: Partial<Settings>) => dispatch({ type: 'setSettings', patch });

  const onExport = () => {
    const data = {
      app: 'tidy-todo',
      version: 1,
      exportedAt: new Date().toISOString(),
      tasks: state.tasks,
      lists: state.lists.filter((l) => l.id !== INBOX_ID),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tidy-todo-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    push('数据已导出');
  };

  const onImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const { tasks, lists } = parseBackup(JSON.parse(text));
      setPendingImport({ tasks, lists });
    } catch {
      push('导入失败:文件格式不正确');
    }
  };

  const doImport = () => {
    if (!pendingImport) return;
    const inbox: TaskList = {
      id: INBOX_ID,
      name: '收件箱',
      color: '#6E56CF',
      icon: 'inbox',
      system: true,
    };
    const lists = [inbox, ...pendingImport.lists.filter((l) => l.id !== INBOX_ID)];
    const validIds = new Set(lists.map((l) => l.id));
    const tasks = pendingImport.tasks.map((t) =>
      validIds.has(t.listId) ? t : { ...t, listId: INBOX_ID },
    );
    dispatch({ type: 'replaceAll', tasks, lists });
    push(`导入成功:${tasks.length} 个任务`);
    setPendingImport(null);
  };

  return (
    <div className="settings-page">
      <header className="view-header">
        <div className="view-header-text">
          <h1 className="view-title">设置</h1>
        </div>
      </header>

      <AiSettings />

      {/* 外观 */}
      <section className="settings-card">
        <div className="settings-card-head">
          <span className="settings-entry-icon"><Palette size={21} /></span>
          <h2 className="settings-card-title">外观</h2>
        </div>
        <div className="segmented">
          <SelectionIndicator selector=".seg-btn.active" />
          {(
            [
              { key: 'light', label: '浅色', icon: <Sun size={15} /> },
              { key: 'dark', label: '深色', icon: <Moon size={15} /> },
              { key: 'system', label: '跟随系统', icon: <Monitor size={15} /> },
            ] as const
          ).map((o) => (
            <button
              type="button"
              key={o.key}
              className={`seg-btn ${s.theme === o.key ? 'active' : ''}`}
              aria-pressed={s.theme === o.key}
              onClick={() => setS({ theme: o.key })}
            >
              {o.icon}
              {o.label}
            </button>
          ))}
        </div>
        <div className="theme-colors" aria-label="主题色">
          {(
            [
              { key: 'violet', label: '鸢尾紫', color: '#65518f' },
              { key: 'blue', label: '湖水蓝', color: '#315da8' },
              { key: 'green', label: '森林绿', color: '#326b4c' },
              { key: 'rose', label: '蔷薇粉', color: '#984867' },
              { key: 'amber', label: '琥珀金', color: '#825b12' },
            ] as const
          ).map((color) => (
            <button
              type="button"
              key={color.key}
              aria-label={color.label}
              aria-pressed={(s.accent ?? 'violet') === color.key}
              className="theme-color"
              onClick={() => setS({ accent: color.key })}
            >
              <span style={{ background: color.color }}>
                {(s.accent ?? 'violet') === color.key && <Check size={17} />}
              </span>
              <small>{color.label}</small>
            </button>
          ))}
        </div>
      </section>

      {/* 数据 */}
      <section className="settings-card">
        <div className="settings-card-head">
          <span className="settings-entry-icon"><Database size={21} /></span>
          <h2 className="settings-card-title">数据</h2>
        </div>
        <div className="settings-row-actions data-actions">
          <button type="button" className="btn btn-secondary" onClick={onExport}>
            <Download size={15} /> 导出
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={15} /> 导入
          </button>
          <button
            type="button"
            className="btn btn-secondary danger-text"
            onClick={() => setConfirmClear(true)}
          >
            <Trash2 size={15} /> 清空
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onImportFile(f);
              e.target.value = '';
            }}
          />
        </div>
      </section>

      <section className="settings-card tutorial-card">
        <button
          type="button"
          className="settings-entry"
          aria-expanded={tutorialOpen}
          aria-controls="usage-tutorial"
          onClick={() => setTutorialOpen((v) => !v)}
        >
          <span className="settings-entry-icon">
            <BookOpen size={21} />
          </span>
          <span>
            <strong>使用教程</strong>
          </span>
          <ChevronDown size={18} className={tutorialOpen ? 'chevron open' : 'chevron'} />
        </button>
        <Expand open={tutorialOpen}>
          <div id="usage-tutorial" className="tutorial-body">
            <h3>应用</h3>
            {installAvailable ? (
              <button type="button" className="btn btn-primary" onClick={onInstall}>
                <Smartphone size={15} />
                安装到主屏幕
              </button>
            ) : (
              <p className="settings-card-desc">
                Safari：分享 → 添加到主屏幕。Chrome / Edge：菜单 → 安装应用。
              </p>
            )}
            <h3>快速录入技巧</h3>
            <ul className="tips-list">
              <li>
                <code>每天 9点 阅读 @学习 p1</code>
              </li>
              <li>搜索：Ctrl / ⌘ + K</li>
              <li>聊天：回车发送，Shift + 回车换行</li>
            </ul>
          </div>
        </Expand>
      </section>

      <AnimatePresence>
        {confirmClear && (
          <Modal
            title="清空所有数据?"
            body="永久删除全部任务和聊天记录，保留设置。无法恢复。"
            confirmLabel="全部清空"
            danger
            onCancel={() => setConfirmClear(false)}
            onConfirm={() => {
              dispatch({ type: 'wipeData' });
              push('已清空所有数据');
              setConfirmClear(false);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pendingImport && (
          <Modal
            title="导入?"
            body={`将用备份替换任务和清单（${pendingImport.tasks.length} 个任务），并清空全部历史对话。AI 配置保留。`}
            confirmLabel="导入"
            onCancel={() => setPendingImport(null)}
            onConfirm={doImport}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
