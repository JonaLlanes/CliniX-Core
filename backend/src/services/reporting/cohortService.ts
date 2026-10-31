import type { PipelineStage, Types } from 'mongoose';
import { CarePlan } from '../../models/CarePlan.js';
import { Condition } from '../../models/Condition.js';
import { EncounterDiagnosis } from '../../models/EncounterDiagnosis.js';
import { MonitoringMetric } from '../../models/MonitoringMetric.js';
import { MonitoringProgram } from '../../models/MonitoringProgram.js';
import { Patient } from '../../models/Patient.js';
import { Recall } from '../../models/Recall.js';
import { Vital } from '../../models/Vital.js';
import { clinicTodayStart, withRange, type ReportRange } from './range.js';
import { abnormalExpression } from './readings.js';

export const COHORTS = [
  {
    key: 'hypertension',
    label: 'Hypertension',
    programType: 'hypertension',
    codePattern: '^I1[0-35](?:\\.|$)',
    textPattern: 'hypertens',
    metricTypes: ['blood_pressure'],
    vital: 'blood_pressure',
  },
  {
    key: 'diabetes',
    label: 'Diabetes',
    programType: 'diabetes',
    codePattern: '^E1[013](?:\\.|$)',
    textPattern: 'diabetes',
    excludeText: 'prediabetes',
    metricTypes: ['a1c'],
    vital: null,
  },
  {
    key: 'copd',
    label: 'COPD',
    programType: 'copd',
    codePattern: '^J4[34](?:\\.|$)',
    textPattern: 'copd|chronic obstructive',
    metricTypes: [],
    vital: 'spo2',
  },
  {
    key: 'heart_failure',
    label: 'Heart Failure',
    programType: 'heart_failure',
    codePattern: '^I50(?:\\.|$)',
    textPattern: 'heart failure|cardiac failure',
    metricTypes: [],
    vital: 'spo2',
  },
  {
    key: 'ckd',
    label: 'CKD',
    programType: 'ckd',
    codePattern: '^N18(?:\\.|$)',
    textPattern: 'chronic kidney|\\bckd\\b',
    metricTypes: ['egfr'],
    vital: null,
  },
] as const;

export type CohortKey = (typeof COHORTS)[number]['key'];
type CohortDefinition = (typeof COHORTS)[number];

interface Membership {
  definition: CohortDefinition;
  patientIds: Types.ObjectId[];
  conditionIds: Types.ObjectId[];
  carePlanIds: Types.ObjectId[];
}

interface PatientName {
  _id: Types.ObjectId;
  mrn?: string;
  givenName?: string;
  familyName?: string;
  preferredName?: string;
}

/**
 * Chronic disease cohorts from active problems and monitoring enrollments.
 * Counts are aggregated. Patient documents are not loaded for the dashboard.
 */
export async function cohortDashboard(range: ReportRange) {
  const membership = await loadMembership();
  const cohorts = await Promise.all(membership.map((item) => summarize(item, range)));
  return withRange(range, { cohorts });
}

export async function cohortCsvRows(range: ReportRange) {
  const membership = await loadMembership();
  const groups = await Promise.all(membership.map((item) => roster(item, range)));
  return groups.flat();
}

async function loadMembership(): Promise<Membership[]> {
  const [conditionRows, programRows] = await Promise.all([
    Condition.aggregate<{
      _id: CohortKey;
      patientIds: Types.ObjectId[];
      conditionIds: Types.ObjectId[][];
    }>(conditionMembershipPipeline()),
    MonitoringProgram.aggregate<{
      _id: CohortKey;
      patientIds: Types.ObjectId[];
      carePlanIds: Array<Types.ObjectId | null>;
    }>([
      {
        $match: {
          deletedAt: null,
          status: { $in: ['active', 'on_hold'] },
          programType: { $in: COHORTS.map((item) => item.programType) },
        },
      },
      {
        $group: {
          _id: '$programType',
          patientIds: { $addToSet: '$patientId' },
          carePlanIds: { $addToSet: '$carePlanId' },
        },
      },
    ] as PipelineStage[]),
  ]);

  const conditions = new Map(conditionRows.map((row) => [row._id, row]));
  const programs = new Map(programRows.map((row) => [row._id, row]));

  return COHORTS.map((definition) => {
    const fromProblems = conditions.get(definition.key);
    const fromPrograms = programs.get(definition.key);
    return {
      definition,
      patientIds: uniqueIds([
        ...(fromProblems?.patientIds ?? []),
        ...(fromPrograms?.patientIds ?? []),
      ]),
      conditionIds: uniqueIds((fromProblems?.conditionIds ?? []).flat()),
      carePlanIds: uniqueIds((fromPrograms?.carePlanIds ?? []).filter((id): id is Types.ObjectId => Boolean(id))),
    };
  });
}

