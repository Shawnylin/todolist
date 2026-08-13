import { useRef, useState } from 'react';
import {
  CheckCircle2,
  Database,
  Download,
  Eye,
  EyeOff,
  Info,
  KeyRound,
  Loader2,
  Monitor,
  Moon,
  Palette,
  Pencil,
  Plus,
  Smartphone,
  Sun,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { Settings, Task, TaskList } from '../types';
import { INBOX_ID, LIST_COLORS, LIST_ICONS } from '../types';
import { hasAiKey, testConnection } from '../ai';
import { useApp } from '../store';
import { todayISO, uid } from '../utils/date';
import { useToast } from './Toast';
import { Modal } from './Modal';
import { ListIcon } from './icons';

interface Props {
  openListEditor: (list?: TaskList) => void;
  installAvailable: boolean;
  onInstall: () => void;
}

export function SettingsPage({ openListEditor, installAvailable, onInstall }: Props) {
  const { state, dispatch } = useApp();
  const { push } = useToast();
  const [showKey, setShowKey] = useState(false);
  const [testState, setTestState] = useState<'idle' | 'busy' | 'ok' | 'err'>('idle');
  const [testMsg, setTestMsg] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [pendingImport, setPendingImport] = useState<{ tasks: Task[]; lists: TaskList[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const s = state.settings;
  const setS = (patch: Partial<Settings>) => dispatch({ type: 'setSettings', patch });

  const onTest = async () => {
    if (!hasAiKey(s)) {
      push('请先填写 API Key');
      return;
    }
    setTestState('busy');
    setTestMsg('');
    try {
      await testConnection(s);
      setTestState('ok');
      setTestMsg('连接成功,API Key 有效');
    } catch (e) {
      setTestState('err');
      setTestMsg(e instanceof Error ? e.message : '连接失败');
    } finally {
      // busy 状态由结果覆盖
    }
  };

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
      const obj = JSON.parse(text) as Record<string, unknown>;
      const tasks = Array.isArray(obj.tasks) ? (obj.tasks as Task[]) : null;
      const lists = Array.isArray(obj.lists) ? (obj.lists as TaskList[]) : null;
      if (!tasks || !lists) throw new Error('文件格式不正确');
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
    // 任务里引用不存在的清单时,归回收件箱
    const validIds = new Set(lists.map((l) => l.id));
    const tasks = pendingImport.tasks.map((t) =>
      validIds.has(t.listId) ? t : { ...t, listId: INBOX_ID },
    );
    dispatch({ type: 'replaceAll', tasks, lists });
    push(`导入成功:${tasks.length} 个任务,${lists.length - 1} 个清单`);
    setPendingImport(null);
  };

  const customLists = state.lists.filter((l) => l.id !== INBOX_ID);

  return (
    <div className="settings-page">
      <header className="view-header">
        <div className="view-header-text">
          <h1 className="view-title">设置</h1>
          <div className="view-subtitle">个性化你的拾光清单</div>
        </div>
      </header>

      {/* AI 助手 */}
      <section className="settings-card">
        <div className="settings-card-head">
          <div className="settings-card-title">
            <KeyRound size={16} />
            AI 助手 · DeepSeek
          </div>
          <span className={`status-dot ${hasAiKey(s) ? 'on' : ''}`}>
            <span className="dot" />
            {hasAiKey(s) ? '已配置' : '未配置'}
          </span>
        </div>
        <p className="settings-card-desc">
          填写你自己的 DeepSeek API Key 后,即可使用自然语言智能解析、任务拆解、今日计划等 AI
          能力。密钥仅保存在本机浏览器中,直接通过 HTTPS 请求 DeepSeek,不经过任何第三方服务器。
        </p>

        <label className="field">
          <span className="field-label">API Key</span>
          <div className="field-input-wrap">
            <input
              className="field-input"
              type={showKey ? 'text' : 'password'}
              placeholder="sk-…"
              autoComplete="off"
              value={s.apiKey}
              onChange={(e) => setS({ apiKey: e.target.value.trim() })}
            />
            <button
              type="button"
              className="field-eye"
              onClick={() => setShowKey((v) => !v)}
              aria-label={showKey ? '隐藏' : '显示'}
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>

        <label className="field">
          <span className="field-label">API 地址(可填代理地址)</span>
          <input
            className="field-input"
            type="text"
            placeholder="https://api.deepseek.com"
            autoComplete="off"
            value={s.baseUrl}
            onChange={(e) => setS({ baseUrl: e.target.value.trim() })}
          />
        </label>

        <label className="field">
          <span className="field-label">模型</span>
          <input
            className="field-input"
            type="text"
            placeholder="deepseek-chat"
            autoComplete="off"
            value={s.model}
            onChange={(e) => setS({ model: e.target.value.trim() })}
          />
        </label>

        <div className="settings-row-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onTest}
            disabled={testState === 'busy'}
          >
            {testState === 'busy' ? <Loader2 size={15} className="spin" /> : <CheckCircle2 size={15} />}
            测试连接
          </button>
          <a
            className="link"
            href="https://platform.deepseek.com/api_keys"
            target="_blank"
            rel="noreferrer"
          >
            获取 API Key ↗
          </a>
        </div>
        {testMsg && (
          <p className={`test-msg ${testState === 'ok' ? 'ok' : 'err'}`}>{testMsg}</p>
        )}
        <p className="settings-card-foot">
          <Info size={13} /> 若浏览器提示跨域(CORS)错误,可填写支持 CORS 的代理地址,或自建
          Cloudflare Worker 反向代理。
        </p>
      </section>

      {/* 外观 */}
      <section className="settings-card">
        <div className="settings-card-head">
          <div className="settings-card-title">
            <Palette size={16} />
            外观
          </div>
        </div>
        <div className="segmented">
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
              onClick={() => setS({ theme: o.key })}
            >
              {o.icon}
              {o.label}
            </button>
          ))}
        </div>
      </section>

      {/* 清单管理 */}
      <section className="settings-card">
        <div className="settings-card-head">
          <div className="settings-card-title">清单管理</div>
          <button type="button" className="btn btn-secondary sm" onClick={() => openListEditor()}>
            <Plus size={14} /> 新建清单
          </button>
        </div>
        {customLists.map((l) => (
          <div className="list-manage-row" key={l.id}>
            <span className="list-manage-icon" style={{ background: l.color }}>
              <ListIcon name={l.icon} size={15} />
            </span>
            <span className="list-manage-name">{l.name}</span>
            <span className="list-manage-count">
              {state.tasks.filter((t) => t.listId === l.id && !t.done).length} 个待办
            </span>
            <button
              type="button"
              className="icon-btn"
              aria-label={`编辑 ${l.name}`}
              onClick={() => openListEditor(l)}
            >
              <Pencil size={15} />
            </button>
          </div>
        ))}
        {customLists.length === 0 && (
          <p className="settings-card-foot">
            <Info size={13} /> 还没有自定义清单,点击右上角新建一个吧。
          </p>
        )}
      </section>

      {/* 数据 */}
      <section className="settings-card">
        <div className="settings-card-head">
          <div className="settings-card-title">
            <Database size={16} />
            数据
          </div>
        </div>
        <p className="settings-card-desc">
          所有数据都保存在本机浏览器(IndexedDB)中,离线也能使用。建议定期导出备份。
        </p>
        <div className="settings-row-actions">
          <button type="button" className="btn btn-secondary" onClick={onExport}>
            <Download size={15} /> 导出数据
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={15} /> 导入数据
          </button>
          <button
            type="button"
            className="btn btn-secondary danger-text"
            onClick={() => setConfirmClear(true)}
          >
            <Trash2 size={15} /> 清空数据
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

      {/* 应用 */}
      <section className="settings-card">
        <div className="settings-card-head">
          <div className="settings-card-title">
            <Smartphone size={16} />
            应用
          </div>
        </div>
        {installAvailable ? (
          <button type="button" className="btn btn-primary" onClick={onInstall}>
            <Smartphone size={15} /> 安装到主屏幕
          </button>
        ) : (
          <p className="settings-card-foot">
            <Info size={13} /> 安装方法:Chrome/Edge 浏览器菜单中选择「安装应用」;iPhone 请用
            Safari 打开后点击「分享 → 添加到主屏幕」。安装后即可全屏离线使用。
          </p>
        )}
        <p className="settings-card-foot version">拾光清单 TidyTodo v1.0.0 · PWA</p>
      </section>

      {/* 使用技巧 */}
      <section className="settings-card">
        <div className="settings-card-head">
          <div className="settings-card-title">快速录入技巧</div>
        </div>
        <ul className="tips-list">
          <li>
            <code>明天下午3点开会</code> 自动识别日期与时间
          </li>
          <li>
            <code>买牛奶 #购物 p1</code> 归入清单并设为最高优先级
          </li>
          <li>
            <code>每天8点喝药 @健康</code> 创建每日重复任务
          </li>
          <li>
            <code>每周五写周报</code> 自动排到最近的周五
          </li>
          <li>
            点击输入框右侧 <span className="tip-spark">✦</span> 可让 AI 帮你解析
          </li>
        </ul>
      </section>

      {confirmClear && (
        <Modal
          title="清空所有数据?"
          body="将删除全部任务与清单(API Key 等设置保留),且无法恢复。建议先导出备份。"
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

      {pendingImport && (
        <Modal
          title="导入数据?"
          body={`将用备份内容替换当前数据(${pendingImport.tasks.length} 个任务、${pendingImport.lists.length} 个清单)。`}
          confirmLabel="导入"
          onCancel={() => setPendingImport(null)}
          onConfirm={doImport}
        />
      )}
    </div>
  );
}

export function ListEditorModal({
  list,
  onClose,
}: {
  list?: TaskList;
  onClose: () => void;
}) {
  const { dispatch } = useApp();
  const { push } = useToast();
  const [name, setName] = useState(list?.name ?? '');
  const [color, setColor] = useState(list?.color ?? LIST_COLORS[0]);
  const [icon, setIcon] = useState(list?.icon ?? 'briefcase');
  const [confirmDel, setConfirmDel] = useState(false);

  const save = () => {
    const n = name.trim();
    if (!n) {
      push('请输入清单名称');
      return;
    }
    if (list) {
      dispatch({ type: 'updateList', id: list.id, patch: { name: n, color, icon } });
      push('清单已更新');
    } else {
      dispatch({ type: 'addList', list: { id: uid(), name: n, color, icon } });
      push(`已创建清单「${n}」`);
    }
    onClose();
  };

  const del = () => {
    if (!list) return;
    dispatch({ type: 'deleteList', id: list.id });
    push(`已删除清单「${list.name}」,任务已移入收件箱`);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3 className="modal-title">{list ? '编辑清单' : '新建清单'}</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭">
            <X size={17} />
          </button>
        </div>
        <div className="modal-body">
          <label className="field">
            <span className="field-label">名称</span>
            <input
              className="field-input"
              type="text"
              placeholder="例如:工作"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) save();
              }}
              autoFocus
            />
          </label>
          <div className="field">
            <span className="field-label">颜色</span>
            <div className="swatches">
              {LIST_COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  className={`swatch ${color === c ? 'active' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                  aria-label={`颜色 ${c}`}
                />
              ))}
            </div>
          </div>
          <div className="field">
            <span className="field-label">图标</span>
            <div className="swatches icons">
              {LIST_ICONS.map((ic) => (
                <button
                  type="button"
                  key={ic}
                  className={`swatch icon-swatch ${icon === ic ? 'active' : ''}`}
                  onClick={() => setIcon(ic)}
                  aria-label={`图标 ${ic}`}
                >
                  <ListIcon name={ic} size={17} />
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="modal-actions spread">
          <div>
            {list && !list.system && (
              <button type="button" className="btn btn-ghost danger-text" onClick={() => setConfirmDel(true)}>
                <Trash2 size={15} /> 删除
              </button>
            )}
          </div>
          <div className="modal-actions-right">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              取消
            </button>
            <button type="button" className="btn btn-primary" onClick={save}>
              保存
            </button>
          </div>
        </div>
        {confirmDel && (
          <Modal
            title={`删除清单「${list!.name}」?`}
            body="清单内的任务会移入收件箱,不会被删除。"
            confirmLabel="删除清单"
            danger
            onCancel={() => setConfirmDel(false)}
            onConfirm={del}
          />
        )}
      </div>
    </div>
  );
}
