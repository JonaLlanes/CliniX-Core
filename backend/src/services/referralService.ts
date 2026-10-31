import { Types } from 'mongoose';
import { CarePlan } from '../models/CarePlan.js';
import { Condition } from '../models/Condition.js';
import { Encounter } from '../models/Encounter.js';
import { EncounterDiagnosis } from '../models/EncounterDiagnosis.js';
import { Referral, type IReferral } from '../models/Referral.js';
import { ReferralDocument } from '../models/ReferralDocument.js';
import { ReferralOutcome } from '../models/ReferralOutcome.js';
import { HttpError } from '../middleware/error.js';
import { notDeleted } from '../utils/pagination.js';
import {
  ACTIVE_REFERRAL_STATUSES,
  OUTCOME_READY_STATUSES,
  REFERRAL_PRIORITY_LABELS,
  REFERRAL_STATUS_LABELS,
  REFERRAL_TRANSITIONS,
  REFERRAL_TYPE_LABELS,
  type ReferralDocumentType,
  type ReferralPriority,
  type ReferralStatus,
  type ReferralTimelineAction,
  type ReferralType,
} from '../types/referrals.js';

const PERSON = 'displayName role';

const POPULATE = [
  { path: 'createdBy', select: PERSON },
  { path: 'encounterId', select: 'chiefComplaint openedAt status' },
  { path: 'diagnosisId', select: 'code description diagnosisType primaryDiagnosis' },
  { path: 'conditionId', select: 'display code status' },
  { path: 'carePlanId', select: 'title status' },
  { path: 'statusHistory.actorId', select: PERSON },
];

const OUTCOME_READY = new Set<ReferralStatus>(OUTCOME_READY_STATUSES);
const FOLLOW_UP_READY = new Set<ReferralStatus>(['sent', 'accepted', 'scheduled', 'completed']);

export type ReferralWrite = {
  encounterId: string;
  diagnosisId: string;
  conditionId?: string;
  carePlanId?: string;
  referralType: ReferralType;
  specialty: string;
  specialistName: string;
  organization: string;
  reasonForReferral: string;
  priority: ReferralPriority;
  referralDate: Date;
  status: 'draft' | 'sent';
};

export type ReferralStatusChange = {
  status: 'sent' | 'accepted' | 'scheduled' | 'completed' | 'closed';
  at?: Date;
  appointmentDate?: Date;
  note?: string;
};

export type ReferralCancelInput = {
  reason: string;
  at?: Date;
};

export type ReferralOutcomeWrite = {
  recommendations: string;
  consultationSummary: string;
  nextSteps: string;
  recordedAt?: Date;
  followUpRequired?: boolean;
};

export type ReferralDocumentWrite = {
  documentType: ReferralDocumentType;
  title: string;
  description?: string;
  recordedAt?: Date;
};

export type ReferralFollowUpWrite = {
  followUpRequired: boolean;
  appointmentDate?: Date;
};

export type ReferralTimelineSource = {
  _id?: unknown;
  referralType: string;
  specialty: string;
  specialistName: string;
  priority: string;
  createdAt?: Date | string | null;
  sentAt?: Date | string | null;
  acceptedAt?: Date | string | null;
  scheduledAt?: Date | string | null;
  appointmentDate?: Date | string | null;
  outcomeReceivedDate?: Date | string | null;
  completedAt?: Date | string | null;
};

export type ReferralTimelinePoint = {
  action: ReferralTimelineAction;
  label: string;
  at: Date;
  detail: string;
};

export type ReferralListFilter = {
  status?: ReferralStatus;
  encounterId?: string;
  view?: 'active' | 'completed' | 'follow_up';
};

type LinkedDiagnosisView = {
  kind: 'encounter' | 'problem' | 'care_plan';
  label: string;
  text: string;
};

type PresentedReferral = Record<string, unknown> & { _id: unknown };

type SavedReferral = {
  referral: PresentedReferral;
  before: Record<string, unknown> | null;
  after: Record<string, unknown>;
};

