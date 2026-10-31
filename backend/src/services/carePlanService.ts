import { Types } from 'mongoose';
import { Condition } from '../models/Condition.js';
import { CarePlan, type ICarePlan } from '../models/CarePlan.js';
import { CarePlanGoal } from '../models/CarePlanGoal.js';
import { CarePlanIntervention } from '../models/CarePlanIntervention.js';
import { Encounter } from '../models/Encounter.js';
import { EncounterDiagnosis } from '../models/EncounterDiagnosis.js';
import { Medication } from '../models/Medication.js';
import { Order } from '../models/Order.js';
import { OrderResult } from '../models/OrderResult.js';
import { Task } from '../models/Task.js';
import { User } from '../models/User.js';
import { HttpError } from '../middleware/error.js';
import { notDeleted } from '../utils/pagination.js';
import { zonedDateTime } from '../utils/clinicTime.js';
import {
  CARE_PLAN_AUDIT_EVENTS,
  CARE_PLAN_STATUS_LABELS,
  CARE_PLAN_TRANSITIONS,
  GOAL_STATUS_LABELS,
  GOAL_TRANSITIONS,
  INTERVENTION_STATUS_LABELS,
  INTERVENTION_TRANSITIONS,
  type CarePlanDiagnosisKind,
  type CarePlanGoalStatus,
  type CarePlanInterventionStatus,
  type CarePlanRole,
  type CarePlanStatus,
  type CarePlanTimelineAction,
  type CarePlanView,
} from '../types/carePlans.js';

const PERSON = 'displayName role';
const OPEN_PLAN: CarePlanStatus[] = ['draft', 'active', 'on_hold'];

export type CarePlanCreateInput = {
  title: string;
  description: string;
  status: 'draft' | 'active';
  startDate: Date;
  targetDate?: Date;
  encounterId?: string;
  ownerClinicianId: string;
  problemIds: string[];
  encounterDiagnosisIds: string[];
  primaryDiagnosisId?: string;
};

export type CarePlanUpdateInput = {
  title?: string;
  description?: string;
  startDate?: Date;
  targetDate?: Date | null;
  encounterId?: string | null;
  ownerClinicianId?: string;
  problemIds?: string[];
  encounterDiagnosisIds?: string[];
  primaryDiagnosisId?: string | null;
};

export type CarePlanStatusInput = {
  status: CarePlanStatus;
  completedDate?: Date;
};

export type GoalWrite = {
  description?: string;
  targetValue?: string | null;
  targetDate?: Date;
  status?: CarePlanGoalStatus;
};

export type InterventionWrite = {
  description?: string;
  assignedRole?: CarePlanRole;
  dueDate?: Date;
  status?: CarePlanInterventionStatus;
};

export type CarePlanTimelineSource = {
  _id?: unknown;
  title: string;
  startDate?: Date | string | null;
  createdAt?: Date | string | null;
  completedDate?: Date | string | null;
};

export type CarePlanGoalTimelineSource = {
  carePlanId?: unknown;
  description: string;
  createdAt?: Date | string | null;
  status?: string;
  achievedAt?: Date | string | null;
};

export type CarePlanInterventionTimelineSource = {
  carePlanId?: unknown;
  description: string;
  createdAt?: Date | string | null;
};

export type CarePlanTimelinePoint = {
  carePlanId: string;
  action: CarePlanTimelineAction;
  label: string;
  at: Date;
  detail: string;
};

export type AuditTrail = {
  action: 'create' | 'update';
  resourceType: string;
  resourceId: string;
  event: string;
  before?: unknown;
  after?: unknown;
};

export type SavedPlan = {
  plan: Record<string, unknown>;
  audits: AuditTrail[];
};

type LinkChoice = {
  problemIds?: string[];
  encounterDiagnosisIds?: string[];
  primaryDiagnosisId?: string | null;
  encounterId?: string | null;
};

function plain(doc: { toObject: () => object }) {
  return doc.toObject() as Record<string, unknown>;
}

function asDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function assertNotFuture(value: Date, label: string) {
  if (Number.isNaN(value.getTime())) throw new HttpError(400, `${label} is not a valid date`);
  if (value.getTime() > Date.now() + 60_000) {
    throw new HttpError(400, `${label} cannot be in the future`);
  }
}

function assertTargetAfterStart(start: Date, target: Date | null | undefined) {
  if (target && target.getTime() + 1000 < start.getTime()) {
    throw new HttpError(400, 'Target date cannot be before the start date');
  }
}

function clinicTodayStart() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const [year, month, day] = parts.split('-').map(Number);
  return zonedDateTime(year, month, day, 0, 0);
}

function isPastDue(target: Date | null | undefined, status: string, closed: ReadonlySet<string>) {
  if (!target || closed.has(status)) return false;
  return target.getTime() < clinicTodayStart().getTime();
}

