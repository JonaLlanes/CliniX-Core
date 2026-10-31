export const CLINIC_TIME_ZONE = 'America/Toronto';

function offsetMs(instant: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = dtf.formatToParts(instant);
  const pick = (type: Intl.DateTimeFormatPartTypes) => {
    const raw = parts.find((part) => part.type === type)?.value ?? '0';
    const value = type === 'hour' && raw === '24' ? '0' : raw;
    return Number(value);
  };
  const asWallClock = Date.UTC(
    pick('year'),
    pick('month') - 1,
    pick('day'),
    pick('hour'),
    pick('minute'),
    pick('second')
  );
  return asWallClock - instant.getTime();
}

/** Wall-clock time in the clinic timezone, as a UTC instant. */
export function zonedDateTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone = CLINIC_TIME_ZONE
) {
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  let utc = wallAsUtc;
  for (let i = 0; i < 2; i += 1) {
    utc = wallAsUtc - offsetMs(new Date(utc), timeZone);
  }
  return new Date(utc);
}

export function clinicDayRange(date: string, timeZone = CLINIC_TIME_ZONE) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const start = zonedDateTime(year, month, day, 0, 0, timeZone);
  const next = new Date(Date.UTC(year, month - 1, day));
  next.setUTCDate(next.getUTCDate() + 1);
  const end = zonedDateTime(
    next.getUTCFullYear(),
    next.getUTCMonth() + 1,
    next.getUTCDate(),
    0,
    0,
    timeZone
  );
  return { start, end };
}

/** Today (or today plus a day offset) at a clinic wall-clock time. */
export function clinicDateTime(
  dayOffset: number,
  hour: number,
  minute = 0,
  timeZone = CLINIC_TIME_ZONE
) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const [year, month, day] = today.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + dayOffset));
  return zonedDateTime(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate(),
    hour,
    minute,
    timeZone
  );
}

/** Calendar date in the clinic timezone, YYYY-MM-DD. */
export function clinicIsoDate(instant = new Date(), timeZone = CLINIC_TIME_ZONE) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

/** Add calendar days to a YYYY-MM-DD date. Does not apply a timezone offset. */
export function addCalendarDays(iso: string, days: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) throw new Error('Invalid clinic date');
  const shifted = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatClinicRange(start: Date, end: Date, timeZone = CLINIC_TIME_ZONE) {
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(start);
  const endTime = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(end);
  return `${day}–${endTime}`;
}
