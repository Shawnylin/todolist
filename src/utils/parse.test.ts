import { describe, expect, it } from 'vitest';
import { parseInput } from './parse';

// 固定「现在」:2026-02-14,星期六
const NOW = new Date(2026, 1, 14, 10, 0, 0);

function p(text: string) {
  return parseInput(text, { now: NOW });
}

describe('parseInput 基础', () => {
  it('纯标题', () => {
    const r = p('买牛奶');
    expect(r.title).toBe('买牛奶');
    expect(r.due).toBeUndefined();
    expect(r.priority).toBe(0);
  });

  it('相对日期', () => {
    expect(p('今天开会').due).toBe('2026-02-14');
    expect(p('明天开会').due).toBe('2026-02-15');
    expect(p('后天开会').due).toBe('2026-02-16');
    expect(p('大后天开会').due).toBe('2026-02-17');
    expect(p('3天后旅行').due).toBe('2026-02-17');
  });

  it('星期几', () => {
    // 今天周六,下一个周一 = 02-16
    expect(p('周一晨会').due).toBe('2026-02-16');
    expect(p('星期五交周报').due).toBe('2026-02-20');
  });

  it('月日(过去的月份滚动到明年)', () => {
    expect(p('2月20日纪念日').due).toBe('2026-02-20');
    expect(p('2月10日纪念日').due).toBe('2027-02-10');
  });

  it('日期 + 时间', () => {
    const r = p('明天下午3点开会');
    expect(r.due).toBe('2026-02-15');
    expect(r.dueTime).toBe('15:00');
    expect(r.title).toBe('开会');
  });

  it('24小时制冒号时间', () => {
    const r = p('明天 18:30 健身');
    expect(r.due).toBe('2026-02-15');
    expect(r.dueTime).toBe('18:30');
    expect(r.title).toBe('健身');
  });

  it('半点', () => {
    expect(p('3点半取快递').dueTime).toBe('15:30');
  });

  it('晚上12点 = 00:00', () => {
    expect(p('晚上12点上线').dueTime).toBe('00:00');
  });

  it('只有时间默认今天', () => {
    const r = p('早上8点吃药');
    expect(r.due).toBe('2026-02-14');
    expect(r.dueTime).toBe('08:00');
  });

  it('清单/标签/优先级', () => {
    const r = p('买牛奶 #购物 @日常 p1');
    expect(r.title).toBe('买牛奶');
    expect(r.listName).toBe('购物');
    expect(r.tags).toEqual(['日常']);
    expect(r.priority).toBe(1);
  });

  it('感叹号优先级', () => {
    expect(p('！2 洗车').priority).toBe(2);
    expect(p('!!1 报告').priority).toBe(1);
    expect(p('!3 整理').priority).toBe(3);
  });

  it('重复任务', () => {
    const r = p('每天8点喝药 @健康');
    expect(r.repeat).toEqual({ freq: 'day', interval: 1 });
    expect(r.due).toBe('2026-02-14');
    expect(r.tags).toEqual(['健康']);

    expect(p('每2周理发').repeat).toEqual({ freq: 'week', interval: 2 });
    expect(p('工作日晨会 9:00').repeat).toEqual({ freq: 'weekday', interval: 1 });
    expect(p('每月1号交房租').repeat).toEqual({ freq: 'month', interval: 1 });
  });

  it('今晚/明早组合词', () => {
    const a = p('今晚8点约会');
    expect(a.due).toBe('2026-02-14');
    expect(a.dueTime).toBe('20:00');
    const b = p('明早跑步');
    expect(b.due).toBe('2026-02-15');
    expect(b.dueTime).toBe('08:00');
  });

  it('标题被解析干净时不丢失原文', () => {
    expect(p('今天').title).toBe('今天');
  });
});
