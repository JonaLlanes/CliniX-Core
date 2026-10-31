import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  clinicalApi,
  encountersApi,
  patientsApi,
  visitsApi,
  type Encounter,
  type Medication,
  type MonitoringDashboard,
  type Order,
  type OrderResult,
  type OrderSummary,
  type Patient,
  type Referral,
  type ReferralSummary,
  type Task,
  type VisitBoard,
  type VisitBoardRow,
} from '../../api/client';
import { reportsApi, type OperationalReport } from '../../api/reports';
import {
  criticalFindings,
  formatChartDate,
  isHighRiskMedication,
  medicationDetail,
  medicationLabel,
} from '../chart/chartDisplay';
import { chartLink } from './chartLink';
import { readRecentCharts } from './recentCharts';
import type { Trend } from './ui';

const REVIEW_LIMIT = 30;
const UNSIGNED = new Set(['open', 'in_progress', 'awaiting_signature']);
const CLOSED_TASK = new Set(['completed', 'cancelled', 'canceled']);
const AWAITING_RESULT = new Set(['ordered', 'scheduled', 'collected']);

export type WorkKind = 'encounter' | 'order' | 'referral' | 'task';
export type WorkFilter = 'all' | WorkKind;
export type AttentionKind = 'recall' | 'critical' | 'medication' | 'abnormal';
export type Priority = 'stat' | 'urgent' | 'high' | 'routine';

export type WorkItem = {
  id: string;
  kind: WorkKind;
  patientId: string;
  patientName: string;
  mrn: string;
  title: string;
  priority: Priority;
  status: string;
  action: string;
  href: string;
};

export type AttentionItem = {
  id: string;
  kind: AttentionKind;
  patientId: string;
  patientName: string;
  mrn: string;
  title: string;
  detail: string;
  href: string;
};

export type ClinicOperations = {
  readyBoard: boolean;
  readyWork: boolean;
  refreshing: boolean;
  boardError: string;
  workError: string;
  population: boolean;
  scopeNote: string;
  truncated: boolean;
  schedule: VisitBoardRow[];
  appointments: number | null;
  waiting: number | null;
  roomed: number | null;
  encounters: number | null;
  orders: number | null;
  referrals: number | null;
  recalls: number | null;
  trends: {
    appointments: Trend;
    waiting: Trend;
    roomed: Trend;
    encounters: Trend;
    orders: Trend;
    referrals: Trend;
    recalls: Trend;
  };
  work: WorkItem[];
  attention: AttentionItem[];
  refresh: () => void;
};

type ChartRef = { id: string; name: string; mrn: string };

type Derived = {
  encounters: number;
  orders: number;
  referrals: number;
  recalls: number;
  awaitingResults: number;
  followUps: number;
  work: WorkItem[];
  attention: AttentionItem[];
  truncated: boolean;
};

const emptyOrders: OrderSummary = { active: [], counts: { active: 0, completed: 0, cancelled: 0 } };
const emptyReferrals: ReferralSummary = {
  active: [],
  followUp: [],
  counts: { active: 0, completed: 0, closed: 0, cancelled: 0, followUp: 0 },
};
const emptyMonitor: MonitoringDashboard = {
  counts: { activePrograms: 0, overdueRecalls: 0, upcomingRecalls: 0 },
  activePrograms: [],
  overdueRecalls: [],
  upcomingRecalls: [],
  recentAbnormal: [],
};

const PRIORITY_RANK: Record<Priority, number> = { stat: 0, urgent: 1, high: 2, routine: 3 };
const ATTENTION_RANK: Record<AttentionKind, number> = { critical: 0, recall: 1, medication: 2, abnormal: 3 };

