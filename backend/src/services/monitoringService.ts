import { Types } from 'mongoose';
import { CarePlan } from '../models/CarePlan.js';
import { Condition } from '../models/Condition.js';
import { EncounterDiagnosis } from '../models/EncounterDiagnosis.js';
import { MonitoringMetric } from '../models/MonitoringMetric.js';
import { MonitoringProgram, type IMonitoringProgram } from '../models/MonitoringProgram.js';
import { Recall, type IRecall } from '../models/Recall.js';
import { User } from '../models/User.js';
import { HttpError } from '../middleware/error.js';
import { notDeleted } from '../utils/pagination.js';
import { CLINIC_TIME_ZONE, clinicDateTime } from '../utils/clinicTime.js';
import {
  DEFAULT_METRIC_UNITS,
  METRIC_TYPE_LABELS,
  MONITORING_AUDIT_EVENTS,
  PROGRAM_STATUS_LABELS,
  PROGRAM_TRANSITIONS,
  PROGRAM_TYPE_LABELS,
  RECALL_STATUS_LABELS,
  RECALL_TRANSITIONS,
  type MetricSource,
  type MetricType,
  type MonitoringDiagnosisKind,
  type MonitoringTimelineAction,
  type ProgramStatus,
  type ProgramType,
  type RecallStatus,
  type RecallStatusInput,
  type TrendDirection,
} from '../types/monitoring.js';

const PERSON = 'displayName role';
const OPEN_RECALL = ['due', 'scheduled'] as const;

const PROGRAM_POPULATE = [
  { path: 'ownerClinicianId', select: PERSON },
  { path: 'carePlanId', select: 'title status' },
];

const RECALL_POPULATE = [
  { path: 'assignedProvider', select: PERSON },
  { path: 'carePlanId', select: 'title status' },
];

export type AuditTrail = {
  action: 'create' | 'update';
  resourceType: string;
  resourceId: string;
  event: string;
  before?: unknown;
  after?: unknown;
};

export type ProgramCreateInput = {
  programType: ProgramType;
  name?: string;
  status: 'active' | 'on_hold';
  enrolledDate: Date;
  diagnosisId?: string;
  carePlanId?: string;
  ownerClinicianId: string;
};

export type ProgramUpdateInput = {
  name?: string | null;
  diagnosisId?: string | null;
  carePlanId?: string | null;
  ownerClinicianId?: string;
};

export type ProgramStatusInput = {
  status: ProgramStatus;
  completedDate?: Date;
};

export type MetricCreateInput = {
  metricType: MetricType;
  label?: string;
  value: string;
  unit?: string;
  recordedAt: Date;
  source: MetricSource;
  abnormal?: boolean;
};

export type MetricUpdateInput = {
  label?: string | null;
  value?: string;
  unit?: string;
  recordedAt?: Date;
  source?: MetricSource;
  abnormal?: boolean;
};

export type RecallCreateInput = {
  reason: string;
  dueDate: Date;
  assignedProvider: string;
  status: 'due' | 'scheduled';
  diagnosisId?: string;
  carePlanId?: string;
};

export type RecallUpdateInput = {
  reason?: string;
  dueDate?: Date;
  assignedProvider?: string;
  diagnosisId?: string | null;
  carePlanId?: string | null;
};

export type RecallStatusChange = {
  status: RecallStatusInput;
  dueDate?: Date;
  note?: string;
};

export type MonitoringTimelinePoint = {
  action: MonitoringTimelineAction;
  label: string;
  at: Date;
  detail: string;
};

type ProgramTimelineSource = {
  _id?: unknown;
  programType: ProgramType;
  name?: string | null;
  enrolledDate?: Date | string | null;
  completedDate?: Date | string | null;
  createdAt?: Date | string | null;
};

type MetricTimelineSource = {
  programId?: unknown;
  metricType: MetricType;
  label?: string | null;
  value: string;
  unit?: string | null;
  recordedAt?: Date | string | null;
};

type RecallTimelineSource = {
  reason: string;
  dueDate?: Date | string | null;
  createdAt?: Date | string | null;
  completedAt?: Date | string | null;
};

type MetricRow = {
  _id: unknown;
  programId: unknown;
  metricType: MetricType;
  label?: string | null;
  value: string;
  unit?: string | null;
  recordedAt: Date;
  source: MetricSource;
  abnormal?: boolean;
};

type Actor = { role: string };

export function programTitle(program: { programType: ProgramType; name?: string | null }) {
  const name = program.name?.trim();
  if (name) return name;
  return PROGRAM_TYPE_LABELS[program.programType];
}

export function effectiveRecallStatus(status: RecallStatus, dueDate: Date): RecallStatus {
  if (status === 'completed' || status === 'cancelled') return status;
  const startOfToday = clinicDateTime(0, 0, 0).getTime();
  if (dueDate.getTime() < startOfToday) return 'overdue';
  if (status === 'overdue') return 'due';
  return status;
}

export function timelinePointsForMonitoring(
  programs: ProgramTimelineSource[],
  metrics: MetricTimelineSource[],
  recalls: RecallTimelineSource[]
) {
  const titles = new Map(programs.map((program) => [String(program._id ?? ''), programTitle(program)]));
  const byProgram = new Map<string, MetricTimelineSource[]>();
  for (const metric of metrics) {
    const key = String(metric.programId ?? '');
    const list = byProgram.get(key) || [];
    list.push(metric);
    byProgram.set(key, list);
  }
  const points: MonitoringTimelinePoint[] = [];
  const seen = new Set(programs.map((program) => String(program._id ?? '')));
  for (const program of programs) {
    points.push(...programLifePoints(program));
    points.push(...metricPoints(byProgram.get(String(program._id ?? '')) || [], titles));
  }
  const orphans = metrics.filter((metric) => !seen.has(String(metric.programId ?? '')));
  points.push(...metricPoints(orphans, titles));
  for (const recall of recalls) points.push(...recallLifePoints(recall));
  points.sort((a, b) => a.at.getTime() - b.at.getTime());
  return points;
}

