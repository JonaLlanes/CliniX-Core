import type { VisitBoardRow, VisitTimelineEvent } from '../api/client';

export function flowStatus(row: VisitBoardRow) {
  return row.visit?.status || row.appointment.status;
}

export function waitedLabel(arrival?: string | null) {
  if (!arrival) return '';
  const mins = Math.max(0, Math.floor((Date.now() - new Date(arrival).getTime()) / 60000));
  if (mins < 1) return 'Just arrived';
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export function timelineActor(actor: VisitTimelineEvent['actorId']) {
  if (!actor || typeof actor === 'string') return 'Staff';
  return actor.displayName || 'Staff';
}

export const TIMELINE_LABELS: Record<string, string> = {
  arrived: 'Arrived',
  waiting: 'Waiting',
  roomed: 'Roomed',
  in_progress: 'In progress',
  completed: 'Completed',
};

export function formatDob(value?: string) {
  if (!value) return '—';
  return value.slice(0, 10);
}

export function healthCardLabel(patient: VisitBoardRow['appointment']['patientId']) {
  const card = patient.provincialHealth;
  if (!card?.healthCardNumber) return '';
  return `${card.province} ${card.healthCardNumber}${card.versionCode ? `-${card.versionCode}` : ''}`;
}
