export const DIAGNOSIS_TYPES = ['working', 'final', 'encounter'] as const;

export type DiagnosisType = (typeof DIAGNOSIS_TYPES)[number];

export const PROMOTION_TARGETS = ['active_problem', 'existing_problem'] as const;

export type PromotionTarget = (typeof PROMOTION_TARGETS)[number];

export const PROBLEM_STATUSES = ['active', 'inactive', 'resolved'] as const;

export type ProblemStatus = (typeof PROBLEM_STATUSES)[number];

export const PROBLEM_SEVERITIES = ['mild', 'moderate', 'severe', 'unknown'] as const;

export type ProblemSeverity = (typeof PROBLEM_SEVERITIES)[number];

export const PROBLEM_CODE_SYSTEMS = ['ICD-10', 'ICD-10-CA', 'SNOMED'] as const;

export type ProblemCodeSystem = (typeof PROBLEM_CODE_SYSTEMS)[number];

/** ICD-10-CA category plus an optional decimal (for example I10 or E11.9). */
export const ICD10CA_PATTERN = /^[A-Z][0-9][0-9A-Z](?:\.[0-9A-Z]{1,4})?$/;

export const DIAGNOSIS_AUDIT_EVENTS = {
  created: 'diagnosis_created',
  problemUpdated: 'problem_updated',
  statusChanged: 'problem_status_changed',
} as const;
