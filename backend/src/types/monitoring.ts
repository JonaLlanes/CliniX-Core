export const PROGRAM_TYPES = [
  'hypertension',
  'diabetes',
  'copd',
  'heart_failure',
  'ckd',
  'custom',
] as const;

export type ProgramType = (typeof PROGRAM_TYPES)[number];

export const PROGRAM_STATUSES = ['active', 'on_hold', 'completed'] as const;

export type ProgramStatus = (typeof PROGRAM_STATUSES)[number];

/** Status changes a clinician can make. Completed programs stay closed. */
export const PROGRAM_TRANSITIONS: Record<ProgramStatus, readonly ProgramStatus[]> = {
  active: ['on_hold', 'completed'],
  on_hold: ['active', 'completed'],
  completed: [],
};

export const PROGRAM_TYPE_LABELS: Record<ProgramType, string> = {
  hypertension: 'Hypertension',
  diabetes: 'Diabetes',
  copd: 'COPD',
  heart_failure: 'Heart Failure',
  ckd: 'CKD',
  custom: 'Custom',
};

export const PROGRAM_STATUS_LABELS: Record<ProgramStatus, string> = {
  active: 'Active',
  on_hold: 'On Hold',
  completed: 'Completed',
};

export const METRIC_TYPES = [
  'blood_pressure',
  'weight',
  'bmi',
  'a1c',
  'ldl',
  'egfr',
  'custom',
] as const;

export type MetricType = (typeof METRIC_TYPES)[number];

export const METRIC_SOURCES = ['clinic', 'home', 'device', 'caregiver'] as const;

export type MetricSource = (typeof METRIC_SOURCES)[number];

export const METRIC_TYPE_LABELS: Record<MetricType, string> = {
  blood_pressure: 'Blood Pressure',
  weight: 'Weight',
  bmi: 'BMI',
  a1c: 'A1C',
  ldl: 'LDL',
  egfr: 'eGFR',
  custom: 'Custom',
};

export const METRIC_SOURCE_LABELS: Record<MetricSource, string> = {
  clinic: 'Clinic',
  home: 'Home',
  device: 'Device',
  caregiver: 'Caregiver',
};

export const DEFAULT_METRIC_UNITS: Record<MetricType, string> = {
  blood_pressure: 'mmHg',
  weight: 'kg',
  bmi: 'kg/m²',
  a1c: '%',
  ldl: 'mmol/L',
  egfr: 'mL/min/1.73 m²',
  custom: '',
};

/** Metric types shown together as laboratory trends. */
export const LABORATORY_METRIC_TYPES = ['ldl', 'egfr'] as const;

export const RECALL_STATUSES = ['due', 'scheduled', 'completed', 'overdue', 'cancelled'] as const;

export type RecallStatus = (typeof RECALL_STATUSES)[number];

/** Statuses a clinician can request. Overdue is derived from the due date. */
export const RECALL_STATUS_INPUTS = ['due', 'scheduled', 'completed', 'cancelled'] as const;

export type RecallStatusInput = (typeof RECALL_STATUS_INPUTS)[number];

export const RECALL_TRANSITIONS: Record<RecallStatus, readonly RecallStatusInput[]> = {
  due: ['scheduled', 'completed', 'cancelled'],
  scheduled: ['due', 'completed', 'cancelled'],
  overdue: ['due', 'scheduled', 'completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export const RECALL_STATUS_LABELS: Record<RecallStatus, string> = {
  due: 'Due',
  scheduled: 'Scheduled',
  completed: 'Completed',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
};

export const MONITORING_DIAGNOSIS_KINDS = ['problem', 'encounter'] as const;

export type MonitoringDiagnosisKind = (typeof MONITORING_DIAGNOSIS_KINDS)[number];

export const MONITORING_TIMELINE_ACTIONS = [
  'enrolled',
  'metric_recorded',
  'recall_created',
  'recall_completed',
  'completed',
] as const;

export type MonitoringTimelineAction = (typeof MONITORING_TIMELINE_ACTIONS)[number];

export const MONITORING_AUDIT_EVENTS = {
  enrolled: 'monitoring_enrolled',
  programUpdated: 'monitoring_program_updated',
  statusChanged: 'monitoring_status_changed',
  programCompleted: 'monitoring_program_completed',
  metricRecorded: 'monitoring_metric_recorded',
  metricUpdated: 'monitoring_metric_updated',
  recallCreated: 'monitoring_recall_created',
  recallUpdated: 'monitoring_recall_updated',
  recallStatusChanged: 'monitoring_recall_status_changed',
  recallCompleted: 'monitoring_recall_completed',
} as const;

export const TREND_DIRECTIONS = ['up', 'down', 'stable', 'unknown'] as const;

export type TrendDirection = (typeof TREND_DIRECTIONS)[number];
