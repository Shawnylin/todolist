import { describe, expect, it } from 'vitest';
import { formatDue, nextDueISO, repeatLabel, toISODate } from './date';

describe('date utils', () => {
  it('formatDue 相对文案', () => {
    expect(formatDue('2026-02-14', '2026-02-14')).toBe('今天 · 周六');
    expect(formatDue('2026-02-15', '2026-02-14')).toBe('明天 · 周日');
    expect(formatDue('2026-02-13', '2026-02-14')).toBe('昨天 · 周五');
  });

  it('nextDueISO 每周重复:过期后从今天起推进', () => {
    // 原到期 02-14(周六),每周;今天已 02-20,下一次应为 02-27
    expect(nextDueISO('2026-02-14', { freq: 'week', interval: 1 }, '2026-02-20')).toBe('2026-02-27');
  });

  it('nextDueISO 未过期时从原日期推进', () => {
    expect(nextDueISO('2026-02-14', { freq: 'week', interval: 1 }, '2026-02-10')).toBe('2026-02-21');
  });

  it('nextDueISO 工作日', () => {
    // 02-14 是周六,下一个工作日是 02-16(周一)
    expect(nextDueISO('2026-02-14', { freq: 'weekday', interval: 1 }, '2026-02-14')).toBe('2026-02-16');
  });

  it('nextDueISO 每月', () => {
    expect(nextDueISO('2026-02-14', { freq: 'month', interval: 1 }, '2026-02-10')).toBe('2026-03-14');
  });

  it('repeatLabel', () => {
    expect(repeatLabel({ freq: 'day', interval: 1 })).toBe('每天');
    expect(repeatLabel({ freq: 'week', interval: 2 })).toBe('每2周');
    expect(repeatLabel({ freq: 'weekday', interval: 1 })).toBe('每个工作日');
    expect(repeatLabel({ freq: 'year', interval: 1 })).toBe('每年');
  });

  it('toISODate 本地时区补零', () => {
    expect(toISODate(new Date(2026, 1, 5))).toBe('2026-02-05');
  });
});
