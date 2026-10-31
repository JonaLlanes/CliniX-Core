import type {
  Appointment,
  CarePlan,
  ClinicalNote,
  Encounter,
  EncounterDiagnosis,
  MonitoringMetric,
  MonitoringProgram,
  MonitoringRecall,
  Order,
  PatientVisit,
  Referral,
} from '../../api/client';
import { providerLabel, typeLabel } from '../appointmentDisplay';
import { providerName } from '../encounterDisplay';
import type { ChartTab } from './chartDisplay';
import type { RecordScope } from './recordFocus';

const CLINIC_ZONE = 'America/Toronto';

const OPEN_APPOINTMENTS = new Set(['booked', 'confirmed', 'arrived']);

export type TimelineFilter =
  | 'all'
  | 'encounters'
  | 'orders'
  | 'referrals'
  | 'appointments'
  | 'notes'
  | 'monitoring';

export type TimelineBucket = 'upcoming' | 'today' | 'yesterday' | 'week' | 'earlier';

export type TimelineChip = TimelineFilter | 'visit' | 'care';

export type VisitStageKey = 'waiting' | 'roomed' | 'completed';

export type VisitStage = {
  key: VisitStageKey;
  label: string;
  state: 'done' | 'current' | 'upcoming';
};

export type TimelineEvent = {
  id: string;
  kind: 'encounter' | 'order' | 'referral' | 'appointment' | 'visit' | 'note' | 'monitoring' | 'care';
  kindLabel: string;
  chip: TimelineChip;
  at: string;
  title: string;
  detail?: string;
  preview?: string;
  badges: string[];
  stages?: VisitStage[];
  alert?: boolean;
  openLabel: string;
  destination: ChartTab;
  recordId: string;
  scope: RecordScope;
  fallbackId?: string;
};

export type TimelineSummary = {
  encounters: number | null;
  activeOrders: number | null;
  activeReferrals: number | null;
  upcomingAppointments: number | null;
};

export type TimelineSources = {
  encounters: Encounter[];
  encounterTotal: number | null;
  diagnoses: EncounterDiagnosis[];
  orders: Order[];
  orderActiveCount: number | null;
  referrals: Referral[];
  referralActiveCount: number | null;
  appointments: Appointment[];
  appointmentsKnown: boolean;
  visits: PatientVisit[];
  notes: ClinicalNote[];
  programs: MonitoringProgram[];
  recalls: MonitoringRecall[];
  abnormal: Array<MonitoringMetric & { programTitle?: string }>;
  carePlans: CarePlan[];
};

export const TIMELINE_FILTERS: { id: TimelineFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'encounters', label: 'Encounters' },
  { id: 'orders', label: 'Orders' },
  { id: 'referrals', label: 'Referrals' },
  { id: 'appointments', label: 'Appointments' },
  { id: 'notes', label: 'Notes' },
  { id: 'monitoring', label: 'Monitoring' },
];

export const TIMELINE_GROUPS: { id: TimelineBucket; label: string; hint: string }[] = [
  { id: 'upcoming', label: 'Upcoming', hint: 'Later clinic days' },
  { id: 'today', label: 'Today', hint: 'Clinic day, America/Toronto' },
  { id: 'yesterday', label: 'Yesterday', hint: '' },
  { id: 'week', label: 'Last 7 Days', hint: 'The five clinic days before yesterday' },
  { id: 'earlier', label: 'Earlier', hint: '' },
];

const ORDER_TYPE_LABEL: Record<string, string> = {
  laboratory: 'Laboratory',
  diagnostic_imaging: 'Diagnostic imaging',
  procedure: 'Procedure',
};

export function buildTimeline(sources: TimelineSources) {
  const events = [
    ...encounterEvents(sources.encounters, sources.diagnoses),
    ...orderEvents(sources.orders),
    ...referralEvents(sources.referrals),
    ...appointmentEvents(sources.appointments),
    ...visitEvents(sources.visits),
    ...noteEvents(sources.notes),
    ...monitoringEvents(sources.programs, sources.recalls, sources.abnormal),
    ...carePlanEvents(sources.carePlans),
  ].filter((event) => !Number.isNaN(new Date(event.at).getTime()));

  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime() || a.title.localeCompare(b.title));

  return {
    events,
    summary: summarize(sources),
  };
}

