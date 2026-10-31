import { SEX_AT_BIRTH } from '../canadianRegistration';
const CHART_TAB_IDS = new Set([
    'overview',
    'timeline',
    'problems',
    'vitals',
    'medications',
    'orders',
    'referrals',
    'appointments',
    'encounters',
    'care',
    'monitoring',
    'notes',
    'allergies',
    'audit',
]);
export function isChartTab(value) {
    return !!value && CHART_TAB_IDS.has(value);
}
export const CHART_GROUPS = [
    {
        id: 'clinical',
        label: 'Clinical',
        tabs: [
            { id: 'overview', label: 'Overview' },
            { id: 'timeline', label: 'Timeline' },
            { id: 'problems', label: 'Problem list' },
            { id: 'allergies', label: 'Allergies' },
            { id: 'medications', label: 'Medications' },
            { id: 'vitals', label: 'Vitals' },
        ],
    },
    {
        id: 'coordination',
        label: 'Care coordination',
        tabs: [
            { id: 'orders', label: 'Orders' },
            { id: 'referrals', label: 'Referrals' },
            { id: 'care', label: 'Care plans' },
            { id: 'monitoring', label: 'Monitoring' },
        ],
    },
    {
        id: 'visits',
        label: 'Visits',
        tabs: [
            { id: 'encounters', label: 'Encounters' },
            { id: 'appointments', label: 'Appointments' },
        ],
    },
    {
        id: 'administration',
        label: 'Administration',
        tabs: [
            { id: 'notes', label: 'Notes' },
            { id: 'audit', label: 'Audit' },
        ],
    },
];
const HIGH_RISK_TERMS = [
    'warfarin',
    'coumadin',
    'heparin',
    'enoxaparin',
    'lovenox',
    'dalteparin',
    'fondaparinux',
    'rivaroxaban',
    'xarelto',
    'apixaban',
    'eliquis',
    'dabigatran',
    'pradaxa',
    'edoxaban',
    'insulin',
    'glargine',
    'lispro',
    'degludec',
    'detemir',
    'humalog',
    'novolog',
    'lantus',
    'tresiba',
    'methotrexate',
    'digoxin',
    'lanoxin',
    'morphine',
    'oxycodone',
    'oxycontin',
    'hydrocodone',
    'fentanyl',
    'hydromorphone',
    'dilaudid',
    'methadone',
    'tramadol',
    'codeine',
    'buprenorphine',
    'glipizide',
    'glyburide',
    'glibenclamide',
    'glimepiride',
    'lithium',
    'amiodarone',
    'clonidine',
    'phenytoin',
    'carbamazepine',
    'valproate',
    'valproic',
];
const CRITICAL_PATTERN = /\b(critical|panic|critically)\b/i;
const ABNORMAL_PATTERN = /\babnormal\b/i;
export function ageLabel(birthDate) {
    if (!birthDate)
        return '—';
    const dob = new Date(birthDate);
    if (Number.isNaN(dob.getTime()))
        return '—';
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const month = now.getMonth() - dob.getMonth();
    if (month < 0 || (month === 0 && now.getDate() < dob.getDate()))
        age -= 1;
    if (age < 0)
        return '—';
    return `${age} yrs`;
}
export function sexAtBirthLabel(value) {
    if (!value)
        return '—';
    return SEX_AT_BIRTH.find((item) => item.code === value)?.label ?? value;
}
export function primaryProviderName(patient, directory) {
    const resolved = (patient.careTeam || [])
        .map((member) => {
        if (typeof member !== 'string')
            return member;
        return directory.find((person) => person._id === member) ?? null;
    })
        .filter((member) => Boolean(member));
    const clinician = resolved.find((person) => person.role === 'clinician');
    return clinician?.displayName || resolved[0]?.displayName || 'Unassigned';
}
export function medicationLabel(medication) {
    const generic = medication.genericName || medication.name || 'Medication';
    return medication.brandName ? `${generic} (${medication.brandName})` : generic;
}
export function medicationDetail(medication) {
    return [medication.strength, medication.dosage || medication.dose, medication.route, medication.frequency]
        .filter(Boolean)
        .join(' · ');
}
export function isHighRiskMedication(medication) {
    const haystack = `${medication.genericName || ''} ${medication.brandName || ''} ${medication.name || ''}`.toLowerCase();
    return HIGH_RISK_TERMS.some((term) => haystack.includes(term));
}
export function activeAllergies(allergies) {
    return allergies
        .filter((allergy) => allergy.status === 'active')
        .sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
}
export function activeConditions(conditions) {
    return conditions
        .filter((condition) => condition.status === 'active')
        .sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
}
export function openTasks(tasks) {
    return tasks
        .filter((task) => task.status !== 'completed')
        .sort((a, b) => {
        if (a.dueDate && b.dueDate)
            return a.dueDate.localeCompare(b.dueDate);
        if (a.dueDate)
            return -1;
        if (b.dueDate)
            return 1;
        return a.title.localeCompare(b.title);
    });
}
export function lastVisitIso(visits, appointments) {
    const stamps = [];
    for (const visit of visits) {
        if (visit.status !== 'completed')
            continue;
        const when = visit.completedAt ||
            (typeof visit.appointmentId === 'object' ? visit.appointmentId.startTime : '');
        const time = when ? new Date(when).getTime() : NaN;
        if (!Number.isNaN(time))
            stamps.push(time);
    }
    for (const appointment of appointments) {
        if (appointment.status !== 'completed')
            continue;
        const time = new Date(appointment.startTime).getTime();
        if (!Number.isNaN(time))
            stamps.push(time);
    }
    if (stamps.length === 0)
        return null;
    return new Date(Math.max(...stamps)).toISOString();
}
export function upcomingAppointment(appointments) {
    const open = new Set(['booked', 'confirmed', 'arrived']);
    return (appointments
        .filter((item) => {
        if (!open.has(item.status))
            return false;
        if (item.status === 'arrived')
            return true;
        return new Date(item.endTime).getTime() >= Date.now();
    })
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0] ?? null);
}
export function criticalFindings(results, abnormal) {
    const fromOrders = results
        .filter((result) => {
        const text = `${result.interpretation || ''} ${result.value || ''}`;
        return CRITICAL_PATTERN.test(text) || ABNORMAL_PATTERN.test(text);
    })
        .map((result) => {
        const text = `${result.interpretation || ''} ${result.value || ''}`;
        const orderName = result.order?.orderName || result.resultType;
        return {
            id: result._id,
            title: orderName,
            detail: [result.value, result.unit, result.interpretation].filter(Boolean).join(' · '),
            level: CRITICAL_PATTERN.test(text) ? 'critical' : 'abnormal',
        };
    });
    const fromMonitoring = abnormal.map((reading) => ({
        id: reading._id,
        title: reading.programTitle || reading.displayLabel,
        detail: `${reading.displayLabel} ${reading.value} ${reading.unit}`.trim(),
        level: 'abnormal',
    }));
    return [...fromOrders, ...fromMonitoring];
}
export function formatChartDate(value) {
    if (!value)
        return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
        return '—';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
function severityRank(value) {
    if (value === 'severe')
        return 0;
    if (value === 'moderate')
        return 1;
    if (value === 'mild')
        return 2;
    return 3;
}
