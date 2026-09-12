import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
} from 'react';
import type { AppState, ChatMessage, ParsedInput, Settings, Task, TaskChange, TaskList, TimeSlot } from './types';
import { DEFAULT_SETTINGS, INBOX_ID } from './types';
import { loadAll, saveAll } from './db';
import { nextDueISO, uid } from './utils/date';

export type Action =
  | { type: 'chatMessage'; message: ChatMessage }
  | { type: 'clearChat' }
  | { type: 'applyPlan'; changes: TaskChange[]; message: ChatMessage }
  | { type: 'undoPlan'; id: string }
  | { type: 'hydrate'; state: AppState }
  | { type: 'addTask'; task: Task }
  | { type: 'updateTask'; id: string; patch: Partial<Task> }
  | { type: 'deleteTask'; id: string }
  | { type: 'undoDelete'; id: string }
  | { type: 'toggleTask'; id: string }
  | { type: 'toggleSubtask'; id: string; subId: string }
  | { type: 'addList'; list: TaskList }
  | { type: 'updateList'; id: string; patch: Partial<TaskList> }
  | { type: 'deleteList'; id: string }
  | { type: 'setSettings'; patch: Partial<Settings> }
  | { type: 'replaceAll'; tasks: Task[]; lists: TaskList[] }
  | { type: 'wipeData' };

interface InternalState extends AppState {
  hydrated: boolean;
  undo?: Task[];
}

const initial: InternalState = {
  tasks: [],
  lists: [],
  settings: DEFAULT_SETTINGS,
  hydrated: false,
};

function inboxList(): TaskList {
  return { id: INBOX_ID, name: '收件箱', color: '#6E56CF', icon: 'inbox', system: true };
}

export function reducer(state: InternalState, action: Action): InternalState {
  switch (action.type) {
    case 'chatMessage':
      return { ...state, conversation: [...(state.conversation ?? []), action.message] };
    case 'clearChat':
      return { ...state, conversation: [] };
    case 'applyPlan': {
      const conflict = action.changes.some((c) => JSON.stringify(state.tasks.find((t) => t.id === c.id)) !== JSON.stringify(c.before) || (c.after && !state.lists.some((list) => list.id === c.after!.listId)));
      if (conflict) return reducer(state, { type: 'chatMessage', message: { ...action.message, content: '相关任务刚刚发生了变化，这次操作没有执行。请重新告诉我需要怎样调整。', status: 'error', changes: undefined } });
      const ids = new Set(action.changes.map((c) => c.id));
      return { ...state, tasks: [...state.tasks.filter((t) => !ids.has(t.id)), ...action.changes.flatMap((c) => c.after ? [c.after] : [])], conversation: [...(state.conversation ?? []), { ...action.message, status: action.changes.length ? 'applied' : undefined, changes: action.changes }] };
    }
    case 'undoPlan': {
      const message = state.conversation?.find((m) => m.id === action.id);
      if (!message || message.status !== 'applied' || !message.changes?.length) return state;
      if (message.changes.some((c) => JSON.stringify(state.tasks.find((t) => t.id === c.id)) !== JSON.stringify(c.after))) {
        return reducer(state, { type: 'chatMessage', message: { id: uid(), role: 'assistant', createdAt: Date.now(), content: '这些任务已有后续修改，无法直接撤销。你可以告诉我需要恢复哪一项。', status: 'error' } });
      }
      const ids = new Set(message.changes.map((c) => c.id));
      return { ...state, tasks: [...state.tasks.filter((t) => !ids.has(t.id)), ...message.changes.flatMap((c) => c.before ? [c.before] : [])], conversation: state.conversation?.map((m) => m.id === message.id ? { ...m, status: 'undone' } : m) };
    }
    case 'hydrate':
      return { ...action.state, hydrated: true };
    case 'addTask':
      return { ...state, tasks: [...state.tasks, action.task] };
    case 'updateTask':
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === action.id ? { ...t, ...action.patch } : t)),
      };
    case 'deleteTask': {
      const task = state.tasks.find((t) => t.id === action.id);
      return {
        ...state,
        tasks: state.tasks.filter((t) => t.id !== action.id),
        undo: task ? [...(state.undo ?? []).slice(-19), task] : state.undo,
      };
    }
    case 'undoDelete': {
      const task = state.undo?.find((t) => t.id === action.id);
      if (!task || state.tasks.some((t) => t.id === task.id)) return state;
      return { ...state, tasks: [...state.tasks, task], undo: state.undo?.filter((t) => t.id !== action.id) };
    }
    case 'toggleTask': {
      const task = state.tasks.find((t) => t.id === action.id);
      if (!task) return state;
      let tasks = state.tasks.map((t) =>
        t.id === action.id
          ? { ...t, done: !t.done, completedAt: !t.done ? Date.now() : undefined }
          : t,
      );
      if (!task.done && task.repeat && !task.nextOccurrenceId) {
        const next: Task = {
          ...task,
          id: uid(),
          done: false,
          completedAt: undefined,
          createdAt: Date.now(),
          due: nextDueISO(task.due, task.repeat),
          subtasks: task.subtasks.map((s) => ({ ...s, id: uid(), done: false })),
          nextOccurrenceId: undefined,
        };
        tasks = tasks.map((t) => t.id === task.id ? { ...t, nextOccurrenceId: next.id } : t);
        tasks = [...tasks, next];
      }
      return { ...state, tasks };
    }
    case 'toggleSubtask':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.id
            ? {
                ...t,
                subtasks: t.subtasks.map((s) =>
                  s.id === action.subId ? { ...s, done: !s.done } : s,
                ),
              }
            : t,
        ),
      };
    case 'addList':
      return { ...state, lists: [...state.lists, action.list] };
    case 'updateList':
      return {
        ...state,
        lists: state.lists.map((l) => (l.id === action.id ? { ...l, ...action.patch } : l)),
      };
    case 'deleteList': {
      const target = state.lists.find((l) => l.id === action.id);
      if (!target || target.system) return state;
      const inbox = state.lists.find((l) => l.id === INBOX_ID) ?? inboxList();
      return {
        ...state,
        lists: state.lists.filter((l) => l.id !== action.id),
        tasks: state.tasks.map((t) => (t.listId === action.id ? { ...t, listId: inbox.id } : t)),
      };
    }
    case 'setSettings':
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case 'replaceAll':
      return { ...state, tasks: action.tasks, lists: action.lists, undo: undefined, conversation: [] };
    case 'wipeData':
      return { ...state, tasks: [], lists: [inboxList()], undo: undefined, conversation: [] };
    default:
      return state;
  }
}