async function summarize(item: Membership, range: ReportRange) {
  const [activeCarePlans, overdueRecalls, recentAbnormalReadings] = await Promise.all([
    countCarePlans(item),
    countOverdue(item.patientIds),
    countAbnormal(item, range),
  ]);
  return {
    key: item.definition.key,
    label: item.definition.label,
    patients: item.patientIds.length,
    activeCarePlans,
    overdueRecalls,
    recentAbnormalReadings,
  };
}

async function roster(item: Membership, range: ReportRange) {
  if (item.patientIds.length === 0) return [];
  const [patients, carePlans, recalls, readings] = await Promise.all([
    Patient.aggregate<PatientName>([
      { $match: { _id: { $in: item.patientIds } } },
      { $project: { mrn: 1, givenName: 1, familyName: 1, preferredName: 1 } },
      { $sort: { familyName: 1, givenName: 1 } },
    ] as PipelineStage[]),
    CarePlan.aggregate<{ _id: Types.ObjectId; count: number }>([
      ...linkedCarePlanStages(item),
      { $group: { _id: '$patientId', count: { $sum: 1 } } },
    ] as PipelineStage[]),
    Recall.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { ...overdueFilter(), patientId: { $in: item.patientIds } } },
      { $group: { _id: '$patientId', count: { $sum: 1 } } },
    ] as PipelineStage[]),
    abnormalByPatient(item, range),
  ]);
  const plans = new Map(carePlans.map((row) => [String(row._id), row.count]));
  const overdue = new Map(recalls.map((row) => [String(row._id), row.count]));
  return patients.map((patient) => ({
    cohort: item.definition.label,
    mrn: patient.mrn ?? '',
    name: patientName(patient),
    activeCarePlans: plans.get(String(patient._id)) ?? 0,
    overdueRecalls: overdue.get(String(patient._id)) ?? 0,
    abnormalReadings: readings.get(String(patient._id)) ?? 0,
  }));
}

function conditionMembershipPipeline(): PipelineStage[] {
  return [
    { $match: { deletedAt: null, status: 'active' } },
    {
      $project: {
        patientId: 1,
        cohort: {
          $setUnion: COHORTS.map((definition) => ({
            $cond: [cohortCond(definition, '$code', '$display'), [definition.key], []],
          })),
        },
      },
    },
    { $unwind: '$cohort' },
    {
      $group: {
        _id: { cohort: '$cohort', patientId: '$patientId' },
        conditionIds: { $addToSet: '$_id' },
      },
    },
    {
      $group: {
        _id: '$_id.cohort',
        patientIds: { $addToSet: '$_id.patientId' },
        conditionIds: { $push: '$conditionIds' },
      },
    },
  ] as PipelineStage[];
}

function cohortCond(definition: CohortDefinition, codeField: string, textField: string) {
  const codeMatch = {
    $regexMatch: { input: { $ifNull: [codeField, ''] }, regex: definition.codePattern, options: 'i' },
  };
  const textMatch = {
    $regexMatch: { input: { $ifNull: [textField, ''] }, regex: definition.textPattern, options: 'i' },
  };
  const textOk =
    'excludeText' in definition
      ? {
          $and: [
            textMatch,
            {
              $not: [
                {
                  $regexMatch: {
                    input: { $ifNull: [textField, ''] },
                    regex: definition.excludeText,
                    options: 'i',
                  },
                },
              ],
            },
          ],
        }
      : textMatch;
  return { $or: [codeMatch, textOk] };
}

function diagnosisQuery(definition: CohortDefinition) {
  const code = { code: { $regex: definition.codePattern, $options: 'i' } };
  const text = { description: { $regex: definition.textPattern, $options: 'i' } };
  if (!('excludeText' in definition)) return { $or: [code, text] };
  return {
    $or: [
      code,
      {
        $and: [
          text,
          { description: { $not: { $regex: definition.excludeText, $options: 'i' } } },
        ],
      },
    ],
  };
}

function linkedCarePlanStages(item: Membership): PipelineStage[] {
  return [
    {
      $match: {
        deletedAt: null,
        status: 'active',
        patientId: { $in: item.patientIds },
      },
    },
    {
      $lookup: {
        from: EncounterDiagnosis.collection.name,
        let: { ids: { $ifNull: ['$encounterDiagnosisIds', []] } },
        pipeline: [
          {
            $match: {
              $expr: { $in: ['$_id', '$$ids'] },
              deletedAt: null,
              ...diagnosisQuery(item.definition),
            },
          },
          { $limit: 1 },
          { $project: { _id: 1 } },
        ],
        as: 'matchedDiagnoses',
      },
    },
    {
      $match: {
        $expr: {
          $or: [
            { $gt: [{ $size: '$matchedDiagnoses' }, 0] },
            {
              $gt: [
                {
                  $size: {
                    $setIntersection: [{ $ifNull: ['$problemIds', []] }, item.conditionIds],
                  },
                },
                0,
              ],
            },
            {
              $and: [
                { $eq: ['$primaryDiagnosisKind', 'problem'] },
                { $in: ['$primaryDiagnosisId', item.conditionIds] },
              ],
            },
            { $in: ['$_id', item.carePlanIds] },
          ],
        },
      },
    },
  ] as PipelineStage[];
}

