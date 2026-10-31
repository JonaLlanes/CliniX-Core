import { flowStatus } from '../visitDisplay';
/** Lobby wait and time spent roomed before the visit starts. */
export const WAIT_SCALE = { yellowAt: 15, redAt: 30 };
/** Arrival through completion. A routine visit should not turn red at 30 minutes. */
export const CLINIC_SCALE = { yellowAt: 45, redAt: 75 };
const LIVE = new Set(['arrived', 'waiting', 'roomed', 'in_progress']);
export function minutesBetween(start, end, now) {
    if (!start)
        return null;
    const from = new Date(start).getTime();
    if (Number.isNaN(from))
        return null;
    const to = end ? new Date(end).getTime() : now;
    if (Number.isNaN(to))
        return null;
    return Math.max(0, Math.floor((to - from) / 60000));
}
export function thresholdTone(minutes, scale) {
    if (minutes == null)
        return 'none';
    if (minutes >= scale.redAt)
        return 'red';
    if (minutes >= scale.yellowAt)
        return 'yellow';
    return 'green';
}
export function formatDuration(minutes) {
    if (minutes == null)
        return '—';
    if (minutes < 1)
        return '<1m';
    if (minutes < 60)
        return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours}h ${rest}m` : `${hours}h`;
}
export function toneWord(tone) {
    if (tone === 'green')
        return 'On time';
    if (tone === 'yellow')
        return 'Extended';
    if (tone === 'red')
        return 'Long';
    return '';
}
export function visitClock(row, now) {
    const status = flowStatus(row);
    const visit = row.visit;
    const arrival = visit?.arrivalAt;
    const roomedAt = visit?.roomedAt;
    const startedAt = visit?.startedAt;
    const completedAt = visit?.completedAt;
    const live = LIVE.has(status);
    const waitStop = roomedAt || startedAt || completedAt;
    const waitMinutes = !arrival
        ? null
        : status === 'arrived' || status === 'waiting'
            ? minutesBetween(arrival, null, now)
            : waitStop
                ? minutesBetween(arrival, waitStop, now)
                : null;
    const roomedMinutes = !roomedAt
        ? null
        : status === 'completed' && completedAt
            ? minutesBetween(roomedAt, completedAt, now)
            : live
                ? minutesBetween(roomedAt, null, now)
                : null;
    const clinicMinutes = !arrival
        ? null
        : live
            ? minutesBetween(arrival, null, now)
            : completedAt
                ? minutesBetween(arrival, completedAt, now)
                : null;
    return {
        waitMinutes,
        waitTone: thresholdTone(waitMinutes, WAIT_SCALE),
        roomedMinutes,
        roomedTone: status === 'roomed' ? thresholdTone(roomedMinutes, WAIT_SCALE) : 'none',
        clinicMinutes,
        clinicTone: thresholdTone(clinicMinutes, CLINIC_SCALE),
    };
}
export function durationLabel(label, minutes, tone, empty) {
    if (minutes == null)
        return `${label}: ${empty}`;
    const word = toneWord(tone);
    const duration = formatDuration(minutes);
    return word ? `${label}: ${duration}, ${word}` : `${label}: ${duration}`;
}
