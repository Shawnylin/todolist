import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'motion/react';
import {
  ArrowUp,
  CalendarDays,
  Check,
  KeyRound,
  MessageCircle,
  Plus,
  RotateCcw,
  Sparkles,
  Square,
  Trash2,
} from 'lucide-react';
import { hasAiKey } from '../ai';
import type { ChatMessage, ViewRoute } from '../types';
import { sortTasks, useApp } from '../store';
import { formatDueShort, uid } from '../utils/date';
import { requestPlanReply, planChanges } from '../utils/planChat';
import { SLOT_LABEL } from '../utils/slot';
import { Modal } from './Modal';
import { TaskRow } from './TaskRow';

export function PlanView({
  navigate,
  openDetail,
}: {
  navigate: (r: ViewRoute) => void;
  openDetail: (id: string) => void;
}) {
  const { state, dispatch } = useApp();
  const messages = state.conversation ?? [];
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const request = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const firstScroll = useRef(true);
  const reduced = useReducedMotion();
  const present = useIsPresent();
  const hasKey = hasAiKey(state.settings);
  const pending = sortTasks(state.tasks.filter((t) => !t.done));
  const message = (content: string, role: ChatMessage['role'] = 'assistant'): ChatMessage => ({
    id: uid(),
    role,
    content,
    createdAt: Date.now(),
  });
  const stop = () => {
    request.current?.abort();
    request.current = null;
    setBusy(false);
  };
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (!present && request.current) {
      stop();
      dispatch({
        type: 'chatMessage',
        message: {
          id: uid(),
          role: 'assistant',
          createdAt: Date.now(),
          content: '已离开聊天，本次请求已停止，没有修改计划。',
        },
      });
    }
  }, [present, dispatch]);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    el?.scrollTo({
      top: el.scrollHeight,
      behavior: reduced || firstScroll.current ? 'instant' : 'smooth',
    });
    firstScroll.current = false;
  }, [messages.length, busy, reduced]);

  const send = async (retryText?: string) => {
    const raw = (retryText ?? text).trim();
    if (!raw || request.current || !hasKey) return;
    const controller = new AbortController();
    request.current = controller;
    const snapshot = state;
    dispatch({ type: 'chatMessage', message: message(raw, 'user') });
    setText('');
    setBusy(true);
    try {
      const result = await requestPlanReply(snapshot, messages, raw, controller.signal);
      if (controller.signal.aborted) return;
      const changes = planChanges(snapshot, result.operations);
      dispatch({ type: 'applyPlan', changes, message: message(result.reply) });
    } catch (error) {
      if (controller.signal.aborted) return;
      dispatch({
        type: 'chatMessage',
        message: {
          ...message(error instanceof Error ? error.message : '暂时无法连接 AI，请重试。'),
          status: 'error',
        },
      });
    } finally {
      if (request.current === controller) {
        request.current = null;
        setBusy(false);
        inputRef.current?.focus();
      }
    }
  };
  const cancel = () => {
    stop();
    dispatch({ type: 'chatMessage', message: message('已停止，本次没有修改计划。') });
  };

  return (
    <div className="plan-chat-page">
      <header className="view-header">
        <div>
          <h1 className="view-title">计划</h1>
          <div className="view-subtitle">聊聊想做的事，接下来的安排交给我。</div>
        </div>
        <div className="view-header-actions">
          <button
            className="icon-btn plan-list-toggle"
            aria-label="查看计划列表"
            onClick={() => setListOpen(true)}
          >
            <CalendarDays size={19} />
          </button>
          <button
            className="icon-btn"
            aria-label="清空聊天记录"
            title="清空聊天记录"
            disabled={!messages.length || busy}
            onClick={() => setClearOpen(true)}
          >
            <Trash2 size={18} />
          </button>
        </div>
      </header>
      <div className="chat-workspace">
        <section className="chat-column" aria-label="AI 计划对话">
          <div
            className="chat-scroll"
            ref={scrollRef}
            role="log"
            aria-label="聊天记录"
            aria-live="polite"
          >
            {!messages.length && (
              <div className="chat-welcome">
                <span className="chat-avatar large">
                  <Sparkles size={30} />
                </span>
                <h2>一起，把日子安排好。</h2>
                <p>可以从一个想法开始，也可以随时调整已有计划。</p>
                <div className="chat-starters">
                  {[
                    '帮我安排明天的学习计划',
                    '把今天没完成的任务移到明天',
                    '看看我接下来有哪些安排',
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => {
                        setText(prompt);
                        inputRef.current?.focus();
                      }}
                    >
                      <MessageCircle size={16} />
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <AnimatePresence initial={false}>
              {messages.map((item, index) => (
                <motion.article
                  key={item.id}
                  className={`chat-message ${item.role}`}
                  initial={{ opacity: 0, y: reduced ? 0 : 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: reduced ? 0 : 0.22 }}
                >
                  {item.role === 'assistant' && (
                    <span className="chat-avatar">
                      <Sparkles size={17} />
                    </span>
                  )}
                  <div className="chat-message-body">
                    <div className={`chat-bubble ${item.status === 'error' ? 'chat-error' : ''}`}>
                      {item.content}
                    </div>
                    {!!item.changes?.length && (
                      <div className="chat-receipt">
                        <div className="receipt-heading">
                          <Check size={14} />
                          {item.status === 'undone'
                            ? '已撤销本次调整'
                            : `已同步 ${item.changes.length} 项变更`}
                        </div>
                        {item.changes.map((change) => (
                          <div className="receipt-item" key={change.id}>
                            <span>
                              {!change.before
                                ? '新增'
                                : !change.after
                                  ? '删除'
                                  : change.after.done !== change.before.done
                                    ? change.after.done
                                      ? '完成'
                                      : '恢复'
                                    : '更新'}
                            </span>
                            <strong>{(change.after ?? change.before)!.title}</strong>
                            <small>
                              {change.after?.due ? formatDueShort(change.after.due) : ''}
                              {change.after?.slot ? ` · ${SLOT_LABEL[change.after.slot]}` : ''}
                              {change.after?.dueTime ? ` ${change.after.dueTime}` : ''}
                            </small>
                          </div>
                        ))}
                        {item.status === 'applied' && (
                          <button
                            className="receipt-undo"
                            onClick={() => dispatch({ type: 'undoPlan', id: item.id })}
                          >
                            <RotateCcw size={13} />
                            撤销本次操作
                          </button>
                        )}
                      </div>
                    )}
                    {item.status === 'error' && index === messages.length - 1 && !busy && (
                      <button
                        className="receipt-undo"
                        onClick={() => {
                          const previous = messages
                            .slice(0, index)
                            .reverse()
                            .find((m) => m.role === 'user');
                          if (previous) void send(previous.content);
                        }}
                      >
                        <RotateCcw size={13} />
                        重试
                      </button>
                    )}
                  </div>
                </motion.article>
              ))}
            </AnimatePresence>
            {busy && (
              <div className="chat-thinking" role="status">
                <Sparkles size={16} />
                <span>正在思考与整理计划</span>
                <i />
                <i />
                <i />
              </div>
            )}
          </div>
          {!hasKey && (
            <button className="chat-config" onClick={() => navigate({ view: 'settings' })}>
              <KeyRound size={16} />
              <span>连接 AI 助手，开始聊天安排计划</span>
              <span>去设置 →</span>
            </button>
          )}
          <form
            className="chat-composer"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <textarea
              ref={inputRef}
              rows={2}
              aria-label="发送给计划助手"
              placeholder={hasKey ? '说说你的安排，或让我调整已有任务…' : '先在设置中连接 AI 助手'}
              value={text}
              maxLength={6000}
              disabled={!hasKey}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === 'Enter' &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing &&
                  window.matchMedia('(min-width: 960px)').matches
                ) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <div className="composer-bottom">
              <span>
                {busy ? '操作完成后会同步到计划列表' : '可新增、改期、完成或删除 · 操作可撤销'}
              </span>
              {busy ? (
                <button type="button" className="chat-send" aria-label="停止生成" onClick={cancel}>
                  <Square size={17} fill="currentColor" />
                </button>
              ) : (
                <button
                  type="submit"
                  className="chat-send"
                  aria-label="发送消息"
                  disabled={!hasKey || !text.trim()}
                >
                  <ArrowUp size={21} />
                </button>
              )}
            </div>
          </form>
          <p className="chat-footnote">
            聊天记录保存在本机；发送时会携带近期对话和当前任务给设置中的 AI 服务。
          </p>
        </section>
        <aside className="chat-plan-list">
          <div className="chat-plan-head">
            <h2>
              <CalendarDays size={18} />
              计划列表
            </h2>
            <span>{pending.length} 件待办</span>
          </div>
          <p className="chat-plan-hint">与「今天」实时同步，也可以点开任务手动调整。</p>
          <div className="chat-plan-items">
            <AnimatePresence initial={false}>
              {pending.map((task) => (
                <TaskRow key={task.id} task={task} showSlot onOpen={() => openDetail(task.id)} />
              ))}
            </AnimatePresence>
            {!pending.length && (
              <div className="chat-list-empty">
                <Plus size={26} />
                <p>还没有待办计划</p>
                <span>发一句话，开始新的安排。</span>
              </div>
            )}
          </div>
        </aside>
      </div>
      <AnimatePresence>
        {clearOpen && (
          <Modal
            key="clear-chat"
            title="清空聊天记录？"
            body="聊天记录与操作回执将清除，已安排的任务会保留。"
            onCancel={() => setClearOpen(false)}
            onConfirm={() => {
              dispatch({ type: 'clearChat' });
              setClearOpen(false);
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {listOpen && (
          <Modal
            key="plan-list"
            title="计划列表"
            confirmLabel="完成"
            onCancel={() => setListOpen(false)}
            onConfirm={() => setListOpen(false)}
            body={
              <div className="mobile-plan-items">
                {pending.length
                  ? pending.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        showSlot
                        onOpen={() => {
                          setListOpen(false);
                          openDetail(task.id);
                        }}
                      />
                    ))
                  : '还没有待办计划，试着让 AI 添加一件事。'}
              </div>
            }
          />
        )}
      </AnimatePresence>
    </div>
  );
}
