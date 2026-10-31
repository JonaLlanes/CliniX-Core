export const ORDER_TYPES = ['laboratory', 'diagnostic_imaging', 'procedure'] as const;

export type OrderType = (typeof ORDER_TYPES)[number];

export const ORDER_PRIORITIES = ['routine', 'urgent', 'stat'] as const;

export type OrderPriority = (typeof ORDER_PRIORITIES)[number];

export const ORDER_STATUSES = [
  'draft',
  'ordered',
  'scheduled',
  'collected',
  'resulted',
  'completed',
  'cancelled',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Statuses still in progress on the chart. */
export const ACTIVE_ORDER_STATUSES = [
  'draft',
  'ordered',
  'scheduled',
  'collected',
  'resulted',
] as const;

/** Status changes staff can request directly. A result moves an order to resulted. */
export const ORDER_STATUS_INPUTS = ['ordered', 'scheduled', 'collected', 'completed'] as const;

export type OrderStatusInput = (typeof ORDER_STATUS_INPUTS)[number];

export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  draft: ['ordered', 'cancelled'],
  ordered: ['scheduled', 'collected', 'cancelled'],
  scheduled: ['collected', 'cancelled'],
  collected: ['cancelled'],
  resulted: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export const RESULT_STATUSES = ['preliminary', 'final', 'corrected'] as const;

export type ResultStatus = (typeof RESULT_STATUSES)[number];

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  laboratory: 'Laboratory',
  diagnostic_imaging: 'Diagnostic Imaging',
  procedure: 'Procedure',
};

export const ORDER_PRIORITY_LABELS: Record<OrderPriority, string> = {
  routine: 'Routine',
  urgent: 'Urgent',
  stat: 'Stat',
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  draft: 'Draft',
  ordered: 'Ordered',
  scheduled: 'Scheduled',
  collected: 'Collected',
  resulted: 'Resulted',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const RESULT_STATUS_LABELS: Record<ResultStatus, string> = {
  preliminary: 'Preliminary',
  final: 'Final',
  corrected: 'Corrected',
};

export const ORDER_TIMELINE_ACTIONS = [
  'placed',
  'scheduled',
  'collected',
  'result_received',
  'completed',
] as const;

export type OrderTimelineAction = (typeof ORDER_TIMELINE_ACTIONS)[number];

export const ORDER_AUDIT_EVENTS = {
  created: 'order_created',
  statusChanged: 'order_status_changed',
  resultEntered: 'order_result_entered',
  cancelled: 'order_cancelled',
} as const;
