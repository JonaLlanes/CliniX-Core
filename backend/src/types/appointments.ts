export const APPOINTMENT_STATUSES = [
  'booked',
  'confirmed',
  'arrived',
  'no_show',
  'cancelled',
  'completed',
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const APPOINTMENT_TYPES = [
  'new_patient',
  'follow_up',
  'consultation',
  'procedure',
  'telehealth',
] as const;

export type AppointmentType = (typeof APPOINTMENT_TYPES)[number];

export const CLINIC_LOCATIONS = [
  'Toronto Main',
  'North York',
  'Mississauga',
  'Virtual',
] as const;

export type ClinicLocation = (typeof CLINIC_LOCATIONS)[number];

/** Statuses that still occupy the provider and patient for overlap checks. */
export const APPOINTMENT_HOLDING_STATUSES: AppointmentStatus[] = [
  'booked',
  'confirmed',
  'arrived',
  'completed',
];

/** Status changes made with PATCH. Cancellation uses the cancel action. */
export const APPOINTMENT_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  booked: ['confirmed', 'arrived'],
  confirmed: ['booked', 'arrived', 'no_show'],
  arrived: ['completed', 'no_show'],
  no_show: [],
  cancelled: [],
  completed: [],
};

export const RESCHEDULABLE_STATUSES: AppointmentStatus[] = ['booked', 'confirmed', 'no_show'];

export const CANCELLABLE_STATUSES: AppointmentStatus[] = ['booked', 'confirmed', 'arrived'];