export function filterEvents(events: TimelineEvent[], filter: TimelineFilter) {
  if (filter === 'all') return events;
  return events.filter((event) => event.chip === filter);
}

export function groupEvents(events: TimelineEvent[], now = new Date()) {
  const buckets = new Map<TimelineBucket, TimelineEvent[]>();
  for (const event of events) {
    const bucket = bucketFor(event.at, now);
    const list = buckets.get(bucket);
    if (list) list.push(event);
    else buckets.set(bucket, [event]);
  }
  return TIMELINE_GROUPS.map((group) => {
    const items = buckets.get(group.id) ?? [];
    if (group.id === 'upcoming') {
      return {
        ...group,
        items: [...items].sort(
          (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime() || a.title.localeCompare(b.title)
        ),
      };
    }
    return { ...group, items };
  }).filter((group) => group.items.length > 0);
}

export function countForFilter(events: TimelineEvent[], filter: TimelineFilter) {
  return filterEvents(events, filter).length;
}

export function formatTimelineWhen(iso: string, bucket: TimelineBucket) {
  const date = new Date(iso);
  if (bucket === 'today' || bucket === 'yesterday') {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: CLINIC_ZONE,
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  }
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CLINIC_ZONE,
    weekday: bucket === 'earlier' ? undefined : 'short',
    month: 'short',
    day: 'numeric',
    year: bucket === 'earlier' || bucket === 'upcoming' ? 'numeric' : undefined,
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function countUpcomingAppointments(appointments: Appointment[], now = Date.now()) {
  return appointments.filter((item) => {
    if (!OPEN_APPOINTMENTS.has(item.status)) return false;
    if (item.status === 'arrived') return true;
    return new Date(item.endTime).getTime() >= now;
  }).length;
}

function summarize(sources: TimelineSources): TimelineSummary {
  return {
    encounters: sources.encounterTotal,
    activeOrders: sources.orderActiveCount,
    activeReferrals: sources.referralActiveCount,
    upcomingAppointments: sources.appointmentsKnown
      ? countUpcomingAppointments(sources.appointments)
      : null,
  };
}

function bucketFor(iso: string, now: Date): TimelineBucket {
  const delta = clinicDayIndex(now) - clinicDayIndex(new Date(iso));
  if (delta < 0) return 'upcoming';
  if (delta === 0) return 'today';
  if (delta === 1) return 'yesterday';
  if (delta <= 7) return 'week';
  return 'earlier';
}

function clinicDayIndex(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CLINIC_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const pick = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return Math.floor(Date.UTC(pick('year'), pick('month') - 1, pick('day')) / 86400000);
}

function refId(value: string | { _id: string } | null | undefined) {
  if (!value) return '';
  return typeof value === 'string' ? value : value._id;
}

function previewText(value: string, max = 140) {
  const flat = value.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1).trimEnd()}…`;
}

function named(value: string) {
  return value && value !== '—' ? value : 'Not recorded';
}

function encounterEvents(encounters: Encounter[], diagnoses: EncounterDiagnosis[]): TimelineEvent[] {
  const byEncounter = new Map<string, EncounterDiagnosis[]>();
  for (const diagnosis of diagnoses) {
    const id = refId(diagnosis.encounterId);
    if (!id) continue;
    const list = byEncounter.get(id);
    if (list) list.push(diagnosis);
    else byEncounter.set(id, [diagnosis]);
  }
  return encounters.map((encounter) => {
    const rows = [...(byEncounter.get(encounter._id) ?? [])].sort(
      (a, b) => Number(b.primaryDiagnosis) - Number(a.primaryDiagnosis)
    );
    const labels = rows
      .slice(0, 3)
      .map((row) => (row.code ? `${row.description} (${row.code})` : row.description));
    const extra = rows.length > 3 ? ` +${rows.length - 3} more` : '';
    return {
      id: `encounter-${encounter._id}`,
      kind: 'encounter' as const,
      kindLabel: 'Encounter',
      chip: 'encounters' as const,
      at: encounter.openedAt,
      title: encounter.chiefComplaint || 'Encounter',
      detail: `Provider ${named(providerName(encounter.attendingProviderId))}`,
      preview: labels.length ? `${labels.join(' · ')}${extra}` : 'No diagnosis recorded',
      badges: [encounter.status],
      openLabel: 'Open encounter',
      destination: 'encounters' as const,
      recordId: encounter._id,
      scope: 'encounter' as const,
    };
  });
}

function orderEvents(orders: Order[]): TimelineEvent[] {
  return orders.map((order) => ({
    id: `order-${order._id}`,
    kind: 'order' as const,
    kindLabel: 'Order',
    chip: 'orders' as const,
    at: order.orderedAt || order.createdAt || order.scheduledAt || '',
    title: order.orderName,
    detail: ORDER_TYPE_LABEL[order.orderType] || order.orderType,
    badges: order.priority === 'routine' ? [order.status] : [order.priority, order.status],
    alert: order.priority === 'stat',
    openLabel: 'Open order',
    destination: 'orders' as const,
    recordId: order._id,
    scope: 'order' as const,
  }));
}

function referralEvents(referrals: Referral[]): TimelineEvent[] {
  return referrals.map((referral) => {
    const person = referral.specialistName?.trim();
    const place = referral.organization?.trim();
    const destination =
      person && place && person !== place ? `${person} · ${place}` : person || place || 'Destination not recorded';
    return {
      id: `referral-${referral._id}`,
      kind: 'referral' as const,
      kindLabel: 'Referral',
      chip: 'referrals' as const,
      at: referral.referralDate || referral.createdAt || '',
      title: destination,
      detail: referral.specialty || undefined,
      badges: [referral.status],
      alert: referral.priority === 'urgent' || referral.followUpRequired,
      openLabel: 'Open referral',
      destination: 'referrals' as const,
      recordId: referral._id,
      scope: 'referral' as const,
    };
  });
}

function appointmentEvents(appointments: Appointment[]): TimelineEvent[] {
  return appointments.map((appointment) => ({
    id: `appointment-${appointment._id}`,
    kind: 'appointment' as const,
    kindLabel: 'Appointment',
    chip: 'appointments' as const,
    at: appointment.startTime,
    title: typeLabel(appointment.appointmentType),
    detail: `Provider ${named(providerLabel(appointment.providerId))}`,
    badges: [appointment.status],
    openLabel: 'Open appointment',
    destination: 'appointments' as const,
    recordId: appointment._id,
    scope: 'appointment' as const,
  }));
}

function visitEvents(visits: PatientVisit[]): TimelineEvent[] {
  return visits.map((visit) => {
    const appointmentId = refId(visit.appointmentId);
    const provider =
      typeof visit.providerId === 'object' ? visit.providerId.displayName || 'Not recorded' : 'Not recorded';
    return {
      id: `visit-${visit._id}`,
      kind: 'visit' as const,
      kindLabel: 'Visit',
      chip: 'visit' as const,
      at: visitAt(visit),
      title: 'Clinic visit',
      detail: `Provider ${provider}`,
      badges: [visit.status],
      stages: visitStages(visit),
      openLabel: 'Open appointment',
      destination: 'appointments' as const,
      recordId: appointmentId,
      scope: 'appointment' as const,
    };
  });
}

function visitAt(visit: PatientVisit) {
  const appointment = typeof visit.appointmentId === 'object' ? visit.appointmentId.startTime : '';
  return visit.completedAt || visit.startedAt || visit.roomedAt || visit.arrivalAt || appointment || '';
}

function visitStages(visit: PatientVisit): VisitStage[] {
  const completed = visit.status === 'completed' || Boolean(visit.completedAt);
  const roomed =
    completed ||
    visit.status === 'roomed' ||
    visit.status === 'in_progress' ||
    Boolean(visit.roomedAt);
  const waiting = roomed || visit.status === 'waiting' || visit.status === 'arrived' || Boolean(visit.arrivalAt);
  const phase = completed ? 2 : roomed ? 1 : waiting ? 0 : -1;
  const keys: VisitStageKey[] = ['waiting', 'roomed', 'completed'];
  const labels = ['Waiting', 'Roomed', 'Completed'];
  return keys.map((key, index) => ({
    key,
    label: labels[index],
    state: phase < 0 ? 'upcoming' : index < phase ? 'done' : index === phase ? 'current' : 'upcoming',
  }));
}

function noteEvents(notes: ClinicalNote[]): TimelineEvent[] {
  return notes.map((note) => {
    const author =
      note.authorId && typeof note.authorId === 'object'
        ? note.authorId.displayName || 'Unknown author'
        : 'Unknown author';
    return {
      id: `note-${note._id}`,
      kind: 'note' as const,
      kindLabel: 'Note',
      chip: 'notes' as const,
      at: note.createdAt,
      title: author,
      detail: note.version > 1 ? `Revision ${note.version}` : undefined,
      preview: previewText(note.body || ''),
      badges: [],
      openLabel: 'Open note',
      destination: 'notes' as const,
      recordId: note._id,
      scope: 'note' as const,
    };
  });
}

function monitoringEvents(
  programs: MonitoringProgram[],
  recalls: MonitoringRecall[],
  abnormal: Array<MonitoringMetric & { programTitle?: string }>
): TimelineEvent[] {
  const enrollments: TimelineEvent[] = programs
    .filter((program) => program.enrolledDate)
    .map((program) => ({
      id: `program-${program._id}`,
      kind: 'monitoring' as const,
      kindLabel: 'Monitoring',
      chip: 'monitoring' as const,
      at: program.enrolledDate,
      title: program.title,
      detail: 'Enrollment',
      badges: [program.status],
      openLabel: 'Open monitoring',
      destination: 'monitoring' as const,
      recordId: program._id,
      scope: 'program' as const,
    }));

  const recallEvents: TimelineEvent[] = recalls.map((recall) => ({
    id: `recall-${recall._id}`,
    kind: 'monitoring' as const,
    kindLabel: 'Monitoring',
    chip: 'monitoring' as const,
    at: recall.completedAt || recall.dueDate,
    title: recall.reason,
    detail: 'Recall',
    badges: [recall.status],
    alert: recall.status === 'overdue',
    openLabel: 'Open monitoring',
    destination: 'monitoring' as const,
    recordId: recall._id,
    scope: 'recall' as const,
  }));

  const seen = new Set<string>();
  const readings: TimelineEvent[] = [];
  for (const reading of abnormal) {
    if (!reading.abnormal || seen.has(reading._id)) continue;
    seen.add(reading._id);
    readings.push({
      id: `metric-${reading._id}`,
      kind: 'monitoring',
      kindLabel: 'Monitoring',
      chip: 'monitoring',
      at: reading.recordedAt,
      title: `${reading.displayLabel} ${reading.value} ${reading.unit}`.trim(),
      detail: reading.programTitle ? `${reading.programTitle} · Abnormal` : 'Abnormal metric',
      badges: ['abnormal'],
      alert: true,
      openLabel: 'Open monitoring',
      destination: 'monitoring',
      recordId: reading._id,
      scope: 'metric',
      fallbackId: reading.programId,
    });
  }

  for (const program of programs) {
    for (const reading of program.recentMetrics || []) {
      if (!reading.abnormal || seen.has(reading._id)) continue;
      seen.add(reading._id);
      readings.push({
        id: `metric-${reading._id}`,
        kind: 'monitoring',
        kindLabel: 'Monitoring',
        chip: 'monitoring',
        at: reading.recordedAt,
        title: `${reading.displayLabel} ${reading.value} ${reading.unit}`.trim(),
        detail: `${program.title} · Abnormal`,
        badges: ['abnormal'],
        alert: true,
        openLabel: 'Open monitoring',
        destination: 'monitoring',
        recordId: reading._id,
        scope: 'metric',
        fallbackId: program._id,
      });
    }
  }

  return [...enrollments, ...recallEvents, ...readings];
}

function carePlanEvents(plans: CarePlan[]): TimelineEvent[] {
  return plans.flatMap((plan) => {
    const at = plan.startDate || createdAtOf(plan);
    if (!at) return [];
    return [
      {
        id: `care-${plan._id}`,
        kind: 'care' as const,
        kindLabel: 'Care plan',
        chip: 'care' as const,
        at,
        title: plan.title,
        detail: plan.description ? previewText(plan.description, 90) : undefined,
        badges: [plan.status],
        openLabel: 'Open care plan',
        destination: 'care' as const,
        recordId: plan._id,
        scope: 'care' as const,
      },
    ];
  });
}

function createdAtOf(value: object) {
  const raw = (value as { createdAt?: string }).createdAt;
  return typeof raw === 'string' ? raw : '';
}
