import type { PipelineStage } from 'mongoose';
import { Appointment } from '../../models/Appointment.js';
import { CarePlan } from '../../models/CarePlan.js';
import { Condition } from '../../models/Condition.js';
import { Encounter } from '../../models/Encounter.js';
import { Medication } from '../../models/Medication.js';
import { MonitoringMetric } from '../../models/MonitoringMetric.js';
import { MonitoringProgram } from '../../models/MonitoringProgram.js';
import { Order } from '../../models/Order.js';
import { Patient } from '../../models/Patient.js';
import { Recall } from '../../models/Recall.js';
import { Referral } from '../../models/Referral.js';
import { Visit } from '../../models/Visit.js';
import { ACTIVE_ORDER_STATUSES } from '../../types/orders.js';
import { ACTIVE_REFERRAL_STATUSES } from '../../types/referrals.js';
import { METRIC_TYPE_LABELS, type MetricType } from '../../types/monitoring.js';
import { clinicIsoDate } from '../../utils/clinicTime.js';
import { bucketExpr, bucketStarts, clinicTodayStart, withRange, type ReportRange } from './range.js';
import { abnormalExpression } from './readings.js';

const OPEN_ENCOUNTERS = ['open', 'in_progress', 'awaiting_signature'] as const;
const SEEN_APPOINTMENTS = ['arrived', 'completed'] as const;
const AWAITING_RESULT = ['ordered', 'scheduled', 'collected'] as const;
const OPEN_RECALL = ['due', 'scheduled'] as const;

type CountRow = { count?: number };
type StatusRow = { _id: string | null; count: number };
type BucketRow = { _id: Date | null; count: number };
type StatusBucketRow = { _id: { day: Date | null; status: string }; count: number };

/**
 * Clinic-wide operational totals. Appointment outcomes are counted from the
 * schedule. Open encounters, referrals, and orders are the current workload.
 * Pipelines return counts only.
 */
export async function operationalDashboard(range: ReportRange) {
  const [flow, wait, activeEncounters, activeReferrals, activeOrders] = await Promise.all([
    Appointment.aggregate<{ byStatus: StatusRow[]; trend: StatusBucketRow[] }>([
      { $match: { deletedAt: null, startTime: { $gte: range.from, $lt: range.to } } },
      {
        $facet: {
          byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
          trend: [
            {
              $group: {
                _id: { day: bucketExpr('$startTime', range), status: '$status' },
                count: { $sum: 1 },
              },
            },
          ],
        },
      },
    ] as PipelineStage[]),
    Visit.aggregate<{ avg: number | null; samples: number }>([
      {
        $match: {
          deletedAt: null,
          arrivalAt: { $gte: range.from, $lt: range.to },
          $or: [{ roomedAt: { $ne: null } }, { startedAt: { $ne: null } }],
        },
      },
      {
        $project: {
          minutes: {
            $divide: [
              { $subtract: [{ $ifNull: ['$roomedAt', '$startedAt'] }, '$arrivalAt'] },
              60000,
            ],
          },
        },
      },
      { $match: { minutes: { $gte: 0 } } },
      { $group: { _id: null, avg: { $avg: '$minutes' }, samples: { $sum: 1 } } },
    ] as PipelineStage[]),
    countWhere(Encounter, {
      deletedAt: null,
      isCurrent: true,
      status: { $in: [...OPEN_ENCOUNTERS] },
    }),
    countWhere(Referral, {
      deletedAt: null,
      status: { $in: [...ACTIVE_REFERRAL_STATUSES] },
    }),
    countWhere(Order, {
      deletedAt: null,
      status: { $in: [...ACTIVE_ORDER_STATUSES] },
    }),
  ]);

  const byStatus = new Map((flow[0]?.byStatus ?? []).map((row) => [row._id, row.count]));
  const appointments = [...byStatus.values()].reduce((sum, count) => sum + count, 0);
  const samples = wait[0]?.samples ?? 0;

  return withRange(range, {
    appointments,
    completedVisits: byStatus.get('completed') ?? 0,
    noShows: byStatus.get('no_show') ?? 0,
    cancellations: byStatus.get('cancelled') ?? 0,
    averageWaitMinutes: samples ? Math.round(wait[0]?.avg ?? 0) : null,
    waitSamples: samples,
    activeEncounters,
    activeReferrals,
    activeOrders,
    trend: appointmentTrend(range, flow[0]?.trend ?? []),
  });
}