export async function timelineForEncounterLinks(
  patientId: string,
  carePlanIds: Types.ObjectId[],
  encounterDiagnosisIds: Types.ObjectId[]
) {
  const links: Record<string, unknown>[] = [];
  if (carePlanIds.length) links.push({ carePlanId: { $in: carePlanIds } });
  if (encounterDiagnosisIds.length) {
    links.push({ diagnosisKind: 'encounter', diagnosisId: { $in: encounterDiagnosisIds } });
  }
  if (links.length === 0) return [];
  const filter = { patientId, ...notDeleted, $or: links };
  const [programs, recalls] = await Promise.all([
    MonitoringProgram.find(filter)
      .select('programType name enrolledDate completedDate createdAt')
      .lean(),
    Recall.find(filter).select('reason dueDate createdAt completedAt').lean(),
  ]);
  const metrics = programs.length
    ? await MonitoringMetric.find({
        programId: { $in: programs.map((program) => program._id) },
        ...notDeleted,
      })
        .select('programId metricType label value unit recordedAt')
        .lean()
    : [];
  return timelinePointsForMonitoring(programs, metrics, recalls);
}

export async function monitoringCounts(patientId: string) {
  const today = clinicDateTime(0, 0, 0);
  const [activePrograms, overdueRecalls] = await Promise.all([
    MonitoringProgram.countDocuments({ patientId, status: 'active', ...notDeleted }),
    Recall.countDocuments({
      patientId,
      status: { $in: [...OPEN_RECALL] },
      dueDate: { $lt: today },
      ...notDeleted,
    }),
  ]);
  return { activePrograms, overdueRecalls };
}

export async function monitoringOptions(patientId: string) {
  const [clinicians, problems, diagnoses, carePlans] = await Promise.all([
    User.find({ role: 'clinician' }).select(PERSON).sort({ displayName: 1 }).lean(),
    Condition.find({ patientId, status: 'active', ...notDeleted })
      .select('display code status')
      .sort({ display: 1 })
      .lean(),
    EncounterDiagnosis.find({ patientId, ...notDeleted })
      .select('code description diagnosisType encounterId recordedAt')
      .sort({ recordedAt: -1 })
      .limit(50)
      .lean(),
    CarePlan.find({
      patientId,
      status: { $in: ['draft', 'active', 'on_hold'] },
      ...notDeleted,
    })
      .select('title status')
      .sort({ updatedAt: -1 })
      .lean(),
  ]);
  return { clinicians, problems, diagnoses, carePlans };
}