function requireId(value: string, message = 'Expected an id') {
  if (!Types.ObjectId.isValid(value)) throw new HttpError(400, message);
  return new Types.ObjectId(value);
}

function canonicalIds(values: string[]) {
  return unique(values.map((value) => String(requireId(value))));
}

function refId(value: unknown) {
  if (!value) return '';
  if (typeof value === 'object' && '_id' in value) return String((value as { _id: unknown })._id);
  return String(value);
}

function transitionError(from: string, to: string, labels: Record<string, string>) {
  const current = labels[from] || from;
  const next = labels[to] || to;
  return new HttpError(400, `${current} cannot change to ${next}`);
}

function assertOpen(plan: ICarePlan) {
  if (plan.status === 'completed' || plan.status === 'cancelled') {
    throw new HttpError(400, 'Completed and cancelled care plans stay on the chart and cannot be edited');
  }
}

function backfill(plan: ICarePlan) {
  if (!plan.description?.trim()) plan.description = plan.title;
  if (!plan.startDate) plan.startDate = plan.createdAt || new Date();
}

export function carePlanTimelinePoints(
  plan: CarePlanTimelineSource,
  goals: CarePlanGoalTimelineSource[] = [],
  interventions: CarePlanInterventionTimelineSource[] = []
): CarePlanTimelinePoint[] {
  const carePlanId = String(plan._id ?? '');
  const points: CarePlanTimelinePoint[] = [];
  const opened = asDate(plan.startDate) || asDate(plan.createdAt);
  if (opened) {
    points.push({
      carePlanId,
      action: 'created',
      label: 'Care plan created',
      at: opened,
      detail: plan.title,
    });
  }
  for (const goal of goals) {
    const added = asDate(goal.createdAt);
    if (added) {
      points.push({
        carePlanId,
        action: 'goal_added',
        label: 'Goal added',
        at: added,
        detail: [plan.title, goal.description].filter(Boolean).join(' · '),
      });
    }
    const achieved = asDate(goal.achievedAt);
    if (achieved && goal.status === 'achieved') {
      points.push({
        carePlanId,
        action: 'goal_achieved',
        label: 'Goal achieved',
        at: achieved,
        detail: [plan.title, goal.description].filter(Boolean).join(' · '),
      });
    }
  }
  for (const intervention of interventions) {
    const added = asDate(intervention.createdAt);
    if (!added) continue;
    points.push({
      carePlanId,
      action: 'intervention_added',
      label: 'Intervention added',
      at: added,
      detail: [plan.title, intervention.description].filter(Boolean).join(' · '),
    });
  }
  const completed = asDate(plan.completedDate);
  if (completed) {
    points.push({
      carePlanId,
      action: 'completed',
      label: 'Care plan completed',
      at: completed,
      detail: plan.title,
    });
  }
  points.sort((a, b) => a.at.getTime() - b.at.getTime());
  return points;
}

export function timelinePointsForCarePlans(
  plans: CarePlanTimelineSource[],
  goals: CarePlanGoalTimelineSource[],
  interventions: CarePlanInterventionTimelineSource[]
) {
  const goalsByPlan = new Map<string, CarePlanGoalTimelineSource[]>();
  for (const goal of goals) {
    const key = String(goal.carePlanId ?? '');
    const list = goalsByPlan.get(key) || [];
    list.push(goal);
    goalsByPlan.set(key, list);
  }
  const interventionsByPlan = new Map<string, CarePlanInterventionTimelineSource[]>();
  for (const intervention of interventions) {
    const key = String(intervention.carePlanId ?? '');
    const list = interventionsByPlan.get(key) || [];
    list.push(intervention);
    interventionsByPlan.set(key, list);
  }
  return plans.flatMap((plan) =>
    carePlanTimelinePoints(
      plan,
      goalsByPlan.get(String(plan._id ?? '')) || [],
      interventionsByPlan.get(String(plan._id ?? '')) || []
    )
  );
}

async function assertOwner(ownerId: string) {
  const owner = await User.findById(requireId(ownerId)).select(PERSON);
  if (!owner) throw new HttpError(404, 'Clinician not found');
  if (owner.role !== 'clinician') throw new HttpError(400, 'Care plan owner must be a clinician');
  return owner._id;
}