/** Point-in-time clinical census, plus patients seen in the selected range. */
export async function clinicalDashboard(range: ReportRange) {
  const seenMatch = {
    deletedAt: null,
    startTime: { $gte: range.from, $lt: range.to },
    status: { $in: [...SEEN_APPOINTMENTS] },
  };
  const [activePatients, seenRows, seenTrend, activeProblems, activeMedications, activeCarePlans, monitoringEnrollments, overdueRecalls] =
    await Promise.all([
      countWhere(Patient, { deletedAt: null }),
      Appointment.aggregate<CountRow>([
        { $match: seenMatch },
        { $group: { _id: '$patientId' } },
        { $count: 'count' },
      ] as PipelineStage[]),
      Appointment.aggregate<BucketRow>([
        { $match: seenMatch },
        { $group: { _id: { day: bucketExpr('$startTime', range), patientId: '$patientId' } } },
        { $group: { _id: '$_id.day', count: { $sum: 1 } } },
      ] as PipelineStage[]),
      countWhere(Condition, { deletedAt: null, status: 'active' }),
      countWhere(Medication, { deletedAt: null, status: 'active' }),
      countWhere(CarePlan, { deletedAt: null, status: 'active' }),
      countWhere(MonitoringProgram, { deletedAt: null, status: 'active' }),
      countWhere(Recall, overdueMatch()),
    ]);

  return withRange(range, {
    activePatients,
    patientsSeen: seenRows[0]?.count ?? 0,
    activeProblems,
    activeMedications,
    activeCarePlans,
    monitoringEnrollments,
    overdueRecalls,
    seenTrend: fillCounts(range, seenTrend, 'patientsSeen'),
  });
}

export async function referralMetrics(range: ReportRange) {
  const [rows] = await Referral.aggregate<{
    created: CountRow[];
    completed: CountRow[];
    cancelled: CountRow[];
    followUp: CountRow[];
    createdTrend: BucketRow[];
    completedTrend: BucketRow[];
    cancelledTrend: BucketRow[];
  }>(referralPipeline(range));

  return withRange(range, {
    created: rows?.created[0]?.count ?? 0,
    completed: rows?.completed[0]?.count ?? 0,
    cancelled: rows?.cancelled[0]?.count ?? 0,
    awaitingFollowUp: rows?.followUp[0]?.count ?? 0,
    trend: mergeTrend(range, {
      created: rows?.createdTrend ?? [],
      completed: rows?.completedTrend ?? [],
      cancelled: rows?.cancelledTrend ?? [],
    }),
  });
}

export async function orderMetrics(range: ReportRange) {
  const [rows, active] = await Promise.all([
    Order.aggregate<{
      completed: CountRow[];
      cancelled: CountRow[];
      outstanding: CountRow[];
      completedTrend: BucketRow[];
      cancelledTrend: BucketRow[];
    }>(orderPipeline(range)).then((result) => result[0]),
    countWhere(Order, { deletedAt: null, status: { $in: [...ACTIVE_ORDER_STATUSES] } }),
  ]);

  return withRange(range, {
    active,
    completed: rows?.completed[0]?.count ?? 0,
    cancelled: rows?.cancelled[0]?.count ?? 0,
    outstandingResults: rows?.outstanding[0]?.count ?? 0,
    trend: mergeTrend(range, {
      completed: rows?.completedTrend ?? [],
      cancelled: rows?.cancelledTrend ?? [],
    }),
  });
}

