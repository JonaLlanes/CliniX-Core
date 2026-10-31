import { Types } from 'mongoose';
import { Appointment, type IAppointment } from '../models/Appointment.js';
import { Encounter, type IEncounter } from '../models/Encounter.js';
import { EncounterDiagnosis } from '../models/EncounterDiagnosis.js';
import { Medication } from '../models/Medication.js';
import { Order } from '../models/Order.js';
import { OrderResult } from '../models/OrderResult.js';
import { Referral } from '../models/Referral.js';
import { CarePlan } from '../models/CarePlan.js';
import { CarePlanGoal } from '../models/CarePlanGoal.js';
import { CarePlanIntervention } from '../models/CarePlanIntervention.js';
import { medicationTimelinePoints, type MedicationTimelinePoint } from './medicationService.js';
import { timelinePointsForOrders, type OrderTimelinePoint } from './orderService.js';
import { timelinePointsForCarePlans, type CarePlanTimelinePoint } from './carePlanService.js';
import { timelinePointsForReferrals, type ReferralTimelinePoint } from './referralService.js';
import { timelineForEncounterLinks, type MonitoringTimelinePoint } from './monitoringService.js';
import { User } from '../models/User.js';
import { Visit, type IVisit } from '../models/Visit.js';
import { HttpError } from '../middleware/error.js';
import { notDeleted } from '../utils/pagination.js';
import type { AppointmentType, ClinicLocation } from '../types/appointments.js';
import {
  ENCOUNTER_SOURCE_VISIT_STATUSES,
  ENCOUNTER_STATUSES,
  ENCOUNTER_TRANSITIONS,
  LOCKED_ENCOUNTER_STATUSES,
  type EncounterStatus,
  type EncounterStatusInput,
  type EncounterTimelineEventName,
} from '../types/encounters.js';
import { beginVisitEncounter } from './visitService.js';

const PROVIDER_FIELDS = 'displayName role';
const LAUNCHABLE_VISIT = new Set<string>(ENCOUNTER_SOURCE_VISIT_STATUSES);

export type CreateEncounterInput = {
  patientId: string;
  visitId: string;
  appointmentId: string;
  attendingProviderId: string;
  supervisingProviderId?: string;
  clinicLocation: ClinicLocation;
  appointmentType: AppointmentType;
  chiefComplaint: string;
  reasonForVisit: string;
};

export type DisplayTimelineItem = {
  kind:
    | 'appointment_booked'
    | 'patient_arrived'
    | 'room_assigned'
    | 'encounter_opened'
    | 'documentation'
    | 'diagnosis'
    | 'medication'
    | 'order'
    | 'care_plan'
    | 'referral'
    | 'monitoring'
    | 'encounter_status'
    | 'visit_status';
  label: string;
  at: Date;
  detail?: string;
};

type DiagnosisTimelineSource = {
  code: string;
  description: string;
  diagnosisType: string;
  primaryDiagnosis: boolean;
  recordedAt: Date;
  promotion?: 'active_problem' | 'existing_problem' | null;
  promotedAt?: Date | null;
};

type PresentedEncounter = Record<string, unknown> & {
  room: string | null;
  displayTimeline: DisplayTimelineItem[];
  amendmentId: string | null;
};

function snapshot(doc: { toObject: () => object }) {
  return doc.toObject() as Record<string, unknown>;
}

function isDuplicate(err: unknown) {
  return Boolean(err && typeof err === 'object' && 'code' in err && (err as { code: number }).code === 11000);
}

function statusLabel(status: string) {
  return status.replaceAll('_', ' ');
}

function idOf(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value instanceof Types.ObjectId) return value.toString();
  if (typeof value === 'object' && value && '_id' in value) {
    return idOf((value as { _id: unknown })._id);
  }
  return String(value);
}

function words(value?: string | null) {
  if (!value) return '';
  return value.replaceAll('_', ' ');
}

