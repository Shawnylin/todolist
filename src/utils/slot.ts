import type { Task, TimeSlot } from '../types';

export const SLOT_ORDER: TimeSlot[] = ['morning', 'afternoon', 'evening'];

export const SLOT_LABEL: Record<TimeSlot, string> = {
  morning: '早上',
  afternoon: '下午',
  evening: '晚上',
};

export const SLOT_SHORT: Record<TimeSlot, string> = {
  morning: '早',
  afternoon: '午',
  evening: '晚',
};

export function slotFromHour(h: number): TimeSlot {
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

/** 任务实际所属时段:优先用显式 slot,否则由时间推断 */
export function slotOf(t: Task): TimeSlot | undefined {
  if (t.slot) return t.slot;
  if (t.dueTime) {
    const h = Number(t.dueTime.slice(0, 2));
    if (!Number.isNaN(h)) return slotFromHour(h);
  }
  return undefined;
}

export function nextSlot(s: TimeSlot): TimeSlot {
  const i = SLOT_ORDER.indexOf(s);
  return SLOT_ORDER[(i + 1) % SLOT_ORDER.length];
}
