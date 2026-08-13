import { describe, expect, it } from 'vitest';
import { splitPlanInput } from './planSplit';

describe('splitPlanInput 本地计划拆分', () => {
  it('「首先/然后」连接的多任务', () => {
    const r = splitPlanInput('首先写言语理解 然后写资料分析 然后写政治理论');
    expect(r.map((x) => x.title)).toEqual(['言语理解', '资料分析', '政治理论']);
    expect(r.map((x) => x.slot)).toEqual(['morning', 'afternoon', 'evening']);
  });

  it('逗号分隔 + 时段前缀', () => {
    const r = splitPlanInput('上午开会,下午写方案,晚上健身');
    expect(r.map((x) => x.title)).toEqual(['开会', '方案', '健身']);
    expect(r.map((x) => x.slot)).toEqual(['morning', 'afternoon', 'evening']);
  });

  it('无时段信息时按顺序分配', () => {
    const r = splitPlanInput('写报告,改简历,买菜,回邮件');
    expect(r.map((x) => x.slot)).toEqual(['morning', 'afternoon', 'evening', 'morning']);
  });

  it('连接词混合使用', () => {
    const r = splitPlanInput('写周报,然后开会,晚上跑步');
    expect(r.map((x) => x.title)).toEqual(['周报', '开会', '跑步']);
    expect(r.map((x) => x.slot)).toEqual(['morning', 'afternoon', 'evening']);
  });

  it('单条任务', () => {
    const r = splitPlanInput('准备明天的演示文稿');
    expect(r).toEqual([{ title: '明天的演示文稿', slot: 'morning' }]);
  });

  it('空输入与相邻去重', () => {
    expect(splitPlanInput('')).toEqual([]);
    expect(splitPlanInput('写报告,写报告')).toEqual([{ title: '报告', slot: 'morning' }]);
  });
});