type SavedOutcome = SavedReferral & {
  outcome: Record<string, unknown> | null;
  previousOutcome: Record<string, unknown> | null;
  outcomeCreated: boolean;
};

type SavedDocument = SavedReferral & {
  document: Record<string, unknown>;
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

function latestAt(referral: IReferral) {
  let latest = referral.createdAt?.getTime() || 0;
  for (const item of referral.statusHistory) {
    const time = item.at instanceof Date ? item.at.getTime() : new Date(item.at).getTime();
    if (time > latest) latest = time;
  }
  if (referral.outcomeReceivedDate && referral.outcomeReceivedDate.getTime() > latest) {
    latest = referral.outcomeReceivedDate.getTime();
  }
  return new Date(latest);
}

function resolveEventTime(value: Date, earliest: Date, label: string, tooEarly: string) {
  assertNotFuture(value, label);
  if (value.getTime() + 1000 >= earliest.getTime()) return value;
  if (value.getTime() + 60_000 < earliest.getTime()) throw new HttpError(400, tooEarly);
  const bumped = new Date(earliest.getTime() + 1000);
  assertNotFuture(bumped, label);
  return bumped;
}

function assertAppointmentDate(appointmentDate: Date, referralDate: Date) {
  if (Number.isNaN(appointmentDate.getTime())) {
    throw new HttpError(400, 'Appointment date is not a valid date');
  }
  if (appointmentDate.getTime() + 60_000 < referralDate.getTime()) {
    throw new HttpError(400, 'Appointment date cannot be before the referral date');
  }
}

function statusLabel(status: string) {
  return REFERRAL_STATUS_LABELS[status as ReferralStatus] || status;
}

function stamp(referral: IReferral, status: ReferralStatus, at: Date, appointmentDate?: Date) {
  if (status === 'sent' && !referral.sentAt) referral.sentAt = at;
  if (status === 'accepted' && !referral.acceptedAt) referral.acceptedAt = at;
  if (status === 'scheduled') {
    if (!referral.scheduledAt) referral.scheduledAt = at;
    if (appointmentDate) referral.appointmentDate = appointmentDate;
  }
  if (status === 'completed' && !referral.completedAt) referral.completedAt = at;
  if (status === 'closed' && !referral.closedAt) referral.closedAt = at;
  if (status === 'cancelled' && !referral.cancelledAt) referral.cancelledAt = at;
}

function pushHistory(referral: IReferral, status: ReferralStatus, at: Date, actorId: string, note?: string) {
  referral.statusHistory.push({
    status,
    at,
    actorId: new Types.ObjectId(actorId),
    note: note?.trim() || undefined,
  });
}

function referralDetail(referral: ReferralTimelineSource) {
  const type = REFERRAL_TYPE_LABELS[referral.referralType as ReferralType] || referral.referralType;
  const priority = REFERRAL_PRIORITY_LABELS[referral.priority as ReferralPriority] || referral.priority;
  return [referral.specialistName, referral.specialty, type, priority].filter(Boolean).join(' · ');
}

function appointmentLabel(value: Date | string | null | undefined) {
  const date = asDate(value);
  if (!date) return '';
  return `Appointment ${date.toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })}`;
}

function scheduleDetail(referral: ReferralTimelineSource) {
  return [referralDetail(referral), appointmentLabel(referral.appointmentDate)].filter(Boolean).join(' · ');
}

export function referralTimelinePoints(referral: ReferralTimelineSource): ReferralTimelinePoint[] {
  const points: ReferralTimelinePoint[] = [];
  const detail = referralDetail(referral);
  const created = asDate(referral.createdAt);
  if (created) points.push({ action: 'created', label: 'Referral created', at: created, detail });
  const sent = asDate(referral.sentAt);
  if (sent) points.push({ action: 'sent', label: 'Referral sent', at: sent, detail });
  const accepted = asDate(referral.acceptedAt);
  if (accepted) points.push({ action: 'accepted', label: 'Referral accepted', at: accepted, detail });
  const scheduled = asDate(referral.scheduledAt);
  if (scheduled) {
    points.push({
      action: 'appointment_scheduled',
      label: 'Appointment scheduled',
      at: scheduled,
      detail: scheduleDetail(referral),
    });
  }
  const consult = asDate(referral.outcomeReceivedDate);
  if (consult) {
    points.push({ action: 'consultation_received', label: 'Consultation received', at: consult, detail });
  }
  const completed = asDate(referral.completedAt);
  if (completed) points.push({ action: 'completed', label: 'Referral completed', at: completed, detail });
  points.sort((a, b) => a.at.getTime() - b.at.getTime());
  return points;
}

export function timelinePointsForReferrals(referrals: ReferralTimelineSource[]) {
  return referrals.flatMap((referral) => referralTimelinePoints(referral));
}

function recordOf(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function linkedDiagnoses(body: Record<string, unknown>): LinkedDiagnosisView[] {
  const links: LinkedDiagnosisView[] = [];
  const diagnosis = recordOf(body.diagnosisId);
  if (diagnosis) {
    const text = [diagnosis.code, diagnosis.description].filter(Boolean).join(' · ');
    if (text) links.push({ kind: 'encounter', label: 'Encounter diagnosis', text });
  }
  const problem = recordOf(body.conditionId);
  if (problem) {
    const text = [problem.display, problem.code].filter(Boolean).join(' · ');
    if (text) links.push({ kind: 'problem', label: 'Active problem', text });
  }
  const plan = recordOf(body.carePlanId);
  if (plan && plan.title) {
    links.push({ kind: 'care_plan', label: 'Care plan', text: String(plan.title) });
  }
  return links;
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
  const problem = await Condition.findOne({ _id: conditionId, patientId, ...notDeleted }).select('_id status');
  if (!problem) throw new HttpError(404, 'Problem list item not found');
  if (problem.status !== 'active') throw new HttpError(400, 'Link an active problem');
  return problem._id;
}

async function assertCarePlan(carePlanId: string | undefined, patientId: string) {
  if (!carePlanId) return null;
  if (!Types.ObjectId.isValid(carePlanId)) throw new HttpError(400, 'Expected an id');
  const plan = await CarePlan.findOne({ _id: carePlanId, patientId, ...notDeleted }).select('_id status');
  if (!plan) throw new HttpError(404, 'Care plan not found');
  if (plan.status === 'cancelled') throw new HttpError(400, 'That care plan is cancelled');
  return plan._id;
}

async function getReferral(id: string, patientId: string) {
  if (!Types.ObjectId.isValid(id)) throw new HttpError(400, 'Expected an id');
  const referral = await Referral.findOne({ _id: id, patientId, ...notDeleted });
  if (!referral) throw new HttpError(404, 'Referral not found');
  return referral;
}

function byPriority(a: IReferral, b: IReferral) {
  const rank: Record<ReferralPriority, number> = { urgent: 0, routine: 1 };
  const priority = rank[a.priority] - rank[b.priority];
  if (priority) return priority;
  return b.referralDate.getTime() - a.referralDate.getTime();
}

export async function presentReferrals(referrals: IReferral[]): Promise<PresentedReferral[]> {
  if (!referrals.length) return [];
  await Referral.populate(referrals, POPULATE);
  const ids = referrals.map((referral) => referral._id);
  const [documents, outcomes] = await Promise.all([
    ReferralDocument.find({ referralId: { $in: ids }, ...notDeleted })
      .sort({ recordedAt: 1, createdAt: 1 })
      .populate('recordedBy', PERSON)
      .lean(),
    ReferralOutcome.find({ referralId: { $in: ids }, ...notDeleted })
      .sort({ version: 1, createdAt: 1 })
      .populate('authorId', PERSON)
      .lean(),
  ]);
  const documentsByReferral = new Map<string, typeof documents>();
  for (const document of documents) {
    const key = String(document.referralId);
    const list = documentsByReferral.get(key) || [];
    list.push(document);
    documentsByReferral.set(key, list);
  }
  const outcomesByReferral = new Map<string, typeof outcomes>();
  for (const outcome of outcomes) {
    const key = String(outcome.referralId);
    const list = outcomesByReferral.get(key) || [];
    list.push(outcome);
    outcomesByReferral.set(key, list);
  }
  return referrals.map((referral) => {
    const body = referral.toObject() as Record<string, unknown> & ReferralTimelineSource;
    const outcomeList = outcomesByReferral.get(String(referral._id)) || [];
    return {
      ...body,
      _id: referral._id,
      documents: documentsByReferral.get(String(referral._id)) || [],
      outcomes: outcomeList,
      currentOutcome: outcomeList.length ? outcomeList[outcomeList.length - 1] : null,
      linkedDiagnoses: linkedDiagnoses(body),
      timeline: referralTimelinePoints(body).map((point) => ({
        ...point,
        at: point.at.toISOString(),
      })),
    } as PresentedReferral;
  });
}

async function presented(referral: IReferral) {
  const [item] = await presentReferrals([referral]);
  return item;
}

export async function referralSummary(patientId: string) {
  const activeFilter = { patientId, status: { $in: [...ACTIVE_REFERRAL_STATUSES] }, ...notDeleted };
  const followFilter = {
    patientId,
    followUpRequired: true,
    status: { $nin: ['cancelled', 'closed', 'draft'] },
    ...notDeleted,
  };
  const [activeCount, completed, closed, cancelled, followUpCount, rows, followRows] = await Promise.all([
    Referral.countDocuments(activeFilter),
    Referral.countDocuments({ patientId, status: 'completed', ...notDeleted }),
    Referral.countDocuments({ patientId, status: 'closed', ...notDeleted }),
    Referral.countDocuments({ patientId, status: 'cancelled', ...notDeleted }),
    Referral.countDocuments(followFilter),
    Referral.find(activeFilter).sort({ referralDate: -1 }).limit(50),
    Referral.find(followFilter).sort({ referralDate: -1 }).limit(8),
  ]);
  rows.sort(byPriority);
  followRows.sort(byPriority);
  return {
    active: await presentReferrals(rows.slice(0, 8)),
    followUp: await presentReferrals(followRows),
    counts: { active: activeCount, completed, closed, cancelled, followUp: followUpCount },
  };
}

export async function listReferrals(
  patientId: string,
  filter: ReferralListFilter,
  skip: number,
  limit: number
) {
  const query: Record<string, unknown> = { patientId, ...notDeleted };
  if (filter.view === 'active') query.status = { $in: [...ACTIVE_REFERRAL_STATUSES] };
  else if (filter.view === 'completed') query.status = { $in: ['completed', 'closed', 'cancelled'] };
  else if (filter.view === 'follow_up') {
    query.followUpRequired = true;
    query.status = { $nin: ['cancelled', 'closed', 'draft'] };
  } else if (filter.status) query.status = filter.status;
  if (filter.encounterId) {
    if (!Types.ObjectId.isValid(filter.encounterId)) throw new HttpError(400, 'Expected an id');
    query.encounterId = filter.encounterId;
  }
  const [rows, total] = await Promise.all([
    Referral.find(query).sort({ referralDate: -1, createdAt: -1 }).skip(skip).limit(limit),
    Referral.countDocuments(query),
  ]);
  rows.sort(byPriority);
  return { data: await presentReferrals(rows), total };
}

export async function getPresentedReferral(id: string, patientId: string) {
  return presented(await getReferral(id, patientId));
}

export async function createReferral(
  patientId: string,
  input: ReferralWrite,
  actorId: string
): Promise<SavedReferral> {
  const encounterId = await assertEncounter(input.encounterId, patientId);
  const diagnosisId = await assertDiagnosis(input.diagnosisId, patientId, encounterId);
  const conditionId = await assertProblem(input.conditionId, patientId);
  const carePlanId = await assertCarePlan(input.carePlanId, patientId);
  assertNotFuture(input.referralDate, 'Referral date');
  const now = new Date();
  const status = input.status;
  const referral = await Referral.create({
    patientId,
    encounterId,
    diagnosisId,
    conditionId,
    carePlanId,
    createdBy: actorId,
    referralType: input.referralType,
    specialty: input.specialty.trim(),
    specialistName: input.specialistName.trim(),
    organization: input.organization.trim(),
    reasonForReferral: input.reasonForReferral.trim(),
    priority: input.priority,
    referralDate: input.referralDate,
    followUpRequired: false,
    sentAt: status === 'sent' ? now : null,
    status,
    statusHistory: [{ status, at: now, actorId: new Types.ObjectId(actorId) }],
  });
  const after = plain(referral);
  return { referral: await presented(referral), before: null, after };
}

export async function changeReferralStatus(
  id: string,
  patientId: string,
  input: ReferralStatusChange,
  actorId: string
): Promise<SavedReferral> {
  const referral = await getReferral(id, patientId);
  const next = input.status;
  if (!REFERRAL_TRANSITIONS[referral.status].includes(next)) {
    throw new HttpError(
      409,
      `A ${statusLabel(referral.status).toLowerCase()} referral cannot be marked ${statusLabel(next).toLowerCase()}`
    );
  }
  if (next === 'completed') {
    const count = await ReferralOutcome.countDocuments({ referralId: referral._id, ...notDeleted });
    if (count === 0) {
      throw new HttpError(409, 'Record the specialist outcome before completing this referral');
    }
  }
  if (next === 'closed' && referral.followUpRequired) {
    throw new HttpError(409, 'Clear follow-up before closing this referral');
  }
  let appointmentDate: Date | undefined;
  if (next === 'scheduled') {
    if (!input.appointmentDate) throw new HttpError(400, 'Appointment date is required');
    assertAppointmentDate(input.appointmentDate, referral.referralDate);
    appointmentDate = input.appointmentDate;
  }
  const at = resolveEventTime(
    input.at ?? new Date(),
    latestAt(referral),
    'Status time',
    'Status time cannot be before the previous status change'
  );
  const before = plain(referral);
  referral.status = next;
  stamp(referral, next, at, appointmentDate);
  pushHistory(referral, next, at, actorId, input.note);
  await referral.save();
  const after = plain(referral);
  return { referral: await presented(referral), before, after };
}

export async function cancelReferral(
  id: string,
  patientId: string,
  input: ReferralCancelInput,
  actorId: string
): Promise<SavedReferral> {
  const referral = await getReferral(id, patientId);
  if (!REFERRAL_TRANSITIONS[referral.status].includes('cancelled')) {
    throw new HttpError(409, `This referral is ${statusLabel(referral.status).toLowerCase()} and stays on the chart`);
  }
  const at = resolveEventTime(
    input.at ?? new Date(),
    latestAt(referral),
    'Cancellation time',
    'Cancellation time cannot be before the previous status change'
  );
  const before = plain(referral);
  referral.status = 'cancelled';
  stamp(referral, 'cancelled', at);
  pushHistory(referral, 'cancelled', at, actorId, input.reason.trim());
  await referral.save();
  const after = plain(referral);
  return { referral: await presented(referral), before, after };
}

export async function addReferralOutcome(
  id: string,
  patientId: string,
  input: ReferralOutcomeWrite,
  actorId: string
): Promise<SavedOutcome> {
  const referral = await getReferral(id, patientId);
  if (!OUTCOME_READY.has(referral.status)) {
    if (referral.status === 'cancelled') throw new HttpError(409, 'This referral is cancelled');
    throw new HttpError(409, 'Accept the referral before recording an outcome');
  }
  const recommendations = input.recommendations.trim();
  const consultationSummary = input.consultationSummary.trim();
  const nextSteps = input.nextSteps.trim();
  const previous = await ReferralOutcome.findOne({ referralId: referral._id, ...notDeleted }).sort({
    version: -1,
  });
  const textSame =
    !!previous &&
    previous.recommendations === recommendations &&
    previous.consultationSummary === consultationSummary &&
    previous.nextSteps === nextSteps;
  const followUpUnchanged =
    input.followUpRequired === undefined || input.followUpRequired === referral.followUpRequired;
  if (textSame && followUpUnchanged) throw new HttpError(400, 'No outcome changes submitted');

  const before = plain(referral);
  if (textSame && input.followUpRequired !== undefined) {
    referral.followUpRequired = input.followUpRequired;
    await referral.save();
    const after = plain(referral);
    return {
      referral: await presented(referral),
      before,
      after,
      outcome: null,
      previousOutcome: plain(previous!),
      outcomeCreated: false,
    };
  }

  const earliest = referral.sentAt || referral.referralDate;
  let recordedAt = resolveEventTime(
    input.recordedAt ?? new Date(),
    earliest,
    'Outcome date',
    'Outcome date cannot be before the referral was sent'
  );
  if (!referral.outcomeReceivedDate) {
    recordedAt = resolveEventTime(
      recordedAt,
      latestAt(referral),
      'Outcome date',
      'Outcome date cannot be before the previous status change'
    );
  } else if (previous) {
    recordedAt = resolveEventTime(
      recordedAt,
      previous.recordedAt,
      'Outcome date',
      'Outcome date cannot be before the previous outcome'
    );
  }

  const created = await ReferralOutcome.create({
    referralId: referral._id,
    patientId: referral.patientId,
    authorId: actorId,
    recommendations,
    consultationSummary,
    nextSteps,
    recordedAt,
    version: previous ? previous.version + 1 : 1,
    rootId: previous ? previous.rootId : undefined,
  });
  try {
    if (!referral.outcomeReceivedDate) referral.outcomeReceivedDate = recordedAt;
    if (input.followUpRequired !== undefined) referral.followUpRequired = input.followUpRequired;
    await referral.save();
  } catch (err) {
    await ReferralOutcome.deleteOne({ _id: created._id });
    throw err;
  }
  const after = plain(referral);
  return {
    referral: await presented(referral),
    before,
    after,
    outcome: plain(created),
    previousOutcome: previous ? plain(previous) : null,
    outcomeCreated: true,
  };
}

export async function addReferralDocument(
  id: string,
  patientId: string,
  input: ReferralDocumentWrite,
  actorId: string
): Promise<SavedDocument> {
  const referral = await getReferral(id, patientId);
  if (referral.status === 'cancelled') throw new HttpError(409, 'This referral is cancelled');
  const recordedAt = resolveEventTime(
    input.recordedAt ?? new Date(),
    referral.referralDate,
    'Document date',
    'Document date cannot be before the referral date'
  );
  const created = await ReferralDocument.create({
    referralId: referral._id,
    patientId: referral.patientId,
    documentType: input.documentType,
    title: input.title.trim(),
    description: input.description?.trim() || undefined,
    recordedAt,
    recordedBy: actorId,
  });
  return {
    referral: await presented(referral),
    before: null,
    after: plain(referral),
    document: plain(created),
  };
}

export async function updateReferralFollowUp(
  id: string,
  patientId: string,
  input: ReferralFollowUpWrite,
  _actorId: string
): Promise<SavedReferral> {
  const referral = await getReferral(id, patientId);
  if (referral.status === 'cancelled') throw new HttpError(409, 'This referral is cancelled');
  if (referral.status === 'closed') throw new HttpError(409, 'This referral is closed');
  if (!FOLLOW_UP_READY.has(referral.status)) {
    throw new HttpError(409, 'Send the referral before tracking follow-up');
  }
  const appointmentUnchanged =
    !input.appointmentDate ||
    (referral.appointmentDate && input.appointmentDate.getTime() === referral.appointmentDate.getTime());
  if (input.followUpRequired === referral.followUpRequired && appointmentUnchanged) {
    throw new HttpError(400, 'No follow-up changes submitted');
  }
  if (input.appointmentDate) {
    if (referral.status !== 'scheduled' && referral.status !== 'completed' && !referral.appointmentDate) {
      throw new HttpError(409, 'Schedule the referral before setting an appointment date');
    }
    assertAppointmentDate(input.appointmentDate, referral.referralDate);
  }
  const before = plain(referral);
  referral.followUpRequired = input.followUpRequired;
  if (input.appointmentDate) referral.appointmentDate = input.appointmentDate;
  await referral.save();
  const after = plain(referral);
  return { referral: await presented(referral), before, after };
}