interface Ctx {
  state: AppState;
  hydrated: boolean;
  dispatch: Dispatch<Action>;
  storageError: string | null;
}

const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const hydrated = useRef(false);
  const [storageError, setStorageError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadAll().then((s) => {
      if (!alive) return;
      // 旧版本默认模型迁移:deepseek-chat 已停用 → deepseek-v4-flash
      if (!s.settings.model || s.settings.model === 'deepseek-chat') {
        s.settings.model = 'deepseek-v4-flash';
      }
      hydrated.current = true;
      dispatch({ type: 'hydrate', state: s });
    }).catch(() => {
      if (alive) setStorageError('无法读取本机数据，请检查浏览器存储权限后刷新。');
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    void saveAll({ tasks: state.tasks, lists: state.lists, settings: state.settings, conversation: state.conversation })
      .then(() => setStorageError(null))
      .catch(() => setStorageError('本次更改未能保存，请及时在设置中导出备份。'));
  }, [state]);

  // 主题跟随系统
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const mode = state.settings.theme;
      const dark = mode === 'dark' || (mode === 'system' && mq.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [state.settings.theme]);

  return (
    <StoreCtx.Provider value={{ state, hydrated: state.hydrated, dispatch, storageError }}>
      {children}
    </StoreCtx.Provider>
  );
}

export function useApp(): Ctx {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error('useApp must be used within StoreProvider');
  return ctx;
}

/** 由解析结果构造任务对象 */
export function buildTask(
  titleFallback: string,
  parsed: ParsedInput,
  lists: TaskList[],
  defaultListId: string,
  slot?: TimeSlot,
): Task {
  let listId = defaultListId;
  if (parsed.listName) {
    const found = lists.find(
      (l) => l.name === parsed.listName || l.name.toLowerCase() === parsed.listName!.toLowerCase(),
    );
    if (found) listId = found.id;
  }
  const inbox = lists.find((l) => l.id === INBOX_ID);
  if (!lists.some((l) => l.id === listId)) listId = inbox?.id ?? INBOX_ID;
  return {
    id: uid(),
    title: parsed.title || titleFallback,
    notes: '',
    listId,
    priority: parsed.priority,
    due: parsed.due,
    dueTime: parsed.dueTime,
    slot,
    tags: parsed.tags,
    subtasks: [],
    repeat: parsed.repeat,
    done: false,
    createdAt: Date.now(),
  };
}

/** 列表内排序:未完成在前,按优先级 → 到期日 → 时间 → 创建时间 */
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.priority !== b.priority) {
      if (a.priority === 0) return 1;
      if (b.priority === 0) return -1;
      return a.priority - b.priority;
    }
    const da = a.due ?? '9999-12-31';
    const db = b.due ?? '9999-12-31';
    if (da !== db) return da < db ? -1 : 1;
    const ta = a.dueTime ?? '99:99';
    const tb = b.dueTime ?? '99:99';
    if (ta !== tb) return ta < tb ? -1 : 1;
    return a.createdAt - b.createdAt;
  });
}

export function pendingCount(tasks: Task[]): number {
  return tasks.filter((t) => !t.done).length;
}