async function resolveLinks(patientId: string, input: LinkChoice) {
  const problemIds = canonicalIds(input.problemIds || []);
  const diagnosisIds = canonicalIds(input.encounterDiagnosisIds || []);

  const problems = problemIds.length
    ? await Condition.find({
        _id: { $in: problemIds },
        patientId,
        status: 'active',
        ...notDeleted,
      }).select('_id')
    : [];
  if (problems.length !== problemIds.length) {
    throw new HttpError(400, 'Link active problems from this chart');
  }

  const diagnoses = diagnosisIds.length
    ? await EncounterDiagnosis.find({
        _id: { $in: diagnosisIds },
        patientId,
        ...notDeleted,
      }).select('_id')
    : [];
  if (diagnoses.length !== diagnosisIds.length) {
    throw new HttpError(400, 'Link encounter diagnoses from this chart');
  }

  let encounterId: Types.ObjectId | null = null;
  if (input.encounterId) {
    const encounter = await Encounter.findOne({
      _id: requireId(input.encounterId),
      patientId,
      ...notDeleted,
    }).select('_id');
    if (!encounter) throw new HttpError(404, 'Encounter not found');
    encounterId = encounter._id;
  }

  let primaryDiagnosisId: Types.ObjectId | null = null;
  let primaryDiagnosisKind: CarePlanDiagnosisKind | null = null;
  if (input.primaryDiagnosisId) {
    const primaryId = String(requireId(input.primaryDiagnosisId));
    if (problemIds.includes(primaryId)) {
      primaryDiagnosisId = new Types.ObjectId(primaryId);
      primaryDiagnosisKind = 'problem';
    } else if (diagnosisIds.includes(primaryId)) {
      primaryDiagnosisId = new Types.ObjectId(primaryId);
      primaryDiagnosisKind = 'encounter';
    } else {
      const problem = await Condition.findOne({
        _id: primaryId,
        patientId,
        status: 'active',
        ...notDeleted,
      }).select('_id');
      if (problem) {
        primaryDiagnosisId = problem._id;
        primaryDiagnosisKind = 'problem';
        problemIds.push(String(problem._id));
      } else {
        const diagnosis = await EncounterDiagnosis.findOne({
          _id: primaryId,
          patientId,
          ...notDeleted,
        }).select('_id');
        if (!diagnosis) {
          throw new HttpError(400, 'Primary diagnosis must be an active problem or an encounter diagnosis');
        }
        primaryDiagnosisId = diagnosis._id;
        primaryDiagnosisKind = 'encounter';
        diagnosisIds.push(String(diagnosis._id));
      }
    }
  }

  return {
    problemIds: problemIds.map((id) => new Types.ObjectId(id)),
    encounterDiagnosisIds: diagnosisIds.map((id) => new Types.ObjectId(id)),
    primaryDiagnosisId,
    primaryDiagnosisKind,
    encounterId,
  };
}

function applyLinks(
  plan: ICarePlan,
  links: Awaited<ReturnType<typeof resolveLinks>>,
  encounterWasSent: boolean
) {
  plan.problemIds = links.problemIds;
  plan.encounterDiagnosisIds = links.encounterDiagnosisIds;
  plan.primaryDiagnosisId = links.primaryDiagnosisId;
  plan.primaryDiagnosisKind = links.primaryDiagnosisKind;
  if (encounterWasSent) plan.encounterId = links.encounterId;
}

async function getPlan(id: string, patientId: string) {
  const plan = await CarePlan.findOne({ _id: requireId(id), patientId, ...notDeleted });
  if (!plan) throw new HttpError(404, 'Care plan not found');
  return plan;
}

async function getGoal(goalId: string, plan: ICarePlan) {
  const goal = await CarePlanGoal.findOne({
    _id: requireId(goalId),
    carePlanId: plan._id,
    patientId: plan.patientId,
    ...notDeleted,
  });
  if (!goal) throw new HttpError(404, 'Goal not found');
  return goal;
}

async function getIntervention(interventionId: string, plan: ICarePlan) {
  const intervention = await CarePlanIntervention.findOne({
    _id: requireId(interventionId),
    carePlanId: plan._id,
    patientId: plan.patientId,
    ...notDeleted,
  });
  if (!intervention) throw new HttpError(404, 'Intervention not found');
  return intervention;
}

function diagnosisLabel(code: string | undefined, text: string) {
  return [code, text].filter(Boolean).join(' · ');
}

