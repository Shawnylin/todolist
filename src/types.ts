export type Priority = 0 | 1 | 2 | 3; // 0 = 无,1 最高(红),2(橙),3(蓝)

export type TimeSlot = 'morning' | 'afternoon' | 'evening';

export type RepeatFreq = 'day' | 'week' | 'month' | 'year' | 'weekday';

export interface Repeat {
  freq: RepeatFreq;
  interval: number; // 每 interval 个 freq
}

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  notes: string;
  listId: string;
  priority: Priority;
  due?: string; // 'YYYY-MM-DD'
  dueTime?: string; // 'HH:mm'
  slot?: TimeSlot; // 时段:早上/下午/晚上
  tags: string[];
  subtasks: Subtask[];
  repeat?: Repeat;
  done: boolean;
  createdAt: number;
  completedAt?: number;
}

export interface TaskList {
  id: string;
  name: string;
  color: string;
  icon: string; // lucide 图标名
  system?: boolean; // 收件箱等系统清单,不可删除
}

export type ThemeMode = 'light' | 'dark' | 'system';

export interface Settings {
  apiKey: string;
  baseUrl: string; // 默认 https://api.deepseek.com
  model: string; // 默认 deepseek-v4-flash
  theme: ThemeMode;
  /** 是否已看过欢迎引导 */
  onboarded: boolean;
}

export interface AppState {
  tasks: Task[];
  lists: TaskList[];
  settings: Settings;
}

export const INBOX_ID = 'inbox';

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-v4-flash',
  theme: 'system',
  onboarded: false,
};

export const LIST_COLORS = [
  '#6E56CF',
  '#E5484D',
  '#F76B15',
  '#F5A524',
  '#2E9E5B',
  '#0E9BA8',
  '#2F6FEB',
  '#E93D82',
  '#8A5A44',
  '#5B6472',
];

export const LIST_ICONS = [
  'inbox',
  'briefcase',
  'home',
  'book-open',
  'shopping-cart',
  'heart',
  'star',
  'code',
  'graduation-cap',
  'plane',
  'dumbbell',
  'music',
  'palette',
  'gift',
];

export interface ParsedInput {
  title: string;
  due?: string;
  dueTime?: string;
  priority: Priority;
  listName?: string;
  tags: string[];
  repeat?: Repeat;
}

/** AI 解析出的一条计划任务 */
export interface AiPlanTask {
  title: string;
  slot: TimeSlot;
  dueTime?: string;
  priority: Priority;
  listName?: string;
  notes?: string;
}

export type ViewRoute =
  | { view: 'today' }
  | { view: 'plan' }
  | { view: 'insights' }
  | { view: 'settings' };
