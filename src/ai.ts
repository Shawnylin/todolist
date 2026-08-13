import type { AiPlanTask, Priority, Settings, Task, TimeSlot } from './types';
import { SLOT_ORDER } from './utils/slot';

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

interface ChatOpts {
  maxTokens?: number;
  temperature?: number;
}

export async function chat(
  cfg: Settings,
  system: string,
  user: string,
  opts: ChatOpts = {},
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const res = await fetch(`${baseOf(cfg)}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: cfg.model.trim() || 'deepseek-v4-flash',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: opts.temperature ?? 0.3,
        max_tokens: opts.maxTokens ?? 700,
        stream: false,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      // 尽量把服务端的错误原因带出来,方便排查
      let detail = '';
      try {
        const body = await res.json();
        const msg = body?.error?.message;
        if (typeof msg === 'string' && msg) detail = `:${msg}`;
      } catch {
        /* ignore */
      }
      throw new AiError(`${friendlyStatus(res.status)}${detail}`, res.status);
    }
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? '';
    if (!content) throw new AiError('AI 返回内容为空,请重试');
    return content;
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new AiError('请求超时,请稍后重试或更换 API 地址');
    }
    if (e instanceof TypeError) {
      throw new AiError('网络请求失败:可能是网络问题、跨域(CORS)限制或 API 地址不正确,可尝试在设置中更换 API 地址');
    }
    throw new AiError(`请求失败:${String(e)}`);
  } finally {
    clearTimeout(timer);
  }
}

/** 从模型输出中提取 JSON:容忍 ```json 代码块与前后废话 */
function extractJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    /* 继续尝试提取 */
  }
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      return JSON.parse(m[0]);
    } catch {
      /* ignore */
    }
  }
  throw new AiError('AI 返回内容无法解析,请重试');
}

const PLAN_SYSTEM = `你是日程规划助手。把用户的一段话拆成一个个具体任务,并分配到"morning/afternoon/evening"(早上/下午/晚上)。
只输出一个 JSON 对象本身,不要输出任何解释、不要用 markdown 代码块。
格式:{"tasks":[{"title":"任务标题","slot":"morning|afternoon|evening","dueTime":"HH:mm 或 null","priority":1|2|3|null,"listName":"清单名或 null","notes":"备注或 null"}]}
规则:
1. 每个动作/事项拆成独立任务,标题 ≤ 20 字、动词开头、保留原意(如"写言语理解"→"写言语理解","然后写资料分析"也是独立任务);
2. 用户明确说了上午/下午/晚上就按其分配,否则按任务先后顺序依次分配时段;
3. 没有信息就填 null,不要臆造;
4. 最多输出 8 条。`;

export async function aiParseTasks(cfg: Settings, text: string): Promise<AiPlanTask[]> {
  const content = await chat(cfg, PLAN_SYSTEM, text, { maxTokens: 900 });
  const obj = extractJson(content) as Record<string, unknown>;
  const arr = Array.isArray(obj.tasks) ? (obj.tasks as unknown[]) : [];
  const out: AiPlanTask[] = [];
  let auto = 0;
  for (const it of arr) {
    const o = it as Record<string, unknown>;
    const title = typeof o.title === 'string' ? o.title.trim().slice(0, 40) : '';
    if (!title) continue;
    let slot = (o.slot === 'morning' || o.slot === 'afternoon' || o.slot === 'evening'
      ? o.slot
      : undefined) as TimeSlot | undefined;
    if (!slot) slot = SLOT_ORDER[auto % SLOT_ORDER.length];
    auto++;
    const p = Number(o.priority);
    out.push({
      title,
      slot,
      dueTime: typeof o.dueTime === 'string' && /^\d{2}:\d{2}$/.test(o.dueTime) ? o.dueTime : undefined,
      priority: p >= 1 && p <= 3 ? (p as Priority) : 0,
      listName: typeof o.listName === 'string' && o.listName.trim() ? o.listName.trim() : undefined,
      notes: typeof o.notes === 'string' && o.notes.trim() ? o.notes.trim().slice(0, 200) : undefined,
    });
    if (out.length >= 8) break;
  }
  if (!out.length) throw new AiError('AI 未能识别出任务,请换一种说法');
  return out;
}

const BREAKDOWN_SYSTEM = `你是任务拆解助手。把用户任务拆成 3-7 个可直接执行的子步骤,每步 4-20 字、动词开头。
只输出一个 JSON 对象本身,不要输出任何解释、不要用 markdown 代码块。
格式:{"subtasks":["子步骤1","子步骤2"]}`;

/** 兜底:当模型输出不是 JSON 时,尝试按行/编号解析出子步骤 */
function parseSubtaskList(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.、)])?\s*/, '').trim())
    .filter((l) => l.length >= 2 && l.length <= 40 && !/^[{}[\]"'`]/.test(l));
  return [...new Set(lines)].slice(0, 10);
}

export async function aiBreakdown(cfg: Settings, task: Task): Promise<string[]> {
  const content = await chat(
    cfg,
    BREAKDOWN_SYSTEM,
    `任务:${task.title}${task.notes ? `\n备注:${task.notes}` : ''}${
      task.subtasks.length ? `\n已有子任务:${task.subtasks.map((s) => s.title).join('、')}` : ''
    }`,
    { maxTokens: 400, temperature: 0.5 },
  );
  let subs: string[] = [];
  try {
    const obj = extractJson(content) as Record<string, unknown>;
    subs = Array.isArray(obj.subtasks)
      ? (obj.subtasks as unknown[]).filter((t): t is string => typeof t === 'string' && !!t.trim())
      : [];
  } catch {
    subs = [];
  }
  if (!subs.length) subs = parseSubtaskList(content);
  if (!subs.length) throw new AiError('AI 未能生成子任务,请换个说法再试');
  return subs.slice(0, 10);
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
