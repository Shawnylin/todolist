import type { ParsedInput, Priority, Repeat } from '../types';
import { addDaysISO, pad2, toISODate } from './date';

const WEEKDAY_NUM: Record<string, number> = {
  日: 0,
  天: 0,
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
};

/** 只有时间修饰词、没有具体钟点时的默认时间 */
const TIME_MOD_DEFAULT: Record<string, number> = {
  凌晨: 1,
  早上: 8,
  早晨: 8,
  上午: 9,
  中午: 12,
  下午: 14,
  傍晚: 18,
  晚上: 19,
  深夜: 22,
};

function nextWeekday(from: Date, target: number, strictNextWeek: boolean): Date {
  const idx = from.getDay();
  let delta = (target - idx + 7) % 7;
  if (delta === 0 && strictNextWeek) delta = 7;
  const d = new Date(from);
  d.setDate(d.getDate() + delta);
  return d;
}

/** 把「修饰词 + 钟点」规范化为 24 小时制 */
function normalizeHour(h: number, mod?: string): number {
  if (!mod) {
    // 无修饰词:1-6 点视为下午/傍晚(更符合任务场景)
    return h <= 6 ? h + 12 : h;
  }
  if (mod === '下午' || mod === '中午' || mod === '傍晚' || mod === '晚上' || mod === '深夜') {
    if (h === 12) return mod === '晚上' ? 0 : 12;
    if (h <= 11) return h + 12;
    return h;
  }
  // 凌晨 / 早上 / 早晨 / 上午
  if (h === 12) return 0;
  return h;
}

/**
 * 解析自然语言输入,例如:
 * 「明天下午3点开会 #工作 p1」「每天8点喝药 @健康」「下周五16:30交周报」「3天后洗车 ！！1」
 */
