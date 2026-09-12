import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Eye, EyeOff, KeyRound, Loader2, Plus, Trash2 } from 'lucide-react';
import { fetchModels } from '../ai';
import type { AiProfile } from '../types';
import { useApp } from '../store';
import { activeAi } from '../utils/preferences';
import { uid } from '../utils/date';
import { Expand } from './Motion';

export function AiSettings() {
  const { state, dispatch } = useApp();
  const s = state.settings;
  const profiles = s.aiProfiles ?? [activeAi(s)];
  const current = activeAi(s);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(current.id);
  const save = (items: AiProfile[], id = s.activeAiProfileId) => {
    const chosen = items.find((p) => p.id === id) ?? items[0];
    dispatch({
      type: 'setSettings',
      patch: {
        aiProfiles: items,
        activeAiProfileId: chosen?.id,
        apiKey: chosen?.apiKey ?? '',
        baseUrl: chosen?.baseUrl ?? 'https://api.openai.com/v1',
        model: chosen?.model ?? '',
      },
    });
  };
  return (
    <section className="settings-card ai-settings">
      <button
        type="button"
        className="settings-entry"
        aria-expanded={open}
        aria-controls="ai-configurations"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="settings-entry-icon">
          <KeyRound size={21} />
        </span>
        <span>
          <strong>AI 配置</strong>
          <small>
            {profiles.length
              ? `${current.name} · ${current.model || '未选择模型'}`
              : '添加 API 地址、密钥与模型'}
          </small>
        </span>
        <ChevronDown size={18} className={open ? 'chevron open' : 'chevron'} />
      </button>
      <Expand open={open}>
        <div id="ai-configurations" className="ai-configurations">
          <p className="settings-card-desc">
            支持 OpenAI 兼容接口。密钥保存在本机，仅发送至对应配置的 API 地址，不包含在数据导出中。
          </p>
          {profiles.map((profile) => (
            <div
              className={`ai-profile ${profile.id === current.id ? 'selected' : ''}`}
              key={profile.id}
            >
              <div className="ai-profile-head">
                <button
                  type="button"
                  className="profile-select"
                  aria-label={`启用 ${profile.name}`}
                  aria-pressed={profile.id === current.id}
                  onClick={() => save(profiles, profile.id)}
                >
                  {profile.id === current.id && <Check size={13} />}
                </button>
                <button
                  type="button"
                  className="profile-name"
                  aria-expanded={editing === profile.id}
                  onClick={() => setEditing((id) => (id === profile.id ? null : profile.id))}
                >
                  <strong>{profile.name || '未命名配置'}</strong>
                  <small>{profile.id === current.id ? '当前使用' : '点击编辑'}</small>
                  <ChevronDown size={16} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`删除配置 ${profile.name}`}
                  onClick={() => save(profiles.filter((p) => p.id !== profile.id))}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <Expand open={editing === profile.id}>
                <ProfileEditor
                  profile={profile}
                  onChange={(patch) =>
                    save(profiles.map((p) => (p.id === profile.id ? { ...p, ...patch } : p)))
                  }
                />
              </Expand>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              const profile = {
                id: uid(),
                name: `配置 ${profiles.length + 1}`,
                apiKey: '',
                baseUrl: 'https://api.openai.com/v1',
                model: '',
              };
              save([...profiles, profile], profiles.length ? current.id : profile.id);
              setEditing(profile.id);
            }}
          >
            <Plus size={16} />
            添加配置
          </button>
        </div>
      </Expand>
    </section>
  );
}

function ProfileEditor({
  profile,
  onChange,
}: {
  profile: AiProfile;
  onChange: (patch: Partial<AiProfile>) => void;
}) {
  const { state } = useApp();
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const controller = useRef<AbortController | null>(null);
  const latest = useRef({ profile, onChange });
  latest.current = { profile, onChange };
  useEffect(() => {
    setModels([]);
    setFeedback('');
    return () => controller.current?.abort();
  }, [profile.apiKey, profile.baseUrl]);
  const load = async () => {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    setFeedback('');
    try {
      const result = await fetchModels(
        { ...state.settings, ...profile, aiProfiles: [profile], activeAiProfileId: profile.id },
        request.signal,
      );
      if (request.signal.aborted) return;
      setModels(result);
      setFeedback(`已获取 ${result.length} 个模型`);
      if (!latest.current.profile.model) latest.current.onChange({ model: result[0] });
    } catch (error) {
      if (!request.signal.aborted)
        setFeedback(error instanceof Error ? error.message : '获取模型失败');
    } finally {
      if (controller.current === request) setBusy(false);
    }
  };
  return (
    <div className="profile-editor">
      <label className="field">
        <span className="field-label">配置名称</span>
        <input
          className="field-input"
          value={profile.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </label>
      <label className="field">
        <span className="field-label">API 地址</span>
        <input
          className="field-input"
          type="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="https://api.openai.com/v1"
          value={profile.baseUrl}
          onChange={(e) => onChange({ baseUrl: e.target.value.trim() })}
        />
      </label>
      <label className="field">
        <span className="field-label">API Key</span>
        <div className="field-input-wrap">
          <input
            className="field-input"
            type={showKey ? 'text' : 'password'}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="填写此服务的 API Key"
            value={profile.apiKey}
            onChange={(e) => onChange({ apiKey: e.target.value.trim() })}
          />
          <button
            type="button"
            className="field-eye"
            aria-label={showKey ? '隐藏密钥' : '显示密钥'}
            onClick={() => setShowKey((v) => !v)}
          >
            {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </label>
      <div className="model-fetch-row">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy || !profile.apiKey || !profile.baseUrl}
          onClick={() => void load()}
        >
          {busy ? <Loader2 size={15} className="spin" /> : <Plus size={15} />}获取模型
        </button>
        <span role="status">{feedback}</span>
      </div>
      {!!models.length && (
        <label className="field">
          <span className="field-label">选择模型</span>
          <select
            className="field-input"
            value={profile.model}
            onChange={(e) => onChange({ model: e.target.value })}
          >
            {!models.includes(profile.model) && (
              <option value={profile.model}>{profile.model || '选择一个模型'}</option>
            )}
            {models.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="field">
        <span className="field-label">模型名称（可手动输入）</span>
        <input
          className="field-input"
          autoCapitalize="none"
          spellCheck={false}
          value={profile.model}
          placeholder="选择或填写模型 ID"
          onChange={(e) => onChange({ model: e.target.value.trim() })}
        />
      </label>
    </div>
  );
}
