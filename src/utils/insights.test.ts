import { describe, expect, it } from 'vitest';
import type { Task } from '../types';
import { buildInsights, completionDate, filterInsightTasks } from './insights';
import { addDaysISO, parseISODate } from './date';

const today = '2026-01-03';
const task = (id: string, patch: Partial<Task> = {}): Task => ({
  id, title: id, notes: '', listId: 'inbox', priority: 0, tags: [], subtasks: [],
  done: false, createdAt: 1, ...patch,
});
const completed = (id: string, date: string) => task(id, {
  done: true, completedAt: parseISODate(date).getTime() + 12 * 3600000,
});

describe('insights', () => {
  it('compares adjacent inclusive periods across a year boundary', () => {
    const tasks = [
      completed('first', '2025-12-28'), completed('last', today),
      completed('previous-first', '2025-12-21'), completed('previous-last', '2025-12-27'),
      completed('older', '2025-12-20'), completed('future', '2026-01-04'),
    ];
    const result = buildInsights(tasks, today, 7);
    expect(result.start).toBe('2025-12-28');
    expect(result.completed).toBe(2);
    expect(result.previousCompleted).toBe(2);
    expect(result.delta).toBe(0);
    expect(result.completionBars.map((bar) => bar.count)).toEqual([1, 0, 0, 0, 0, 0, 1]);
    expect(result.recent.some((task) => task.id === 'future')).toBe(false);
  });

  it('covers all thirty days once with six contiguous five-day buckets', () => {
    const tasks = Array.from({ length: 30 }, (_, i) => completed(String(i), addDaysISO(today, -i)));
    const result = buildInsights(tasks, today, 30);
    expect(result.completed).toBe(30);
    expect(result.completionBars).toHaveLength(6);
    expect(result.completionBars.map((bar) => bar.count)).toEqual([5, 5, 5, 5, 5, 5]);
    expect(result.completionBars[0].from).toBe(addDaysISO(today, -29));
    expect(result.completionBars[result.completionBars.length - 1].to).toBe(today);
    for (const bar of result.completionBars) {
      expect(filterInsightTasks(tasks, { kind: 'completed', start: bar.from, end: bar.to }, today)).toHaveLength(5);
    }
  });

  it('counts only open tasks scheduled from today through the next six days', () => {
    const tasks = [
      task('today', { due: today }), task('last', { due: addDaysISO(today, 6) }),
      task('later', { due: addDaysISO(today, 7) }), task('overdue', { due: addDaysISO(today, -1) }),
      task('undated'), task('done', { due: today, done: true }),
    ];
    const result = buildInsights(tasks, today, 7);
    expect(result.scheduled).toBe(2);
    expect(result.scheduleBars.map((bar) => bar.count)).toEqual([1, 0, 0, 0, 0, 0, 1]);
    expect(filterInsightTasks(tasks, { kind: 'scheduled', date: today }, today).map((t) => t.id)).toEqual(['today']);
  });

  it('keeps risk categories independent and excludes completed tasks', () => {
    const tasks = [
      task('late', { due: '2026-01-01', priority: 1 }), task('undated', { priority: 1 }),
      task('later', { due: '2026-01-10', priority: 1 }),
      task('done', { done: true, priority: 1, due: '2026-01-01' }),
    ];
    const result = buildInsights(tasks, today, 30);
    expect([result.overdue, result.unscheduled, result.priority]).toEqual([1, 1, 3]);
    expect(filterInsightTasks(tasks, { kind: 'overdue' }, today).map((t) => t.id)).toEqual(['late']);
    expect(filterInsightTasks(tasks, { kind: 'unscheduled' }, today).map((t) => t.id)).toEqual(['undated']);
    expect(filterInsightTasks(tasks, { kind: 'priority' }, today).map((t) => t.id)).toEqual(['late', 'undated', 'later']);
  });

  it('does not invent a completion date for imported tasks without one', () => {
    const tasks = [task('unknown', { done: true }), task('invalid', { done: true, completedAt: NaN }),
      task('outside-date-range', { done: true, completedAt: 9e15 }), completed('known', today)];
    expect(buildInsights(tasks, today, 7).completed).toBe(1);
    expect(buildInsights(tasks, today, 7).recent.map((task) => task.id)).toEqual(['known']);
    expect(filterInsightTasks(tasks, { kind: 'completed' }, today)).toHaveLength(4);
    expect(filterInsightTasks(tasks, { kind: 'completed', start: today, end: today }, today)).toHaveLength(1);
    expect(completionDate(tasks[0])).toBeUndefined();
    expect(completionDate(tasks[1])).toBeUndefined();
    expect(completionDate(tasks[2])).toBeUndefined();
  });

  it('uses the local completion day, including midnight boundaries', () => {
    const midnight = parseISODate(today).getTime();
    expect(completionDate(task('before', { done: true, completedAt: midnight - 1 }))).toBe(addDaysISO(today, -1));
    expect(completionDate(task('at', { done: true, completedAt: midnight }))).toBe(today);
    expect(completionDate(task('reopened', { completedAt: midnight }))).toBeUndefined();
  });

  it('returns honest zero values for an empty collection', () => {
    const result = buildInsights([], today, 7);
    expect([result.completed, result.previousCompleted, result.delta, result.scheduled, result.overdue, result.unscheduled, result.priority]).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(result.completionBars.every((bar) => bar.count === 0)).toBe(true);
    expect(result.recent).toEqual([]);
  });
});
