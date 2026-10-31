import { providerLabel, typeLabel } from '../appointmentDisplay';
import { providerName } from '../encounterDisplay';
const CLINIC_ZONE = 'America/Toronto';
const OPEN_APPOINTMENTS = new Set(['booked', 'confirmed', 'arrived']);
export const TIMELINE_FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'encounters', label: 'Encounters' },
    { id: 'orders', label: 'Orders' },
    { id: 'referrals', label: 'Referrals' },
    { id: 'appointments', label: 'Appointments' },
    { id: 'notes', label: 'Notes' },
    { id: 'monitoring', label: 'Monitoring' },
];
export const TIMELINE_GROUPS = [
    { id: 'upcoming', label: 'Upcoming', hint: 'Later clinic days' },
    { id: 'today', label: 'Today', hint: 'Clinic day, America/Toronto' },
    { id: 'yesterday', label: 'Yesterday', hint: '' },
    { id: 'week', label: 'Last 7 Days', hint: 'The five clinic days before yesterday' },
    { id: 'earlier', label: 'Earlier', hint: '' },
];
const ORDER_TYPE_LABEL = {
    laboratory: 'Laboratory',
    diagnostic_imaging: 'Diagnostic imaging',
    procedure: 'Procedure',
};
export function buildTimeline(sources) {
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
export function filterEvents(events, filter) {
    if (filter === 'all')
        return events;
    return events.filter((event) => event.chip === filter);
}
export function groupEvents(events, now = new Date()) {
    const buckets = new Map();
    for (const event of events) {
        const bucket = bucketFor(event.at, now);
        const list = buckets.get(bucket);
        if (list)
            list.push(event);
        else
            buckets.set(bucket, [event]);
    }
    return TIMELINE_GROUPS.map((group) => {
        const items = buckets.get(group.id) ?? [];
        if (group.id === 'upcoming') {
            return {
                ...group,
                items: [...items].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime() || a.title.localeCompare(b.title)),
            };
        }
        return { ...group, items };
    }).filter((group) => group.items.length > 0);
}
export function countForFilter(events, filter) {
    return filterEvents(events, filter).length;
}
export function formatTimelineWhen(iso, bucket) {
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
export function countUpcomingAppointments(appointments, now = Date.now()) {
    return appointments.filter((item) => {
        if (!OPEN_APPOINTMENTS.has(item.status))
            return false;
        if (item.status === 'arrived')
            return true;
        return new Date(item.endTime).getTime() >= now;
    }).length;
}
function summarize(sources) {
    return {
        encounters: sources.encounterTotal,
        activeOrders: sources.orderActiveCount,
        activeReferrals: sources.referralActiveCount,
        upcomingAppointments: sources.appointmentsKnown
            ? countUpcomingAppointments(sources.appointments)
            : null,
    };
}
function bucketFor(iso, now) {
    const delta = clinicDayIndex(now) - clinicDayIndex(new Date(iso));
    if (delta < 0)
        return 'upcoming';
    if (delta === 0)
        return 'today';
    if (delta === 1)
        return 'yesterday';
    if (delta <= 7)
        return 'week';
    return 'earlier';
}
function clinicDayIndex(date) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: CLINIC_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);
    const pick = (type) => Number(parts.find((part) => part.type === type)?.value);
    return Math.floor(Date.UTC(pick('year'), pick('month') - 1, pick('day')) / 86400000);
}
function refId(value) {
    if (!value)
        return '';
    return typeof value === 'string' ? value : value._id;
}
function previewText(value, max = 140) {
    const flat = value.replace(/\s+/g, ' ').trim();
    if (flat.length <= max)
        return flat;
    return `${flat.slice(0, max - 1).trimEnd()}…`;
}
function named(value) {
    return value && value !== '—' ? value : 'Not recorded';
}
function encounterEvents(encounters, diagnoses) {
    const byEncounter = new Map();
    for (const diagnosis of diagnoses) {
        const id = refId(diagnosis.encounterId);
        if (!id)
            continue;
        const list = byEncounter.get(id);
        if (list)
            list.push(diagnosis);
        else
            byEncounter.set(id, [diagnosis]);
    }
    return encounters.map((encounter) => {
        const rows = [...(byEncounter.get(encounter._id) ?? [])].sort((a, b) => Number(b.primaryDiagnosis) - Number(a.primaryDiagnosis));
        const labels = rows
            .slice(0, 3)
            .map((row) => (row.code ? `${row.description} (${row.code})` : row.description));
        const extra = rows.length > 3 ? ` +${rows.length - 3} more` : '';
        return {
            id: `encounter-${encounter._id}`,
            kind: 'encounter',
            kindLabel: 'Encounter',
            chip: 'encounters',
            at: encounter.openedAt,
            title: encounter.chiefComplaint || 'Encounter',
            detail: `Provider ${named(providerName(encounter.attendingProviderId))}`,
            preview: labels.length ? `${labels.join(' · ')}${extra}` : 'No diagnosis recorded',
            badges: [encounter.status],
            openLabel: 'Open encounter',
            destination: 'encounters',
            recordId: encounter._id,
            scope: 'encounter',
        };
    });
}
function orderEvents(orders) {
    return orders.map((order) => ({
        id: `order-${order._id}`,
        kind: 'order',
        kindLabel: 'Order',
        chip: 'orders',
        at: order.orderedAt || order.createdAt || order.scheduledAt || '',
        title: order.orderName,
        detail: ORDER_TYPE_LABEL[order.orderType] || order.orderType,
        badges: order.priority === 'routine' ? [order.status] : [order.priority, order.status],
        alert: order.priority === 'stat',
        openLabel: 'Open order',
        destination: 'orders',
        recordId: order._id,
        scope: 'order',
    }));
}
function referralEvents(referrals) {
    return referrals.map((referral) => {
        const person = referral.specialistName?.trim();
        const place = referral.organization?.trim();
        const destination = person && place && person !== place ? `${person} · ${place}` : person || place || 'Destination not recorded';
        return {
            id: `referral-${referral._id}`,
            kind: 'referral',
            kindLabel: 'Referral',
            chip: 'referrals',
            at: referral.referralDate || referral.createdAt || '',
            title: destination,
            detail: referral.specialty || undefined,
            badges: [referral.status],
            alert: referral.priority === 'urgent' || referral.followUpRequired,
            openLabel: 'Open referral',
            destination: 'referrals',
            recordId: referral._id,
            scope: 'referral',
        };
    });
}
function appointmentEvents(appointments) {
    return appointments.map((appointment) => ({
        id: `appointment-${appointment._id}`,
        kind: 'appointment',
        kindLabel: 'Appointment',
        chip: 'appointments',
        at: appointment.startTime,
        title: typeLabel(appointment.appointmentType),
        detail: `Provider ${named(providerLabel(appointment.providerId))}`,
        badges: [appointment.status],
        openLabel: 'Open appointment',
        destination: 'appointments',
        recordId: appointment._id,
        scope: 'appointment',
    }));
}
function visitEvents(visits) {
    return visits.map((visit) => {
        const appointmentId = refId(visit.appointmentId);
        const provider = typeof visit.providerId === 'object' ? visit.providerId.displayName || 'Not recorded' : 'Not recorded';
        return {
            id: `visit-${visit._id}`,
            kind: 'visit',
            kindLabel: 'Visit',
            chip: 'visit',
            at: visitAt(visit),
            title: 'Clinic visit',
            detail: `Provider ${provider}`,
            badges: [visit.status],
            stages: visitStages(visit),
            openLabel: 'Open appointment',
            destination: 'appointments',
            recordId: appointmentId,
            scope: 'appointment',
        };
    });
}
function visitAt(visit) {
    const appointment = typeof visit.appointmentId === 'object' ? visit.appointmentId.startTime : '';
    return visit.completedAt || visit.startedAt || visit.roomedAt || visit.arrivalAt || appointment || '';
}
function visitStages(visit) {
    const completed = visit.status === 'completed' || Boolean(visit.completedAt);
    const roomed = completed ||
        visit.status === 'roomed' ||
        visit.status === 'in_progress' ||
        Boolean(visit.roomedAt);
    const waiting = roomed || visit.status === 'waiting' || visit.status === 'arrived' || Boolean(visit.arrivalAt);
    const phase = completed ? 2 : roomed ? 1 : waiting ? 0 : -1;
    const keys = ['waiting', 'roomed', 'completed'];
    const labels = ['Waiting', 'Roomed', 'Completed'];
    return keys.map((key, index) => ({
        key,
        label: labels[index],
        state: phase < 0 ? 'upcoming' : index < phase ? 'done' : index === phase ? 'current' : 'upcoming',
    }));
}
function noteEvents(notes) {
    return notes.map((note) => {
        const author = note.authorId && typeof note.authorId === 'object'
            ? note.authorId.displayName || 'Unknown author'
            : 'Unknown author';
        return {
            id: `note-${note._id}`,
            kind: 'note',
            kindLabel: 'Note',
            chip: 'notes',
            at: note.createdAt,
            title: author,
            detail: note.version > 1 ? `Revision ${note.version}` : undefined,
            preview: previewText(note.body || ''),
            badges: [],
            openLabel: 'Open note',
            destination: 'notes',
            recordId: note._id,
            scope: 'note',
        };
    });
}
function monitoringEvents(programs, recalls, abnormal) {
    const enrollments = programs
        .filter((program) => program.enrolledDate)
        .map((program) => ({
        id: `program-${program._id}`,
        kind: 'monitoring',
        kindLabel: 'Monitoring',
        chip: 'monitoring',
        at: program.enrolledDate,
        title: program.title,
        detail: 'Enrollment',
        badges: [program.status],
        openLabel: 'Open monitoring',
        destination: 'monitoring',
        recordId: program._id,
        scope: 'program',
    }));
    const recallEvents = recalls.map((recall) => ({
        id: `recall-${recall._id}`,
        kind: 'monitoring',
        kindLabel: 'Monitoring',
        chip: 'monitoring',
        at: recall.completedAt || recall.dueDate,
        title: recall.reason,
        detail: 'Recall',
        badges: [recall.status],
        alert: recall.status === 'overdue',
        openLabel: 'Open monitoring',
        destination: 'monitoring',
        recordId: recall._id,
        scope: 'recall',
    }));
    const seen = new Set();
    const readings = [];
    for (const reading of abnormal) {
        if (!reading.abnormal || seen.has(reading._id))
            continue;
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
            if (!reading.abnormal || seen.has(reading._id))
                continue;
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
function carePlanEvents(plans) {
    return plans.flatMap((plan) => {
        const at = plan.startDate || createdAtOf(plan);
        if (!at)
            return [];
        return [
            {
                id: `care-${plan._id}`,
                kind: 'care',
                kindLabel: 'Care plan',
                chip: 'care',
                at,
                title: plan.title,
                detail: plan.description ? previewText(plan.description, 90) : undefined,
                badges: [plan.status],
                openLabel: 'Open care plan',
                destination: 'care',
                recordId: plan._id,
                scope: 'care',
            },
        ];
    });
}
function createdAtOf(value) {
    const raw = value.createdAt;
    return typeof raw === 'string' ? raw : '';
}