export function parseInput(input: string, opts: { now?: Date } = {}): ParsedInput {
  const now = opts.now ?? new Date();
  const today = toISODate(now);
  let text = input.trim();

  // 1) #清单名 / @标签
  const listNames: string[] = [];
  text = text.replace(/[#＃]([\p{L}\p{N}_\-]+)/gu, (_m, name: string) => {
    listNames.push(name);
    return ' ';
  });
  const tags: string[] = [];
  text = text.replace(/[@＠]([\p{L}\p{N}_\-]+)/gu, (_m, name: string) => {
    tags.push(name);
    return ' ';
  });

  // 2) 优先级 p1-p4 / !1-!4
  let priority: Priority = 0;
  text = text.replace(/\b[pP]([1-4])\b/g, (_m, p: string) => {
    const v = Number(p);
    if (v >= 1 && v <= 3) priority = v as Priority;
    return ' ';
  });
  text = text.replace(/[!！]([1-4])\b/g, (_m, p: string) => {
    const v = Number(p);
    if (v >= 1 && v <= 3) priority = v as Priority;
    return ' ';
  });

  // 3) 重复:每天 / 每2周 / 工作日 …
  let repeat: Repeat | undefined;
  text = text.replace(/每\s*(\d+)?\s*(天|日|周|星期|礼拜|月|年)/g, (_m, n: string, unit: string) => {
    repeat = {
      freq:
        unit === '天' || unit === '日'
          ? 'day'
          : unit === '周' || unit === '星期' || unit === '礼拜'
            ? 'week'
            : unit === '月'
              ? 'month'
              : 'year',
      interval: n ? Number(n) : 1,
    };
    return ' ';
  });
  text = text.replace(/工作[日天]/g, () => {
    repeat = { freq: 'weekday', interval: 1 };
    return ' ';
  });

  // 4) 日期
  let due: string | undefined;
  const rel: Array<[RegExp, number]> = [
    [/大后天/g, 3],
    [/后天/g, 2],
    [/明天/g, 1],
    [/今天/g, 0],
  ];
  for (const [re, days] of rel) {
    if (re.test(text)) {
      text = text.replace(re, ' ');
      due = addDaysISO(today, days);
      break;
    }
  }
  if (!due) {
    const m = text.match(/(\d+)\s*天(?:后|以后)/);
    if (m) {
      due = addDaysISO(today, Number(m[1]));
      text = text.replace(m[0], ' ');
    }
  }
  if (!due) {
    const m = text.match(/下\s*(?:个\s*)?(?:周|星期|礼拜)([一二三四五六日天])/);
    if (m) {
      due = toISODate(nextWeekday(now, WEEKDAY_NUM[m[1]], true));
      text = text.replace(m[0], ' ');
    }
  }
  if (!due) {
    const m = text.match(/(?:周|星期|礼拜)([一二三四五六日天])/);
    if (m) {
      due = toISODate(nextWeekday(now, WEEKDAY_NUM[m[1]], false));
      text = text.replace(m[0], ' ');
    }
  }
  if (!due) {
    const m = text.match(/下\s*(?:个\s*)?月\s*(\d{1,2})[日号]/);
    if (m) {
      const dd = Number(m[1]);
      if (dd >= 1 && dd <= 31) {
        due = toISODate(new Date(now.getFullYear(), now.getMonth() + 1, dd));
        text = text.replace(m[0], ' ');
      }
    }
  }
  if (!due) {
    const m = text.match(/(\d{1,2})月(\d{1,2})[日号]/);
    if (m) {
      const mm = Number(m[1]);
      const dd = Number(m[2]);
      if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
        let iso = `${now.getFullYear()}-${pad2(mm)}-${pad2(dd)}`;
        if (iso < today) iso = `${now.getFullYear() + 1}-${pad2(mm)}-${pad2(dd)}`;
        due = iso;
        text = text.replace(m[0], ' ');
      }
    }
  }
  if (!due) {
    const m = text.match(/(?<!\d)(\d{1,2})[日号](?!\d)/);
    if (m) {
      const dd = Number(m[1]);
      if (dd >= 1 && dd <= 31) {
        let iso = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(dd)}`;
        if (iso < today) iso = toISODate(new Date(now.getFullYear(), now.getMonth() + 1, dd));
        due = iso;
        text = text.replace(m[0], ' ');
      }
    }
  }

  // 5) 「今晚 / 明晚 / 明早」等组合词
  let pendingMod: string | undefined;
  const combos: Array<[RegExp, string, string]> = [
    [/今晚/g, today, '晚上'],
    [/明晚/g, addDaysISO(today, 1), '晚上'],
    [/明早|明晨/g, addDaysISO(today, 1), '早上'],
    [/今早|今晨/g, today, '早上'],
  ];
  for (const [re, d, mod] of combos) {
    if (re.test(text)) {
      text = text.replace(re, ' ');
      if (!due) due = d;
      pendingMod = mod;
      break;
    }
  }

  // 6) 时间
  let dueTime: string | undefined;
  const tmod = text.match(/(凌晨|早上|早晨|上午|中午|下午|傍晚|晚上|深夜)/);
  const mod = tmod ? tmod[1] : pendingMod;
  if (tmod) text = text.replace(tmod[0], ' ');

  const hm = text.match(/(\d{1,2})[:：](\d{1,2})(?:分)?/);
  if (hm) {
    const h = normalizeHour(Number(hm[1]), mod);
    const m = Number(hm[2]);
    if (h <= 23 && m <= 59) dueTime = `${pad2(h)}:${pad2(m)}`;
    text = text.replace(hm[0], ' ');
  } else {
    const hm2 = text.match(/(\d{1,2})\s*点(?:(半)|(\d{1,2})\s*分?)?/);
    if (hm2) {
      const h = normalizeHour(Number(hm2[1]), mod);
      const m = hm2[2] ? 30 : hm2[3] ? Number(hm2[3]) : 0;
      if (h <= 23 && m <= 59) dueTime = `${pad2(h)}:${pad2(m)}`;
      text = text.replace(hm2[0], ' ');
    } else if (mod) {
      dueTime = `${pad2(TIME_MOD_DEFAULT[mod])}:00`;
    }
  }

  // 只有时间没有日期时,默认视为今天;重复任务无日期也默认今天
  if (dueTime && !due) due = today;
  if (repeat && !due) due = today;

  // 7) 剩余文本即标题
  let title = text
    .replace(/[，,。.;；、\s]+/g, ' ')
    .replace(/^[\s:：,，.。;；-]+|[\s:：,，.。;；-]+$/g, '')
    .trim();
  if (!title) title = input.replace(/[#＃@＠][\p{L}\p{N}_\-]+/gu, ' ').replace(/\s+/g, ' ').trim();

  return {
    title,
    due,
    dueTime,
    priority,
    listName: listNames[listNames.length - 1],
    tags,
    repeat,
  };
}