async function countCarePlans(item: Membership) {
  if (item.patientIds.length === 0) return 0;
  const rows = await CarePlan.aggregate<{ count: number }>([
    ...linkedCarePlanStages(item),
    { $count: 'count' },
  ] as PipelineStage[]);
  return rows[0]?.count ?? 0;
}

function overdueFilter() {
  return {
    deletedAt: null,
    $or: [
      { status: 'overdue' },
      { status: { $in: ['due', 'scheduled'] }, dueDate: { $lt: clinicTodayStart() } },
    ],
  };
}

async function countOverdue(patientIds: Types.ObjectId[]) {
  if (patientIds.length === 0) return 0;
  const rows = await Recall.aggregate<{ count: number }>([
    { $match: { ...overdueFilter(), patientId: { $in: patientIds } } },
    { $count: 'count' },
  ] as PipelineStage[]);
  return rows[0]?.count ?? 0;
}

async function countAbnormal(item: Membership, range: ReportRange) {
  if (item.patientIds.length === 0) return 0;
  const [metrics, vitals] = await Promise.all([
    MonitoringMetric.aggregate<{ count: number }>([
      ...abnormalMetricStages(item, range),
      { $count: 'count' },
    ] as PipelineStage[]),
    vitalCount(item, range),
  ]);
  return (metrics[0]?.count ?? 0) + vitals;
}

async function abnormalByPatient(item: Membership, range: ReportRange) {
  const totals = new Map<string, number>();
  const add = (rows: Array<{ _id: Types.ObjectId; count: number }>) => {
    for (const row of rows) {
      const key = String(row._id);
      totals.set(key, (totals.get(key) ?? 0) + row.count);
    }
  };
  const [metrics, vitals] = await Promise.all([
    MonitoringMetric.aggregate<{ _id: Types.ObjectId; count: number }>([
      ...abnormalMetricStages(item, range),
      { $group: { _id: '$patientId', count: { $sum: 1 } } },
    ] as PipelineStage[]),
    vitalByPatient(item, range),
  ]);
  add(metrics);
  add(vitals);
  return totals;
}

function abnormalMetricStages(item: Membership, range: ReportRange): PipelineStage[] {
  const metricTypes = [...item.definition.metricTypes];
  return [
    {
      $match: {
        deletedAt: null,
        recordedAt: { $gte: range.from, $lt: range.to },
        patientId: { $in: item.patientIds },
      },
    },
    {
      $lookup: {
        from: MonitoringProgram.collection.name,
        localField: 'programId',
        foreignField: '_id',
        pipeline: [{ $project: { programType: 1 } }],
        as: 'program',
      },
    },
    {
      $addFields: {
        programType: { $arrayElemAt: ['$program.programType', 0] },
        isAbnormal: abnormalExpression(),
      },
    },
    {
      $match: {
        isAbnormal: true,
        $or: [
          { programType: item.definition.programType },
          ...(metricTypes.length ? [{ metricType: { $in: metricTypes } }] : []),
        ],
      },
    },
  ] as PipelineStage[];
}

async function vitalCount(item: Membership, range: ReportRange) {
  const match = vitalMatch(item, range);
  if (!match) return 0;
  const rows = await Vital.aggregate<{ count: number }>([
    { $match: match },
    { $count: 'count' },
  ] as PipelineStage[]);
  return rows[0]?.count ?? 0;
}

async function vitalByPatient(item: Membership, range: ReportRange) {
  const match = vitalMatch(item, range);
  if (!match) return [];
  return Vital.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: match },
    { $group: { _id: '$patientId', count: { $sum: 1 } } },
  ] as PipelineStage[]);
}

function vitalMatch(item: Membership, range: ReportRange) {
  const rule =
    item.definition.vital === 'blood_pressure'
      ? {
          $or: [
            { 'measurements.systolicBp': { $gte: 140 } },
            { 'measurements.diastolicBp': { $gte: 90 } },
            { 'measurements.systolicBp': { $lt: 90 } },
            { 'measurements.diastolicBp': { $lt: 60 } },
          ],
        }
      : item.definition.vital === 'spo2'
        ? { 'measurements.spo2': { $gt: 0, $lt: 92 } }
        : null;
  if (!rule || item.patientIds.length === 0) return null;
  return {
    deletedAt: null,
    patientId: { $in: item.patientIds },
    effectiveAt: { $gte: range.from, $lt: range.to },
    ...rule,
  };
}

function uniqueIds(ids: Types.ObjectId[]) {
  const seen = new Set<string>();
  const unique: Types.ObjectId[] = [];
  for (const id of ids) {
    const key = String(id);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(id);
  }
  return unique;
}

function patientName(patient: PatientName) {
  const preferred =
    patient.preferredName && patient.preferredName !== patient.givenName
      ? ` (${patient.preferredName})`
      : '';
  return `${patient.familyName || ''}, ${patient.givenName || ''}${preferred}`.replace(/^, /, '');
}
