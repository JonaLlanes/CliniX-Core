export const REFERRAL_TYPES = ['specialist', 'allied_health', 'community_service'] as const;

export type ReferralType = (typeof REFERRAL_TYPES)[number];

export const REFERRAL_PRIORITIES = ['routine', 'urgent'] as const;

export type ReferralPriority = (typeof REFERRAL_PRIORITIES)[number];

export const REFERRAL_STATUSES = [
  'draft',
  'sent',
  'accepted',
  'scheduled',
  'completed',
  'closed',
  'cancelled',
] as const;

export type ReferralStatus = (typeof REFERRAL_STATUSES)[number];

/** Statuses still in progress on the chart. */
export const ACTIVE_REFERRAL_STATUSES = ['draft', 'sent', 'accepted', 'scheduled'] as const;

/** Status changes staff can request directly. Cancellation is a separate action. */
export const REFERRAL_STATUS_INPUTS = ['sent', 'accepted', 'scheduled', 'completed', 'closed'] as const;

export type ReferralStatusInput = (typeof REFERRAL_STATUS_INPUTS)[number];

export const REFERRAL_TRANSITIONS: Record<ReferralStatus, readonly ReferralStatus[]> = {
  draft: ['sent', 'cancelled'],
  sent: ['accepted', 'cancelled'],
  accepted: ['scheduled', 'cancelled'],
  scheduled: ['completed', 'cancelled'],
  completed: ['closed'],
  closed: [],
  cancelled: [],
};

/** Statuses that can receive a specialist outcome. */
export const OUTCOME_READY_STATUSES = ['accepted', 'scheduled', 'completed', 'closed'] as const;

export const REFERRAL_DOCUMENT_TYPES = [
  'referral_letter',
  'consultation_note',
  'external_report',
] as const;

export type ReferralDocumentType = (typeof REFERRAL_DOCUMENT_TYPES)[number];

export const REFERRAL_TYPE_LABELS: Record<ReferralType, string> = {
  specialist: 'Specialist',
  allied_health: 'Allied Health',
  community_service: 'Community Service',
};

export const REFERRAL_PRIORITY_LABELS: Record<ReferralPriority, string> = {
  routine: 'Routine',
  urgent: 'Urgent',
};

export const REFERRAL_STATUS_LABELS: Record<ReferralStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
  scheduled: 'Scheduled',
  completed: 'Completed',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

export const REFERRAL_DOCUMENT_LABELS: Record<ReferralDocumentType, string> = {
  referral_letter: 'Referral Letter',
  consultation_note: 'Consultation Note',
  external_report: 'External Report',
};

export const REFERRAL_TIMELINE_ACTIONS = [
  'created',
  'sent',
  'accepted',
  'appointment_scheduled',
  'consultation_received',
  'completed',
] as const;

export type ReferralTimelineAction = (typeof REFERRAL_TIMELINE_ACTIONS)[number];

export const REFERRAL_AUDIT_EVENTS = {
  created: 'referral_created',
  statusChanged: 'referral_status_changed',
  outcomeUpdated: 'referral_outcome_updated',
  cancelled: 'referral_cancelled',
  documentAdded: 'referral_document_added',
  followUpUpdated: 'referral_follow_up_updated',
} as const;