async function assertClinician(providerId: string, label: string) {
  if (!Types.ObjectId.isValid(providerId)) throw new HttpError(400, 'Expected an id');
  const provider = await User.findById(providerId).select(PROVIDER_FIELDS);
  if (!provider) throw new HttpError(404, `${label} not found`);
  if (provider.role !== 'clinician') throw new HttpError(400, `${label} must be a clinician`);
  return provider;
}

function assertUnlocked(status: EncounterStatus) {
  if (LOCKED_ENCOUNTER_STATUSES.includes(status)) {
    throw new HttpError(409, 'This encounter is locked');
  }
}

async function getOwned(id: string, patientId: string) {
  if (!Types.ObjectId.isValid(id)) throw new HttpError(400, 'Expected an id');
  const encounter = await Encounter.findOne({ _id: id, patientId, ...notDeleted });
  if (!encounter) throw new HttpError(404, 'Encounter not found');
  return encounter;
}

function providerNote(attendingName: string, supervisingName?: string | null) {
  const parts = [`Attending ${attendingName}`];
  if (supervisingName) parts.push(`Supervising ${supervisingName}`);
  return parts.join('. ');
}

type Timed = DisplayTimelineItem & { order: number };

function diagnosisTypeLabel(value: string) {
  if (value === 'working') return 'Working';
  if (value === 'final') return 'Final';
  if (value === 'encounter') return 'Encounter';
  return value;
}

function diagnosisDetail(dx: DiagnosisTimelineSource) {
  const parts = [
    `ICD-10-CA ${dx.code}`,
    dx.description,
    diagnosisTypeLabel(dx.diagnosisType),
  ];
  if (dx.primaryDiagnosis) parts.push('Primary');
  return parts.join(' · ');
}

