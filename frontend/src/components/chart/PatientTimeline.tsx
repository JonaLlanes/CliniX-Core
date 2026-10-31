import { useEffect, useMemo, useState } from 'react';
import {
  appointmentsApi,
  clinicalApi,
  encountersApi,
  visitsApi,
  type MonitoringMetric,
  type Order,
  type Referral,
} from '../../api/client';
import {
  CalendarIcon,
  CarePlanIcon,
  EncounterIcon,
  NoteIcon,
  OrderIcon,
  PulseIcon,
  ReferralIcon,
  VisitFlowIcon,
} from '../icons';
import { StatusBadge } from '../StatusBadge';
import { ErrorNotice } from '../feedback';
import {
  buildTimeline,
  countForFilter,
  filterEvents,
  formatTimelineWhen,
  groupEvents,
  TIMELINE_FILTERS,
  type TimelineBucket,
  type TimelineEvent,
  type TimelineFilter,
  type TimelineSources,
  type TimelineSummary,
  type VisitStage,
} from './timelineModel';

const ACTIVE_ORDER = new Set(['draft', 'ordered', 'scheduled', 'collected', 'resulted']);
const ACTIVE_REFERRAL = new Set(['draft', 'sent', 'accepted', 'scheduled']);

const ICONS = {
  encounter: EncounterIcon,
  order: OrderIcon,
  referral: ReferralIcon,
  appointment: CalendarIcon,
  visit: VisitFlowIcon,
  note: NoteIcon,
  monitoring: PulseIcon,
  care: CarePlanIcon,
} as const;

const ICON_TONE: Record<TimelineEvent['kind'], string> = {
  encounter: 'bg-teal-50 text-teal-800 ring-teal-200',
  referral: 'bg-violet-50 text-violet-800 ring-violet-200',
  order: 'bg-sky-50 text-sky-800 ring-sky-200',
  appointment: 'bg-blue-50 text-blue-800 ring-blue-200',
  visit: 'bg-amber-50 text-amber-900 ring-amber-200',
  note: 'bg-slate-100 text-slate-700 ring-slate-200',
  monitoring: 'bg-rose-50 text-rose-800 ring-rose-200',
  care: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
};

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      events: TimelineEvent[];
      summary: TimelineSummary;
      warnings: string[];
    };