function clinicToday(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function scheduleRows(board: VisitBoard | null) {
  if (!board) return [];
  return [...board.checkIn, ...board.waitingRoom, ...board.closed].sort(
    (a, b) => new Date(a.appointment.startTime).getTime() - new Date(b.appointment.startTime).getTime()
  );
}

function chartName(patient: Pick<Patient, 'familyName' | 'givenName'>) {
  return `${patient.familyName}, ${patient.givenName}`;
}

async function settle<T>(promise: Promise<T>, fallback: T) {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

async function mapPool<T, R>(items: T[], size: number, task: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await task(items[index]);
    }
  }
  const workers = Math.min(size, items.length);
  if (workers === 0) return results;
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

function overdue(due?: string) {
  if (!due) return false;
  return due.slice(0, 10) < clinicToday();
}

function taskPriority(task: Task): Priority {
  if (overdue(task.dueDate)) return 'high';
  if (task.status === 'in_progress') return 'urgent';
  return 'routine';
}

function encounterPriority(status: string): Priority {
  if (status === 'awaiting_signature') return 'high';
  if (status === 'in_progress') return 'urgent';
  return 'routine';
}

function orderPriority(priority: string): Priority {
  if (priority === 'stat' || priority === 'urgent' || priority === 'routine') return priority;
  return 'routine';
}

function referralPriority(referral: Referral): Priority {
  if (referral.followUpRequired && referral.priority !== 'urgent') return 'high';
  if (referral.priority === 'urgent') return 'urgent';
  return 'routine';
}

function pushWork(bucket: WorkItem[], item: Omit<WorkItem, 'id'> & { id: string }) {
  bucket.push(item);
}

async function reviewChart(chart: ChartRef): Promise<Derived> {
  const [encounters, orders, referrals, tasks, monitor, medications, results] = await Promise.all([
    settle(encountersApi.list(chart.id, 100), { data: [] as Encounter[], page: 1, limit: 0, total: 0 }),
    settle(clinicalApi.orders(chart.id).summary(), emptyOrders),
    settle(clinicalApi.referrals(chart.id).summary(), emptyReferrals),
    settle(clinicalApi.tasks(chart.id).list('?limit=100'), { data: [] as Task[], page: 1, limit: 0, total: 0 }),
    settle(clinicalApi.monitoring(chart.id).dashboard(), emptyMonitor),
    settle(clinicalApi.medications(chart.id).list('?status=active&limit=50'), {
      data: [] as Medication[],
      page: 1,
      limit: 0,
      total: 0,
    }),
    settle(clinicalApi.orders(chart.id).results('?limit=40'), {
      data: [] as OrderResult[],
      page: 1,
      limit: 0,
      total: 0,
    }),
  ]);

  const work: WorkItem[] = [];
  const attention: AttentionItem[] = [];
  const unsigned = encounters.data.filter((encounter) => UNSIGNED.has(encounter.status));

  for (const encounter of unsigned) {
    pushWork(work, {
      id: `${chart.id}:encounter:${encounter._id}`,
      kind: 'encounter',
      patientId: chart.id,
      patientName: chart.name,
      mrn: chart.mrn,
      title: encounter.chiefComplaint || 'Unsigned encounter',
      priority: encounterPriority(encounter.status),
      status: encounter.status,
      action: encounter.status === 'awaiting_signature' ? 'Sign' : 'Open',
      href: chartLink(chart.id, 'encounters'),
    });
  }

  for (const order of orders.active) {
    pushWork(work, {
      id: `${chart.id}:order:${order._id}`,
      kind: 'order',
      patientId: chart.id,
      patientName: chart.name,
      mrn: chart.mrn,
      title: order.orderName,
      priority: orderPriority(order.priority),
      status: order.status,
      action: 'Review',
      href: chartLink(chart.id, 'orders'),
    });
  }

  const seenReferrals = new Set<string>();
  const referralRows = [...referrals.active, ...referrals.followUp];
  for (const referral of referralRows) {
    if (seenReferrals.has(referral._id)) continue;
    seenReferrals.add(referral._id);
    const title = [referral.specialty, referral.specialistName].filter(Boolean).join(' · ') || 'Referral';
    pushWork(work, {
      id: `${chart.id}:referral:${referral._id}`,
      kind: 'referral',
      patientId: chart.id,
      patientName: chart.name,
      mrn: chart.mrn,
      title,
      priority: referralPriority(referral),
      status: referral.status,
      action: referral.followUpRequired ? 'Follow up' : 'Open',
      href: chartLink(chart.id, 'referrals'),
    });
  }

  for (const task of tasks.data) {
    if (CLOSED_TASK.has(task.status)) continue;
    pushWork(work, {
      id: `${chart.id}:task:${task._id}`,
      kind: 'task',
      patientId: chart.id,
      patientName: chart.name,
      mrn: chart.mrn,
      title: task.title,
      priority: taskPriority(task),
      status: task.status,
      action: 'Open',
      href: chartLink(chart.id, 'care'),
    });
  }

  for (const recall of monitor.overdueRecalls) {
    attention.push({
      id: `${chart.id}:recall:${recall._id}`,
      kind: 'recall',
      patientId: chart.id,
      patientName: chart.name,
      mrn: chart.mrn,
      title: recall.reason,
      detail: `Due ${formatChartDate(recall.dueDate)}`,
      href: chartLink(chart.id, 'monitoring'),
    });
  }

  const resultIds = new Set(results.data.map((result) => result._id));
  for (const finding of criticalFindings(results.data, monitor.recentAbnormal)) {
    attention.push({
      id: `${chart.id}:${finding.level}:${finding.id}`,
      kind: finding.level === 'critical' ? 'critical' : 'abnormal',
      patientId: chart.id,
      patientName: chart.name,
      mrn: chart.mrn,
      title: finding.title,
      detail: finding.detail,
      href: chartLink(chart.id, resultIds.has(finding.id) ? 'orders' : 'monitoring'),
    });
  }

  for (const medication of medications.data) {
    if (medication.status !== 'active' && medication.status !== 'on-hold') continue;
    if (!isHighRiskMedication(medication)) continue;
    attention.push({
      id: `${chart.id}:medication:${medication._id}`,
      kind: 'medication',
      patientId: chart.id,
      patientName: chart.name,
      mrn: chart.mrn,
      title: medicationLabel(medication),
      detail: medicationDetail(medication) || 'Active high-alert medication',
      href: chartLink(chart.id, 'medications'),
    });
  }

  return {
    encounters: unsigned.length,
    orders: orders.counts.active,
    referrals: referrals.counts.active,
    recalls: monitor.counts.overdueRecalls,
    awaitingResults: orders.active.filter((order: Order) => AWAITING_RESULT.has(order.status)).length,
    followUps: referrals.counts.followUp,
    work,
    attention,
    truncated:
      orders.counts.active > orders.active.length ||
      referrals.counts.active > referrals.active.length ||
      referrals.counts.followUp > referrals.followUp.length,
  };
}

function rankCharts(charts: ChartRef[], todayIds: Set<string>) {
  const recent = new Set(readRecentCharts().map((item) => item.id));
  return [...charts].sort((a, b) => {
    const score = (chart: ChartRef) => (todayIds.has(chart.id) ? 0 : recent.has(chart.id) ? 1 : 2);
    const diff = score(a) - score(b);
    if (diff) return diff;
    return a.name.localeCompare(b.name);
  });
}

function mergeDerived(rows: Derived[]): Derived {
  return rows.reduce<Derived>(
    (sum, row) => ({
      encounters: sum.encounters + row.encounters,
      orders: sum.orders + row.orders,
      referrals: sum.referrals + row.referrals,
      recalls: sum.recalls + row.recalls,
      awaitingResults: sum.awaitingResults + row.awaitingResults,
      followUps: sum.followUps + row.followUps,
      work: sum.work.concat(row.work),
      attention: sum.attention.concat(row.attention),
      truncated: sum.truncated || row.truncated,
    }),
    {
      encounters: 0,
      orders: 0,
      referrals: 0,
      recalls: 0,
      awaitingResults: 0,
      followUps: 0,
      work: [],
      attention: [],
      truncated: false,
    }
  );
}

function flatTrend(label: string, tone: Trend['tone'] = 'neutral'): Trend {
  return { direction: 'flat', label, tone };
}

function countTrend(count: number | null, empty: string, busy: string, tone: Trend['tone'] = 'neutral'): Trend {
  if (count == null) return flatTrend('…');
  if (count === 0) return { direction: 'down', label: empty, tone: 'good' };
  return flatTrend(busy, tone);
}

function appointmentTrend(todayCount: number | null, week: OperationalReport | null, today: string): Trend {
  if (todayCount == null) return flatTrend('today');
  const trend = week?.trend ?? [];
  const index = trend.findIndex((point) => point.date === today);
  const previous = index > 0 ? trend[index - 1] : null;
  if (!previous) return flatTrend('today');
  const delta = todayCount - previous.appointments;
  if (delta === 0) return flatTrend('same as yesterday');
  if (delta > 0) return { direction: 'up', label: `+${delta} vs yesterday`, tone: 'neutral' };
  return { direction: 'down', label: `${delta} vs yesterday`, tone: 'neutral' };
}

function scopeNote(population: boolean, reviewed: number, total: number, truncated: boolean) {
  const coverage =
    total === 0
      ? 'No charts are available for this sign-in.'
      : reviewed < total
        ? `Rows below cover ${reviewed} of ${total} charts, starting with patients on today’s schedule.`
        : 'Rows below cover every chart you can open.';
  const sample = truncated ? ' A chart with a long queue shows its highest-priority items.' : '';
  if (population) {
    return `Appointment, encounter, order, referral, and recall totals are clinic-wide. ${coverage}${sample}`;
  }
  return `Totals follow the charts on your care team. Population reports stay with clinicians, nurses, and administrators. ${coverage}${sample}`;
}

const initialTrends = {
  appointments: flatTrend('today'),
  waiting: flatTrend('queue'),
  roomed: flatTrend('rooms'),
  encounters: flatTrend('open now'),
  orders: flatTrend('in process'),
  referrals: flatTrend('in process'),
  recalls: flatTrend('recalls'),
};

export function useClinicOperations(canViewPopulation: boolean): ClinicOperations {
  const [tick, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(true);
  const [readyBoard, setReadyBoard] = useState(false);
  const [readyWork, setReadyWork] = useState(false);
  const [boardError, setBoardError] = useState('');
  const [workError, setWorkError] = useState('');
  const [schedule, setSchedule] = useState<VisitBoardRow[]>([]);
  const [waiting, setWaiting] = useState<number | null>(null);
  const [roomed, setRoomed] = useState<number | null>(null);
  const [inProgress, setInProgress] = useState<number | null>(null);
  const [appointments, setAppointments] = useState<number | null>(null);
  const [encounters, setEncounters] = useState<number | null>(null);
  const [orders, setOrders] = useState<number | null>(null);
  const [referrals, setReferrals] = useState<number | null>(null);
  const [recalls, setRecalls] = useState<number | null>(null);
  const [trends, setTrends] = useState(initialTrends);
  const [work, setWork] = useState<WorkItem[]>([]);
  const [attention, setAttention] = useState<AttentionItem[]>([]);
  const [scope, setScope] = useState('');
  const [truncated, setTruncated] = useState(false);

  const refresh = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    const today = clinicToday();
    setRefreshing(true);
    setBoardError('');
    setWorkError('');

    async function loadBoard() {
      try {
        const board = await visitsApi.board({ date: today });
        if (cancelled) return null;
        const rows = scheduleRows(board);
        setSchedule(rows);
        setAppointments(rows.length);
        setWaiting(board.providerQueue.waiting.length);
        setRoomed(board.providerQueue.roomed.length);
        setInProgress(board.providerQueue.inProgress.length);
        setReadyBoard(true);
        return board;
      } catch (err) {
        if (cancelled) return null;
        setBoardError(err instanceof Error ? err.message : 'Unable to load today’s schedule');
        setSchedule([]);
        setAppointments(0);
        setWaiting(0);
        setRoomed(0);
        setInProgress(0);
        setReadyBoard(true);
        return null;
      }
    }

    async function loadReports() {
      if (!canViewPopulation) return null;
      try {
        const [operational, week, clinical, orderReport, referralReport] = await Promise.all([
          reportsApi.operational('preset=today'),
          reportsApi.operational('preset=last_7_days'),
          reportsApi.clinical('preset=today'),
          reportsApi.orders('preset=today'),
          reportsApi.referrals('preset=today'),
        ]);
        if (cancelled) return null;
        return { operational, week, clinical, orderReport, referralReport };
      } catch {
        return null;
      }
    }

    async function loadWork(board: VisitBoard | null) {
      try {
        const page = await patientsApi.list({ limit: 100 });
        if (cancelled) return;
        const todayIds = new Set(
          scheduleRows(board)
            .map((row) => row.appointment.patientId?._id)
            .filter((id): id is string => Boolean(id))
        );
        const charts = rankCharts(
          page.data.map((patient) => ({ id: patient._id, name: chartName(patient), mrn: patient.mrn })),
          todayIds
        ).slice(0, REVIEW_LIMIT);
        const reviewed = await mapPool(charts, 4, reviewChart);
        if (cancelled) return;
        const derived = mergeDerived(reviewed);
        derived.work.sort(
          (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.patientName.localeCompare(b.patientName)
        );
        derived.attention.sort(
          (a, b) => ATTENTION_RANK[a.kind] - ATTENTION_RANK[b.kind] || a.patientName.localeCompare(b.patientName)
        );
        setWork(derived.work);
        setAttention(derived.attention);
        setTruncated(derived.truncated);
        setScope(scopeNote(canViewPopulation, charts.length, page.total, derived.truncated));
        setReadyWork(true);
        return derived;
      } catch (err) {
        if (cancelled) return;
        setWorkError(err instanceof Error ? err.message : 'Unable to load the care team worklist');
        setWork([]);
        setAttention([]);
        setReadyWork(true);
        setScope(scopeNote(canViewPopulation, 0, 0, false));
        return null;
      }
    }

    void (async () => {
      const [board, reports] = await Promise.all([loadBoard(), loadReports()]);
      if (cancelled) return;
      if (reports) {
        setEncounters(reports.operational.activeEncounters);
        setOrders(reports.operational.activeOrders);
        setReferrals(reports.operational.activeReferrals);
        setRecalls(reports.clinical.overdueRecalls);
      }
      const derived = await loadWork(board);
      if (cancelled) return;

      const appointmentCount = board ? scheduleRows(board).length : 0;
      const waitingCount = board?.providerQueue.waiting.length ?? 0;
      const roomedCount = board?.providerQueue.roomed.length ?? 0;
      const progressCount = board?.providerQueue.inProgress.length ?? 0;
      const encounterCount = reports?.operational.activeEncounters ?? derived?.encounters ?? 0;
      const orderCount = reports?.operational.activeOrders ?? derived?.orders ?? 0;
      const referralCount = reports?.operational.activeReferrals ?? derived?.referrals ?? 0;
      const recallCount = reports?.clinical.overdueRecalls ?? derived?.recalls ?? 0;
      const outstanding = reports?.orderReport.outstandingResults ?? derived?.awaitingResults ?? 0;
      const followUps = reports?.referralReport.awaitingFollowUp ?? derived?.followUps ?? 0;
      const averageWait = reports?.operational.averageWaitMinutes ?? null;

      if (!reports) {
        setEncounters(derived?.encounters ?? 0);
        setOrders(derived?.orders ?? 0);
        setReferrals(derived?.referrals ?? 0);
        setRecalls(derived?.recalls ?? 0);
      }

      setTrends({
        appointments: appointmentTrend(appointmentCount, reports?.week ?? null, today),
        waiting:
          waitingCount === 0
            ? { direction: 'down', label: 'clear', tone: 'good' }
            : averageWait != null
              ? {
                  direction: averageWait >= 20 ? 'up' : 'flat',
                  label: `${averageWait}m wait`,
                  tone: averageWait >= 20 ? 'warn' : 'neutral',
                }
              : { direction: 'up', label: 'in queue', tone: 'warn' },
        roomed:
          roomedCount === 0
            ? flatTrend('none roomed')
            : progressCount > 0
              ? flatTrend(`${progressCount} in visit`)
              : flatTrend('in exam'),
        encounters: countTrend(encounterCount, 'none open', 'open now'),
        orders:
          outstanding > 0
            ? { direction: 'up', label: `${outstanding} results out`, tone: 'warn' }
            : countTrend(orderCount, 'none open', 'in process'),
        referrals:
          followUps > 0
            ? { direction: 'up', label: `${followUps} follow-up`, tone: 'warn' }
            : countTrend(referralCount, 'none open', 'in process'),
        recalls: countTrend(recallCount, 'none due', 'past due', 'warn'),
      });
      setRefreshing(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [tick, canViewPopulation]);

  return useMemo(
    () => ({
      readyBoard,
      readyWork,
      refreshing,
      boardError,
      workError,
      population: canViewPopulation,
      scopeNote: scope,
      truncated,
      schedule,
      appointments,
      waiting,
      roomed,
      encounters,
      orders,
      referrals,
      recalls,
      trends,
      work,
      attention,
      refresh,
    }),
    [
      readyBoard,
      readyWork,
      refreshing,
      boardError,
      workError,
      canViewPopulation,
      scope,
      truncated,
      schedule,
      appointments,
      waiting,
      roomed,
      encounters,
      orders,
      referrals,
      recalls,
      trends,
      work,
      attention,
      refresh,
    ]
  );
}