function buildDisplayTimeline(
  appointment: IAppointment | null,
  visit: IVisit | null,
  encounter: IEncounter | null,
  diagnoses: DiagnosisTimelineSource[] = [],
  medications: MedicationTimelinePoint[] = [],
  orders: OrderTimelinePoint[] = [],
  carePlans: CarePlanTimelinePoint[] = [],
  referrals: ReferralTimelinePoint[] = [],
  monitoring: MonitoringTimelinePoint[] = []
): DisplayTimelineItem[] {
  const events: Timed[] = [];

  if (appointment) {
    events.push({
      kind: 'appointment_booked',
      label: 'Appointment booked',
      at: appointment.createdAt,
      detail: [appointment.clinicLocation, words(appointment.appointmentType)].filter(Boolean).join(' · '),
      order: 0,
    });
  }

  const arrived = visit?.timeline.find((item) => item.event === 'arrived');
  const arrivedAt = arrived?.at || visit?.arrivalAt;
  if (arrivedAt) {
    events.push({
      kind: 'patient_arrived',
      label: 'Patient arrived',
      at: arrivedAt,
      detail: arrived?.note || undefined,
      order: 1,
    });
  }

  const roomEvents = visit?.timeline.filter((item) => item.event === 'roomed') ?? [];
  if (roomEvents.length) {
    for (const room of roomEvents) {
      events.push({
        kind: 'room_assigned',
        label: 'Room assignment',
        at: room.at,
        detail: [room.examRoom, room.note].filter(Boolean).join(' · ') || undefined,
        order: 3,
      });
    }
  } else if (visit?.roomedAt) {
    events.push({
      kind: 'room_assigned',
      label: 'Room assignment',
      at: visit.roomedAt,
      detail: visit.examRoom || undefined,
      order: 3,
    });
  }

  for (const item of visit?.timeline ?? []) {
    if (item.event === 'arrived' || item.event === 'roomed') continue;
    const label =
      item.event === 'waiting'
        ? 'Waiting'
        : item.event === 'in_progress'
          ? 'Visit in progress'
          : item.event === 'completed'
            ? 'Visit completed'
            : '';
    if (!label) continue;
    events.push({
      kind: 'visit_status',
      label,
      at: item.at,
      detail: [item.examRoom, item.note].filter(Boolean).join(' · ') || undefined,
      order: item.event === 'waiting' ? 2 : item.event === 'in_progress' ? 4 : 12,
    });
  }

  if (encounter) {
    const opened = encounter.timeline.find((item) => item.event === 'opened');
    events.push({
      kind: 'encounter_opened',
      label: 'Encounter opened',
      at: opened?.at || encounter.openedAt,
      detail: encounter.chiefComplaint,
      order: 5,
    });

    const labels: Partial<Record<EncounterTimelineEventName, { label: string; order: number }>> = {
      provider_assigned: { label: 'Provider assigned', order: 6 },
      in_progress: { label: 'Encounter in progress', order: 7 },
      awaiting_signature: { label: 'Awaiting signature', order: 9 },
      signed: { label: 'Encounter signed', order: 10 },
      amended: { label: 'Encounter amended', order: 11 },
    };

    for (const item of encounter.timeline) {
      if (item.event === 'documentation') {
        events.push({
          kind: 'documentation',
          label: 'Documentation',
          at: item.at,
          detail: item.note || undefined,
          order: 8,
        });
        continue;
      }
      if (item.event === 'opened') continue;
      const mapped = labels[item.event];
      if (!mapped) continue;
      events.push({
        kind: 'encounter_status',
        label: mapped.label,
        at: item.at,
        detail: item.note || undefined,
        order: mapped.order,
      });
    }

    for (const dx of diagnoses) {
      events.push({
        kind: 'diagnosis',
        label: 'Diagnosis recorded',
        at: dx.recordedAt,
        detail: diagnosisDetail(dx),
        order: 8,
      });
      if (dx.promotedAt && dx.promotion) {
        events.push({
          kind: 'diagnosis',
          label: dx.promotion === 'active_problem' ? 'Promoted to active problem' : 'Problem list updated',
          at: dx.promotedAt,
          detail: diagnosisDetail(dx),
          order: 8.5,
        });
      }
    }

    for (const point of medications) {
      events.push({
        kind: 'medication',
        label: point.label,
        at: point.at,
        detail: point.detail,
        order: 8.2,
      });
    }

    for (const point of orders) {
      events.push({
        kind: 'order',
        label: point.label,
        at: point.at,
        detail: point.detail,
        order: 8.4,
      });
    }

    for (const point of carePlans) {
      events.push({
        kind: 'care_plan',
        label: point.label,
        at: point.at,
        detail: point.detail,
        order: 8.6,
      });
    }

    for (const point of referrals) {
      events.push({
        kind: 'referral',
        label: point.label,
        at: point.at,
        detail: point.detail,
        order: 8.5,
      });
    }

    for (const point of monitoring) {
      events.push({
        kind: 'monitoring',
        label: point.label,
        at: point.at,
        detail: point.detail,
        order: 8.7,
      });
    }
  }

  events.sort((a, b) => a.at.getTime() - b.at.getTime() || a.order - b.order);
  return events.map(({ order: _order, ...item }) => item);
}

async function loadLinks(encounter: IEncounter) {
  const [visit, appointment, amendment] = await Promise.all([
    Visit.findOne({ _id: encounter.visitId, ...notDeleted }),
    Appointment.findOne({ _id: encounter.appointmentId, ...notDeleted }),
    Encounter.findOne({ amendsEncounterId: encounter._id, ...notDeleted }).select('_id'),
  ]);
  return { visit, appointment, amendment };
}