export async function listPrograms(
  patientId: string,
  status: ProgramStatus | undefined,
  skip: number,
  limit: number
) {
  const filter: Record<string, unknown> = { patientId, ...notDeleted };
  if (status) filter.status = status;
  const [rows, total] = await Promise.all([
    MonitoringProgram.find(filter)
      .populate(PROGRAM_POPULATE)
      .sort({ enrolledDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    MonitoringProgram.countDocuments(filter),
  ]);
  return { data: await presentPrograms(patientId, rows), total };
}

export async function getPresentedProgram(id: string, patientId: string) {
  const program = await findProgram(id, patientId);
  await program.populate(PROGRAM_POPULATE);
  const [presented] = await presentPrograms(patientId, [program]);
  return presented;
}

export async function createProgram(patientId: string, input: ProgramCreateInput) {
  assertNotFuture(input.enrolledDate, 'Enrollment date');
  const name = cleanName(input.name);
  if (input.programType === 'custom' && !name) {
    throw new HttpError(400, 'Name the custom monitoring program');
  }
  await assertUniqueOpenProgram(patientId, input.programType, name);
  const ownerClinicianId = await assertClinician(input.ownerClinicianId, 'Monitoring owner');
  const diagnosis = await resolveDiagnosis(patientId, input.diagnosisId);
  const carePlanId = await resolveCarePlan(patientId, input.carePlanId);
  const program = await MonitoringProgram.create({
    patientId,
    diagnosisId: diagnosis.diagnosisId,
    diagnosisKind: diagnosis.diagnosisKind,
    carePlanId,
    programType: input.programType,
    name,
    status: input.status,
    enrolledDate: input.enrolledDate,
    ownerClinicianId,
  });
  const after = program.toObject();
  await program.populate(PROGRAM_POPULATE);
  const [presented] = await presentPrograms(patientId, [program]);
  return {
    program: presented,
    audits: [
      audit('create', 'MonitoringProgram', String(program._id), MONITORING_AUDIT_EVENTS.enrolled, undefined, after),
    ],
  };
}

export async function updateProgram(id: string, patientId: string, input: ProgramUpdateInput) {
  const program = await findProgram(id, patientId);
  if (program.status === 'completed') {
    throw new HttpError(400, 'Completed monitoring programs stay on the chart unchanged');
  }
  const before = program.toObject();
  if (input.name !== undefined) {
    const name = cleanName(input.name);
    if (program.programType === 'custom' && !name) {
      throw new HttpError(400, 'Name the custom monitoring program');
    }
    await assertUniqueOpenProgram(patientId, program.programType, name, String(program._id));
    program.name = name;
  }
  if (input.ownerClinicianId) {
    program.ownerClinicianId = await assertClinician(input.ownerClinicianId, 'Monitoring owner');
  }
  await applyLinks(patientId, input, program);
  await program.save();
  const after = program.toObject();
  await program.populate(PROGRAM_POPULATE);
  const [presented] = await presentPrograms(patientId, [program]);
  return {
    program: presented,
    audits: [
      audit(
        'update',
        'MonitoringProgram',
        String(program._id),
        MONITORING_AUDIT_EVENTS.programUpdated,
        before,
        after
      ),
    ],
  };
}

export async function changeProgramStatus(
  id: string,
  patientId: string,
  input: ProgramStatusInput
) {
  const program = await findProgram(id, patientId);
  const allowed = PROGRAM_TRANSITIONS[program.status];
  if (!allowed.includes(input.status)) {
    throw new HttpError(
      400,
      `${PROGRAM_STATUS_LABELS[program.status]} programs cannot move to ${PROGRAM_STATUS_LABELS[input.status]}`
    );
  }
  if (program.status === input.status) {
    throw new HttpError(400, `Program is already ${PROGRAM_STATUS_LABELS[input.status]}`);
  }
  if (input.status === 'active' || input.status === 'on_hold') {
    await assertUniqueOpenProgram(patientId, program.programType, program.name ?? null, String(program._id));
  }
  const before = program.toObject();
  if (input.status === 'completed') {
    const completedDate = input.completedDate ?? new Date();
    assertNotFuture(completedDate, 'Completed date');
    if (completedDate.getTime() < program.enrolledDate.getTime()) {
      throw new HttpError(400, 'Completed date cannot be before the enrollment date');
    }
    program.completedDate = completedDate;
  } else {
    program.completedDate = null;
  }
  program.status = input.status;
  await program.save();
  const after = program.toObject();
  await program.populate(PROGRAM_POPULATE);
  const [presented] = await presentPrograms(patientId, [program]);
  return {
    program: presented,
    audits: [
      audit(
        'update',
        'MonitoringProgram',
        String(program._id),
        input.status === 'completed'
          ? MONITORING_AUDIT_EVENTS.programCompleted
          : MONITORING_AUDIT_EVENTS.statusChanged,
        before,
        after
      ),
    ],
  };
}

export async function recordMetric(
  programId: string,
  patientId: string,
  input: MetricCreateInput,
  actor: Actor
) {
  const program = await findProgram(programId, patientId);
  if (program.status === 'completed') {
    throw new HttpError(400, 'This monitoring program is completed');
  }
  assertMetricSource(actor.role, input.source);
  assertNotFuture(input.recordedAt, 'Recorded time');
  const label = metricLabel(input.metricType, input.label);
  const unit = (input.unit?.trim() || DEFAULT_METRIC_UNITS[input.metricType]).trim();
  if (!unit) throw new HttpError(400, 'Enter a unit');
  const value = normalizeValue(input.metricType, input.value);
  assertReading(input.metricType, value, unit);
  const metric = await MonitoringMetric.create({
    programId: program._id,
    patientId,
    metricType: input.metricType,
    label,
    value,
    unit,
    recordedAt: input.recordedAt,
    source: input.source,
    abnormal: input.metricType === 'custom' ? Boolean(input.abnormal) : false,
  });
  return {
    metric: presentMetric(metric),
    audits: [
      audit(
        'create',
        'MonitoringMetric',
        String(metric._id),
        MONITORING_AUDIT_EVENTS.metricRecorded,
        undefined,
        metric.toObject()
      ),
    ],
  };
}

export async function updateMetric(
  id: string,
  patientId: string,
  input: MetricUpdateInput,
  actor: Actor
) {
  const metric = await findMetric(id, patientId);
  if (actor.role === 'caregiver' && metric.source === 'clinic') {
    throw new HttpError(403, 'Caregivers may only update readings from home, a device, or a caregiver');
  }
  assertMetricSource(actor.role, input.source ?? metric.source);
  const before = metric.toObject();
  if (input.label !== undefined) {
    if (metric.metricType !== 'custom') {
      throw new HttpError(400, 'Only a custom metric has its own name');
    }
    const label = input.label?.trim() || '';
    if (!label) throw new HttpError(400, 'Name the custom metric');
    metric.label = label;
  }
  if (input.abnormal !== undefined) {
    if (metric.metricType !== 'custom') {
      throw new HttpError(400, 'Only a custom metric can be flagged manually');
    }
    metric.abnormal = input.abnormal;
  }
  const nextValue = input.value !== undefined ? normalizeValue(metric.metricType, input.value) : metric.value;
  const nextUnit = input.unit !== undefined ? input.unit.trim() : metric.unit || '';
  if (!nextUnit) throw new HttpError(400, 'Enter a unit');
  assertReading(metric.metricType, nextValue, nextUnit);
  if (input.recordedAt) assertNotFuture(input.recordedAt, 'Recorded time');
  metric.value = nextValue;
  metric.unit = nextUnit;
  if (input.recordedAt) metric.recordedAt = input.recordedAt;
  if (input.source) metric.source = input.source;
  await metric.save();
  return {
    metric: presentMetric(metric),
    audits: [
      audit(
        'update',
        'MonitoringMetric',
        String(metric._id),
        MONITORING_AUDIT_EVENTS.metricUpdated,
        before,
        metric.toObject()
      ),
    ],
  };
}

export async function listRecalls(
  patientId: string,
  status: RecallStatus | undefined,
  skip: number,
  limit: number
) {
  const filter: Record<string, unknown> = { patientId, ...notDeleted };
  const today = clinicDateTime(0, 0, 0);
  if (status === 'overdue') {
    filter.status = { $in: [...OPEN_RECALL] };
    filter.dueDate = { $lt: today };
  } else if (status === 'due' || status === 'scheduled') {
    filter.status = status;
    filter.dueDate = { $gte: today };
  } else if (status) {
    filter.status = status;
  }
  const [rows, total] = await Promise.all([
    Recall.find(filter).populate(RECALL_POPULATE).sort({ dueDate: 1, createdAt: -1 }).skip(skip).limit(limit),
    Recall.countDocuments(filter),
  ]);
  return { data: await presentRecalls(patientId, rows), total };
}

export async function getPresentedRecall(id: string, patientId: string) {
  const recall = await findRecall(id, patientId);
  await recall.populate(RECALL_POPULATE);
  const [presented] = await presentRecalls(patientId, [recall]);
  return presented;
}

export async function createRecall(patientId: string, input: RecallCreateInput) {
  if (input.status === 'scheduled' && input.dueDate.getTime() < clinicDateTime(0, 0, 0).getTime()) {
    throw new HttpError(400, 'Scheduled follow-up needs a due date today or later');
  }
  const assignedProvider = await assertClinician(input.assignedProvider, 'Assigned provider');
  const diagnosis = await resolveDiagnosis(patientId, input.diagnosisId);
  const carePlanId = await resolveCarePlan(patientId, input.carePlanId);
  const recall = await Recall.create({
    patientId,
    diagnosisId: diagnosis.diagnosisId,
    diagnosisKind: diagnosis.diagnosisKind,
    carePlanId,
    reason: input.reason.trim(),
    dueDate: input.dueDate,
    assignedProvider,
    status: input.status,
  });
  const after = recall.toObject();
  await recall.populate(RECALL_POPULATE);
  const [presented] = await presentRecalls(patientId, [recall]);
  return {
    recall: presented,
    audits: [
      audit('create', 'Recall', String(recall._id), MONITORING_AUDIT_EVENTS.recallCreated, undefined, after),
    ],
  };
}

export async function updateRecall(id: string, patientId: string, input: RecallUpdateInput) {
  const recall = await findRecall(id, patientId);
  assertRecallOpen(recall);
  const before = recall.toObject();
  if (input.reason !== undefined) recall.reason = input.reason.trim();
  if (input.dueDate) recall.dueDate = input.dueDate;
  if (input.assignedProvider) {
    recall.assignedProvider = await assertClinician(input.assignedProvider, 'Assigned provider');
  }
  await applyLinks(patientId, input, recall);
  if (recall.status === 'scheduled' && recall.dueDate.getTime() < clinicDateTime(0, 0, 0).getTime()) {
    throw new HttpError(400, 'Scheduled follow-up needs a due date today or later');
  }
  await recall.save();
  const after = recall.toObject();
  await recall.populate(RECALL_POPULATE);
  const [presented] = await presentRecalls(patientId, [recall]);
  return {
    recall: presented,
    audits: [
      audit('update', 'Recall', String(recall._id), MONITORING_AUDIT_EVENTS.recallUpdated, before, after),
    ],
  };
}

export async function changeRecallStatus(
  id: string,
  patientId: string,
  input: RecallStatusChange
) {
  const recall = await findRecall(id, patientId);
  const effective = effectiveRecallStatus(recall.status, recall.dueDate);
  const allowed = RECALL_TRANSITIONS[effective];
  if (!allowed.includes(input.status)) {
    throw new HttpError(
      400,
      `${RECALL_STATUS_LABELS[effective]} recalls cannot move to ${RECALL_STATUS_LABELS[input.status]}`
    );
  }
  const dueChanged = Boolean(input.dueDate && input.dueDate.getTime() !== recall.dueDate.getTime());
  if (recall.status === input.status && !dueChanged) {
    throw new HttpError(400, `Recall is already ${RECALL_STATUS_LABELS[input.status]}`);
  }
  const before = recall.toObject();
  if ((input.status === 'due' || input.status === 'scheduled') && input.dueDate) {
    recall.dueDate = input.dueDate;
  }
  if (
    (input.status === 'due' || input.status === 'scheduled') &&
    effectiveRecallStatus(input.status, recall.dueDate) === 'overdue'
  ) {
    throw new HttpError(400, 'Choose a due date today or later');
  }
  recall.status = input.status;
  if (input.status === 'completed') {
    recall.completedAt = new Date();
    recall.cancelledAt = null;
  } else if (input.status === 'cancelled') {
    recall.cancelledAt = new Date();
    recall.completedAt = null;
  } else {
    recall.completedAt = null;
    recall.cancelledAt = null;
  }
  await recall.save();
  const after = recall.toObject() as unknown as Record<string, unknown>;
  if (input.note) after.note = input.note;
  await recall.populate(RECALL_POPULATE);
  const [presented] = await presentRecalls(patientId, [recall]);
  return {
    recall: presented,
    audits: [
      audit(
        'update',
        'Recall',
        String(recall._id),
        input.status === 'completed'
          ? MONITORING_AUDIT_EVENTS.recallCompleted
          : MONITORING_AUDIT_EVENTS.recallStatusChanged,
        before,
        after
      ),
    ],
  };
}

export async function monitoringDashboard(patientId: string) {
  const today = clinicDateTime(0, 0, 0);
  const horizon = clinicDateTime(90, 0, 0);
  const [programs, overdue, upcoming, recent, counts] = await Promise.all([
    MonitoringProgram.find({ patientId, status: 'active', ...notDeleted })
      .populate(PROGRAM_POPULATE)
      .sort({ enrolledDate: -1 })
      .limit(20),
    Recall.find({
      patientId,
      status: { $in: [...OPEN_RECALL] },
      dueDate: { $lt: today },
      ...notDeleted,
    })
      .populate(RECALL_POPULATE)
      .sort({ dueDate: 1 })
      .limit(20),
    Recall.find({
      patientId,
      status: { $in: [...OPEN_RECALL] },
      dueDate: { $gte: today, $lt: horizon },
      ...notDeleted,
    })
      .populate(RECALL_POPULATE)
      .sort({ dueDate: 1 })
      .limit(20),
    MonitoringMetric.find({ patientId, ...notDeleted }).sort({ recordedAt: -1, createdAt: -1 }).limit(200).lean(),
    monitoringCounts(patientId),
  ]);
  const latestByProgram = new Map<string, MetricRow>();
  if (programs.length) {
    const latest = await MonitoringMetric.find({
      programId: { $in: programs.map((program) => program._id) },
      ...notDeleted,
    })
      .sort({ recordedAt: -1, createdAt: -1 })
      .lean();
    for (const metric of latest) {
      const key = String(metric.programId);
      if (!latestByProgram.has(key)) latestByProgram.set(key, metric);
    }
  }
  const abnormal = recent.filter((metric) => readingIsAbnormal(metric)).slice(0, 8);
  const titles = await programTitles(
    patientId,
    abnormal.map((metric) => String(metric.programId))
  );
  const diagnosisMap = await diagnosisLabels(patientId, [...programs, ...overdue, ...upcoming]);
  return {
    counts: {
      ...counts,
      upcomingRecalls: await Recall.countDocuments({
        patientId,
        status: { $in: [...OPEN_RECALL] },
        dueDate: { $gte: today, $lt: horizon },
        ...notDeleted,
      }),
    },
    activePrograms: programs.map((program) => {
      const latestMetric = latestByProgram.get(String(program._id));
      return {
        _id: String(program._id),
        title: programTitle(program),
        programType: program.programType,
        status: program.status,
        enrolledDate: program.enrolledDate,
        owner: personName(program.ownerClinicianId),
        diagnosisLabel: labelFor(program, diagnosisMap),
        latestMetric: latestMetric ? presentMetric(latestMetric) : null,
      };
    }),
    overdueRecalls: overdue.map((recall) => recallCard(recall, diagnosisMap)),
    upcomingRecalls: upcoming.map((recall) => recallCard(recall, diagnosisMap)),
    recentAbnormal: abnormal.map((metric) => ({
      ...presentMetric(metric),
      programTitle: titles.get(String(metric.programId)) || 'Monitoring',
    })),
  };
}

export async function monitoringTrends(patientId: string) {
  const [bloodPressure, weight, a1c, ldl, egfr, custom] = await Promise.all([
    latestOfType(patientId, 'blood_pressure'),
    latestOfType(patientId, 'weight'),
    latestOfType(patientId, 'a1c'),
    latestOfType(patientId, 'ldl'),
    latestOfType(patientId, 'egfr'),
    latestOfType(patientId, 'custom', 100),
  ]);
  return {
    bloodPressure: buildSeries('blood_pressure', METRIC_TYPE_LABELS.blood_pressure, bloodPressure),
    weight: buildSeries('weight', METRIC_TYPE_LABELS.weight, weight),
    a1c: buildSeries('a1c', METRIC_TYPE_LABELS.a1c, a1c),
    laboratory: [
      buildSeries('ldl', METRIC_TYPE_LABELS.ldl, ldl),
      buildSeries('egfr', METRIC_TYPE_LABELS.egfr, egfr),
      ...customSeries(custom),
    ],
  };
}

function asDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function clinicDayLabel(value: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CLINIC_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(value);
}

function assertNotFuture(value: Date, label: string) {
  if (Number.isNaN(value.getTime())) throw new HttpError(400, `${label} is not a valid date`);
  if (value.getTime() > Date.now() + 60_000) {
    throw new HttpError(400, `${label} cannot be in the future`);
  }
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cleanName(value: string | null | undefined) {
  const name = value?.trim() || '';
  return name || null;
}

function metricDisplay(metric: { metricType: MetricType; label?: string | null }) {
  if (metric.metricType === 'custom' && metric.label?.trim()) return metric.label.trim();
  return METRIC_TYPE_LABELS[metric.metricType];
}

function metricLabel(type: MetricType, label?: string | null) {
  if (type !== 'custom') return null;
  const name = label?.trim() || '';
  if (!name) throw new HttpError(400, 'Name the custom metric');
  return name;
}

function parseBp(value: string) {
  const match = /^(\d{2,3})\s*\/\s*(\d{2,3})$/.exec(value.trim());
  if (!match) return null;
  return { systolic: Number(match[1]), diastolic: Number(match[2]) };
}

function normalizeValue(type: MetricType, value: string) {
  const trimmed = value.trim();
  if (type !== 'blood_pressure') return trimmed;
  const bp = parseBp(trimmed);
  if (!bp) return trimmed;
  return `${bp.systolic}/${bp.diastolic}`;
}

function assertReading(type: MetricType, value: string, unit: string) {
  if (type === 'custom') return;
  if (type === 'blood_pressure') {
    const bp = parseBp(value);
    if (!bp) throw new HttpError(400, 'Enter blood pressure as systolic/diastolic, such as 128/82');
    if (bp.systolic < 60 || bp.systolic > 250 || bp.diastolic < 30 || bp.diastolic > 150) {
      throw new HttpError(400, 'Blood pressure is outside the accepted range');
    }
    if (bp.diastolic >= bp.systolic) {
      throw new HttpError(400, 'Diastolic pressure must be lower than systolic pressure');
    }
    return;
  }
  const reading = Number(value);
  if (!Number.isFinite(reading)) throw new HttpError(400, 'Enter a number');
  const pounds = /lb/i.test(unit);
  const milligrams = /mg/i.test(unit);
  const ranges: Partial<Record<MetricType, [number, number]>> = {
    weight: pounds ? [2, 1100] : [1, 500],
    bmi: [8, 90],
    a1c: [3, 25],
    ldl: milligrams ? [0, 600] : [0, 30],
    egfr: [0, 200],
  };
  const range = ranges[type];
  if (!range) return;
  if (reading < range[0] || reading > range[1]) {
    throw new HttpError(400, `${METRIC_TYPE_LABELS[type]} is outside the accepted range`);
  }
}

function readingIsAbnormal(input: {
  metricType: MetricType;
  value: string;
  unit?: string | null;
  abnormal?: boolean;
}) {
  if (input.metricType === 'custom') return Boolean(input.abnormal);
  if (input.metricType === 'weight') return false;
  if (input.metricType === 'blood_pressure') {
    const bp = parseBp(input.value);
    if (!bp) return false;
    return bp.systolic >= 140 || bp.diastolic >= 90 || bp.systolic < 90 || bp.diastolic < 60;
  }
  const reading = Number(input.value);
  if (!Number.isFinite(reading)) return false;
  if (input.metricType === 'bmi') return reading < 18.5 || reading >= 30;
  if (input.metricType === 'a1c') return reading >= 7;
  if (input.metricType === 'ldl') return /mg/i.test(input.unit || '') ? reading >= 130 : reading >= 3.5;
  if (input.metricType === 'egfr') return reading < 60;
  return false;
}

function assertMetricSource(role: string, source: MetricSource) {
  if (role === 'caregiver' && source === 'clinic') {
    throw new HttpError(403, 'Caregivers may only record readings from home, a device, or a caregiver');
  }
}

function numericOf(type: MetricType, value: string) {
  if (type === 'blood_pressure') return parseBp(value)?.systolic ?? null;
  const reading = Number(value);
  return Number.isFinite(reading) ? reading : null;
}

function bpDirection(latest: string, previous: string): TrendDirection {
  const current = parseBp(latest);
  const prior = parseBp(previous);
  if (!current || !prior) return 'unknown';
  const systolic = current.systolic - prior.systolic;
  const diastolic = current.diastolic - prior.diastolic;
  if (Math.abs(systolic) < 5 && Math.abs(diastolic) < 5) return 'stable';
  const delta = Math.abs(systolic) >= Math.abs(diastolic) ? systolic : diastolic;
  return delta > 0 ? 'up' : 'down';
}

function stableBand(type: MetricType, unit: string) {
  if (type === 'weight') return /lb/i.test(unit) ? 1 : 0.5;
  if (type === 'bmi') return 0.3;
  if (type === 'a1c') return 0.2;
  if (type === 'ldl') return /mg/i.test(unit) ? 5 : 0.2;
  if (type === 'egfr') return 3;
  return 0;
}

function directionBetween(type: MetricType, latest: string, previous: string, unit: string): TrendDirection {
  if (type === 'blood_pressure') return bpDirection(latest, previous);
  const current = Number(latest);
  const prior = Number(previous);
  if (!Number.isFinite(current) || !Number.isFinite(prior)) return 'unknown';
  const delta = current - prior;
  if (Math.abs(delta) <= stableBand(type, unit)) return 'stable';
  return delta > 0 ? 'up' : 'down';
}

function presentMetric(metric: MetricRow) {
  const unit = metric.unit?.trim() || DEFAULT_METRIC_UNITS[metric.metricType] || '';
  return {
    _id: String(metric._id),
    programId: String(metric.programId),
    metricType: metric.metricType,
    label: metric.label?.trim() || null,
    displayLabel: metricDisplay(metric),
    value: metric.value,
    unit,
    recordedAt: metric.recordedAt,
    source: metric.source,
    abnormal: readingIsAbnormal({ ...metric, unit }),
  };
}

function buildSeries(metricType: MetricType, label: string, newestFirst: MetricRow[]) {
  const unit = newestFirst[0]?.unit?.trim() || DEFAULT_METRIC_UNITS[metricType] || '';
  const recent = newestFirst.slice(0, 6).map((metric) => presentMetric(metric));
  const spark = [...newestFirst].slice(0, 12).reverse();
  const latest = newestFirst[0];
  const previous = newestFirst[1];
  return {
    metricType,
    label,
    unit,
    direction:
      latest && previous ? directionBetween(metricType, latest.value, previous.value, unit) : ('unknown' as const),
    latest: recent[0] || null,
    recent,
    points: spark.map((metric) => ({
      value: metric.value,
      numeric: numericOf(metricType, metric.value),
      recordedAt: metric.recordedAt,
    })),
  };
}

function customSeries(newestFirst: MetricRow[]) {
  const groups = new Map<string, MetricRow[]>();
  for (const metric of newestFirst) {
    const key = metric.label?.trim() || 'Custom';
    const list = groups.get(key) || [];
    list.push(metric);
    groups.set(key, list);
  }
  return [...groups.entries()].map(([label, rows]) => buildSeries('custom', label, rows));
}

async function latestOfType(patientId: string, metricType: MetricType, limit = 30) {
  return MonitoringMetric.find({ patientId, metricType, ...notDeleted })
    .sort({ recordedAt: -1, createdAt: -1 })
    .limit(limit)
    .lean();
}

function programLifePoints(program: ProgramTimelineSource): MonitoringTimelinePoint[] {
  const points: MonitoringTimelinePoint[] = [];
  const title = programTitle(program);
  const enrolled = asDate(program.enrolledDate) || asDate(program.createdAt);
  if (enrolled) {
    points.push({ action: 'enrolled', label: 'Enrolled in monitoring', at: enrolled, detail: title });
  }
  const completed = asDate(program.completedDate);
  if (completed) {
    points.push({ action: 'completed', label: 'Program completed', at: completed, detail: title });
  }
  return points;
}

function metricPoints(metrics: MetricTimelineSource[], titles: Map<string, string>): MonitoringTimelinePoint[] {
  const points: MonitoringTimelinePoint[] = [];
  for (const metric of metrics) {
    const at = asDate(metric.recordedAt);
    if (!at) continue;
    const reading = [metricDisplay(metric), metric.value, metric.unit?.trim()].filter(Boolean).join(' ');
    const title = titles.get(String(metric.programId ?? ''));
    points.push({
      action: 'metric_recorded',
      label: 'Metric recorded',
      at,
      detail: title ? `${title} · ${reading}` : reading,
    });
  }
  return points;
}

function recallLifePoints(recall: RecallTimelineSource): MonitoringTimelinePoint[] {
  const points: MonitoringTimelinePoint[] = [];
  const created = asDate(recall.createdAt);
  const due = asDate(recall.dueDate);
  const detail = due ? `${recall.reason} · due ${clinicDayLabel(due)}` : recall.reason;
  if (created) {
    points.push({ action: 'recall_created', label: 'Recall created', at: created, detail });
  }
  const completed = asDate(recall.completedAt);
  if (completed) {
    points.push({ action: 'recall_completed', label: 'Recall completed', at: completed, detail: recall.reason });
  }
  return points;
}

function audit(
  action: AuditTrail['action'],
  resourceType: string,
  resourceId: string,
  event: string,
  before?: unknown,
  after?: unknown
): AuditTrail {
  return { action, resourceType, resourceId, event, before, after };
}

async function assertClinician(id: string, label: string) {
  if (!Types.ObjectId.isValid(id)) throw new HttpError(400, 'Expected an id');
  const user = await User.findById(id).select(PERSON);
  if (!user) throw new HttpError(404, `${label} not found`);
  if (user.role !== 'clinician') throw new HttpError(400, `${label} must be a clinician`);
  return user._id;
}

async function assertUniqueOpenProgram(
  patientId: string,
  programType: ProgramType,
  name: string | null,
  exceptId?: string
) {
  const filter: Record<string, unknown> = {
    patientId,
    programType,
    status: { $in: ['active', 'on_hold'] },
    ...notDeleted,
  };
  if (exceptId) filter._id = { $ne: exceptId };
  if (programType === 'custom') {
    if (!name) throw new HttpError(400, 'Name the custom monitoring program');
    filter.name = new RegExp(`^${escapeRegex(name)}$`, 'i');
  }
  const clash = await MonitoringProgram.findOne(filter).select('_id');
  if (!clash) return;
  if (programType === 'custom') {
    throw new HttpError(400, 'This patient already has an open custom program with that name');
  }
  throw new HttpError(
    400,
    `This patient already has an open ${PROGRAM_TYPE_LABELS[programType]} monitoring program`
  );
}

async function resolveDiagnosis(patientId: string, diagnosisId?: string | null) {
  if (!diagnosisId) {
    return { diagnosisId: null as Types.ObjectId | null, diagnosisKind: null as MonitoringDiagnosisKind | null };
  }
  if (!Types.ObjectId.isValid(diagnosisId)) throw new HttpError(400, 'Expected an id');
  const problem = await Condition.findOne({ _id: diagnosisId, patientId, ...notDeleted }).select('_id');
  if (problem) return { diagnosisId: problem._id, diagnosisKind: 'problem' as const };
  const diagnosis = await EncounterDiagnosis.findOne({
    _id: diagnosisId,
    patientId,
    ...notDeleted,
  }).select('_id');
  if (diagnosis) return { diagnosisId: diagnosis._id, diagnosisKind: 'encounter' as const };
  throw new HttpError(400, 'Link a diagnosis from this chart');
}

async function resolveCarePlan(patientId: string, carePlanId?: string | null) {
  if (!carePlanId) return null;
  if (!Types.ObjectId.isValid(carePlanId)) throw new HttpError(400, 'Expected an id');
  const plan = await CarePlan.findOne({ _id: carePlanId, patientId, ...notDeleted }).select('_id');
  if (!plan) throw new HttpError(400, 'Link a care plan from this chart');
  return plan._id;
}

async function applyLinks(
  patientId: string,
  input: { diagnosisId?: string | null; carePlanId?: string | null },
  target: { diagnosisId?: Types.ObjectId | null; diagnosisKind?: MonitoringDiagnosisKind | null; carePlanId?: Types.ObjectId | null }
) {
  if (input.diagnosisId !== undefined) {
    const diagnosis = await resolveDiagnosis(patientId, input.diagnosisId);
    target.diagnosisId = diagnosis.diagnosisId;
    target.diagnosisKind = diagnosis.diagnosisKind;
  }
  if (input.carePlanId !== undefined) {
    target.carePlanId = await resolveCarePlan(patientId, input.carePlanId);
  }
}

async function findProgram(id: string, patientId: string) {
  if (!Types.ObjectId.isValid(id)) throw new HttpError(400, 'Expected an id');
  const program = await MonitoringProgram.findOne({ _id: id, patientId, ...notDeleted });
  if (!program) throw new HttpError(404, 'Monitoring program not found');
  return program;
}

async function findMetric(id: string, patientId: string) {
  if (!Types.ObjectId.isValid(id)) throw new HttpError(400, 'Expected an id');
  const metric = await MonitoringMetric.findOne({ _id: id, patientId, ...notDeleted });
  if (!metric) throw new HttpError(404, 'Monitoring metric not found');
  return metric;
}

async function findRecall(id: string, patientId: string) {
  if (!Types.ObjectId.isValid(id)) throw new HttpError(400, 'Expected an id');
  const recall = await Recall.findOne({ _id: id, patientId, ...notDeleted });
  if (!recall) throw new HttpError(404, 'Recall not found');
  return recall;
}

function assertRecallOpen(recall: IRecall) {
  if (recall.status === 'completed' || recall.status === 'cancelled') {
    throw new HttpError(400, `${RECALL_STATUS_LABELS[recall.status]} recalls stay on the chart unchanged`);
  }
}

function personName(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const name = (value as { displayName?: string }).displayName;
  return name || null;
}

function linkedCarePlan(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const title = (value as { title?: string }).title;
  return title || null;
}

function labelFor(
  doc: { diagnosisId?: unknown; diagnosisKind?: MonitoringDiagnosisKind | null },
  labels: Map<string, string>
) {
  if (!doc.diagnosisId || !doc.diagnosisKind) return null;
  return labels.get(String(doc.diagnosisId)) || null;
}

async function diagnosisLabels(
  patientId: string,
  docs: { diagnosisId?: unknown; diagnosisKind?: MonitoringDiagnosisKind | null }[]
) {
  const problemIds = [
    ...new Set(
      docs
        .filter((doc) => doc.diagnosisKind === 'problem' && doc.diagnosisId)
        .map((doc) => String(doc.diagnosisId))
    ),
  ];
  const diagnosisIds = [
    ...new Set(
      docs
        .filter((doc) => doc.diagnosisKind === 'encounter' && doc.diagnosisId)
        .map((doc) => String(doc.diagnosisId))
    ),
  ];
  const [problems, diagnoses] = await Promise.all([
    problemIds.length
      ? Condition.find({ _id: { $in: problemIds }, patientId, ...notDeleted }).select('display code').lean()
      : [],
    diagnosisIds.length
      ? EncounterDiagnosis.find({ _id: { $in: diagnosisIds }, patientId, ...notDeleted })
          .select('code description')
          .lean()
      : [],
  ]);
  const labels = new Map<string, string>();
  for (const problem of problems) {
    labels.set(String(problem._id), [problem.display, problem.code].filter(Boolean).join(' · '));
  }
  for (const diagnosis of diagnoses) {
    labels.set(String(diagnosis._id), [diagnosis.code, diagnosis.description].filter(Boolean).join(' · '));
  }
  return labels;
}

async function programTitles(patientId: string, ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  const labels = new Map<string, string>();
  if (unique.length === 0) return labels;
  const programs = await MonitoringProgram.find({
    _id: { $in: unique },
    patientId,
    ...notDeleted,
  })
    .select('programType name')
    .lean();
  for (const program of programs) labels.set(String(program._id), programTitle(program));
  return labels;
}

async function presentPrograms(patientId: string, programs: IMonitoringProgram[]) {
  if (programs.length === 0) return [];
  const metrics = await MonitoringMetric.find({
    programId: { $in: programs.map((program) => program._id) },
    ...notDeleted,
  })
    .sort({ recordedAt: -1, createdAt: -1 })
    .lean();
  const labels = await diagnosisLabels(patientId, programs);
  return programs.map((program) => {
    const mine = metrics.filter((metric) => String(metric.programId) === String(program._id));
    const body = program.toObject() as Record<string, unknown>;
    const source: ProgramTimelineSource = {
      _id: program._id,
      programType: program.programType,
      name: program.name,
      enrolledDate: program.enrolledDate,
      completedDate: program.completedDate,
      createdAt: program.createdAt,
    };
    return {
      ...body,
      title: programTitle(program),
      owner: personName(body.ownerClinicianId),
      carePlanTitle: linkedCarePlan(body.carePlanId),
      diagnosisLabel: labelFor(program, labels),
      recentMetrics: mine.slice(0, 8).map((metric) => presentMetric(metric)),
      timeline: timelinePointsForMonitoring( [source], mine, []),
    };
  });
}

function recallCard(recall: IRecall, labels: Map<string, string>) {
  return {
    _id: String(recall._id),
    reason: recall.reason,
    dueDate: recall.dueDate,
    status: effectiveRecallStatus(recall.status, recall.dueDate),
    assignedProvider: personName(recall.assignedProvider),
    diagnosisLabel: labelFor(recall, labels),
    carePlanTitle: linkedCarePlan(recall.carePlanId),
  };
}

async function presentRecalls(patientId: string, recalls: IRecall[]) {
  if (recalls.length === 0) return [];
  const labels = await diagnosisLabels(patientId, recalls);
  return recalls.map((recall) => {
    const body = recall.toObject() as Record<string, unknown>;
    const source: RecallTimelineSource = {
      reason: recall.reason,
      dueDate: recall.dueDate,
      createdAt: recall.createdAt,
      completedAt: recall.completedAt,
    };
    return {
      ...body,
      status: effectiveRecallStatus(recall.status, recall.dueDate),
      assignedProviderName: personName(body.assignedProvider),
      carePlanTitle: linkedCarePlan(body.carePlanId),
      diagnosisLabel: labelFor(recall, labels),
      timeline: timelinePointsForMonitoring([], [], [source]),
    };
  });
}
