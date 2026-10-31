export const ENCOUNTER_STATUSES = [
  'open',
  'in_progress',
  'awaiting_signature',
  'signed',
  'amended',
] as const;

export type EncounterStatus = (typeof ENCOUNTER_STATUSES)[number];

/** Provider and documentation transitions. Signing and amending use their own actions. */
export const ENCOUNTER_STATUS_INPUTS = ['in_progress', 'awaiting_signature'] as const;

export type EncounterStatusInput = (typeof ENCOUNTER_STATUS_INPUTS)[number];

export const ENCOUNTER_TRANSITIONS: Record<EncounterStatus, readonly EncounterStatus[]> = {
  open: ['in_progress'],
  in_progress: ['awaiting_signature'],
  awaiting_signature: ['signed'],
  signed: ['amended'],
  amended: [],
};

export const ENCOUNTER_TIMELINE_EVENTS = [
  'opened',
  'in_progress',
  'awaiting_signature',
  'signed',
  'amended',
  'provider_assigned',
  'documentation',
] as const;

export type EncounterTimelineEventName = (typeof ENCOUNTER_TIMELINE_EVENTS)[number];

/** Visits a provider can launch an encounter from. */
export const ENCOUNTER_SOURCE_VISIT_STATUSES = ['waiting', 'roomed', 'in_progress'] as const;

export const LOCKED_ENCOUNTER_STATUSES: readonly EncounterStatus[] = ['signed', 'amended'];

export const ENCOUNTER_AUDIT_EVENTS = {
  created: 'encounter_created',
  statusChanged: 'encounter_status_changed',
  providerAssigned: 'encounter_provider_assigned',
} as const;
