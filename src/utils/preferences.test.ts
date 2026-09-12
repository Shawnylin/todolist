import { describe, expect, it } from 'vitest';
import { apiEndpoint } from '../ai';
import { reducer } from '../store';
import { DEFAULT_SETTINGS, type AppState, type ChatMessage } from '../types';
import { activeAi, migratePreferences } from './preferences';
const oldMessage: ChatMessage = { id: 'm1', role: 'user', content: '以前的对话', createdAt: 1 };
const seed = (): AppState => ({
  tasks: [],
  lists: [],
  settings: { ...DEFAULT_SETTINGS, apiKey: 'legacy-test' },
  conversation: [oldMessage],
});
describe('preferences and history', () => {
  it('migrates legacy key and chat without duplicating records on reload', () => {
    const migrated = migratePreferences(seed());
    expect(activeAi(migrated.settings).apiKey).toBe('legacy-test');
    expect(migrated.conversations?.[0].messages).toEqual([oldMessage]);
    expect(migratePreferences(migrated).conversations).toEqual(migrated.conversations);
  });
  it('new conversations do not carry history, previous conversations can resume', () => {
    let state = reducer({ ...seed(), hydrated: false }, { type: 'hydrate', state: seed() });
    const previous = state.activeConversationId!;
    state = reducer(state, {
      type: 'newConversation',
      session: { id: 'new', title: '新对话', createdAt: 2, updatedAt: 2, messages: [] },
    });
    expect(state.conversation).toEqual([]);
    state = reducer(state, {
      type: 'chatMessage',
      sessionId: 'new',
      message: { ...oldMessage, id: 'm2', content: '新话题' },
    });
    state = reducer(state, { type: 'selectConversation', id: previous });
    expect(state.conversation).toEqual([oldMessage]);
    expect(state.conversations?.find((c) => c.id === 'new')?.title).toBe('新话题');
  });
  it('late responses stay in their originating conversation', () => {
    let state = reducer({ ...seed(), hydrated: false }, { type: 'hydrate', state: seed() });
    const previous = state.activeConversationId!;
    state = reducer(state, {
      type: 'newConversation',
      session: { id: 'new', title: '新对话', createdAt: 2, updatedAt: 2, messages: [] },
    });
    state = reducer(state, {
      type: 'chatMessage',
      sessionId: previous,
      message: { ...oldMessage, id: 'late', role: 'assistant' },
    });
    expect(state.conversation).toEqual([]);
    expect(state.conversations?.find((c) => c.id === previous)?.messages).toHaveLength(2);
  });
  it('selects only the active API profile', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      aiProfiles: [
        { id: 'a', name: 'A', apiKey: 'a', model: 'ma', baseUrl: 'https://a.test/v1' },
        { id: 'b', name: 'B', apiKey: 'b', model: 'mb', baseUrl: 'https://b.test/v1' },
      ],
      activeAiProfileId: 'b',
    };
    expect(activeAi(settings).model).toBe('mb');
  });
  it('normalizes OpenAI base, versioned, full and custom-path URLs', () => {
    expect(apiEndpoint('https://api.openai.com', 'models')).toBe(
      'https://api.openai.com/v1/models',
    );
    expect(apiEndpoint('https://proxy.test/v1/', 'models')).toBe('https://proxy.test/v1/models');
    expect(apiEndpoint('https://proxy.test/v1/chat/completions', 'models')).toBe(
      'https://proxy.test/v1/models',
    );
    expect(apiEndpoint('https://proxy.test/custom/v2/models', 'chat/completions')).toBe(
      'https://proxy.test/custom/v2/chat/completions',
    );
    expect(apiEndpoint('https://api.deepseek.com', 'models')).toBe(
      'https://api.deepseek.com/models',
    );
    expect(() => apiEndpoint('javascript:alert(1)', 'models')).toThrow();
  });
});
