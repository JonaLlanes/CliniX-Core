import type { VisitBoard, VisitBoardRow, VisitStatus } from '../../api/client';
import { flowStatus } from '../visitDisplay';
import { visitClock } from './timing';

export type StatusAction =
  | { type: 'status'; status: 'waiting' | 'in_progress' | 'completed' }
  | { type: 'room'; examRoom: string };

export const KANBAN_COLUMNS: {
  status: 'arrived' | 'waiting' | 'roomed' | 'in_progress' | 'completed';
  title: string;
  hint: string;
  emptyTitle: string;
  emptyBody: string;
}[] = [
  {
    status: 'arrived',
    title: 'Arrived',
    hint: 'Checked in',
    emptyTitle: 'No arrived patients',
    emptyBody: 'Patients appear here after check-in, before they are sent to the waiting room.',
  },
  {
    status: 'waiting',
    title: 'Waiting',
    hint: 'Waiting room',
    emptyTitle: 'Waiting room is clear',
    emptyBody: 'No patients are waiting for a room.',
  },
  {
    status: 'roomed',
    title: 'Roomed',
    hint: 'Exam room',
    emptyTitle: 'No roomed patients',
    emptyBody: 'Assign a room from the waiting column to move a patient here.',
  },
  {
    status: 'in_progress',
    title: 'In Progress',
    hint: 'With the provider',
    emptyTitle: 'No visits in progress',
    emptyBody: 'Roomed visits move here when the visit starts.',
  },
  {
    status: 'completed',
    title: 'Completed',
    hint: 'Finished',
    emptyTitle: 'None completed',
    emptyBody: 'Finished visits for this clinic day will collect here.',
  },
];

export const STATUS_FILTERS: { value: VisitStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'booked', label: 'Booked' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'arrived', label: 'Arrived' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'roomed', label: 'Roomed' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'no_show', label: 'No show' },
  { value: 'cancelled', label: 'Cancelled' },
];

const FILTER_VALUES = new Set<string>(STATUS_FILTERS.map((item) => item.value));

export function isStatusFilter(value: string): value is VisitStatus | '' {
  return FILTER_VALUES.has(value);
}

export function uniqueRows(board: VisitBoard) {
  const seen = new Set<string>();
  const rows: VisitBoardRow[] = [];
  for (const row of [...board.checkIn, ...board.waitingRoom, ...board.closed]) {
    if (seen.has(row.appointment._id)) continue;
    seen.add(row.appointment._id);
    rows.push(row);
  }
  return rows;
}

export function patientIds(rows: VisitBoardRow[]) {
  return [...new Set(rows.map((row) => row.appointment.patientId._id))];
}

function stamp(value?: string | null) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

export function columnRows(
  rows: VisitBoardRow[],
  status: (typeof KANBAN_COLUMNS)[number]['status'],
  now: number
) {
  const matched = rows.filter((row) => flowStatus(row) === status);
  if (status === 'completed') {
    return matched.sort((a, b) => stamp(b.visit?.completedAt) - stamp(a.visit?.completedAt));
  }
  if (status === 'roomed') {
    return matched.sort(
      (a, b) => (visitClock(b, now).roomedMinutes ?? -1) - (visitClock(a, now).roomedMinutes ?? -1)
    );
  }
  if (status === 'in_progress') {
    return matched.sort(
      (a, b) => (visitClock(b, now).clinicMinutes ?? -1) - (visitClock(a, now).clinicMinutes ?? -1)
    );
  }
  return matched.sort(
    (a, b) => (visitClock(b, now).waitMinutes ?? -1) - (visitClock(a, now).waitMinutes ?? -1)
  );
}

export function queueRows(rows: VisitBoardRow[], statuses: VisitStatus[]) {
  const allowed = new Set<string>(statuses);
  return rows
    .filter((row) => allowed.has(flowStatus(row)))
    .sort((a, b) => stamp(a.appointment.startTime) - stamp(b.appointment.startTime));
}

export type BoardMetrics = {
  waiting: number;
  averageWait: number | null;
  roomed: number;
  inProgress: number;
  completed: number;
};

export function boardMetrics(rows: VisitBoardRow[], now: number): BoardMetrics {
  const lobby: number[] = [];
  let waiting = 0;
  let roomed = 0;
  let inProgress = 0;
  let completed = 0;
  for (const row of rows) {
    const status = flowStatus(row);
    if (status === 'waiting') waiting += 1;
    if (status === 'roomed') roomed += 1;
    if (status === 'in_progress') inProgress += 1;
    if (status === 'completed') completed += 1;
    if (status === 'arrived' || status === 'waiting') {
      const minutes = visitClock(row, now).waitMinutes;
      if (minutes != null) lobby.push(minutes);
    }
  }
  const averageWait = lobby.length
    ? Math.round(lobby.reduce((sum, value) => sum + value, 0) / lobby.length)
    : null;
  return { waiting, averageWait, roomed, inProgress, completed };
}