export async function presentPlans(plans: ICarePlan[]) {
  if (!plans.length) return [];
  await CarePlan.populate(plans, [
    { path: 'ownerClinicianId', select: PERSON },
    { path: 'encounterId', select: 'chiefComplaint openedAt status' },
    { path: 'progress.authorId', select: PERSON },
  ]);

  const planIds = plans.map((plan) => plan._id);
  const patientIds = unique(plans.map((plan) => String(plan.patientId)));
  const problemIds = unique(plans.flatMap((plan) => plan.problemIds.map(String)));
  const diagnosisIds = unique(plans.flatMap((plan) => plan.encounterDiagnosisIds.map(String)));
  const encounterIds = unique(plans.map((plan) => refId(plan.encounterId)).filter(Boolean));

  const [goals, interventions, problems, diagnoses] = await Promise.all([
    CarePlanGoal.find({ carePlanId: { $in: planIds }, ...notDeleted }).sort({ targetDate: 1 }).lean(),
    CarePlanIntervention.find({ carePlanId: { $in: planIds }, ...notDeleted }).sort({ dueDate: 1 }).lean(),
    problemIds.length
      ? Condition.find({ _id: { $in: problemIds }, ...notDeleted }).select('display code status').lean()
      : [],
    diagnosisIds.length
      ? EncounterDiagnosis.find({ _id: { $in: diagnosisIds }, ...notDeleted })
          .select('code description diagnosisType primaryDiagnosis encounterId')
          .lean()
      : [],
  ]);

  const medFilter: Record<string, unknown>[] = [];
  if (problemIds.length) medFilter.push({ conditionId: { $in: problemIds } });
  if (encounterIds.length) medFilter.push({ encounterId: { $in: encounterIds } });
  const orderFilter: Record<string, unknown>[] = [...medFilter];
  if (diagnosisIds.length) orderFilter.push({ diagnosisId: { $in: diagnosisIds } });

  const [medications, orders] = await Promise.all([
    medFilter.length && patientIds.length
      ? Medication.find({ patientId: { $in: patientIds }, ...notDeleted, $or: medFilter })
          .select('patientId conditionId encounterId genericName name dose strength dosage frequency status')
          .sort({ startDate: -1 })
          .limit(80)
          .lean()
      : [],
    orderFilter.length && patientIds.length
      ? Order.find({ patientId: { $in: patientIds }, ...notDeleted, $or: orderFilter })
          .select('patientId conditionId diagnosisId encounterId orderName orderType priority status orderedAt')
          .sort({ createdAt: -1 })
          .limit(80)
          .lean()
      : [],
  ]);
  const results = orders.length
    ? await OrderResult.find({
        orderId: { $in: orders.map((order) => order._id) },
        ...notDeleted,
      })
        .select('orderId resultType value unit status resultDate')
        .sort({ resultDate: -1 })
        .limit(80)
        .lean()
    : [];

  const problemsById = new Map(problems.map((problem) => [String(problem._id), problem]));
  const diagnosesById = new Map(diagnoses.map((diagnosis) => [String(diagnosis._id), diagnosis]));
  const goalsByPlan = new Map<string, typeof goals>();
  for (const goal of goals) {
    const key = String(goal.carePlanId);
    const list = goalsByPlan.get(key) || [];
    list.push(goal);
    goalsByPlan.set(key, list);
  }
  const interventionsByPlan = new Map<string, typeof interventions>();
  for (const intervention of interventions) {
    const key = String(intervention.carePlanId);
    const list = interventionsByPlan.get(key) || [];
    list.push(intervention);
    interventionsByPlan.set(key, list);
  }

  return plans.map((plan) => {
    const key = String(plan._id);
    const planGoals = goalsByPlan.get(key) || [];
    const planInterventions = interventionsByPlan.get(key) || [];
    const linkedProblemIds = new Set(plan.problemIds.map(String));
    const linkedDiagnosisIds = new Set(plan.encounterDiagnosisIds.map(String));
    const encounterId = refId(plan.encounterId);

    const linkedDiagnoses = [
      ...plan.problemIds.map((id) => {
        const problem = problemsById.get(String(id));
        return {
          id: String(id),
          kind: 'problem' as const,
          label: problem ? diagnosisLabel(problem.code, problem.display) : 'Problem',
          code: problem?.code,
          primary: plan.primaryDiagnosisKind === 'problem' && String(plan.primaryDiagnosisId) === String(id),
        };
      }),
      ...plan.encounterDiagnosisIds.map((id) => {
        const diagnosis = diagnosesById.get(String(id));
        return {
          id: String(id),
          kind: 'encounter' as const,
          label: diagnosis ? diagnosisLabel(diagnosis.code, diagnosis.description) : 'Encounter diagnosis',
          code: diagnosis?.code,
          primary:
            plan.primaryDiagnosisKind === 'encounter' && String(plan.primaryDiagnosisId) === String(id),
        };
      }),
    ];

    const relatedMedications = medications
      .filter(
        (medication) =>
          String(medication.patientId) === String(plan.patientId) &&
          ((medication.conditionId && linkedProblemIds.has(String(medication.conditionId))) ||
            (encounterId && medication.encounterId && String(medication.encounterId) === encounterId))
      )
      .slice(0, 8)
      .map((medication) => ({
        _id: medication._id,
        name: medication.genericName || medication.name || 'Medication',
        dose: medication.strength || medication.dose || medication.dosage || undefined,
        frequency: medication.frequency,
        status: medication.status,
      }));

    const relatedOrders = orders
      .filter(
        (order) =>
          String(order.patientId) === String(plan.patientId) &&
          ((order.conditionId && linkedProblemIds.has(String(order.conditionId))) ||
            (order.diagnosisId && linkedDiagnosisIds.has(String(order.diagnosisId))) ||
            (encounterId && order.encounterId && String(order.encounterId) === encounterId))
      )
      .slice(0, 8);
    const relatedOrderIds = new Set(relatedOrders.map((order) => String(order._id)));
    const orderNames = new Map(relatedOrders.map((order) => [String(order._id), order.orderName]));
    const recentResults = results
      .filter((result) => relatedOrderIds.has(String(result.orderId)))
      .slice(0, 5)
      .map((result) => ({
        _id: result._id,
        orderId: result.orderId,
        orderName: orderNames.get(String(result.orderId)) || 'Order',
        resultType: result.resultType,
        value: result.value,
        unit: result.unit,
        status: result.status,
        resultDate: result.resultDate,
      }));

    const body = plan.toObject() as Record<string, unknown> & CarePlanTimelineSource;
    const progress = [...(plan.progress || [])].sort((a, b) => b.at.getTime() - a.at.getTime());
    return {
      ...body,
      _id: plan._id,
      progress,
      goals: planGoals.map((goal) => ({
        ...goal,
        overdue: isPastDue(goal.targetDate, goal.status, new Set(['achieved', 'cancelled'])),
      })),
      interventions: planInterventions.map((intervention) => ({
        ...intervention,
        overdue: isPastDue(intervention.dueDate, intervention.status, new Set(['completed', 'cancelled'])),
      })),
      linkedDiagnoses,
      relatedMedications,
      relatedOrders: relatedOrders.map((order) => ({
        _id: order._id,
        orderName: order.orderName,
        orderType: order.orderType,
        priority: order.priority,
        status: order.status,
        orderedAt: order.orderedAt,
      })),
      recentResults,
      timeline: carePlanTimelinePoints(body, planGoals, planInterventions).map((point) => ({
        ...point,
        at: point.at.toISOString(),
      })),
    };
  });
}