export default function PatientTimeline({
  patientId,
  onOpen,
}: {
  patientId: string;
  onOpen: (event: TimelineEvent) => void;
}) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [filter, setFilter] = useState<TimelineFilter>('all');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    setFilter('all');
    loadTimeline(patientId)
      .then((result) => {
        if (!cancelled) setState({ status: 'ready', ...result });
      })
      .catch((err) => {
        if (!cancelled) {
          setState({
            status: 'error',
            message: err instanceof Error ? err.message : 'The timeline could not be loaded.',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [patientId, attempt]);

  const visible = useMemo(
    () => (state.status === 'ready' ? filterEvents(state.events, filter) : []),
    [state, filter]
  );
  const groups = useMemo(() => groupEvents(visible), [visible]);

  if (state.status === 'loading') return <TimelineSkeleton />;
  if (state.status === 'error') {
    return (
      <ErrorNotice
        title="The timeline could not be loaded"
        message={state.message}
        onRetry={() => setAttempt((value) => value + 1)}
      />
    );
  }

  return (
    <div className="space-y-5">
      <SummaryBar summary={state.summary} />
      {state.warnings.length > 0 && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950" role="status">
          Some history could not be loaded: {state.warnings.join(', ')}.
        </p>
      )}
      <div
        className="sticky top-[calc(4rem+var(--chart-chrome,9rem)+0.5rem)] z-10 flex max-w-full gap-2 overflow-x-auto bg-slate-50/95 py-2 backdrop-blur"
        role="toolbar"
        aria-label="Timeline filters"
        onKeyDown={(event) => {
          const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button')];
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
          if (index < 0) return;
          let next = index;
          if (event.key === 'ArrowRight') next = (index + 1) % buttons.length;
          else if (event.key === 'ArrowLeft') next = (index - 1 + buttons.length) % buttons.length;
          else if (event.key === 'Home') next = 0;
          else if (event.key === 'End') next = buttons.length - 1;
          else return;
          event.preventDefault();
          buttons[next]?.focus();
          buttons[next]?.click();
        }}
      >
        {TIMELINE_FILTERS.map((item) => {
          const selected = filter === item.id;
          const count = countForFilter(state.events, item.id);
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={selected}
              onClick={() => setFilter(item.id)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                selected
                  ? 'bg-teal-700 text-white shadow-sm'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {item.label}
              <span className={`tabular-nums text-xs ${selected ? 'text-teal-100' : 'text-slate-600'}`}>{count}</span>
            </button>
          );
        })}
      </div>
      {groups.length === 0 ? (
        <TimelineEmpty filter={filter} />
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.id} aria-label={group.label}>
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-950">{group.label}</h2>
                <p className="text-xs text-slate-500">
                  {group.items.length} {group.items.length === 1 ? 'event' : 'events'}
                </p>
              </div>
              <ol className="relative space-y-3 before:absolute before:bottom-4 before:left-5 before:top-4 before:w-px before:bg-slate-200">
                {group.items.map((event) => (
                  <li key={event.id}>
                    <TimelineCard event={event} bucket={group.id} onOpen={onOpen} />
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryBar({ summary }: { summary: TimelineSummary }) {
  const items = [
    { label: 'Total encounters', value: summary.encounters },
    { label: 'Active orders', value: summary.activeOrders },
    { label: 'Active referrals', value: summary.activeReferrals },
    { label: 'Upcoming appointments', value: summary.upcomingAppointments },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-slate-950">
            {item.value == null ? '—' : item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function TimelineCard({
  event,
  bucket,
  onOpen,
}: {
  event: TimelineEvent;
  bucket: TimelineBucket;
  onOpen: (event: TimelineEvent) => void;
}) {
  const Icon = ICONS[event.kind];
  return (
    <button type="button" onClick={() => onOpen(event)} className="group flex w-full gap-3 text-left">
      <span
        className={`relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-2xl ring-1 ${ICON_TONE[event.kind]}`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span
        className={`min-w-0 flex-1 rounded-2xl border bg-white p-4 shadow-sm transition group-hover:border-teal-300 group-hover:shadow-md group-focus-visible:border-teal-600 group-focus-visible:ring-2 group-focus-visible:ring-teal-600 ${
          event.alert ? 'border-rose-200' : 'border-slate-200'
        }`}
      >
        {event.alert && <span className="sr-only">Needs review. </span>}
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              {event.kindLabel}
            </span>
            <span className="mt-0.5 block text-sm font-semibold text-slate-950">{event.title}</span>
          </span>
          <time className="shrink-0 text-xs font-medium text-slate-500" dateTime={event.at}>
            {formatTimelineWhen(event.at, bucket)}
          </time>
        </span>
        {event.detail && <span className="mt-1 block text-sm text-slate-600">{event.detail}</span>}
        {event.badges.length > 0 && (
          <span className="mt-2 flex flex-wrap gap-1.5">
            {event.badges.map((badge) => (
              <StatusBadge key={badge} value={badge} />
            ))}
          </span>
        )}
        {event.preview && <span className="mt-2 block text-sm leading-5 text-slate-700">{event.preview}</span>}
        {event.stages && <StageRail stages={event.stages} />}
        <span className="mt-3 block text-xs font-semibold text-teal-800">{event.openLabel}</span>
      </span>
    </button>
  );
}

function StageRail({ stages }: { stages: VisitStage[] }) {
  return (
    <span className="mt-3 grid grid-cols-3 gap-2">
      {stages.map((stage) => {
        const bar =
          stage.state === 'upcoming'
            ? 'bg-slate-200'
            : stage.state === 'current' && stage.key !== 'completed'
              ? 'bg-amber-500'
              : 'bg-teal-600';
        const text =
          stage.state === 'upcoming'
            ? 'text-slate-600'
            : stage.state === 'current' && stage.key !== 'completed'
              ? 'text-amber-900'
              : 'text-teal-900';
        return (
          <span key={stage.key}>
            <span className={`block h-1 rounded-full ${bar}`} />
            <span className={`mt-1 block text-[11px] font-medium ${text}`}>
              {stage.label}
              <span className="sr-only">
                {stage.state === 'done' ? ', done' : stage.state === 'current' ? ', current' : ', not yet'}
              </span>
            </span>
          </span>
        );
      })}
    </span>
  );
}

function TimelineEmpty({ filter }: { filter: TimelineFilter }) {
  const copy: Record<TimelineFilter, { title: string; body: string }> = {
    all: {
      title: 'No chart history yet',
      body: 'Encounters, orders, referrals, visits, notes, and monitoring events show up here.',
    },
    encounters: {
      title: 'No encounters',
      body: 'Encounters for this chart show up here after a visit is documented.',
    },
    orders: {
      title: 'No orders',
      body: 'Laboratory, imaging, and procedure orders show up here.',
    },
    referrals: {
      title: 'No referrals',
      body: 'Specialist and allied-health referrals show up here.',
    },
    appointments: {
      title: 'No appointments',
      body: 'Booked and completed visits show up in this history.',
    },
    notes: {
      title: 'No clinical notes',
      body: 'Notes written on this chart show up here.',
    },
    monitoring: {
      title: 'No monitoring events',
      body: 'Program readings and recalls show up here.',
    },
  };
  const item = copy[filter];
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      <p className="text-sm font-medium text-slate-800">{item.title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">{item.body}</p>
    </div>
  );
}

function TimelineSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading timeline</span>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-[4.5rem] animate-pulse rounded-2xl bg-slate-200" />
        ))}
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="h-8 w-24 animate-pulse rounded-full bg-slate-200" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="flex gap-3">
            <div className="h-10 w-10 animate-pulse rounded-2xl bg-slate-200" />
            <div className="h-24 flex-1 animate-pulse rounded-2xl bg-slate-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

async function loadTimeline(patientId: string) {
  const [
    encounters,
    diagnoses,
    activeOrders,
    closedOrders,
    orderSummary,
    activeReferrals,
    closedReferrals,
    referralSummary,
    appointments,
    visits,
    notes,
    programs,
    recalls,
    dashboard,
    carePlans,
  ] = await Promise.all([
    settle(encountersApi.list(patientId, 100)),
    settle(clinicalApi.diagnoses(patientId).list('?limit=100')),
    settle(clinicalApi.orders(patientId).list('?view=active&limit=100')),
    settle(clinicalApi.orders(patientId).list('?view=completed&limit=100')),
    settle(clinicalApi.orders(patientId).summary()),
    settle(clinicalApi.referrals(patientId).list('?view=active&limit=100')),
    settle(clinicalApi.referrals(patientId).list('?view=completed&limit=100')),
    settle(clinicalApi.referrals(patientId).summary()),
    settle(appointmentsApi.history(patientId, 100)),
    settle(visitsApi.forPatient(patientId)),
    settle(clinicalApi.notes(patientId).list('?limit=100')),
    settle(clinicalApi.monitoring(patientId).programs('?limit=100')),
    settle(clinicalApi.monitoring(patientId).recalls('?limit=100')),
    settle(clinicalApi.monitoring(patientId).dashboard()),
    settle(clinicalApi.carePlans(patientId).list('?view=all&limit=100')),
  ]);

  const warnings: string[] = [];
  const orders = mergeRecords<Order>(activeOrders, closedOrders);
  if (!orders) warnings.push('orders');
  else if (!activeOrders.ok || !closedOrders.ok) warnings.push('orders');
  const referrals = mergeRecords<Referral>(activeReferrals, closedReferrals);
  if (!referrals) warnings.push('referrals');
  else if (!activeReferrals.ok || !closedReferrals.ok) warnings.push('referrals');

  const orderList = orders ?? [];
  const referralList = referrals ?? [];
  const orderActiveCount = orderSummary.ok
    ? orderSummary.value.counts.active
    : orders
      ? orderList.filter((order) => ACTIVE_ORDER.has(order.status)).length
      : null;
  const referralActiveCount = referralSummary.ok
    ? referralSummary.value.counts.active
    : referrals
      ? referralList.filter((referral) => ACTIVE_REFERRAL.has(referral.status)).length
      : null;

  if (!encounters.ok) warnings.push('encounters');
  else if (!diagnoses.ok) warnings.push('diagnoses');
  if (!appointments.ok) warnings.push('appointments');
  if (!visits.ok) warnings.push('visits');
  if (!notes.ok) warnings.push('notes');
  if (!programs.ok || !recalls.ok || !dashboard.ok) warnings.push('monitoring');
  if (!carePlans.ok) warnings.push('care plans');

  const abnormal: Array<MonitoringMetric & { programTitle?: string }> = dashboard.ok
    ? dashboard.value.recentAbnormal
    : [];

  const sources: TimelineSources = {
    encounters: encounters.ok ? encounters.value.data : [],
    encounterTotal: encounters.ok ? encounters.value.total : null,
    diagnoses: diagnoses.ok ? diagnoses.value.data : [],
    orders: orderList,
    orderActiveCount,
    referrals: referralList,
    referralActiveCount,
    appointments: appointments.ok ? appointments.value.data : [],
    appointmentsKnown: appointments.ok,
    visits: visits.ok ? visits.value.data : [],
    notes: notes.ok ? notes.value.data : [],
    programs: programs.ok ? programs.value.data : [],
    recalls: recalls.ok ? recalls.value.data : [],
    abnormal,
    carePlans: carePlans.ok ? carePlans.value.data : [],
  };

  const failedCore = [encounters, appointments, notes, programs].filter((item) => !item.ok).length;
  if (!orders && !referrals && failedCore >= 3) {
    throw new Error('The timeline could not be loaded.');
  }

  const built = buildTimeline(sources);
  return { ...built, warnings: [...new Set(warnings)] };
}

function mergeRecords<T extends { _id: string }>(
  active: Settled<{ data: T[] }>,
  closed: Settled<{ data: T[] }>
) {
  if (!active.ok && !closed.ok) return null;
  const map = new Map<string, T>();
  if (active.ok) for (const item of active.value.data) map.set(item._id, item);
  if (closed.ok) for (const item of closed.value.data) map.set(item._id, item);
  return [...map.values()];
}

type Settled<T> = { ok: true; value: T } | { ok: false };

async function settle<T>(work: Promise<T>): Promise<Settled<T>> {
  try {
    return { ok: true, value: await work };
  } catch {
    return { ok: false };
  }
}
