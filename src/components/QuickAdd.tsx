import { useMemo, useRef, useState } from 'react';
import { Loader2, Plus, Sparkles } from 'lucide-react';
import type { ParsedInput } from '../types';
import { aiParseTask, hasAiKey, mergeParse } from '../ai';
import { buildTask, useApp } from '../store';
import { parseInput } from '../utils/parse';
import { formatDueShort, repeatLabel } from '../utils/date';
import { useToast } from './Toast';

function previewChips(p: ParsedInput): string[] {
  const chips: string[] = [];
  if (p.due) chips.push(`${formatDueShort(p.due)}${p.dueTime ? ' ' + p.dueTime : ''}`);
  if (p.priority) chips.push(`P${p.priority} 优先`);
  if (p.listName) chips.push(`#${p.listName}`);
  if (p.repeat) chips.push(repeatLabel(p.repeat));
  for (const t of p.tags) chips.push(`@${t}`);
  return chips;
}

export function QuickAdd({ listId }: { listId: string }) {
  const { state, dispatch } = useApp();
  const { push } = useToast();
  const [value, setValue] = useState('');
  const [aiExtra, setAiExtra] = useState<Partial<ParsedInput> | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => (value.trim() ? parseInput(value.trim()) : null), [value]);
  const merged = parsed && aiExtra ? mergeParse(parsed, aiExtra) : parsed;
  const chips = merged ? previewChips(merged) : [];
  const list = state.lists.find((l) => l.id === listId);

  const submit = () => {
    const p = merged;
    if (!p || !p.title) return;
    dispatch({ type: 'addTask', task: buildTask(value.trim(), p, state.lists, listId) });
    push(`已添加:${p.title}`);
    setValue('');
    setAiExtra(null);
    inputRef.current?.focus();
  };

  const onAi = async () => {
    if (!value.trim()) {
      push('先输入任务内容,再让 AI 帮你解析');
      return;
    }
    if (!hasAiKey(state.settings)) {
      push('请先在「设置 → AI 助手」填写 DeepSeek API Key');
      return;
    }
    setBusy(true);
    try {
      const ai = await aiParseTask(state.settings, value.trim());
      setAiExtra(ai);
      push('AI 解析完成,按回车添加');
    } catch (e) {
      push(e instanceof Error ? e.message : 'AI 解析失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`quick-add ${chips.length ? 'has-chips' : ''}`}>
      <div className="quick-add-row">
        <span className="quick-add-plus">
          <Plus size={17} />
        </span>
        <input
          ref={inputRef}
          className="quick-add-input"
          type="text"
          enterKeyHint="done"
          value={value}
          placeholder={`添加任务,如:明天下午3点开会 #${list?.name ?? '收件箱'} p1`}
          onChange={(e) => {
            setValue(e.target.value);
            setAiExtra(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
        />
        {hasAiKey(state.settings) && (
          <button
            type="button"
            className={`quick-add-ai ${busy ? 'busy' : ''}`}
            title="AI 智能解析"
            aria-label="AI 智能解析"
            onClick={onAi}
            disabled={busy}
          >
            {busy ? <Loader2 size={17} className="spin" /> : <Sparkles size={17} />}
          </button>
        )}
      </div>
      {chips.length > 0 && (
        <div className="quick-add-chips">
          {chips.map((c, i) => (
            <span className="chip" key={i}>
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