export async function presentEncounter(encounter: IEncounter): Promise<PresentedEncounter> {
  await encounter.populate([
    { path: 'attendingProviderId', select: PROVIDER_FIELDS },
    { path: 'supervisingProviderId', select: PROVIDER_FIELDS },
    { path: 'createdBy', select: PROVIDER_FIELDS },
    { path: 'signedBy', select: PROVIDER_FIELDS },
    { path: 'timeline.actorId', select: PROVIDER_FIELDS },
  ]);
  const { visit, appointment, amendment } = await loadLinks(encounter);
  const [diagnoses, medications, orderDocs, referralDocs] = await Promise.all([
    EncounterDiagnosis.find({ encounterId: encounter._id, ...notDeleted })
      .select('code description diagnosisType primaryDiagnosis recordedAt promotion promotedAt')
      .sort({ recordedAt: 1 })
      .lean(),
    Medication.find({ encounterId: encounter._id, patientId: encounter.patientId, ...notDeleted })
      .select('genericName brandName name strength dosage dose route frequency indication status startDate endDate events adherenceNotes')
      .lean(),
    Order.find({ encounterId: encounter._id, patientId: encounter.patientId, ...notDeleted })
      .select('orderType orderName priority orderedAt scheduledAt collectedAt completedAt')
      .lean(),
    Referral.find({ encounterId: encounter._id, patientId: encounter.patientId, ...notDeleted })
      .select(
        'referralType specialty specialistName priority createdAt sentAt acceptedAt scheduledAt appointmentDate outcomeReceivedDate completedAt'
      )
      .lean(),
  ]);
  const orderResults = orderDocs.length
    ? await OrderResult.find({
        orderId: { $in: orderDocs.map((item) => item._id) },
        ...notDeleted,
      })
        .select('orderId resultType value unit status resultDate')
        .lean()
    : [];
  const medicationPoints = medications.flatMap((med) => medicationTimelinePoints(med));
  const orderPoints = timelinePointsForOrders(orderDocs, orderResults);
  const referralPoints = timelinePointsForReferrals(referralDocs);
  const carePlans = await CarePlan.find({
    encounterId: encounter._id,
    patientId: encounter.patientId,
    ...notDeleted,
  })
    .select('title startDate createdAt completedDate')
    .lean();
  const carePlanIds = carePlans.map((plan) => plan._id);
  const [careGoals, careInterventions] = carePlanIds.length
    ? await Promise.all([
        CarePlanGoal.find({ carePlanId: { $in: carePlanIds }, ...notDeleted })
          .select('carePlanId description createdAt status achievedAt')
          .lean(),
        CarePlanIntervention.find({ carePlanId: { $in: carePlanIds }, ...notDeleted })
          .select('carePlanId description createdAt')
          .lean(),
      ])
    : [[], []];
  const carePoints = timelinePointsForCarePlans(carePlans, careGoals, careInterventions);
  const monitoringPoints = await timelineForEncounterLinks(
    String(encounter.patientId),
    carePlans.map((plan) => plan._id),
    diagnoses.map((item) => (item as { _id: Types.ObjectId })._id)
  );
  const plain = encounter.toObject() as Record<string, unknown>;
  return {
    ...plain,
    room: visit?.examRoom ?? null,
    displayTimeline: buildDisplayTimeline(
      appointment,
      visit,
      encounter,
      diagnoses,
      medicationPoints,
      orderPoints,
      carePoints,
      referralPoints,
      monitoringPoints
    ),
    amendmentId: amendment ? String(amendment._id) : null,
  };
}

