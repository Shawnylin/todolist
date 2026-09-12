import type { AiProfile, AppState, ChatSession, Settings } from '../types';

export function activeAi(settings: Settings): AiProfile {
  return (
    settings.aiProfiles?.find((p) => p.id === settings.activeAiProfileId) ??
    settings.aiProfiles?.[0] ?? {
      id: 'legacy-ai',
      name: '默认配置',
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl,
      model: settings.model,
    }
  );
}

export function migratePreferences(state: AppState): AppState {
  const profiles = state.settings.aiProfiles ?? [activeAi(state.settings)];
  const active = profiles.find((p) => p.id === state.settings.activeAiProfileId) ?? profiles[0];
  const messages = state.conversation ?? [];
  const conversations: ChatSession[] = state.conversations?.length
    ? state.conversations
    : [
        {
          id: 'legacy-chat',
          title: messages.find((m) => m.role === 'user')?.content.slice(0, 24) || '新对话',
          createdAt: messages[0]?.createdAt ?? Date.now(),
          updatedAt: messages[messages.length - 1]?.createdAt ?? Date.now(),
          messages,
        },
      ];
  const current =
    conversations.find((c) => c.id === state.activeConversationId) ?? conversations[0];
  return {
    ...state,
    conversations,
    activeConversationId: current.id,
    conversation: current.messages,
    settings: {
      ...state.settings,
      accent: state.settings.accent ?? 'violet',
      aiProfiles: profiles,
      activeAiProfileId: active?.id,
    },
  };
}
