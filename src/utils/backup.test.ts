import { expect, it } from 'vitest';
import { parseBackup } from './backup';
it('accepts empty exports and rejects incomplete tasks before replacement', () => {
  expect(parseBackup({ tasks: [], lists: [] })).toEqual({ tasks: [], lists: [] });
  expect(() => parseBackup({ tasks: [{ id: 'broken' }], lists: [] })).toThrow();
});
it('rejects duplicate list IDs', () => {
  const list = { id: 'work', name: '工作', color: '#665588', icon: 'inbox' };
  expect(() => parseBackup({ tasks: [], lists: [list, list] })).toThrow();
});
