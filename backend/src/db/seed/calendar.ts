import { zonedDateTime } from '../../utils/clinicTime.js';

export type ClinicDay = {
  key: string;
  y: number;
  m: number;
  d: number;
  /** 0 Sunday … 6 Saturday */
  weekday: number;
  weight: number;
  saturday: boolean;
};

const SLOT_MS = 20 * 60 * 1000;

export function slotMs() {
  return SLOT_MS;
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function dayKey(y: number, m: number, d: number) {
  return `${y}-${pad(m)}-${pad(d)}`;
}

function weekdayOf(y: number, m: number, d: number) {
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function addCalendarDays(y: number, m: number, d: number, days: number) {
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() };
}

function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { m: month, d: day };
}

function nthWeekday(year: number, month: number, weekday: number, n: number) {
  const first = weekdayOf(year, month, 1);
  const delta = (weekday - first + 7) % 7;
  return 1 + delta + (n - 1) * 7;
}

function ontarioHolidays(year: number) {
  const keys = new Set<string>();
  const add = (m: number, d: number) => keys.add(dayKey(year, m, d));
  add(1, 1);
  add(2, nthWeekday(year, 2, 1, 3));
  const easter = easterSunday(year);
  const goodFriday = addCalendarDays(year, easter.m, easter.d, -2);
  add(goodFriday.m, goodFriday.d);
  // Victoria Day is the Monday on or before May 24.
  const may24 = weekdayOf(year, 5, 24);
  const victoria = 24 - ((may24 + 6) % 7);
  add(5, victoria);
  add(7, 1);
  add(8, nthWeekday(year, 8, 1, 1));
  add(9, nthWeekday(year, 9, 1, 1));
  add(10, nthWeekday(year, 10, 1, 2));
  add(12, 25);
  add(12, 26);
  return keys;
}

function dayWeight(weekday: number, month: number, saturday: boolean) {
  if (saturday) return 0.35;
  let weight = 1;
  if (weekday === 1) weight *= 1.2;
  if (weekday === 2) weight *= 1.12;
  if (weekday === 5) weight *= 0.86;
  if (month === 12 || month <= 2) weight *= 1.28;
  if (month === 7 || month === 8) weight *= 0.72;
  if (month === 9) weight *= 1.08;
  return weight;
}

const instantCache = new Map<string, number>();

export function instant(y: number, m: number, d: number, hour: number, minute: number) {
  const key = `${y}-${m}-${d}-${hour}-${minute}`;
  const cached = instantCache.get(key);
  if (cached != null) return cached;
  const value = zonedDateTime(y, m, d, hour, minute).getTime();
  instantCache.set(key, value);
  return value;
}

/**
 * Instant used as "now" while seeding.
 * The live board needs a full weekday with morning and afternoon slots.
 * Outside that window (evenings, Saturday clinic, Sunday) the board is pinned
 * to 10:40 America/Toronto on the next open weekday so visit timelines stay coherent.
 */
export function boardNow(real = new Date()): Date {
  const realToday = clinicToday(real);
  const days = clinicDays(realToday, 1, 21);
  const windowOk = (day: ClinicDay, at: number) => {
    if (day.saturday || day.weekday === 0) return false;
    const slots = slotStarts(day, 1);
    const past = slots.filter((start) => start < at - 10 * 60 * 1000).length;
    const future = slots.filter((start) => start > at + 20 * 60 * 1000).length;
    return past >= 4 && future >= 4;
  };
  if (days.some((day) => day.key === realToday.key) && windowOk(realToday, real.getTime())) {
    return real;
  }
  for (const day of days) {
    if (day.saturday || day.key < realToday.key) continue;
    const at = instant(day.y, day.m, day.d, 10, 40);
    if (day.key === realToday.key && at + 6 * 60 * 60 * 1000 < real.getTime()) continue;
    if (windowOk(day, at)) return new Date(at);
  }
  throw new Error('no open weekday can host the operational board');
}

export function clinicToday(now = new Date()): ClinicDay {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const [y, m, d] = parts.split('-').map(Number);
  return makeDay(y!, m!, d!);
}

function makeDay(y: number, m: number, d: number): ClinicDay {
  const weekday = weekdayOf(y, m, d);
  const saturday = weekday === 6;
  return {
    key: dayKey(y, m, d),
    y,
    m,
    d,
    weekday,
    saturday,
    weight: dayWeight(weekday, m, saturday),
  };
}

export function clinicDays(today: ClinicDay, pastMonths: number, futureDays: number) {
  const holidays = new Set<string>();
  for (let year = today.y - 4; year <= today.y + 1; year += 1) {
    for (const key of ontarioHolidays(year)) holidays.add(key);
  }
  const start = addCalendarDays(today.y, today.m, today.d, -Math.round(pastMonths * 30.437));
  const end = addCalendarDays(today.y, today.m, today.d, futureDays);
  const days: ClinicDay[] = [];
  let cursor = start;
  for (let guard = 0; guard < 1400; guard += 1) {
    const day = makeDay(cursor.y, cursor.m, cursor.d);
    const closed = holidays.has(day.key) || day.weekday === 0;
    if (!closed) days.push(day);
    if (day.key === dayKey(end.y, end.m, end.d)) break;
    cursor = addCalendarDays(cursor.y, cursor.m, cursor.d, 1);
  }
  return days;
}

export function addDays(day: ClinicDay, days: number): ClinicDay {
  const next = addCalendarDays(day.y, day.m, day.d, days);
  return makeDay(next.y, next.m, next.d);
}

const slotCache = new Map<string, number[]>();

/** 20-minute starts. `span` is 1 or 2 slots. Saturday clinic is Toronto morning only. */
export function slotStarts(day: ClinicDay, span: 1 | 2): number[] {
  const cacheKey = `${day.key}:${span}:${day.saturday ? 'sat' : 'wd'}`;
  const cached = slotCache.get(cacheKey);
  if (cached) return cached;
  const starts: number[] = [];
  const windows = day.saturday
    ? [[9 * 60, 12 * 60]]
    : [
        [8 * 60, 12 * 60],
        [13 * 60, 17 * 60],
      ];
  const length = span * 20;
  for (const [open, close] of windows) {
    for (let minute = open!; minute + length <= close!; minute += 20) {
      starts.push(instant(day.y, day.m, day.d, Math.floor(minute / 60), minute % 60));
    }
  }
  slotCache.set(cacheKey, starts);
  return starts;
}

export class Calendar {
  private busy = new Map<string, Set<number>>();

  free(id: string, start: number, span: number) {
    const taken = this.busy.get(id);
    if (!taken) return true;
    for (let index = 0; index < span; index += 1) {
      if (taken.has(start + index * SLOT_MS)) return false;
    }
    return true;
  }

  occupy(id: string, start: number, span: number) {
    let taken = this.busy.get(id);
    if (!taken) {
      taken = new Set();
      this.busy.set(id, taken);
    }
    for (let index = 0; index < span; index += 1) taken.add(start + index * SLOT_MS);
  }
}

export function dayIndex(days: ClinicDay[], key: string) {
  return days.findIndex((day) => day.key === key);
}
