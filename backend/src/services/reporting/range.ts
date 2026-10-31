import { HttpError } from '../../middleware/error.js';
import {
  CLINIC_TIME_ZONE,
  addCalendarDays,
  clinicDayRange,
  clinicIsoDate,
} from '../../utils/clinicTime.js';

export const REPORT_PRESETS = ['today', 'last_7_days', 'current_month', 'custom'] as const;

export type ReportPreset = (typeof REPORT_PRESETS)[number];

export interface ReportRange {
  preset: ReportPreset;
  /** Inclusive clinic-day start. */
  from: Date;
  /** Exclusive clinic-day end. */
  to: Date;
  fromDate: string;
  toDate: string;
  label: string;
  bucket: 'day' | 'week';
  timeZone: string;
}

export interface PublicRange {
  preset: ReportPreset;
  from: string;
  to: string;
  label: string;
  bucket: 'day' | 'week';
  timeZone: string;
}

const MAX_SPAN_DAYS = 366;

export function publicRange(range: ReportRange): PublicRange {
  return {
    preset: range.preset,
    from: range.fromDate,
    to: range.toDate,
    label: range.label,
    bucket: range.bucket,
    timeZone: range.timeZone,
  };
}

export function withRange<T extends Record<string, unknown>>(range: ReportRange, body: T) {
  return { range: publicRange(range), ...body };
}

/** Start of the current clinic day. Overdue work is judged against this instant. */
export function clinicTodayStart() {
  const today = clinicDayRange(clinicIsoDate());
  if (!today) throw new HttpError(500, 'Clinic date is unavailable');
  return today.start;
}

export function resolveReportRange(query: Record<string, unknown>): ReportRange {
  const presetRaw = firstString(query.preset);
  const fromRaw = firstString(query.from);
  const toRaw = firstString(query.to);

  let preset: ReportPreset;
  if (presetRaw) {
    if (!REPORT_PRESETS.includes(presetRaw as ReportPreset)) {
      throw new HttpError(400, 'preset must be today, last_7_days, current_month, or custom');
    }
    preset = presetRaw as ReportPreset;
  } else if (fromRaw || toRaw) {
    preset = 'custom';
  } else {
    preset = 'today';
  }

  const today = clinicIsoDate();
  if (preset === 'today') {
    return buildRange('today', today, today, 'Today');
  }
  if (preset === 'last_7_days') {
    return buildRange('last_7_days', addCalendarDays(today, -6), today, 'Last 7 days');
  }
  if (preset === 'current_month') {
    const [yearText, monthText] = today.split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    const fromDate = `${yearText}-${monthText}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const toDate = addCalendarDays(
      `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`,
      -1
    );
    const monthLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-CA', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
    return buildRange('current_month', fromDate, toDate, monthLabel);
  }

  if (!fromRaw || !toRaw) {
    throw new HttpError(400, 'Custom range requires from and to dates (YYYY-MM-DD)');
  }
  if (!isRealDate(fromRaw) || !isRealDate(toRaw)) {
    throw new HttpError(400, 'from and to must be real dates in YYYY-MM-DD');
  }
  if (toRaw < fromRaw) {
    throw new HttpError(400, 'to must be on or after from');
  }
  const span = calendarSpan(fromRaw, toRaw);
  if (span + 1 > MAX_SPAN_DAYS) {
    throw new HttpError(400, `Custom range cannot exceed ${MAX_SPAN_DAYS} days`);
  }
  return buildRange('custom', fromRaw, toRaw, `${prettyDate(fromRaw)} – ${prettyDate(toRaw)}`);
}

export function bucketStarts(range: ReportRange) {
  const step = range.bucket === 'week' ? 7 : 1;
  const start = range.bucket === 'week' ? mondayOnOrBefore(range.fromDate) : range.fromDate;
  const dates: string[] = [];
  for (let cursor = start; cursor <= range.toDate; cursor = addCalendarDays(cursor, step)) {
    dates.push(cursor);
  }
  return dates;
}

export function bucketExpr(field: string, range: ReportRange) {
  return {
    $dateTrunc: {
      date: field,
      unit: range.bucket,
      timezone: range.timeZone,
      ...(range.bucket === 'week' ? { startOfWeek: 'monday' as const } : {}),
    },
  };
}

export function countsByBucket(
  range: ReportRange,
  rows: Array<{ _id: Date | string | null; count: number }>
) {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (!row._id) continue;
    const key = clinicIsoDate(new Date(row._id));
    totals.set(key, (totals.get(key) ?? 0) + row.count);
  }
  return bucketStarts(range).map((date) => ({ date, count: totals.get(date) ?? 0 }));
}

function buildRange(preset: ReportPreset, fromDate: string, toDate: string, label: string): ReportRange {
  const start = clinicDayRange(fromDate);
  const endDay = clinicDayRange(toDate);
  if (!start || !endDay) throw new HttpError(400, 'Invalid report range');
  const inclusiveDays = calendarSpan(fromDate, toDate) + 1;
  return {
    preset,
    from: start.start,
    to: endDay.end,
    fromDate,
    toDate,
    label,
    bucket: inclusiveDays > 45 ? 'week' : 'day',
    timeZone: CLINIC_TIME_ZONE,
  };
}

function firstString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value)) return firstString(value[0]);
  return undefined;
}

function isRealDate(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day
  );
}

function calendarSpan(from: string, to: string) {
  const [y1, m1, d1] = from.split('-').map(Number);
  const [y2, m2, d2] = to.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

function prettyDate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function mondayOnOrBefore(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const delta = weekday === 0 ? 6 : weekday - 1;
  return addCalendarDays(iso, -delta);
}
