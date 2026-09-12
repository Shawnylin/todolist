import { describe, expect, it } from 'vitest';
import { parsePlanReply, planChanges } from './planChat';
import { reducer } from '../store';
import { DEFAULT_SETTINGS, type ChatMessage, type Task } from '../types';
const task: Task = {
  id: 'read',
  title: '阅读',
  notes: '',
  priority: 0,
  done: false,
  listId: 'inbox',
  tags: [],
  subtasks: [],
  createdAt: 1,
};
const initial = () => ({
  hydrated: true,
  tasks: [{ ...task }],
  lists: [{ id: 'inbox', name: '收件箱', color: '#665588', icon: 'inbox', system: true }],
  settings: DEFAULT_SETTINGS,
  conversation: [] as ChatMessage[],
});
const message: ChatMessage = { id: 'reply', role: 'assistant', content: '已调整', createdAt: 2 };
describe('chat plan transactions', () => {
  it('adds, updates and deletes tasks through validated operations', () => {
    const state = initial();
    const changes = planChanges(state, [
      { type: 'add', fields: { title: '跑步', slot: 'evening' } },
      { type: 'update', id: 'read', fields: { due: '2026-09-15', dueTime: '09:00' } },
    ]);
    const applied = reducer(state, { type: 'applyPlan', changes, message });
    expect(applied.tasks).toHaveLength(2);
    expect(applied.tasks.find((t) => t.id === 'read')?.dueTime).toBe('09:00');
    expect(planChanges(applied, [{ type: 'delete', id: 'read' }])[0].after).toBeUndefined();
    expect(state.tasks).toEqual([task]);
  });
  it('rejects malformed fields, invalid dates and unknown IDs without partial writes', () => {
    expect(() =>
      parsePlanReply(
        '{"reply":"ok","operations":[{"type":"update","id":"read","fields":{"apiKey":"bad"}}]}',
      ),
    ).toThrow();
    expect(() =>
      planChanges(initial(), [
        { type: 'add', fields: { title: 'ok' } },
        { type: 'delete', id: 'missing' },
      ]),
    ).toThrow();
    expect(() =>
      planChanges(initial(), [{ type: 'update', id: 'read', fields: { due: '2026-02-30' } }]),
    ).toThrow();
  });
  it('does not overwrite edits made during a request', () => {
    const state = initial();
    const changes = planChanges(state, [{ type: 'delete', id: 'read' }]);
    const edited = reducer(state, { type: 'updateTask', id: 'read', patch: { title: '手动修改' } });
    const applied = reducer(edited, { type: 'applyPlan', changes, message });
    expect(applied.tasks[0].title).toBe('手动修改');
    expect(applied.conversation?.[0].status).toBe('error');
  });
  it('undoes only its own changes, preserving unrelated later additions', () => {
    const state = initial();
    let applied = reducer(state, {
      type: 'applyPlan',
      changes: planChanges(state, [{ type: 'delete', id: 'read' }]),
      message,
    });
    applied = reducer(applied, { type: 'addTask', task: { ...task, id: 'other' } });
    const undone = reducer(applied, { type: 'undoPlan', id: 'reply' });
    expect(undone.tasks.map((t) => t.id).sort()).toEqual(['other', 'read']);
    expect(undone.conversation?.[0].status).toBe('undone');
  });
  it('refuses undo when a touched task has newer edits', () => {
    const state = initial();
    let applied = reducer(state, {
      type: 'applyPlan',
      changes: planChanges(state, [{ type: 'update', id: 'read', fields: { notes: 'AI' } }]),
      message,
    });
    applied = reducer(applied, { type: 'updateTask', id: 'read', patch: { notes: '后来修改' } });
    expect(reducer(applied, { type: 'undoPlan', id: 'reply' }).tasks[0].notes).toBe('后来修改');
  });
  it('completion is idempotent and recurring successor is included in undo', () => {
    const state = initial();
    state.tasks[0].repeat = { freq: 'day', interval: 1 };
    const changes = planChanges(state, [{ type: 'complete', id: 'read', done: true }]);
    expect(changes).toHaveLength(2);
    const applied = reducer(state, { type: 'applyPlan', changes, message });
    expect(planChanges(applied, [{ type: 'complete', id: 'read', done: true }])).toEqual([]);
    expect(reducer(applied, { type: 'undoPlan', id: 'reply' }).tasks).toEqual(state.tasks);
  });
  it('allows conversation-only replies and clearing nullable fields', () => {
    expect(parsePlanReply('{"reply":"想安排在几点？","operations":[]}').operations).toEqual([]);
    const reply = parsePlanReply(
      '{"reply":"已清除时间","operations":[{"type":"update","id":"read","fields":{"dueTime":null}}]}',
    );
    expect(reply.operations[0]).toEqual({
      type: 'update',
      id: 'read',
      fields: { dueTime: undefined },
    });
  });
});
