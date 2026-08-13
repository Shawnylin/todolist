import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useRef,
  type Dispatch,
  type ReactNode,
} from 'react';
import type { AppState, ParsedInput, Settings, Task, TaskList, TimeSlot } from './types';
import { DEFAULT_SETTINGS, INBOX_ID } from './types';
import { loadAll, saveAll } from './db';
import { nextDueISO, uid } from './utils/date';

export type Action =
  | { type: 'hydrate'; state: AppState }
  | { type: 'addTask'; task: Task }
  | { type: 'updateTask'; id: string; patch: Partial<Task> }
  | { type: 'deleteTask'; id: string }
  | { type: 'undoDelete' }
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
  undo?: Task;
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

function reducer(state: InternalState, action: Action): InternalState {
  switch (action.type) {
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
        undo: task,
      };
    }
    case 'undoDelete': {
      if (!state.undo) return state;
      return { ...state, tasks: [...state.tasks, state.undo], undo: undefined };
    }
    case 'toggleTask': {
      const task = state.tasks.find((t) => t.id === action.id);
      if (!task) return state;
      let tasks = state.tasks.map((t) =>
        t.id === action.id
          ? { ...t, done: !t.done, completedAt: !t.done ? Date.now() : undefined }
          : t,
      );
      if (!task.done && task.repeat) {
        const next: Task = {
          ...task,
          id: uid(),
          done: false,
          completedAt: undefined,
          createdAt: Date.now(),
          due: nextDueISO(task.due, task.repeat),
        };
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
      return { ...state, tasks: action.tasks, lists: action.lists };
    case 'wipeData':
      return { ...state, tasks: [], lists: [inboxList()] };
    default:
      return state;
  }
}

interface Ctx {
  state: AppState;
  hydrated: boolean;
  dispatch: Dispatch<Action>;
}

const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const hydrated = useRef(false);

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
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    const t = setTimeout(() => {
      void saveAll({ tasks: state.tasks, lists: state.lists, settings: state.settings });
    }, 250);
    return () => clearTimeout(t);
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
    <StoreCtx.Provider value={{ state, hydrated: state.hydrated, dispatch }}>
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
