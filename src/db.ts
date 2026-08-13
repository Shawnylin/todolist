import { openDB, type IDBPDatabase } from 'idb';
import type { AppState, Settings, Task, TaskList } from './types';
import { DEFAULT_SETTINGS, INBOX_ID } from './types';

const DB_NAME = 'tidy-todo-db';
const DB_VERSION = 1;
const STORE = 'kv';

let dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(d) {
        d.createObjectStore(STORE);
      },
    });
  }
  return dbPromise;
}

const DEFAULT_INBOX: TaskList = {
  id: INBOX_ID,
  name: '收件箱',
  color: '#6E56CF',
  icon: 'inbox',
  system: true,
};

export async function loadAll(): Promise<AppState> {
  const d = await db();
  const tx = d.transaction(STORE, 'readonly');
  const tasks = (await tx.store.get('tasks')) as Task[] | undefined;
  const lists = (await tx.store.get('lists')) as TaskList[] | undefined;
  const settings = (await tx.store.get('settings')) as Settings | undefined;
  await tx.done;
  const finalLists = lists && lists.length > 0 ? lists : [DEFAULT_INBOX];
  return {
    tasks: tasks ?? [],
    lists: finalLists,
    settings: { ...DEFAULT_SETTINGS, ...(settings ?? {}) },
  };
}

export async function saveAll(state: AppState): Promise<void> {
  const d = await db();
  const tx = d.transaction(STORE, 'readwrite');
  await Promise.all([
    tx.store.put(state.tasks, 'tasks'),
    tx.store.put(state.lists, 'lists'),
    tx.store.put(state.settings, 'settings'),
  ]);
  await tx.done;
}

export async function wipeAll(): Promise<void> {
  const d = await db();
  const tx = d.transaction(STORE, 'readwrite');
  await tx.store.clear();
  await tx.done;
}