export async function medicationMetrics(range: ReportRange) {
  const [active, discontinued, acknowledgements] = await Promise.all([
    countWhere(Medication, { deletedAt: null, status: 'active' }),
    Medication.aggregate<CountRow>([
      { $match: { deletedAt: null } },
      { $match: { $expr: discontinuedInRange(range) } },
      { $count: 'count' },
    ] as PipelineStage[]),
    Medication.aggregate<CountRow>([
      { $match: { deletedAt: null } },
      {
        $project: {
          acknowledgements: {
            $size: {
              $filter: {
                input: { $ifNull: ['$allergyAcknowledgments', []] },
                as: 'ack',
                cond: {
                  $and: [
                    { $gte: ['$$ack.at', range.from] },
                    { $lt: ['$$ack.at', range.to] },
                  ],
                },
              },
            },
          },
        },
      },
      { $group: { _id: null, count: { $sum: '$acknowledgements' } } },
    ] as PipelineStage[]),
  ]);

  return withRange(range, {
    active,
    discontinued: discontinued[0]?.count ?? 0,
    allergyAcknowledgements: acknowledgements[0]?.count ?? 0,
  });
}

export async function monitoringMetrics(range: ReportRange) {
  const [activePrograms, overdueRecalls, completedRecalls, readings] = await Promise.all([
    countWhere(MonitoringProgram, { deletedAt: null, status: 'active' }),
    countWhere(Recall, overdueMatch()),
    countWhere(Recall, {
      deletedAt: null,
      status: 'completed',
      completedAt: { $gte: range.from, $lt: range.to },
    }),
    MonitoringMetric.aggregate<{
      byType: Array<{ _id: MetricType | null; count: number }>;
      trend: BucketRow[];
      total: CountRow[];
    }>([
      { $match: { deletedAt: null, recordedAt: { $gte: range.from, $lt: range.to } } },
      { $addFields: { isAbnormal: abnormalExpression() } },
      {
        $facet: {
          byType: [
            { $match: { isAbnormal: true } },
            { $group: { _id: '$metricType', count: { $sum: 1 } } },
            { $sort: { count: -1, _id: 1 } },
          ],
          trend: [
            { $match: { isAbnormal: true } },
            { $group: { _id: bucketExpr('$recordedAt', range), count: { $sum: 1 } } },
          ],
          total: [{ $match: { isAbnormal: true } }, { $count: 'count' }],
        },
      },
    ] as PipelineStage[]),
  ]);

  const facet = readings[0];
  return withRange(range, {
    activePrograms,
    overdueRecalls,
    completedRecalls,
    abnormalReadings: facet?.total[0]?.count ?? 0,
    abnormalByType: (facet?.byType ?? []).map((row) => ({
      metricType: row._id,
      label: row._id ? METRIC_TYPE_LABELS[row._id] ?? row._id : 'Unknown',
      count: row.count,
    })),
    trend: fillCounts(range, facet?.trend ?? [], 'abnormalReadings'),
  });
}

function overdueMatch() {
  return {
    deletedAt: null,
    $or: [
      { status: 'overdue' },
      { status: { $in: [...OPEN_RECALL] }, dueDate: { $lt: clinicTodayStart() } },
    ],
  };
}

async function countWhere(
  model: { aggregate: (pipeline: PipelineStage[]) => Promise<CountRow[]> },
  match: Record<string, unknown>
) {
  const rows = await model.aggregate([{ $match: match }, { $count: 'count' }] as PipelineStage[]);
  return rows[0]?.count ?? 0;
}

function appointmentTrend(range: ReportRange, rows: StatusBucketRow[]) {
  const dates = bucketStarts(range);
  const table = new Map(
    dates.map((date) => [
      date,
      { appointments: 0, completedVisits: 0, noShows: 0, cancellations: 0 },
    ])
  );
  for (const row of rows) {
    if (!row._id?.day) continue;
    const point = table.get(clinicIsoDate(new Date(row._id.day)));
    if (!point) continue;
    point.appointments += row.count;
    if (row._id.status === 'completed') point.completedVisits += row.count;
    if (row._id.status === 'no_show') point.noShows += row.count;
    if (row._id.status === 'cancelled') point.cancellations += row.count;
  }
  return dates.map((date) => ({ date, ...table.get(date)! }));
}