async function presented(plan: ICarePlan) {
  const [item] = await presentPlans([plan]);
  return item;
}

function requireOwner(plan: ICarePlan) {
  if (!plan.ownerClinicianId) throw new HttpError(400, 'Choose a clinician owner');
}

export async function listCarePlanClinicians() {
  return User.find({ role: 'clinician' }).select(PERSON).sort({ displayName: 1 });
}

export async function carePlanOptions(patientId: string) {
  const [clinicians, problems, diagnoses, encounters] = await Promise.all([
    listCarePlanClinicians(),
    Condition.find({ patientId, status: 'active', ...notDeleted })
      .select('display code status')
      .sort({ display: 1 })
      .lean(),
    EncounterDiagnosis.find({ patientId, ...notDeleted })
      .select('code description diagnosisType primaryDiagnosis encounterId recordedAt')
      .sort({ recordedAt: -1 })
      .limit(50)
      .lean(),
    Encounter.find({ patientId, ...notDeleted })
      .select('chiefComplaint openedAt status')
      .sort({ openedAt: -1 })
      .limit(30)
      .lean(),
  ]);
  return { clinicians, problems, diagnoses, encounters };
}

export async function listCarePlans(patientId: string, view: CarePlanView, skip: number, limit: number) {
  const filter: Record<string, unknown> = { patientId, ...notDeleted };
  if (view === 'current') filter.status = { $in: OPEN_PLAN };
  if (view === 'active') filter.status = 'active';
  if (view === 'closed') filter.status = { $in: ['completed', 'cancelled'] };
  const [rows, total] = await Promise.all([
    CarePlan.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit),
    CarePlan.countDocuments(filter),
  ]);
  return { data: await presentPlans(rows), total };
}

export async function getPresentedPlan(id: string, patientId: string) {
  return presented(await getPlan(id, patientId));
}

