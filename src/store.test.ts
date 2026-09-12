import { describe, expect, it } from 'vitest';
import { reducer } from './store';
import { DEFAULT_SETTINGS, type Task } from './types';

const task = (id: string): Task => ({ id, title: id, notes: '', listId: 'inbox', priority: 0, tags: [], subtasks: [], done: false, createdAt: 1 });
const initial = () => ({ tasks: [task('a'), task('b')], lists: [], settings: DEFAULT_SETTINGS, hydrated: true });
describe('task lifecycle', () => {
  it('undo restores the selected deletion even after another deletion', () => {
    let state = reducer(initial(), { type: 'deleteTask', id: 'a' });
    state = reducer(state, { type: 'deleteTask', id: 'b' });
    state = reducer(state, { type: 'undoDelete', id: 'a' });
    expect(state.tasks.map((t) => t.id)).toEqual(['a']);
    state = reducer(state, { type: 'undoDelete', id: 'b' });
    expect(state.tasks.map((t) => t.id)).toEqual(['a', 'b']);
  });
  it('repeated completion creates one successor and resets subtasks', () => {
    const seed = initial();
    seed.tasks[0].repeat = { freq: 'day', interval: 1 };
    seed.tasks[0].subtasks = [{ id: 'sub', title: 'step', done: true }];
    let state = reducer(seed, { type: 'toggleTask', id: 'a' });
    state = reducer(state, { type: 'toggleTask', id: 'a' });
    state = reducer(state, { type: 'toggleTask', id: 'a' });
    expect(state.tasks).toHaveLength(3);
    expect(state.tasks[2].subtasks[0].done).toBe(false);
    expect(state.tasks[2].subtasks[0].id).not.toBe('sub');
  });
  it('replacing data clears stale undo history', () => {
    let state = reducer(initial(), { type: 'deleteTask', id: 'a' });
    state = reducer(state, { type: 'wipeData' });
    expect(reducer(state, { type: 'undoDelete', id: 'a' }).tasks).toEqual([]);
  });
});
