import { type Task, type TaskList } from '../types';

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === 'string';
const date = (v: unknown) => v === undefined || (str(v) && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v);
const unique = (values: { id: string }[]) => new Set(values.map((v) => v.id)).size === values.length;

/** Validate before replacing local data; reject partial or malformed backups. */
export function parseBackup(value: unknown): { tasks: Task[]; lists: TaskList[] } {
  const fail = () => { throw new Error('备份格式不正确或含有无效数据'); };
  if (!record(value) || !Array.isArray(value.tasks) || !Array.isArray(value.lists)) return fail();
  for (const t of value.tasks) {
    if (!record(t) || !str(t.id) || !t.id || !str(t.title) || !t.title.trim() || !str(t.notes) || !str(t.listId) ||
      ![0, 1, 2, 3].includes(t.priority as number) || typeof t.done !== 'boolean' || !Number.isFinite(t.createdAt) ||
      !date(t.due) || (t.completedAt !== undefined && !Number.isFinite(t.completedAt)) ||
      (t.dueTime !== undefined && (!str(t.dueTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(t.dueTime))) ||
      (t.slot !== undefined && !['morning', 'afternoon', 'evening'].includes(t.slot as string)) ||
      (t.nextOccurrenceId !== undefined && !str(t.nextOccurrenceId)) ||
      !Array.isArray(t.tags) || !t.tags.every(str) || !Array.isArray(t.subtasks) ||
      !t.subtasks.every((s) => record(s) && str(s.id) && s.id && str(s.title) && typeof s.done === 'boolean') || !unique(t.subtasks)) return fail();
    if (t.repeat !== undefined && (!record(t.repeat) || !['day', 'week', 'month', 'year', 'weekday'].includes(t.repeat.freq as string) || !Number.isInteger(t.repeat.interval) || Number(t.repeat.interval) < 1 || Number(t.repeat.interval) > 365)) return fail();
  }
  for (const l of value.lists) {
    if (!record(l) || !str(l.id) || !l.id || !str(l.name) || !l.name.trim() || !str(l.color) || !/^#[0-9a-f]{6}$/i.test(l.color) || !str(l.icon) || (l.system !== undefined && typeof l.system !== 'boolean')) return fail();
  }
  const tasks = value.tasks as Task[], lists = value.lists as TaskList[];
  if (!unique(tasks) || !unique(lists)) return fail();
  return { tasks, lists };
}