export async function carePlanSummary(patientId: string) {
  const today = clinicTodayStart();
  const [active, onHold, goals, tasks] = await Promise.all([
    CarePlan.find({ patientId, status: 'active', ...notDeleted })
      .sort({ updatedAt: -1 })
      .limit(8)
      .populate('ownerClinicianId', PERSON),
    CarePlan.find({ patientId, status: 'on_hold', ...notDeleted })
      .sort({ updatedAt: -1 })
      .limit(8)
      .populate('ownerClinicianId', PERSON),
    CarePlanGoal.find({
      patientId,
      status: { $in: ['not_started', 'in_progress'] },
      targetDate: { $lt: today },
      ...notDeleted,
    })
      .sort({ targetDate: 1 })
      .limit(12)
      .lean(),
    Task.find({
      patientId,
      carePlanId: { $exists: true, $ne: null },
      status: { $in: ['pending', 'in_progress'] },
      ...notDeleted,
    })
      .sort({ dueDate: 1 })
      .limit(20)
      .lean(),
  ]);

  const summaryPlans = [...active, ...onHold];
  const planIds = unique([
    ...summaryPlans.map((plan) => String(plan._id)),
    ...goals.map((goal) => String(goal.carePlanId)),
    ...tasks.map((task) => (task.carePlanId ? String(task.carePlanId) : '')),
  ]);
  const plans = planIds.length
    ? await CarePlan.find({ _id: { $in: planIds }, patientId, ...notDeleted }).select('title status primaryDiagnosisId primaryDiagnosisKind problemIds encounterDiagnosisIds')
    : [];
  const openPlanIds = new Set(
    plans.filter((plan) => plan.status === 'active' || plan.status === 'on_hold').map((plan) => String(plan._id))
  );
  const titles = new Map(plans.map((plan) => [String(plan._id), plan.title]));

  const problemIds = unique(summaryPlans.flatMap((plan) => (plan.problemIds || []).map(String)));
  const diagnosisIds = unique(summaryPlans.flatMap((plan) => (plan.encounterDiagnosisIds || []).map(String)));
  const [problems, diagnoses] = await Promise.all([
    problemIds.length ? Condition.find({ _id: { $in: problemIds } }).select('display code').lean() : [],
    diagnosisIds.length
      ? EncounterDiagnosis.find({ _id: { $in: diagnosisIds } }).select('code description').lean()
      : [],
  ]);
  const problemLabels = new Map(problems.map((problem) => [String(problem._id), diagnosisLabel(problem.code, problem.display)]));
  const diagnosisLabels = new Map(
    diagnoses.map((diagnosis) => [String(diagnosis._id), diagnosisLabel(diagnosis.code, diagnosis.description)])
  );

  function row(plan: ICarePlan) {
    const owner = plan.ownerClinicianId as unknown as { displayName?: string } | undefined;
    const primary =
      plan.primaryDiagnosisKind === 'problem'
        ? problemLabels.get(String(plan.primaryDiagnosisId))
        : plan.primaryDiagnosisKind === 'encounter'
          ? diagnosisLabels.get(String(plan.primaryDiagnosisId))
          : undefined;
    return {
      _id: plan._id,
      title: plan.title,
      status: plan.status,
      targetDate: plan.targetDate,
      owner: owner && typeof owner === 'object' ? owner.displayName || null : null,
      primaryDiagnosis: primary || null,
    };
  }

  const upcoming = tasks
    .filter((task) => {
      if (!task.carePlanId || !openPlanIds.has(String(task.carePlanId))) return false;
      if (!task.dueDate) return true;
      return task.dueDate.getTime() >= today.getTime();
    })
    .slice(0, 8)
    .map((task) => ({
      _id: task._id,
      title: task.title,
      status: task.status,
      dueDate: task.dueDate,
      assigneeRole: task.assigneeRole,
      carePlanId: task.carePlanId,
      carePlanTitle: titles.get(String(task.carePlanId)) || 'Care plan',
    }));

  return {
    active: active.map(row),
    onHold: onHold.map(row),
    overdueGoals: goals
      .filter((goal) => openPlanIds.has(String(goal.carePlanId)))
      .slice(0, 8)
      .map((goal) => ({
        _id: goal._id,
        description: goal.description,
        targetValue: goal.targetValue,
        targetDate: goal.targetDate,
        status: goal.status,
        carePlanId: goal.carePlanId,
        carePlanTitle: titles.get(String(goal.carePlanId)) || 'Care plan',
      })),
    upcomingTasks: upcoming,
  };
}

export async function createCarePlan(
  patientId: string,
  input: CarePlanCreateInput
): Promise<SavedPlan> {
  const ownerId = await assertOwner(input.ownerClinicianId);
  assertTargetAfterStart(input.startDate, input.targetDate);
  const links = await resolveLinks(patientId, input);
  if (input.status === 'active' && !links.primaryDiagnosisId) {
    throw new HttpError(400, 'An active care plan needs a primary diagnosis');
  }
  const plan = await CarePlan.create({
    patientId,
    title: input.title.trim(),
    description: input.description.trim(),
    status: input.status,
    startDate: input.startDate,
    targetDate: input.targetDate ?? null,
    ownerClinicianId: ownerId,
    problemIds: links.problemIds,
    encounterDiagnosisIds: links.encounterDiagnosisIds,
    primaryDiagnosisId: links.primaryDiagnosisId,
    primaryDiagnosisKind: links.primaryDiagnosisKind,
    encounterId: links.encounterId,
    progress: [],
  });
  return {
    plan: await presented(plan),
    audits: [
      {
        action: 'create',
        resourceType: 'CarePlan',
        resourceId: String(plan._id),
        event: CARE_PLAN_AUDIT_EVENTS.created,
        after: plain(plan),
      },
    ],
  };
}

