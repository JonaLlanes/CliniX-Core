import { Types } from 'mongoose';
import { Condition } from '../models/Condition.js';
import { Encounter } from '../models/Encounter.js';
import { EncounterDiagnosis } from '../models/EncounterDiagnosis.js';
import { Order, type IOrder } from '../models/Order.js';
import { OrderResult } from '../models/OrderResult.js';
import { User } from '../models/User.js';
import { HttpError } from '../middleware/error.js';
import { notDeleted } from '../utils/pagination.js';
import {
  ACTIVE_ORDER_STATUSES,
  ORDER_PRIORITY_LABELS,
  ORDER_STATUS_LABELS,
  ORDER_TRANSITIONS,
  ORDER_TYPE_LABELS,
  RESULT_STATUS_LABELS,
  type OrderPriority,
  type OrderStatus,
  type OrderTimelineAction,
  type OrderType,
  type ResultStatus,
} from '../types/orders.js';

const PERSON = 'displayName role';

const POPULATE = [
  { path: 'orderedBy', select: PERSON },
  { path: 'encounterId', select: 'chiefComplaint openedAt status' },
  { path: 'diagnosisId', select: 'code description diagnosisType primaryDiagnosis' },
  { path: 'conditionId', select: 'display code status' },
  { path: 'statusHistory.actorId', select: PERSON },
];

const RESULT_READY = new Set<OrderStatus>(['ordered', 'scheduled', 'collected', 'resulted', 'completed']);

export type OrderWrite = {
  encounterId: string;
  diagnosisId: string;
  conditionId?: string;
  orderedBy: string;
  orderType: OrderType;
  orderName: string;
  priority: OrderPriority;
  clinicalReason: string;
  instructions?: string;
  status: 'draft' | 'ordered';
  orderedAt?: Date;
};

export type OrderStatusChange = {
  status: 'ordered' | 'scheduled' | 'collected' | 'completed';
  at?: Date;
  note?: string;
};

export type OrderCancelInput = {
  reason: string;
  at?: Date;
};

export type OrderResultWrite = {
  resultType: string;
  value: string;
  unit?: string;
  referenceRange?: string;
  resultDate: Date;
  interpretation?: string;
  status: ResultStatus;
};

export type OrderTimelineSource = {
  _id?: unknown;
  orderType: string;
  orderName: string;
  priority: string;
  orderedAt?: Date | string | null;
  scheduledAt?: Date | string | null;
  collectedAt?: Date | string | null;
  completedAt?: Date | string | null;
};

export type OrderResultTimelineSource = {
  orderId?: unknown;
  resultType: string;
  value: string;
  unit?: string | null;
  status: string;
  resultDate: Date | string;
};

export type OrderTimelinePoint = {
  action: OrderTimelineAction;
  label: string;
  at: Date;
  detail: string;
};

export type OrderListFilter = {
  status?: OrderStatus;
  encounterId?: string;
  view?: 'active' | 'completed';
};

type PresentedOrder = Record<string, unknown> & { _id: unknown };

type SavedOrder = {
  order: PresentedOrder;
  before: Record<string, unknown> | null;
  after: Record<string, unknown>;
};

type SavedResult = SavedOrder & {
  result: Record<string, unknown>;
  statusChanged: boolean;
};

function plain(doc: { toObject: () => object }) {
  return doc.toObject() as Record<string, unknown>;
}

function asDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function assertNotFuture(value: Date, label: string) {
  if (Number.isNaN(value.getTime())) throw new HttpError(400, `${label} is not a valid date`);
  if (value.getTime() > Date.now() + 60_000) {
    throw new HttpError(400, `${label} cannot be in the future`);
  }
}

function latestAt(order: IOrder) {
  let latest = order.createdAt?.getTime() || 0;
  for (const item of order.statusHistory) {
    const time = item.at instanceof Date ? item.at.getTime() : new Date(item.at).getTime();
    if (time > latest) latest = time;
  }
  return new Date(latest);
}

function resolveEventTime(value: Date, earliest: Date, label: string, tooEarly: string) {
  assertNotFuture(value, label);
  if (value.getTime() + 1000 >= earliest.getTime()) return value;
  // The chart time control stores minutes, so a time in the same minute is not an earlier step.
  if (value.getTime() + 60_000 < earliest.getTime()) throw new HttpError(400, tooEarly);
  const bumped = new Date(earliest.getTime() + 1000);
  assertNotFuture(bumped, label);
  return bumped;
}

function statusLabel(status: string) {
  return ORDER_STATUS_LABELS[status as OrderStatus] || status;
}

