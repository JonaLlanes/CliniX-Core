export const ROLES = [
  'clinician',
  'nurse',
  'caregiver',
  'admin',
  'pharmacist',
  'insight_service',
] as const;

export type Role = (typeof ROLES)[number];

export const CLINICAL_ROLES = [
  'clinician',
  'nurse',
  'caregiver',
  'pharmacist',
] as const;