export async function updateCarePlan(
  id: string,
  patientId: string,
  input: CarePlanUpdateInput
): Promise<SavedPlan> {
  const plan = await getPlan(id, patientId);
  assertOpen(plan);
  const before = plain(plan);
  if (input.title !== undefined) plan.title = input.title.trim();
  if (input.description !== undefined) plan.description = input.description.trim();
  if (input.startDate) plan.startDate = input.startDate;
  if (input.targetDate === null) plan.targetDate = null;
  else if (input.targetDate) plan.targetDate = input.targetDate;
  if (input.ownerClinicianId) plan.ownerClinicianId = await assertOwner(input.ownerClinicianId);

  const linksTouched =
    input.problemIds !== undefined ||
    input.encounterDiagnosisIds !== undefined ||
    input.primaryDiagnosisId !== undefined ||
    input.encounterId !== undefined;
  if (linksTouched) {
    const links = await resolveLinks(patientId, {
      problemIds: input.problemIds ?? plan.problemIds.map(String),
      encounterDiagnosisIds: input.encounterDiagnosisIds ?? plan.encounterDiagnosisIds.map(String),
      primaryDiagnosisId:
        input.primaryDiagnosisId === undefined
          ? plan.primaryDiagnosisId
            ? String(plan.primaryDiagnosisId)
            : null
          : input.primaryDiagnosisId,
      encounterId:
        input.encounterId === undefined
          ? plan.encounterId
            ? String(plan.encounterId)
            : null
          : input.encounterId,
    });
    applyLinks(plan, links, input.encounterId !== undefined);
  }

  backfill(plan);
  requireOwner(plan);
  assertTargetAfterStart(plan.startDate, plan.targetDate);
  if (plan.status === 'active' && !plan.primaryDiagnosisId) {
    throw new HttpError(400, 'An active care plan needs a primary diagnosis');
  }
  await plan.save();
  return {
    plan: await presented(plan),
    audits: [
      {
        action: 'update',
        resourceType: 'CarePlan',
        resourceId: String(plan._id),
        event: CARE_PLAN_AUDIT_EVENTS.updated,
        before,
        after: plain(plan),
      },
    ],
  };
}

export async function changeCarePlanStatus(
  id: string,
  patientId: string,
  input: CarePlanStatusInput
): Promise<SavedPlan> {
  const plan = await getPlan(id, patientId);
  if (plan.status === input.status) {
    throw new HttpError(400, `Care plan is already ${CARE_PLAN_STATUS_LABELS[plan.status]}`);
  }
  if (!CARE_PLAN_TRANSITIONS[plan.status].includes(input.status)) {
    throw transitionError(plan.status, input.status, CARE_PLAN_STATUS_LABELS);
  }
  const before = plain(plan);
  if (input.status === 'active' && !plan.primaryDiagnosisId) {
    throw new HttpError(400, 'Choose a primary diagnosis before activating the care plan');
  }
  if (input.status === 'completed') {
    const completedDate = input.completedDate ?? new Date();
    assertNotFuture(completedDate, 'Completed date');
    if (plan.startDate && completedDate.getTime() + 1000 < plan.startDate.getTime()) {
      throw new HttpError(400, 'Completed date cannot be before the start date');
    }
    plan.completedDate = completedDate;
  }
  plan.status = input.status;
  backfill(plan);
  requireOwner(plan);
  await plan.save();
  return {
    plan: await presented(plan),
    audits: [
      {
        action: 'update',
        resourceType: 'CarePlan',
        resourceId: String(plan._id),
        event:
          input.status === 'completed'
            ? CARE_PLAN_AUDIT_EVENTS.completed
            : CARE_PLAN_AUDIT_EVENTS.statusChanged,
        before,
        after: plain(plan),
      },
    ],
  };
}

export async function addCarePlanProgress(id: string, patientId: string, note: string, authorId: string) {
  const plan = await getPlan(id, patientId);
  if (plan.status === 'cancelled') {
    throw new HttpError(400, 'Cancelled care plans cannot take progress notes');
  }
  const before = plain(plan);
  const at = new Date();
  plan.progress.push({
    authorId: requireId(authorId),
    at,
    note: note.trim(),
  });
  backfill(plan);
  requireOwner(plan);
  await plan.save();
  const entry = plan.progress[plan.progress.length - 1];
  return {
    plan: await presented(plan),
    audits: [
      {
        action: 'update' as const,
        resourceType: 'CarePlan',
        resourceId: String(plan._id),
        event: CARE_PLAN_AUDIT_EVENTS.progressAdded,
        before,
        after: {
          authorId: String(entry.authorId),
          at: entry.at,
          note: entry.note,
        },
      },
    ],
  };
}

