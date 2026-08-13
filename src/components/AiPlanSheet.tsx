import { useEffect, useState } from 'react';
import { AlertTriangle, Flag, Loader2, Sparkles, X } from 'lucide-react';
import type { AiPlanItem } from '../types';
import { aiTodayPlan } from '../ai';
import { useApp } from '../store';
import { todayISO } from '../utils/date';
import { useToast } from './Toast';

const PRIORITY_COLOR: Record<number, string> = { 1: '#E5484D', 2: '#F76B15', 3: '#2F6FEB' };

export function AiPlanSheet({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useApp();
  const { push } = useToast();
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  const [err, setErr] = useState('');
  const [plan, setPlan] = useState<AiPlanItem[]>([]);
  const [applied, setApplied] = useState<Set<number>>(new Set());

  useEffect(() => {
    let alive = true;
    const today = todayISO();
    const targets = state.tasks.filter((t) => !t.done && t.due && t.due <= today);
    aiTodayPlan(state.settings, targets)
      .then((p) => {
        if (!alive) return;
        setPlan(p);
        setStatus('ready');
      })
      .catch((e) => {
        if (!alive) return;
        setErr(e instanceof Error ? e.message : '生成失败');
        setStatus('error');
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apply = (item: AiPlanItem, idx: number) => {
    const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();
    const t = state.tasks.find(
      (x) =>
        !x.done && (norm(x.title) === norm(item.title) ||
          (item.title.length >= 4 && (norm(x.title).includes(norm(item.title)) || norm(item.title).includes(norm(x.title))))),
    );
    if (!t) {
      push(`未找到对应任务:「${item.title}」`);
      return;
    }
    dispatch({ type: 'updateTask', id: t.id, patch: { priority: item.priority } });
    setApplied((prev) => new Set(prev).add(idx));
    push(`已将「${t.title}」设为 P${item.priority}`);
  };

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet ai-sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <div className="ai-sheet-title">
            <Sparkles size={17} />
            今日计划 · AI 建议
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </div>
        <div className="sheet-scroll">
          {status === 'loading' && (
            <div className="ai-loading">
              <Loader2 size={26} className="spin" />
              <p>DeepSeek 正在分析你的今日待办…</p>
            </div>
          )}
          {status === 'error' && (
            <div className="ai-loading">
              <AlertTriangle size={26} />
              <p>{err}</p>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                关闭
              </button>
            </div>
          )}
          {status === 'ready' && (
            <>
              {plan.length === 0 && (
                <p className="ai-empty-tip">AI 暂时没有给出建议,今天没有带日期的待办时先添加几个吧。</p>
              )}
              {plan.map((item, i) => (
                <div className="plan-item" key={i}>
                  <div className="plan-index">{i + 1}</div>
                  <div className="plan-main">
                    <div className="plan-title-row">
                      <span className="plan-title">{item.title}</span>
                      {item.priority > 0 && (
                        <span className="plan-priority" style={{ color: PRIORITY_COLOR[item.priority] }}>
                          <Flag size={13} fill="currentColor" />
                          P{item.priority}
                        </span>
                      )}
                    </div>
                    <p className="plan-reason">{item.reason}</p>
                  </div>
                  <button
                    type="button"
                    className={`btn sm ${applied.has(i) ? 'btn-applied' : 'btn-secondary'}`}
                    onClick={() => apply(item, i)}
                    disabled={applied.has(i)}
                  >
                    {applied.has(i) ? '已应用' : '应用'}
                  </button>
                </div>
              ))}
              <p className="ai-disclaimer">建议由 DeepSeek 生成,仅供参考。</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