export async function createEncounter(input: CreateEncounterInput, actorId: string, patientId: string) {
  if (input.patientId !== patientId) {
    throw new HttpError(400, 'Encounter patient does not match this chart');
  }
  if (!Types.ObjectId.isValid(input.visitId)) throw new HttpError(400, 'Expected an id');

  const visit = await Visit.findOne({ _id: input.visitId, ...notDeleted });
  if (!visit || String(visit.patientId) !== patientId) {
    throw new HttpError(404, 'Visit not found');
  }
  if (!LAUNCHABLE_VISIT.has(visit.status)) {
    throw new HttpError(400, 'An encounter can start when the visit is waiting, roomed, or in progress');
  }
  if (String(visit.appointmentId) !== input.appointmentId) {
    throw new HttpError(400, 'Appointment does not match the visit');
  }

  const appointment = await Appointment.findOne({ _id: visit.appointmentId, ...notDeleted });
  if (!appointment) throw new HttpError(404, 'Appointment not found');
  if (appointment.clinicLocation !== input.clinicLocation) {
    throw new HttpError(400, 'Clinic location does not match the appointment');
  }
  if (appointment.appointmentType !== input.appointmentType) {
    throw new HttpError(400, 'Appointment type does not match the appointment');
  }

  const attending = await assertClinician(input.attendingProviderId, 'Attending provider');
  const supervising = input.supervisingProviderId
    ? await assertClinician(input.supervisingProviderId, 'Supervising provider')
    : null;
  if (supervising && String(supervising._id) === String(attending._id)) {
    throw new HttpError(400, 'Supervising provider must be a different clinician');
  }

  const existing = await Encounter.findOne({ visitId: visit._id, isCurrent: true, ...notDeleted });
  if (existing) {
    throw new HttpError(
      409,
      existing.status === 'signed'
        ? 'This visit already has a signed encounter'
        : 'This visit already has an encounter'
    );
  }

  const visitChange = await beginVisitEncounter(visit, actorId);
  const now = new Date();
  const actor = new Types.ObjectId(actorId);
  let encounter: IEncounter;
  try {
    encounter = await Encounter.create({
      patientId: visit.patientId,
      visitId: visit._id,
      appointmentId: appointment._id,
      attendingProviderId: attending._id,
      supervisingProviderId: supervising?._id ?? null,
      clinicLocation: appointment.clinicLocation,
      appointmentType: appointment.appointmentType,
      chiefComplaint: input.chiefComplaint,
      reasonForVisit: input.reasonForVisit,
      status: 'open',
      isCurrent: true,
      createdBy: actor,
      openedAt: now,
      timeline: [
        { event: 'opened', at: now, actorId: actor, note: input.chiefComplaint },
        {
          event: 'provider_assigned',
          at: now,
          actorId: actor,
          note: providerNote(attending.displayName, supervising?.displayName),
        },
      ],
    });
  } catch (err) {
    if (isDuplicate(err)) throw new HttpError(409, 'This visit already has an encounter');
    throw err;
  }

  return { encounter, visitChange };
}