export async function addGoal(id: string, patientId: string, input: GoalWrite): Promise<SavedPlan> {
  const plan = await getPlan(id, patientId);
  assertOpen(plan);
  if (!input.description || !input.targetDate) throw new HttpError(400, 'A goal needs a description and target date');
  const status = input.status && input.status !== 'cancelled' ? input.status : 'not_started';
  const goal = await CarePlanGoal.create({
    carePlanId: plan._id,
    patientId: plan.patientId,
    description: input.description.trim(),
    targetValue: input.targetValue?.trim() || null,
    targetDate: input.targetDate,
    status,
    achievedAt: status === 'achieved' ? new Date() : null,
  });
  return {
    plan: await presented(plan),
    audits: [
      {
        action: 'create',
        resourceType: 'CarePlanGoal',
        resourceId: String(goal._id),
        event: CARE_PLAN_AUDIT_EVENTS.goalAdded,
        after: plain(goal),
      },
    ],
  };
}

export async function updateGoal(
  id: string,
  patientId: string,
  goalId: string,
  input: GoalWrite
): Promise<SavedPlan> {
  const plan = await getPlan(id, patientId);
  assertOpen(plan);
  const goal = await getGoal(goalId, plan);
  const before = plain(goal);
  if (input.description !== undefined) goal.description = input.description.trim();
  if (input.targetValue === null) goal.targetValue = null;
  else if (input.targetValue !== undefined) goal.targetValue = input.targetValue.trim();
  if (input.targetDate) goal.targetDate = input.targetDate;
  let achieved = false;
  if (input.status && input.status !== goal.status) {
    if (!GOAL_TRANSITIONS[goal.status].includes(input.status)) {
      throw transitionError(goal.status, input.status, GOAL_STATUS_LABELS);
    }
    if (input.status === 'achieved') {
      goal.achievedAt = new Date();
      achieved = true;
    }
    goal.status = input.status;
  }
  await goal.save();
  return {
    plan: await presented(plan),
    audits: [
      {
        action: 'update',
        resourceType: 'CarePlanGoal',
        resourceId: String(goal._id),
        event: achieved ? CARE_PLAN_AUDIT_EVENTS.goalAchieved : CARE_PLAN_AUDIT_EVENTS.goalUpdated,
        before,
        after: plain(goal),
      },
    ],
  };
}

export async function addIntervention(
  id: string,
  patientId: string,
  input: InterventionWrite
): Promise<SavedPlan> {
  const plan = await getPlan(id, patientId);
  assertOpen(plan);
  if (!input.description || !input.assignedRole || !input.dueDate) {
    throw new HttpError(400, 'An intervention needs a description, role, and due date');
  }
  const status = input.status && input.status !== 'cancelled' ? input.status : 'planned';
  const intervention = await CarePlanIntervention.create({
    carePlanId: plan._id,
    patientId: plan.patientId,
    description: input.description.trim(),
    assignedRole: input.assignedRole,
    dueDate: input.dueDate,
    status,
    completedAt: status === 'completed' ? new Date() : null,
  });
  return {
    plan: await presented(plan),
    audits: [
      {
        action: 'create',
        resourceType: 'CarePlanIntervention',
        resourceId: String(intervention._id),
        event: CARE_PLAN_AUDIT_EVENTS.interventionAdded,
        after: plain(intervention),
      },
    ],
  };
}

export async function updateIntervention(
  id: string,
  patientId: string,
  interventionId: string,
  input: InterventionWrite
): Promise<SavedPlan> {
  const plan = await getPlan(id, patientId);
  assertOpen(plan);
  const intervention = await getIntervention(interventionId, plan);
  const before = plain(intervention);
  if (input.description !== undefined) intervention.description = input.description.trim();
  if (input.assignedRole) intervention.assignedRole = input.assignedRole;
  if (input.dueDate) intervention.dueDate = input.dueDate;
  if (input.status && input.status !== intervention.status) {
    if (!INTERVENTION_TRANSITIONS[intervention.status].includes(input.status)) {
      throw transitionError(intervention.status, input.status, INTERVENTION_STATUS_LABELS);
    }
    if (input.status === 'completed' && !intervention.completedAt) intervention.completedAt = new Date();
    intervention.status = input.status;
  }
  await intervention.save();
  return {
    plan: await presented(plan),
    audits: [
      {
        action: 'update',
        resourceType: 'CarePlanIntervention',
        resourceId: String(intervention._id),
        event: CARE_PLAN_AUDIT_EVENTS.interventionUpdated,
        before,
        after: plain(intervention),
      },
    ],
  };
}