function fillCounts(range: ReportRange, rows: BucketRow[], key: string) {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (!row._id) continue;
    const bucket = clinicIsoDate(new Date(row._id));
    totals.set(bucket, (totals.get(bucket) ?? 0) + row.count);
  }
  return bucketStarts(range).map((date) => ({ date, [key]: totals.get(date) ?? 0 }));
}

function mergeTrend(range: ReportRange, series: Record<string, BucketRow[]>) {
  const maps = Object.fromEntries(
    Object.entries(series).map(([key, rows]) => {
      const totals = new Map<string, number>();
      for (const row of rows) {
        if (!row._id) continue;
        const bucket = clinicIsoDate(new Date(row._id));
        totals.set(bucket, (totals.get(bucket) ?? 0) + row.count);
      }
      return [key, totals];
    })
  );
  return bucketStarts(range).map((date) => {
    const point: Record<string, string | number> = { date };
    for (const key of Object.keys(series)) point[key] = maps[key].get(date) ?? 0;
    return point;
  });
}

function referralPipeline(range: ReportRange): PipelineStage[] {
  const inRange = { $gte: range.from, $lt: range.to };
  return [
    { $match: { deletedAt: null } },
    {
      $facet: {
        created: [{ $match: { referralDate: inRange } }, { $count: 'count' }],
        completed: [{ $match: { completedAt: inRange } }, { $count: 'count' }],
        cancelled: [{ $match: { cancelledAt: inRange } }, { $count: 'count' }],
        followUp: [
          {
            $match: {
              followUpRequired: true,
              status: { $nin: ['cancelled', 'closed', 'draft'] },
            },
          },
          { $count: 'count' },
        ],
        createdTrend: [
          { $match: { referralDate: inRange } },
          { $group: { _id: bucketExpr('$referralDate', range), count: { $sum: 1 } } },
        ],
        completedTrend: [
          { $match: { completedAt: inRange } },
          { $group: { _id: bucketExpr('$completedAt', range), count: { $sum: 1 } } },
        ],
        cancelledTrend: [
          { $match: { cancelledAt: inRange } },
          { $group: { _id: bucketExpr('$cancelledAt', range), count: { $sum: 1 } } },
        ],
      },
    },
  ] as PipelineStage[];
}

function orderPipeline(range: ReportRange): PipelineStage[] {
  const inRange = { $gte: range.from, $lt: range.to };
  return [
    { $match: { deletedAt: null } },
    {
      $facet: {
        completed: [{ $match: { completedAt: inRange } }, { $count: 'count' }],
        cancelled: [{ $match: { cancelledAt: inRange } }, { $count: 'count' }],
        outstanding: [{ $match: { status: { $in: [...AWAITING_RESULT] } } }, { $count: 'count' }],
        completedTrend: [
          { $match: { completedAt: inRange } },
          { $group: { _id: bucketExpr('$completedAt', range), count: { $sum: 1 } } },
        ],
        cancelledTrend: [
          { $match: { cancelledAt: inRange } },
          { $group: { _id: bucketExpr('$cancelledAt', range), count: { $sum: 1 } } },
        ],
      },
    },
  ] as PipelineStage[];
}

function discontinuedInRange(range: ReportRange) {
  const eventInRange = {
    $gt: [
      {
        $size: {
          $filter: {
            input: { $ifNull: ['$events', []] },
            as: 'event',
            cond: {
              $and: [
                { $eq: ['$$event.action', 'discontinued'] },
                { $gte: ['$$event.at', range.from] },
                { $lt: ['$$event.at', range.to] },
              ],
            },
          },
        },
      },
      0,
    ],
  };
  const legacyEnd = {
    $and: [
      { $eq: ['$status', 'discontinued'] },
      { $gte: ['$endDate', range.from] },
      { $lt: ['$endDate', range.to] },
      {
        $eq: [
          {
            $size: {
              $filter: {
                input: { $ifNull: ['$events', []] },
                as: 'event',
                cond: { $eq: ['$$event.action', 'discontinued'] },
              },
            },
          },
          0,
        ],
      },
    ],
  };
  return { $or: [eventInRange, legacyEnd] };
}
