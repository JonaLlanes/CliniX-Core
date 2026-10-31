export const CARE_PLAN_STATUSES = ['draft', 'active', 'on_hold', 'completed', 'cancelled'] as const;

export type CarePlanStatus = (typeof CARE_PLAN_STATUSES)[number];

export const CARE_PLAN_GOAL_STATUSES = ['not_started', 'in_progress', 'achieved', 'cancelled'] as const;

export type CarePlanGoalStatus = (typeof CARE_PLAN_GOAL_STATUSES)[number];

export const CARE_PLAN_INTERVENTION_STATUSES = ['planned', 'active', 'completed', 'cancelled'] as const;

export type CarePlanInterventionStatus = (typeof CARE_PLAN_INTERVENTION_STATUSES)[number];

export const CARE_PLAN_ROLES = ['clinician', 'nurse', 'caregiver', 'pharmacist'] as const;

export type CarePlanRole = (typeof CARE_PLAN_ROLES)[number];

export const CARE_PLAN_DIAGNOSIS_KINDS = ['problem', 'encounter'] as const;

export type CarePlanDiagnosisKind = (typeof CARE_PLAN_DIAGNOSIS_KINDS)[number];

export const CARE_PLAN_VIEWS = ['current', 'active', 'closed', 'all'] as const;

export type CarePlanView = (typeof CARE_PLAN_VIEWS)[number];

/** Status changes a clinician can make from each care plan status. */
export const CARE_PLAN_TRANSITIONS: Record<CarePlanStatus, readonly CarePlanStatus[]> = {
  draft: ['active', 'cancelled'],
  active: ['on_hold', 'completed', 'cancelled'],
  on_hold: ['active', 'completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export const GOAL_TRANSITIONS: Record<CarePlanGoalStatus, readonly CarePlanGoalStatus[]> = {
  not_started: ['in_progress', 'achieved', 'cancelled'],
  in_progress: ['not_started', 'achieved', 'cancelled'],
  achieved: [],
  cancelled: [],
};

export const INTERVENTION_TRANSITIONS: Record<
  CarePlanInterventionStatus,
  readonly CarePlanInterventionStatus[]
> = {
  planned: ['active', 'completed', 'cancelled'],
  active: ['planned', 'completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export const CARE_PLAN_STATUS_LABELS: Record<CarePlanStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  on_hold: 'On Hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const GOAL_STATUS_LABELS: Record<CarePlanGoalStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  achieved: 'Achieved',
  cancelled: 'Cancelled',
};

export const INTERVENTION_STATUS_LABELS: Record<CarePlanInterventionStatus, string> = {
  planned: 'Planned',
  active: 'Active',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const CARE_PLAN_TIMELINE_ACTIONS = [
  'created',
  'goal_added',
  'intervention_added',
  'goal_achieved',
  'completed',
] as const;

export type CarePlanTimelineAction = (typeof CARE_PLAN_TIMELINE_ACTIONS)[number];

export const CARE_PLAN_AUDIT_EVENTS = {
  created: 'care_plan_created',
  updated: 'care_plan_updated',
  statusChanged: 'care_plan_status_changed',
  completed: 'care_plan_completed',
  goalAdded: 'care_plan_goal_added',
  goalUpdated: 'care_plan_goal_updated',
  goalAchieved: 'care_plan_goal_achieved',
  interventionAdded: 'care_plan_intervention_added',
  interventionUpdated: 'care_plan_intervention_updated',
  progressAdded: 'care_plan_progress_added',
} as const;