export async function listEncounters(
  patientId: string,
  filter: { visitId?: string; status?: EncounterStatus },
  skip: number,
  limit: number
) {
  const query: Record<string, unknown> = { patientId, ...notDeleted, status: { $in: [...ENCOUNTER_STATUSES] } };
  if (filter.visitId) query.visitId = filter.visitId;
  if (filter.status) query.status = filter.status;
  const [encounters, total] = await Promise.all([
    Encounter.find(query)
      .sort({ openedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('attendingProviderId', PROVIDER_FIELDS)
      .populate('supervisingProviderId', PROVIDER_FIELDS)
      .populate('signedBy', PROVIDER_FIELDS)
      .populate('createdBy', PROVIDER_FIELDS),
    Encounter.countDocuments(query),
  ]);
  const visits = await Visit.find({
    _id: { $in: encounters.map((item) => item.visitId) },
    ...notDeleted,
  }).select('examRoom');
  const rooms = new Map(visits.map((visit) => [String(visit._id), visit.examRoom ?? null]));
  const data = encounters.map((encounter) => ({
    ...encounter.toObject(),
    room: rooms.get(String(encounter.visitId)) ?? null,
  }));
  return { data, total };
}

export async function getEncounter(id: string, patientId: string) {
  return getOwned(id, patientId);
}

export async function getVisitEncounterView(patientId: string, visitId: string) {
  if (!Types.ObjectId.isValid(visitId)) throw new HttpError(400, 'Expected an id');
  const visit = await Visit.findOne({ _id: visitId, patientId, ...notDeleted });
  if (!visit) throw new HttpError(404, 'Visit not found');
  const appointment = await Appointment.findOne({ _id: visit.appointmentId, ...notDeleted });
  const encounter = await Encounter.findOne({ visitId: visit._id, patientId, isCurrent: true, ...notDeleted });
  if (!encounter) {
    return { encounter: null, displayTimeline: buildDisplayTimeline(appointment, visit, null) };
  }
  const presented = await presentEncounter(encounter);
  return { encounter: presented, displayTimeline: presented.displayTimeline };
}

export async function encounterSummary(patientId: string) {
  const activeVisit = await Visit.findOne({
    patientId,
    status: { $in: [...ENCOUNTER_SOURCE_VISIT_STATUSES] },
    ...notDeleted,
  }).sort({ updatedAt: -1 });

  const encounter = activeVisit
    ? await Encounter.findOne({ visitId: activeVisit._id, patientId, isCurrent: true, ...notDeleted }).populate(
        'attendingProviderId',
        PROVIDER_FIELDS
      )
    : await Encounter.findOne({ patientId, isCurrent: true, ...notDeleted })
        .sort({ openedAt: -1 })
        .populate('attendingProviderId', PROVIDER_FIELDS);

  const visit =
    activeVisit ||
    (encounter
      ? await Visit.findOne({ _id: encounter.visitId, ...notDeleted }).select('examRoom status')
      : null);

  const attending = encounter?.attendingProviderId as unknown as { displayName?: string } | undefined;
  return {
    encounterId: encounter ? String(encounter._id) : null,
    provider: attending && typeof attending === 'object' ? attending.displayName || null : null,
    chiefComplaint: encounter?.chiefComplaint ?? null,
    status: encounter?.status ?? null,
    room: visit?.examRoom ?? null,
    openedAt: encounter?.openedAt ?? null,
    visitId: visit ? String(visit._id) : null,
    visitStatus: visit?.status ?? null,
  };
}

export async function changeEncounterStatus(
  id: string,
  patientId: string,
  status: EncounterStatusInput,
  actorId: string
) {
  const encounter = await getOwned(id, patientId);
  assertUnlocked(encounter.status);
  const allowed = ENCOUNTER_TRANSITIONS[encounter.status];
  if (!allowed.includes(status)) {
    throw new HttpError(
      400,
      `Cannot change status from ${statusLabel(encounter.status)} to ${statusLabel(status)}`
    );
  }
  const before = snapshot(encounter);
  const now = new Date();
  const updated = await Encounter.findOneAndUpdate(
    { _id: encounter._id, patientId, status: encounter.status, ...notDeleted },
    {
      $set: { status },
      $push: { timeline: { event: status, at: now, actorId: new Types.ObjectId(actorId) } },
    },
    { new: true, runValidators: true, timestamps: true }
  );
  if (!updated) throw new HttpError(409, 'Encounter status changed');
  return { encounter: updated, before };
}

export async function assignEncounterProviders(
  id: string,
  patientId: string,
  input: { attendingProviderId?: string; supervisingProviderId?: string | null },
  actorId: string
) {
  const encounter = await getOwned(id, patientId);
  assertUnlocked(encounter.status);

  const nextAttending = input.attendingProviderId ?? idOf(encounter.attendingProviderId);
  const nextSupervising =
    input.supervisingProviderId === undefined
      ? encounter.supervisingProviderId
        ? idOf(encounter.supervisingProviderId)
        : null
      : input.supervisingProviderId;

  if (nextSupervising && nextSupervising === nextAttending) {
    throw new HttpError(400, 'Supervising provider must be a different clinician');
  }
  if (
    nextAttending === idOf(encounter.attendingProviderId) &&
    (nextSupervising || null) === (encounter.supervisingProviderId ? idOf(encounter.supervisingProviderId) : null)
  ) {
    throw new HttpError(400, 'No provider change submitted');
  }

  const attending = await assertClinician(nextAttending, 'Attending provider');
  const supervising = nextSupervising ? await assertClinician(nextSupervising, 'Supervising provider') : null;
  const before = snapshot(encounter);
  const now = new Date();
  const updated = await Encounter.findOneAndUpdate(
    {
      _id: encounter._id,
      patientId,
      status: { $in: ['open', 'in_progress', 'awaiting_signature'] },
      ...notDeleted,
    },
    {
      $set: {
        attendingProviderId: attending._id,
        supervisingProviderId: supervising?._id ?? null,
      },
      $push: {
        timeline: {
          event: 'provider_assigned',
          at: now,
          actorId: new Types.ObjectId(actorId),
          note: providerNote(attending.displayName, supervising?.displayName),
        },
      },
    },
    { new: true, runValidators: true, timestamps: true }
  );
  if (!updated) throw new HttpError(409, 'This encounter is locked');
  return { encounter: updated, before };
}

export async function signEncounter(
  id: string,
  patientId: string,
  actor: { id: string; role: string }
) {
  const encounter = await getOwned(id, patientId);
  if (encounter.status !== 'awaiting_signature') {
    throw new HttpError(400, 'Encounter must be awaiting signature');
  }
  const attending = idOf(encounter.attendingProviderId);
  const supervising = encounter.supervisingProviderId ? idOf(encounter.supervisingProviderId) : '';
  const allowed = actor.role === 'admin' || actor.id === attending || actor.id === supervising;
  if (!allowed) {
    throw new HttpError(403, 'Only the attending provider, supervising provider, or an administrator can sign');
  }
  const before = snapshot(encounter);
  const now = new Date();
  const signedBy = new Types.ObjectId(actor.id);
  const updated = await Encounter.findOneAndUpdate(
    { _id: encounter._id, patientId, status: 'awaiting_signature', ...notDeleted },
    {
      $set: { status: 'signed', signedBy, signedAt: now },
      $push: { timeline: { event: 'signed', at: now, actorId: signedBy } },
    },
    { new: true, runValidators: true, timestamps: true }
  );
  if (!updated) throw new HttpError(409, 'Encounter status changed');
  return { encounter: updated, before };
}

export async function amendEncounter(
  id: string,
  patientId: string,
  input: {
    chiefComplaint: string;
    reasonForVisit: string;
    attendingProviderId?: string;
    supervisingProviderId?: string;
  },
  actorId: string
) {
  const encounter = await getOwned(id, patientId);
  if (encounter.status !== 'signed' || !encounter.isCurrent) {
    throw new HttpError(
      400,
      encounter.status === 'amended' ? 'This encounter has already been amended' : 'Only a signed encounter can be amended'
    );
  }

  const attendingId = input.attendingProviderId ?? idOf(encounter.attendingProviderId);
  const supervisingId =
    input.supervisingProviderId === undefined
      ? encounter.supervisingProviderId
        ? idOf(encounter.supervisingProviderId)
        : undefined
      : input.supervisingProviderId;
  const attending = await assertClinician(attendingId, 'Attending provider');
  const supervising = supervisingId ? await assertClinician(supervisingId, 'Supervising provider') : null;
  if (supervising && String(supervising._id) === String(attending._id)) {
    throw new HttpError(400, 'Supervising provider must be a different clinician');
  }

  const now = new Date();
  const actor = new Types.ObjectId(actorId);
  const original = await Encounter.findOneAndUpdate(
    { _id: encounter._id, patientId, status: 'signed', isCurrent: true, ...notDeleted },
    {
      $set: { status: 'amended', isCurrent: false },
      $push: { timeline: { event: 'amended', at: now, actorId: actor } },
    },
    { new: false, runValidators: true, timestamps: true }
  );
  if (!original) throw new HttpError(409, 'This encounter has already been amended');

  try {
    const created = await Encounter.create({
      patientId: original.patientId,
      visitId: original.visitId,
      appointmentId: original.appointmentId,
      attendingProviderId: attending._id,
      supervisingProviderId: supervising?._id ?? null,
      clinicLocation: original.clinicLocation,
      appointmentType: original.appointmentType,
      chiefComplaint: input.chiefComplaint,
      reasonForVisit: input.reasonForVisit,
      status: 'open',
      isCurrent: true,
      createdBy: actor,
      openedAt: now,
      amendsEncounterId: original._id,
      timeline: [
        { event: 'opened', at: now, actorId: actor, note: input.chiefComplaint },
        {
          event: 'provider_assigned',
          at: now,
          actorId: actor,
          note: providerNote(attending.displayName, supervising?.displayName),
        },
      ],
    });
    const updatedOriginal = await Encounter.findById(original._id);
    if (!updatedOriginal) throw new HttpError(404, 'Encounter not found');
    return { originalBefore: snapshot(original), original: updatedOriginal, created };
  } catch (err) {
    await Encounter.updateOne(
      { _id: original._id, status: 'amended', isCurrent: false },
      { $set: { status: 'signed', isCurrent: true }, $pop: { timeline: 1 } }
    );
    if (isDuplicate(err)) throw new HttpError(409, 'This visit already has an encounter');
    throw err;
  }
}
