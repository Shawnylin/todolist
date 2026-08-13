import { useRef, useState } from 'react';
import { ArrowRight, KeyRound, Loader2, Plus, Sparkles, X } from 'lucide-react';
import type { AiPlanTask, TimeSlot, ViewRoute } from '../types';
import { INBOX_ID } from '../types';
import { aiParseTasks, hasAiKey } from '../ai';
import { buildTask, useApp } from '../store';
import { splitPlanInput } from '../utils/planSplit';
import { todayISO, uid } from '../utils/date';
import { SLOT_LABEL, SLOT_ORDER } from '../utils/slot';
import { useToast } from './Toast';

interface PlanItem {
  id: string;
  title: string;
  slot: TimeSlot;
  priority: 0 | 1 | 2 | 3;
  listName?: string;
  notes?: string;
}

interface Props {
  navigate: (r: ViewRoute) => void;
}

const SLOT_SHORT: Record<TimeSlot, string> = { morning: '早', afternoon: '午', evening: '晚' };

export function PlanView({ navigate }: Props) {
  const { state, dispatch } = useApp();
  const { push } = useToast();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<PlanItem[]>([]);
  const [source, setSource] = useState<'ai' | 'local' | null>(null);
  const [lastAdded, setLastAdded] = useState(0);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const hasKey = hasAiKey(state.settings);

  const generate = async () => {
    const raw = text.trim();
    if (!raw || busy) return;
    setBusy(true);
    try {
      if (hasKey) {
        try {
          const ai = await aiParseTasks(state.settings, raw);
          setItems(
            ai.map((t: AiPlanTask) => ({
              id: uid(),
              title: t.title,
              slot: t.slot,
              priority: t.priority,
              listName: t.listName,
              notes: t.notes,
            })),
          );
          setSource('ai');
          return;
        } catch (e) {
          push(e instanceof Error ? e.message : 'AI 解析失败,已改用本地拆分');
        }
      }
      const local = splitPlanInput(raw);
      if (!local.length) {
        push('没有识别出任务,请用逗号或「然后」分隔多个任务');
        return;
      }
      setItems(local.map((l) => ({ id: uid(), title: l.title, slot: l.slot, priority: 0 })));
      setSource('local');
    } finally {
      setBusy(false);
    }
  };

  const addAll = () => {
    if (!items.length) return;
    const today = todayISO();
    let n = 0;
    for (const it of items) {
      const title = it.title.trim();
      if (!title) continue;
      const task = buildTask(
        title,
        {
          title,
          due: today,
          priority: it.priority,
          listName: it.listName,
          tags: [],
        },
        state.lists,
        INBOX_ID,
        it.slot,
      );
      if (it.notes) task.notes = it.notes;
      dispatch({ type: 'addTask', task });
      n++;
    }
    setLastAdded(n);
    setItems([]);
    setText('');
    push(`已把 ${n} 个任务添加到今天`);
  };

  const updateItem = (id: string, patch: Partial<PlanItem>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const removeItem = (id: string) => setItems((prev) => prev.filter((it) => it.id !== id));

  return (
    <div className="task-view plan-view">
      <header className="view-header">
        <div className="view-header-text">
          <h1 className="view-title">计划</h1>
          <div className="view-subtitle">一句话描述今天的安排,AI 帮你拆成任务</div>
        </div>
      </header>

      <div className="plan-input-card">
        <textarea
          ref={taRef}
          className="plan-textarea"
          rows={3}
          placeholder={'例如:\n首先写言语理解,然后写资料分析,然后写政治理论\n或者:上午开会,下午写方案,晚上健身'}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setLastAdded(0);
          }}
        />
        <div className="plan-actions">
          {!hasKey && (
            <button type="button" className="plan-key-hint" onClick={() => navigate({ view: 'settings' })}>
              <KeyRound size={13} />
              未配置 AI,将用本地规则拆分 · 去配置
            </button>
          )}
          <button
            type="button"
            className="btn btn-ai"
            disabled={busy || !text.trim()}
            onClick={generate}
          >
            {busy ? (
              <>
                <Loader2 size={15} className="spin" /> {hasKey ? 'AI 解析中…' : '拆分中…'}
              </>
            ) : (
              <>
                <Sparkles size={15} /> {hasKey ? '生成今日计划' : '拆分任务'}
              </>
            )}
          </button>
        </div>
      </div>

      {items.length > 0 && (
        <div className="plan-results">
          <div className="plan-results-head">
            <span>
              {source === 'ai' ? '✨ DeepSeek 解析结果' : '本地拆分结果'} · {items.length} 个任务
            </span>
            <button type="button" className="btn btn-ghost sm" onClick={() => setItems([])}>
              清空
            </button>
          </div>
          {items.map((it) => (
            <div className="plan-item-row" key={it.id}>
              <div className="slot-seg">
                {SLOT_ORDER.map((s) => (
                  <button
                    type="button"
                    key={s}
                    className={`slot-seg-btn ${it.slot === s ? 'active' : ''}`}
                    onClick={() => updateItem(it.id, { slot: s })}
                    aria-label={SLOT_LABEL[s]}
                  >
                    {SLOT_SHORT[s]}
                  </button>
                ))}
              </div>
              <input
                type="text"
                className="plan-item-input"
                value={it.title}
                onChange={(e) => updateItem(it.id, { title: e.target.value })}
              />
              <button
                type="button"
                className="icon-btn subtle"
                aria-label="移除"
                onClick={() => removeItem(it.id)}
              >
                <X size={14} />
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-primary btn-block" onClick={addAll}>
            <Plus size={15} /> 添加到今天 · {items.filter((i) => i.title.trim()).length} 项
          </button>
        </div>
      )}

      {lastAdded > 0 && items.length === 0 && (
        <div className="plan-done-tip">
          已添加 {lastAdded} 个任务
          <button type="button" className="link" onClick={() => navigate({ view: 'today' })}>
            去今日查看 <ArrowRight size={13} />
          </button>
        </div>
      )}

      {!busy && !items.length && !lastAdded && (
        <div className="plan-examples">
          <div className="plan-examples-title">试试这些说法</div>
          <button type="button" className="plan-example" onClick={() => setText('首先写言语理解,然后写资料分析,然后写政治理论')}>
            “首先写言语理解,然后写资料分析,然后写政治理论”
          </button>
          <button type="button" className="plan-example" onClick={() => setText('上午写周报,下午3点开会,晚上健身')}>
            “上午写周报,下午3点开会,晚上健身”
          </button>
        </div>
      )}
    </div>
  );
}