function stamp(order: IOrder, status: OrderStatus, at: Date) {
  if (status === 'ordered' && !order.orderedAt) order.orderedAt = at;
  if (status === 'scheduled' && !order.scheduledAt) order.scheduledAt = at;
  if (status === 'collected' && !order.collectedAt) order.collectedAt = at;
  if (status === 'resulted' && !order.resultedAt) order.resultedAt = at;
  if (status === 'completed' && !order.completedAt) order.completedAt = at;
  if (status === 'cancelled' && !order.cancelledAt) order.cancelledAt = at;
}

function pushHistory(order: IOrder, status: OrderStatus, at: Date, actorId: string, note?: string) {
  order.statusHistory.push({
    status,
    at,
    actorId: new Types.ObjectId(actorId),
    note: note?.trim() || undefined,
  });
}

function orderDetail(order: OrderTimelineSource) {
  const type = ORDER_TYPE_LABELS[order.orderType as OrderType] || order.orderType;
  const priority = ORDER_PRIORITY_LABELS[order.priority as OrderPriority] || order.priority;
  return [order.orderName, type, priority].filter(Boolean).join(' · ');
}

function resultDetail(order: OrderTimelineSource, result: OrderResultTimelineSource) {
  const value = [result.value, result.unit].filter(Boolean).join(' ');
  const status = RESULT_STATUS_LABELS[result.status as ResultStatus] || result.status;
  return [order.orderName, result.resultType, value, status].filter(Boolean).join(' · ');
}

function collectedLabel(orderType: string) {
  return orderType === 'laboratory' ? 'Specimen collected' : 'Collected';
}

export function orderTimelinePoints(
  order: OrderTimelineSource,
  results: OrderResultTimelineSource[] = []
): OrderTimelinePoint[] {
  const points: OrderTimelinePoint[] = [];
  const detail = orderDetail(order);
  const placed = asDate(order.orderedAt);
  if (placed) points.push({ action: 'placed', label: 'Order placed', at: placed, detail });
  const scheduled = asDate(order.scheduledAt);
  if (scheduled) points.push({ action: 'scheduled', label: 'Order scheduled', at: scheduled, detail });
  const collected = asDate(order.collectedAt);
  if (collected) {
    points.push({ action: 'collected', label: collectedLabel(order.orderType), at: collected, detail });
  }
  for (const result of results) {
    const at = asDate(result.resultDate);
    if (!at) continue;
    points.push({
      action: 'result_received',
      label: 'Result received',
      at,
      detail: resultDetail(order, result),
    });
  }
  const completed = asDate(order.completedAt);
  if (completed) points.push({ action: 'completed', label: 'Order completed', at: completed, detail });
  points.sort((a, b) => a.at.getTime() - b.at.getTime());
  return points;
}

export function timelinePointsForOrders(
  orders: OrderTimelineSource[],
  results: OrderResultTimelineSource[]
) {
  const grouped = new Map<string, OrderResultTimelineSource[]>();
  for (const result of results) {
    const key = String(result.orderId ?? '');
    const list = grouped.get(key) || [];
    list.push(result);
    grouped.set(key, list);
  }
  return orders.flatMap((order) => orderTimelinePoints(order, grouped.get(String(order._id ?? '')) || []));
}

async function assertEncounter(encounterId: string, patientId: string) {
  if (!Types.ObjectId.isValid(encounterId)) throw new HttpError(400, 'Expected an id');
  const encounter = await Encounter.findOne({ _id: encounterId, patientId, ...notDeleted }).select('_id');
  if (!encounter) throw new HttpError(404, 'Encounter not found');
  return encounter._id;
}

async function assertDiagnosis(diagnosisId: string, patientId: string, encounterId: Types.ObjectId) {
  if (!Types.ObjectId.isValid(diagnosisId)) throw new HttpError(400, 'Expected an id');
  const diagnosis = await EncounterDiagnosis.findOne({
    _id: diagnosisId,
    patientId,
    encounterId,
    ...notDeleted,
  }).select('_id');
  if (!diagnosis) throw new HttpError(404, 'Encounter diagnosis not found');
  return diagnosis._id;
}

async function assertProblem(conditionId: string | undefined, patientId: string) {
  if (!conditionId) return null;
  if (!Types.ObjectId.isValid(conditionId)) throw new HttpError(400, 'Expected an id');
  const problem = await Condition.findOne({ _id: conditionId, patientId, ...notDeleted }).select('_id');
  if (!problem) throw new HttpError(404, 'Problem list item not found');
  return problem._id;
}

async function assertOrderingClinician(clinicianId: string) {
  if (!Types.ObjectId.isValid(clinicianId)) throw new HttpError(400, 'Expected an id');
  const clinician = await User.findById(clinicianId).select(PERSON);
  if (!clinician) throw new HttpError(404, 'Ordering clinician not found');
  if (clinician.role !== 'clinician') throw new HttpError(400, 'Orders are placed by a clinician');
  return clinician;
}

