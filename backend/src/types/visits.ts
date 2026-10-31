import type { AppointmentStatus, ClinicLocation } from './appointments.js';

export const VISIT_STATUSES = [
  'booked',
  'confirmed',
  'arrived',
  'waiting',
  'roomed',
  'in_progress',
  'completed',
  'no_show',
  'cancelled',
] as const;

export type VisitStatus = (typeof VISIT_STATUSES)[number];

/** Status changes accepted by the status route. Arrival and rooming have their own actions. */
export const VISIT_STATUS_INPUTS = [
  'booked',
  'confirmed',
  'waiting',
  'in_progress',
  'completed',
  'no_show',
  'cancelled',
] as const;

export type VisitStatusInput = (typeof VISIT_STATUS_INPUTS)[number];

export const VISIT_TIMELINE_EVENTS = [
  'arrived',
  'waiting',
  'roomed',
  'in_progress',
  'completed',
] as const;

export type VisitTimelineEventName = (typeof VISIT_TIMELINE_EVENTS)[number];

export const VISIT_TRANSITIONS: Record<VisitStatus, VisitStatus[]> = {
  booked: ['confirmed', 'cancelled'],
  confirmed: ['booked', 'no_show', 'cancelled'],
  arrived: ['waiting', 'no_show', 'cancelled'],
  waiting: ['no_show', 'cancelled'],
  roomed: ['waiting', 'in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  no_show: [],
  cancelled: [],
};

export const CHECK_IN_QUEUE: VisitStatus[] = ['booked', 'confirmed'];
export const FLOOR_STATUSES: VisitStatus[] = ['arrived', 'waiting', 'roomed', 'in_progress'];
export const PROVIDER_WAITING: VisitStatus[] = ['arrived', 'waiting'];
export const CLOSED_STATUSES: VisitStatus[] = ['completed', 'no_show', 'cancelled'];
export const ROOMABLE_STATUSES: VisitStatus[] = ['arrived', 'waiting', 'roomed', 'in_progress'];

export const EXAM_ROOMS: Record<ClinicLocation, string[]> = {
  'Toronto Main': ['Exam 1', 'Exam 2', 'Exam 3', 'Exam 4'],
  'North York': ['Exam 1', 'Exam 2', 'Exam 3'],
  Mississauga: ['Exam 1', 'Exam 2', 'Exam 3'],
  Virtual: ['Virtual'],
};

export function roomsFor(location: string) {
  if ((Object.keys(EXAM_ROOMS) as string[]).includes(location)) {
    return EXAM_ROOMS[location as ClinicLocation];
  }
  return [];
}

/** Waiting, roomed, and in progress stay on the appointment as arrived. */
export function appointmentStatusForVisit(status: VisitStatus): AppointmentStatus {
  switch (status) {
    case 'waiting':
    case 'roomed':
    case 'in_progress':
    case 'arrived':
      return 'arrived';
    case 'completed':
      return 'completed';
    case 'no_show':
      return 'no_show';
    case 'cancelled':
      return 'cancelled';
    case 'confirmed':
      return 'confirmed';
    case 'booked':
      return 'booked';
  }
}
