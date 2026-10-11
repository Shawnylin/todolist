import type { Task } from '../types';
import { addDaysISO, toISODate } from './date';

export type InsightPeriod = 7 | 30;
export type InsightFilter =
  | { kind: 'completed'; start?: string; end?: string }
  | { kind: 'scheduled'; date: string }
  | { kind: 'overdue' | 'unscheduled' | 'priority' };

export function completionDate(task: Task): string | undefined {
  if (!task.done || task.completedAt === undefined || !Number.isFinite(task.completedAt)) return;
  const date = new Date(task.completedAt);
  return Number.isFinite(date.getTime()) ? toISODate(date) : undefined;
}

export function filterInsightTasks(tasks: Task[], filter: InsightFilter, today: string): Task[] {
  return tasks.filter((task) => {
    if (filter.kind === 'completed') {
      if (!task.done) return false;
      if (!filter.start && !filter.end) return true;
      const date = completionDate(task);
      return !!date && (!filter.start || date >= filter.start) && (!filter.end || date <= filter.end);
    }
    if (task.done) return false;
    switch (filter.kind) {
      case 'scheduled': return task.due === filter.date;
      case 'overdue': return !!task.due && task.due < today;
      case 'unscheduled': return !task.due;
      case 'priority': return task.priority === 1;
    }
  });
}

export function buildInsights(tasks: Task[], today: string, period: InsightPeriod) {
  const start = addDaysISO(today, 1 - period);
  const previousStart = addDaysISO(start, -period);
  const previousEnd = addDaysISO(start, -1);
  const completedCounts = new Map<string, number>();
  const scheduledCounts = new Map<string, number>();
  for (const task of tasks) {
    const date = completionDate(task);
    if (date) completedCounts.set(date, (completedCounts.get(date) ?? 0) + 1);
    if (!task.done && task.due) scheduledCounts.set(task.due, (scheduledCounts.get(task.due) ?? 0) + 1);
  }
  const countCompleted = (from: string, to: string) => {
    let count = 0;
    for (const [date, value] of completedCounts) {
      if (date >= from && date <= to) count += value;
    }
    return count;
  };
  // Six five-day buckets keep the thirty-day chart tappable on a phone.
  const bucketSize = period === 7 ? 1 : 5;
  const completionBars = Array.from({ length: period / bucketSize }, (_, i) => {
    const from = addDaysISO(start, i * bucketSize);
    const to = addDaysISO(from, bucketSize - 1);
    return { from, to, count: countCompleted(from, to) };
  });
  const scheduleBars = Array.from({ length: 7 }, (_, i) => {
    const date = addDaysISO(today, i);
    return { date, count: scheduledCounts.get(date) ?? 0 };
  });
  const completed = countCompleted(start, today);
  const previousCompleted = countCompleted(previousStart, previousEnd);
  return {
    start, completed, previousCompleted, delta: completed - previousCompleted,
    completionBars, scheduleBars,
    scheduled: scheduleBars.reduce((sum, bar) => sum + bar.count, 0),
    overdue: filterInsightTasks(tasks, { kind: 'overdue' }, today).length,
    unscheduled: filterInsightTasks(tasks, { kind: 'unscheduled' }, today).length,
    priority: filterInsightTasks(tasks, { kind: 'priority' }, today).length,
    recent: tasks.filter((task) => {
      const date = completionDate(task);
      return !!date && date <= today;
    })
      .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)).slice(0, 5),
  };
}