async function getOrder(id: string, patientId: string) {
  if (!Types.ObjectId.isValid(id)) throw new HttpError(400, 'Expected an id');
  const order = await Order.findOne({ _id: id, patientId, ...notDeleted });
  if (!order) throw new HttpError(404, 'Order not found');
  return order;
}

function groupResults(results: Array<OrderResultTimelineSource & { orderId?: unknown }>) {
  const grouped = new Map<string, typeof results>();
  for (const result of results) {
    const key = String(result.orderId ?? '');
    const list = grouped.get(key) || [];
    list.push(result);
    grouped.set(key, list);
  }
  return grouped;
}

export async function presentOrders(orders: IOrder[]): Promise<PresentedOrder[]> {
  if (!orders.length) return [];
  await Order.populate(orders, POPULATE);
  const results = await OrderResult.find({
    orderId: { $in: orders.map((order) => order._id) },
    ...notDeleted,
  })
    .sort({ resultDate: 1, createdAt: 1 })
    .lean();
  const grouped = groupResults(results);
  return orders.map((order) => {
    const body = order.toObject() as Record<string, unknown> & OrderTimelineSource;
    const orderResults = grouped.get(String(order._id)) || [];
    return {
      ...body,
      _id: order._id,
      results: orderResults,
      timeline: orderTimelinePoints(body, orderResults).map((point) => ({
        ...point,
        at: point.at.toISOString(),
      })),
    } as PresentedOrder;
  });
}

async function presented(order: IOrder) {
  const [item] = await presentOrders([order]);
  return item;
}

export async function listOrderingClinicians() {
  return User.find({ role: 'clinician' }).select(PERSON).sort({ displayName: 1 });
}

export async function orderSummary(patientId: string) {
  const activeFilter = { patientId, status: { $in: [...ACTIVE_ORDER_STATUSES] }, ...notDeleted };
  const [activeCount, completed, cancelled, rows] = await Promise.all([
    Order.countDocuments(activeFilter),
    Order.countDocuments({ patientId, status: 'completed', ...notDeleted }),
    Order.countDocuments({ patientId, status: 'cancelled', ...notDeleted }),
    Order.find(activeFilter).sort({ createdAt: -1 }).limit(50),
  ]);
  const rank: Record<OrderPriority, number> = { stat: 0, urgent: 1, routine: 2 };
  rows.sort(
    (a, b) => rank[a.priority] - rank[b.priority] || b.createdAt.getTime() - a.createdAt.getTime()
  );
  return {
    active: await presentOrders(rows.slice(0, 8)),
    counts: { active: activeCount, completed, cancelled },
  };
}

export async function listOrders(patientId: string, filter: OrderListFilter, skip: number, limit: number) {
  const query: Record<string, unknown> = { patientId, ...notDeleted };
  if (filter.view === 'active') query.status = { $in: [...ACTIVE_ORDER_STATUSES] };
  else if (filter.view === 'completed') query.status = { $in: ['completed', 'cancelled'] };
  else if (filter.status) query.status = filter.status;
  if (filter.encounterId) {
    if (!Types.ObjectId.isValid(filter.encounterId)) throw new HttpError(400, 'Expected an id');
    query.encounterId = filter.encounterId;
  }
  const [rows, total] = await Promise.all([
    Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Order.countDocuments(query),
  ]);
  return { data: await presentOrders(rows), total };
}

export async function getPresentedOrder(id: string, patientId: string) {
  return presented(await getOrder(id, patientId));
}

export async function createOrder(patientId: string, input: OrderWrite, actorId: string): Promise<SavedOrder> {
  const encounterId = await assertEncounter(input.encounterId, patientId);
  const diagnosisId = await assertDiagnosis(input.diagnosisId, patientId, encounterId);
  const conditionId = await assertProblem(input.conditionId, patientId);
  const orderedBy = await assertOrderingClinician(input.orderedBy);
  const now = new Date();
  const placedAt = input.orderedAt ?? now;
  if (input.status === 'ordered') assertNotFuture(placedAt, 'Order time');
  const at = input.status === 'ordered' ? placedAt : now;
  const order = await Order.create({
    patientId,
    encounterId,
    diagnosisId,
    conditionId,
    orderedBy: orderedBy._id,
    orderType: input.orderType,
    orderName: input.orderName.trim(),
    priority: input.priority,
    clinicalReason: input.clinicalReason.trim(),
    instructions: input.instructions?.trim() || undefined,
    orderedAt: input.status === 'ordered' ? placedAt : null,
    status: input.status,
    statusHistory: [{ status: input.status, at, actorId: new Types.ObjectId(actorId) }],
  });
  const after = plain(order);
  return { order: await presented(order), before: null, after };
}

