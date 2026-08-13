import type { Repeat, Task } from '../types';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** 本地时区的 YYYY-MM-DD */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function addDaysISO(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function diffDaysISO(fromISO: string, toISO: string): number {
  const a = parseISODate(fromISO).getTime();
  const b = parseISODate(toISO).getTime();
  return Math.round((b - a) / 86400000);
}

/** 相对日期文案:今天 / 明天 / 昨天 / M月D日 周X / YYYY年M月D日 */
export function formatDue(iso: string, nowISO = todayISO()): string {
  const diff = diffDaysISO(nowISO, iso);
  const d = parseISODate(iso);
  const wd = WEEKDAYS[d.getDay()];
  const md = `${d.getMonth() + 1}月${d.getDate()}日`;
  if (diff === 0) return `今天 · 周${wd}`;
  if (diff === 1) return `明天 · 周${wd}`;
  if (diff === -1) return `昨天 · 周${wd}`;
  if (diff === 2) return `后天 · 周${wd}`;
  if (d.getFullYear() === parseISODate(nowISO).getFullYear()) return `${md} · 周${wd}`;
  return `${d.getFullYear()}年${md} · 周${wd}`;
}

/** 短文案:今天 / 明天 / M月D日 / YYYY年M月D日 */
export function formatDueShort(iso: string, nowISO = todayISO()): string {
  const diff = diffDaysISO(nowISO, iso);
  const d = parseISODate(iso);
  if (diff === 0) return '今天';
  if (diff === 1) return '明天';
  if (diff === -1) return '昨天';
  if (diff === 2) return '后天';
  const md = `${d.getMonth() + 1}月${d.getDate()}日`;
  if (d.getFullYear() === parseISODate(nowISO).getFullYear()) return md;
  return `${d.getFullYear()}年${md}`;
}

/** 视图头部的大日期,如「2月14日 · 周五」 */
export function formatHeaderDate(d = new Date()): string {
  return `${d.getMonth() + 1}月${d.getDate()}日 · 周${WEEKDAYS[d.getDay()]}`;
}

export function isOverdue(task: Task, nowISO = todayISO()): boolean {
  return !!task.due && !task.done && task.due < nowISO;
}

export function isToday(task: Task, nowISO = todayISO()): boolean {
  return !!task.due && task.due === nowISO;
}

/** 完成重复任务时,计算下一次到期日(从「原到期日」或「今天」起向后推进) */
export function nextDueISO(dueISO: string | undefined, repeat: Repeat, nowISO = todayISO()): string {
  const anchor = dueISO && dueISO >= nowISO ? dueISO : nowISO;
  const base = parseISODate(anchor);
  const add = (date: Date, freq: Repeat['freq'], interval: number) => {
    const d = new Date(date);
    if (freq === 'day') d.setDate(d.getDate() + interval);
    else if (freq === 'week') d.setDate(d.getDate() + interval * 7);
    else if (freq === 'month') d.setMonth(d.getMonth() + interval);
    else if (freq === 'year') d.setFullYear(d.getFullYear() + interval);
    else if (freq === 'weekday') {
      // 推进到下一个工作日
      do {
        d.setDate(d.getDate() + 1);
      } while (d.getDay() === 0 || d.getDay() === 6);
    }
    return d;
  };
  let d = add(base, repeat.freq, repeat.interval);
  // 若仍落在今天之前(长时间未完成),继续推进
  let guard = 0;
  while (toISODate(d) <= nowISO && guard < 400) {
    d = add(d, repeat.freq, repeat.interval);
    guard++;
  }
  return toISODate(d);
}

export function repeatLabel(repeat: Repeat): string {
  const n = repeat.interval;
  if (repeat.freq === 'weekday') return '每个工作日';
  const unit: Record<Repeat['freq'], string> = {
    day: '天',
    week: '周',
    month: '月',
    year: '年',
    weekday: '工作日',
  };
  return `每${n === 1 ? '' : n}${unit[repeat.freq]}`;
}

export function timeOf(iso: string): number {
  return parseISODate(iso).getTime();
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
