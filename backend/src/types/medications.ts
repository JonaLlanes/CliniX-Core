export const MEDICATION_STATUSES = ['active', 'on-hold', 'completed', 'discontinued'] as const;

export type MedicationStatus = (typeof MEDICATION_STATUSES)[number];

export const MEDICATION_EVENT_ACTIONS = [
  'started',
  'changed',
  'held',
  'resumed',
  'discontinued',
  'completed',
] as const;

export type MedicationEventAction = (typeof MEDICATION_EVENT_ACTIONS)[number];

export const MEDICATION_TIMELINE_LABELS: Record<MedicationEventAction, string> = {
  started: 'Medication started',
  changed: 'Medication changed',
  held: 'Medication held',
  resumed: 'Medication resumed',
  discontinued: 'Medication discontinued',
  completed: 'Medication completed',
};

export const MEDICATION_AUDIT_EVENTS = {
  added: 'medication_added',
  changed: 'medication_changed',
  held: 'medication_held',
  resumed: 'medication_resumed',
  discontinued: 'medication_discontinued',
  completed: 'medication_completed',
  allergyAcknowledged: 'medication_allergy_warning_acknowledged',
} as const;

export type AllergyWarning = {
  allergyId: string;
  substance: string;
  reaction: string;
  severity: string;
  matchedOn: string;
};
