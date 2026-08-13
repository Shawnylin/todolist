import type { AiPlanItem, ParsedInput, Priority, Repeat, Settings, Task } from './types';
import { toISODate } from './utils/date';

export class AiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

export function hasAiKey(s: Settings): boolean {
  return !!s.apiKey.trim();
}

function friendlyStatus(status: number): string {
  switch (status) {
    case 401:
      return 'API Key 无效或未填写,请到「设置 → AI 助手」检查';
    case 402:
      return 'DeepSeek 账户余额不足,请前往 platform.deepseek.com 充值';
    case 429:
      return '请求过于频繁,请稍后再试';
    case 500:
    case 502:
    case 503:
      return 'DeepSeek 服务暂时不可用,请稍后再试';
    default:
      return `请求失败(HTTP ${status})`;
  }
}

const baseOf = (cfg: Settings) => cfg.baseUrl.trim().replace(/\/+$/, '');

export async function chat(
  cfg: Settings,
  system: string,
  user: string,
  opts: { json?: boolean } = {},
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(`${baseOf(cfg)}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: cfg.model.trim() || 'deepseek-chat',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.3,
        stream: false,
        ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new AiError(friendlyStatus(res.status), res.status);
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? '';
    if (!content) throw new AiError('AI 返回内容为空,请重试');
    return content;
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new AiError('请求超时,请检查网络或更换 API 地址');
    }
    if (e instanceof TypeError) {
      throw new AiError('网络请求失败:可能是网络问题、跨域(CORS)限制或 API 地址不正确,可尝试在设置中更换 API 地址');
    }
    throw new AiError(`请求失败:${String(e)}`);
  } finally {
    clearTimeout(timer);
  }
}

function extractJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    /* 继续尝试提取 */
  }
  const m = text.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      return JSON.parse(m[0]);
    } catch {
      /* ignore */
    }
  }
  throw new AiError('AI 返回内容无法解析,请重试');
}

const PARSE_SYSTEM = `你是一个待办事项解析助手。把用户输入的自然语言解析成结构化任务,只输出 JSON,不要输出其他内容。
格式:
{"title":"任务标题(去除日期/时间/优先级等修饰后的简洁标题)","due":"YYYY-MM-DD 或 null","time":"HH:mm 或 null","priority":1|2|3|null(1最高)","listName":"清单名或 null","tags":["标签"],"repeat":"daily|weekday|weekly|monthly|yearly|every-2-days|every-3-weeks 等,或 null","subtasks":["子任务"]}
规则:
1. title 保留用户原意,简洁、可执行;
2. 只有用户明确提到日期/时间才填 due/time,不要臆造;
3. 没有信息就填 null 或空数组;
4. 忽略用户提到的敏感或无关信息;`;

export async function aiParseTask(cfg: Settings, raw: string): Promise<Partial<ParsedInput>> {
  const content = await chat(cfg, PARSE_SYSTEM, raw, { json: true });
  const obj = extractJson(content) as Record<string, unknown>;
  const result: Partial<ParsedInput> = {};
  if (typeof obj.title === 'string' && obj.title.trim()) result.title = obj.title.trim();
  if (typeof obj.due === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(obj.due)) result.due = obj.due;
  if (typeof obj.time === 'string' && /^\d{2}:\d{2}$/.test(obj.time)) result.dueTime = obj.time;
  const p = Number(obj.priority);
  if (p >= 1 && p <= 3) result.priority = p as Priority;
  if (typeof obj.listName === 'string' && obj.listName.trim()) result.listName = obj.listName.trim();
  if (Array.isArray(obj.tags)) {
    result.tags = (obj.tags as unknown[])
      .filter((t): t is string => typeof t === 'string' && !!t.trim())
      .map((t) => t.trim())
      .slice(0, 8);
  }
  if (typeof obj.repeat === 'string') {
    const r = obj.repeat.trim();
    const map: Record<string, Repeat> = {
      daily: { freq: 'day', interval: 1 },
      weekday: { freq: 'weekday', interval: 1 },
      weekly: { freq: 'week', interval: 1 },
      monthly: { freq: 'month', interval: 1 },
      yearly: { freq: 'year', interval: 1 },
    };
    if (map[r]) result.repeat = map[r];
    else {
      const m = r.match(/^every-(\d+)-(day|week|month|year)s?$/);
      if (m) {
        result.repeat = { freq: m[2] as Repeat['freq'], interval: Number(m[1]) };
      }
    }
  }
  return result;
}

const BREAKDOWN_SYSTEM = `你是任务拆解助手。把用户的任务拆解成 3-7 个可以直接执行的具体子步骤,每步 4-24 个字,动词开头,不重复。
只输出 JSON:{"subtasks":["...","..."]}`;

export async function aiBreakdown(cfg: Settings, task: Task): Promise<string[]> {
  const content = await chat(
    cfg,
    BREAKDOWN_SYSTEM,
    JSON.stringify({
      title: task.title,
      notes: task.notes,
      due: task.due,
      time: task.dueTime,
      tags: task.tags,
      subtasks: task.subtasks.map((s) => s.title),
    }),
    { json: true },
  );
  const obj = extractJson(content) as Record<string, unknown>;
  const subs = Array.isArray(obj.subtasks)
    ? (obj.subtasks as unknown[]).filter((t): t is string => typeof t === 'string' && !!t.trim())
    : [];
  if (!subs.length) throw new AiError('AI 未能生成子任务,请换个说法再试');
  return subs.slice(0, 10);
}

const PLAN_SYSTEM = `你是时间管理教练。根据用户今天(或已逾期)的待办列表,给出执行顺序与优先级建议。
只输出 JSON:{"plan":[{"title":"必须与输入中某个任务的标题完全一致","priority":1|2|3(1最高)","reason":"一句简短中文理由"}]}
要求:
1. title 必须原样引用输入中的任务标题,不要改写;
2. 按「紧急且重要 → 重要 → 琐碎」排序,最多返回前 8 项;
3. reason 控制在 30 字以内,具体、可执行。`;

export async function aiTodayPlan(cfg: Settings, tasks: Task[]): Promise<AiPlanItem[]> {
  const payload = tasks.map((t) => ({
    title: t.title,
    due: t.due,
    time: t.dueTime,
    priority: t.priority,
    notes: t.notes,
  }));
  const content = await chat(cfg, PLAN_SYSTEM, JSON.stringify(payload), { json: true });
  const obj = extractJson(content) as { plan?: unknown };
  const plan = Array.isArray(obj.plan) ? (obj.plan as unknown[]) : [];
  return plan
    .map((it) => {
      const o = it as Record<string, unknown>;
      const p = Number(o.priority);
      return {
        title: typeof o.title === 'string' ? o.title.trim() : '',
        priority: (p >= 1 && p <= 3 ? p : 2) as Priority,
        reason: typeof o.reason === 'string' ? o.reason.trim() : '',
      };
    })
    .filter((it) => it.title)
    .slice(0, 8);
}

/** 用「今天」构造一次完整的智能解析(补充 parse 缺失字段) */
export function mergeParse(base: ParsedInput, ai: Partial<ParsedInput>): ParsedInput {
  return {
    title: ai.title || base.title,
    due: base.due ?? ai.due,
    dueTime: base.dueTime ?? ai.dueTime,
    priority: (base.priority || ai.priority || 0) as Priority,
    listName: base.listName ?? ai.listName,
    tags: base.tags.length ? base.tags : (ai.tags ?? []),
    repeat: base.repeat ?? ai.repeat,
  };
}

export async function testConnection(cfg: Settings): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(`${baseOf(cfg)}/models`, {
      headers: { Authorization: `Bearer ${cfg.apiKey.trim()}` },
      signal: controller.signal,
    });
    if (res.ok) return;
    throw new AiError(friendlyStatus(res.status), res.status);
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new AiError('连接超时,请检查网络或 API 地址');
    }
    if (e instanceof TypeError) {
      throw new AiError('网络请求失败:可能是网络问题、跨域(CORS)限制或 API 地址不正确');
    }
    throw new AiError(`连接失败:${String(e)}`);
  } finally {
    clearTimeout(timer);
  }
}

export function todayStr(): string {
  return toISODate(new Date());
}
