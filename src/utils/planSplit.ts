import type { TimeSlot } from '../types';

/**
 * 本地规则拆分一段计划描述(无 AI / AI 失败时的兜底):
 * 1. 按逗号/句号/换行/连接词(然后、接着、之后、最后、再、其次、还有、以及)切分
 * 2. 识别「上午/下午/晚上」等时段前缀并剥离
 * 3. 剥离「首先/写/做/完成」等引导词,得到简洁任务标题
 * 4. 未显式指定时段的条目按顺序分配到 早 → 午 → 晚(循环)
 */
const SPLIT_RE = /[，,。；;、\n]|(?:然后|接着|之后|最后|其次|还有|以及|再然后)/;

const LEAD_RE =
  /^(?:首先|先|其次|然后|接着|最后|还有|以及|我想|我需要|我准备|我要|准备|完成|复习|处理|整理|提交|学习|练习|去|要|写|做|读|看|背|练)+/;

function detectSlot(s: string): TimeSlot | undefined {
  if (/^(?:上午|早上|早晨|早)/.test(s)) return 'morning';
  if (/^(?:下午|中午)/.test(s)) return 'afternoon';
  if (/^(?:晚上|傍晚|夜里|夜间|睡前)/.test(s)) return 'evening';
  return undefined;
}

function stripSlot(s: string): string {
  return s.replace(/^(?:上午|早上|早晨|早|下午|中午|晚上|傍晚|夜里|夜间|睡前)/, '').trim();
}

const AUTO_SLOTS: TimeSlot[] = ['morning', 'afternoon', 'evening'];

export interface PlanPart {
  title: string;
  slot: TimeSlot;
}

export function splitPlanInput(text: string): PlanPart[] {
  const parts = text
    .split(SPLIT_RE)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const out: PlanPart[] = [];
  let auto = 0;
  for (const raw of parts) {
    const slot = detectSlot(raw);
    let title = slot ? stripSlot(raw) : raw;
    title = title.replace(LEAD_RE, '').trim();
    if (!title) title = stripSlot(raw).replace(/^(?:首先|然后|接着)+/, '').trim();
    if (!title) continue;
    if (out.length && out[out.length - 1].title === title) continue; // 相邻去重
    out.push({
      title,
      slot: slot ?? AUTO_SLOTS[auto % AUTO_SLOTS.length],
    });
    if (!slot) auto++;
  }
  return out;
}