export async function changeOrderStatus(
  id: string,
  patientId: string,
  input: OrderStatusChange,
  actorId: string
): Promise<SavedOrder> {
  const order = await getOrder(id, patientId);
  const next = input.status;
  if (!ORDER_TRANSITIONS[order.status].includes(next)) {
    throw new HttpError(409, `A ${statusLabel(order.status).toLowerCase()} order cannot be marked ${statusLabel(next).toLowerCase()}`);
  }
  if (next === 'completed') {
    const count = await OrderResult.countDocuments({ orderId: order._id, ...notDeleted });
    if (count === 0) throw new HttpError(409, 'Enter a result before completing this order');
  }
  const at = resolveEventTime(
    input.at ?? new Date(),
    latestAt(order),
    'Status time',
    'Status time cannot be before the previous status change'
  );
  const before = plain(order);
  order.status = next;
  stamp(order, next, at);
  pushHistory(order, next, at, actorId, input.note);
  await order.save();
  const after = plain(order);
  return { order: await presented(order), before, after };
}

export async function cancelOrder(
  id: string,
  patientId: string,
  input: OrderCancelInput,
  actorId: string
): Promise<SavedOrder> {
  const order = await getOrder(id, patientId);
  if (!ORDER_TRANSITIONS[order.status].includes('cancelled')) {
    throw new HttpError(409, `This order is ${statusLabel(order.status).toLowerCase()} and stays on the chart`);
  }
  const at = resolveEventTime(
    input.at ?? new Date(),
    latestAt(order),
    'Cancellation time',
    'Cancellation time cannot be before the previous status change'
  );
  const before = plain(order);
  order.status = 'cancelled';
  stamp(order, 'cancelled', at);
  pushHistory(order, 'cancelled', at, actorId, input.reason.trim());
  await order.save();
  const after = plain(order);
  return { order: await presented(order), before, after };
}

export async function addOrderResult(
  id: string,
  patientId: string,
  input: OrderResultWrite,
  actorId: string
): Promise<SavedResult> {
  const order = await getOrder(id, patientId);
  if (!RESULT_READY.has(order.status)) {
    if (order.status === 'draft') throw new HttpError(409, 'Place the order before entering a result');
    throw new HttpError(409, 'This order is cancelled');
  }
  const placed = order.orderedAt || order.createdAt;
  let resultDate = resolveEventTime(
    input.resultDate,
    placed,
    'Result date',
    'Result date cannot be before the order was placed'
  );
  const movesToResulted = order.status === 'ordered' || order.status === 'scheduled' || order.status === 'collected';
  if (movesToResulted) {
    resultDate = resolveEventTime(
      resultDate,
      latestAt(order),
      'Result date',
      'Result date cannot be before the previous status change'
    );
  }
  const before = plain(order);
  const created = await OrderResult.create({
    orderId: order._id,
    patientId: order.patientId,
    resultType: input.resultType.trim(),
    value: input.value.trim(),
    unit: input.unit?.trim() || undefined,
    referenceRange: input.referenceRange?.trim() || undefined,
    resultDate,
    interpretation: input.interpretation?.trim() || undefined,
    status: input.status,
  });
  let statusChanged = false;
  try {
    if (movesToResulted) {
      order.status = 'resulted';
      stamp(order, 'resulted', resultDate);
      pushHistory(order, 'resulted', resultDate, actorId, 'Result received');
      await order.save();
      statusChanged = true;
    }
  } catch (err) {
    await OrderResult.deleteOne({ _id: created._id });
    throw err;
  }
  const after = plain(order);
  const result = plain(created);
  return {
    order: await presented(order),
    before,
    after,
    result,
    statusChanged,
  };
}

export async function listPatientResults(patientId: string, skip: number, limit: number) {
  const filter = { patientId, ...notDeleted };
  const [rows, total] = await Promise.all([
    OrderResult.find(filter).sort({ resultDate: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
    OrderResult.countDocuments(filter),
  ]);
  const orders = await Order.find({
    _id: { $in: rows.map((row) => row.orderId) },
    ...notDeleted,
  })
    .select('orderName orderType priority status diagnosisId encounterId')
    .populate('diagnosisId', 'code description diagnosisType primaryDiagnosis')
    .populate('encounterId', 'chiefComplaint openedAt status')
    .lean();
  const byId = new Map(orders.map((order) => [String(order._id), order]));
  return {
    data: rows.map((row) => ({
      ...row,
      order: byId.get(String(row.orderId)) || null,
    })),
    total,
  };
}
