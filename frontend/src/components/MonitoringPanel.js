import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { clinicalApi, } from '../api/client';
import Panel from './Panel';
import { StatusBadge } from './StatusBadge';
import { chartRecordId, focusedRecordClass, watchChartRecord } from './chart/recordFocus';
import { formatEncounterWhen, providerId, providerName } from './encounterDisplay';
const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm';
const labelCls = 'block text-xs font-medium text-gray-600 mb-1';
const btnPrimary = 'px-4 py-2 bg-clinical-teal text-white rounded-lg text-sm hover:bg-clinical-teal-dark disabled:opacity-50';
const btnGhost = 'px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50';
const btnText = 'text-sm text-clinical-teal hover:underline disabled:opacity-50';
const PROGRAM_TYPES = [
    { value: 'hypertension', label: 'Hypertension' },
    { value: 'diabetes', label: 'Diabetes' },
    { value: 'copd', label: 'COPD' },
    { value: 'heart_failure', label: 'Heart Failure' },
    { value: 'ckd', label: 'CKD' },
    { value: 'custom', label: 'Custom' },
];
const PROGRAM_STATUSES = [
    { value: 'active', label: 'Active' },
    { value: 'on_hold', label: 'On Hold' },
    { value: 'completed', label: 'Completed' },
];
const PROGRAM_NEXT = {
    active: ['on_hold', 'completed'],
    on_hold: ['active', 'completed'],
    completed: [],
};
const METRIC_TYPES = [
    { value: 'blood_pressure', label: 'Blood Pressure' },
    { value: 'weight', label: 'Weight' },
    { value: 'bmi', label: 'BMI' },
    { value: 'a1c', label: 'A1C' },
    { value: 'ldl', label: 'LDL' },
    { value: 'egfr', label: 'eGFR' },
    { value: 'custom', label: 'Custom' },
];
const UNITS = {
    blood_pressure: 'mmHg',
    weight: 'kg',
    bmi: 'kg/m²',
    a1c: '%',
    ldl: 'mmol/L',
    egfr: 'mL/min/1.73 m²',
    custom: '',
};
const SOURCES = [
    { value: 'clinic', label: 'Clinic' },
    { value: 'home', label: 'Home' },
    { value: 'device', label: 'Device' },
    { value: 'caregiver', label: 'Caregiver' },
];
const RECALL_STATUSES = [
    { value: 'due', label: 'Due' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
];
const RECALL_NEXT = {
    due: ['scheduled', 'completed', 'cancelled'],
    scheduled: ['due', 'completed', 'cancelled'],
    overdue: ['due', 'scheduled', 'completed', 'cancelled'],
    completed: [],
    cancelled: [],
};
const RECALL_REASONS = ['Repeat A1C', 'BP Follow-up', 'Annual Review', 'Medication Review'];
const DIRECTION_TEXT = {
    up: 'Rising',
    down: 'Falling',
    stable: 'Stable',
    unknown: 'Not enough readings',
};
function messageOf(err) {
    return err instanceof Error ? err.message : 'Request failed';
}
function nowLocalInput() {
    const date = new Date();
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
}
function todayInput() {
    return nowLocalInput().slice(0, 10);
}
function dateTimeInput(value) {
    if (!value)
        return nowLocalInput();
    const date = new Date(value);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
}
function day(value) {
    if (!value)
        return '—';
    return new Date(value).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}
function statusChoices(current, next, labels) {
    const allowed = new Set([current, ...next]);
    return labels.filter((item) => allowed.has(item.value));
}
function defaultMetric(programType) {
    if (programType === 'hypertension')
        return 'blood_pressure';
    if (programType === 'diabetes')
        return 'a1c';
    if (programType === 'heart_failure')
        return 'weight';
    if (programType === 'ckd')
        return 'egfr';
    if (programType === 'copd')
        return 'custom';
    return 'blood_pressure';
}
function sourceLabel(source) {
    return SOURCES.find((item) => item.value === source)?.label || source;
}
function directionTone(metricType, direction) {
    if (direction === 'unknown')
        return 'text-gray-500';
    if (direction === 'stable')
        return 'text-gray-700';
    const adverse = metricType === 'egfr'
        ? direction === 'down'
        : (metricType === 'blood_pressure' || metricType === 'a1c' || metricType === 'ldl') && direction === 'up';
    if (adverse)
        return 'text-amber-700';
    if (metricType === 'egfr' && direction === 'up')
        return 'text-green-700';
    if ((metricType === 'blood_pressure' || metricType === 'a1c' || metricType === 'ldl') &&
        direction === 'down') {
        return 'text-green-700';
    }
    return 'text-gray-800';
}
function directionArrow(direction) {
    if (direction === 'up')
        return '↑';
    if (direction === 'down')
        return '↓';
    if (direction === 'stable')
        return '→';
    return '';
}
function Field({ label, children }) {
    return (_jsxs("div", { children: [_jsx("label", { className: labelCls, children: label }), children] }));
}
function Sparkline({ points, alert }) {
    const values = points.map((point) => point.numeric).filter((value) => value != null);
    if (values.length < 2)
        return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const width = 148;
    const height = 40;
    const coords = values
        .map((value, index) => {
        const x = (index / (values.length - 1)) * width;
        const y = height - ((value - min) / span) * (height - 6) - 3;
        return `${x},${y}`;
    })
        .join(' ');
    return (_jsx("svg", { viewBox: `0 0 ${width} ${height}`, className: `w-36 h-10 ${alert ? 'text-red-600' : 'text-clinical-teal'}`, children: _jsx("polyline", { fill: "none", stroke: "currentColor", strokeWidth: "2", points: coords }) }));
}
function DirectionMark({ metricType, direction }) {
    return (_jsxs("p", { className: `text-sm font-medium ${directionTone(metricType, direction)}`, children: [directionArrow(direction), " ", DIRECTION_TEXT[direction]] }));
}
function ActivityList({ points }) {
    if (points.length === 0)
        return _jsx("p", { className: "text-sm text-gray-500", children: "No monitoring activity yet." });
    return (_jsx("ol", { className: "space-y-3", children: points.map((point, index) => (_jsxs("li", { className: "flex gap-3 text-sm", children: [_jsx("div", { className: "w-36 shrink-0 text-gray-500", children: formatEncounterWhen(point.at) }), _jsxs("div", { children: [_jsx("div", { className: "font-medium text-gray-900", children: point.label }), point.detail && _jsx("div", { className: "text-gray-600", children: point.detail })] })] }, `${point.action}-${point.at}-${index}`))) }));
}
function TrendCard({ series }) {
    return (_jsxs("div", { className: "border border-gray-200 rounded-lg p-4", children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-gray-900", children: series.label }), series.latest ? (_jsxs("p", { className: `text-2xl font-semibold mt-1 ${series.latest.abnormal ? 'text-red-700' : 'text-gray-900'}`, children: [series.latest.value, ' ', _jsx("span", { className: "text-sm font-normal text-gray-500", children: series.latest.unit || series.unit })] })) : (_jsx("p", { className: "text-sm text-gray-500 mt-2", children: "No readings yet." })), _jsx("div", { className: "mt-1", children: _jsx(DirectionMark, { metricType: series.metricType, direction: series.direction }) })] }), _jsx(Sparkline, { points: series.points, alert: series.latest?.abnormal })] }), series.recent.length > 0 && (_jsx("ul", { className: "mt-3 space-y-1", children: series.recent.map((reading) => (_jsxs("li", { className: "flex flex-wrap items-baseline justify-between gap-2 text-sm", children: [_jsxs("span", { className: reading.abnormal ? 'text-red-700 font-medium' : 'text-gray-900', children: [reading.value, " ", reading.unit, reading.abnormal ? ' · Abnormal' : ''] }), _jsxs("span", { className: "text-gray-500", children: [day(reading.recordedAt), " \u00B7 ", sourceLabel(reading.source)] })] }, reading._id))) }))] }));
}
function TrendBoard({ trends }) {
    return (_jsx(Panel, { title: "Trends", subtitle: "Recent blood pressure, weight, A1C, and laboratory values", children: !trends ? (_jsx("p", { className: "text-sm text-gray-500", children: "Loading trends..." })) : (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-4", children: [_jsx(TrendCard, { series: trends.bloodPressure }), _jsx(TrendCard, { series: trends.weight }), _jsx(TrendCard, { series: trends.a1c })] }), _jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-gray-900 mb-2", children: "Laboratory values" }), _jsx("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-4", children: trends.laboratory
                                .filter((series) => series.metricType !== 'custom')
                                .map((series) => (_jsx(TrendCard, { series: series }, `${series.metricType}-${series.label}`))) })] }), trends.laboratory.some((series) => series.metricType === 'custom') && (_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-gray-900 mb-2", children: "Other readings" }), _jsx("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-4", children: trends.laboratory
                                .filter((series) => series.metricType === 'custom')
                                .map((series) => (_jsx(TrendCard, { series: series }, `${series.metricType}-${series.label}`))) })] }))] })) }));
}
function readingLine(reading) {
    if (!reading)
        return 'No readings yet';
    return `${reading.displayLabel} ${reading.value} ${reading.unit}`.trim();
}
export function MonitoringSummary({ patientId, onOpen }) {
    const [summary, setSummary] = useState(null);
    const [error, setError] = useState('');
    useEffect(() => {
        let cancelled = false;
        clinicalApi
            .monitoring(patientId)
            .dashboard()
            .then((data) => {
            if (!cancelled) {
                setSummary(data);
                setError('');
            }
        })
            .catch((err) => {
            if (!cancelled)
                setError(messageOf(err));
        });
        return () => {
            cancelled = true;
        };
    }, [patientId]);
    return (_jsxs(Panel, { title: "Monitoring", subtitle: "Active programs, recalls, and recent abnormal values", children: [error && (_jsx("div", { className: "mb-3 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm", children: error })), !summary ? (_jsx("p", { className: "text-sm text-gray-500", children: "Loading monitoring..." })) : (_jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-5", children: [_jsxs("section", { children: [_jsxs("h3", { className: "text-sm font-medium text-gray-900 mb-2", children: ["Active programs", summary.counts.activePrograms ? ` (${summary.counts.activePrograms})` : ''] }), summary.activePrograms.length === 0 ? (_jsx("p", { className: "text-sm text-gray-500", children: "No active monitoring programs." })) : (_jsx("ul", { className: "space-y-2", children: summary.activePrograms.map((program) => (_jsxs("li", { className: "text-sm", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("span", { className: "font-medium text-gray-900", children: program.title }), _jsx(StatusBadge, { value: program.status })] }), _jsxs("div", { className: "text-gray-600", children: [program.diagnosisLabel || 'No linked diagnosis', program.owner ? ` · ${program.owner}` : '', ' · ', readingLine(program.latestMetric), program.latestMetric?.abnormal ? ' · Abnormal' : ''] })] }, program._id))) }))] }), _jsxs("section", { children: [_jsxs("h3", { className: "text-sm font-medium text-gray-900 mb-2", children: ["Overdue recalls", summary.counts.overdueRecalls ? ` (${summary.counts.overdueRecalls})` : ''] }), summary.overdueRecalls.length === 0 ? (_jsx("p", { className: "text-sm text-gray-500", children: "No overdue recalls." })) : (_jsx("ul", { className: "space-y-2", children: summary.overdueRecalls.map((recall) => (_jsxs("li", { className: "text-sm", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("span", { className: "font-medium text-gray-900", children: recall.reason }), _jsx(StatusBadge, { value: recall.status })] }), _jsxs("div", { className: "text-gray-600", children: ["Due ", day(recall.dueDate), recall.assignedProvider ? ` · ${recall.assignedProvider}` : ''] })] }, recall._id))) }))] }), _jsxs("section", { children: [_jsx("h3", { className: "text-sm font-medium text-gray-900 mb-2", children: "Upcoming recalls" }), summary.upcomingRecalls.length === 0 ? (_jsx("p", { className: "text-sm text-gray-500", children: "No recalls due in the next 90 days." })) : (_jsx("ul", { className: "space-y-2", children: summary.upcomingRecalls.map((recall) => (_jsxs("li", { className: "text-sm", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("span", { className: "font-medium text-gray-900", children: recall.reason }), _jsx(StatusBadge, { value: recall.status })] }), _jsxs("div", { className: "text-gray-600", children: ["Due ", day(recall.dueDate), recall.assignedProvider ? ` · ${recall.assignedProvider}` : ''] })] }, recall._id))) }))] }), _jsxs("section", { children: [_jsx("h3", { className: "text-sm font-medium text-gray-900 mb-2", children: "Recent abnormal values" }), _jsx("p", { className: "text-xs text-gray-500 mb-2", children: "Blood pressure outside 90\u2013139 / 60\u201389, A1C 7% or higher, LDL 3.5 mmol/L or higher, eGFR below 60, BMI below 18.5 or 30 or higher." }), summary.recentAbnormal.length === 0 ? (_jsx("p", { className: "text-sm text-gray-500", children: "No recent abnormal values." })) : (_jsx("ul", { className: "space-y-2", children: summary.recentAbnormal.map((reading) => (_jsxs("li", { className: "text-sm", children: [_jsxs("div", { className: "font-medium text-red-700", children: [reading.displayLabel, " ", reading.value, " ", reading.unit] }), _jsxs("div", { className: "text-gray-600", children: [reading.programTitle, " \u00B7 ", day(reading.recordedAt), " \u00B7 ", sourceLabel(reading.source)] })] }, reading._id))) }))] })] })), onOpen && (_jsx("button", { type: "button", className: `${btnText} mt-4`, onClick: onOpen, children: "Open monitoring" }))] }));
}
function LinkFields({ options, diagnosisId, carePlanId, onDiagnosis, onCarePlan, }) {
    return (_jsxs(_Fragment, { children: [_jsx(Field, { label: "Diagnosis", children: _jsxs("select", { className: inputCls, value: diagnosisId, onChange: (event) => onDiagnosis(event.target.value), children: [_jsx("option", { value: "", children: "None" }), _jsx("optgroup", { label: "Problems", children: (options?.problems || []).map((problem) => (_jsxs("option", { value: problem._id, children: [problem.display, problem.code ? ` · ${problem.code}` : ''] }, problem._id))) }), _jsx("optgroup", { label: "Encounter diagnoses", children: (options?.diagnoses || []).map((diagnosis) => (_jsxs("option", { value: diagnosis._id, children: [diagnosis.code, " \u00B7 ", diagnosis.description] }, diagnosis._id))) })] }) }), _jsx(Field, { label: "Care plan", children: _jsxs("select", { className: inputCls, value: carePlanId, onChange: (event) => onCarePlan(event.target.value), children: [_jsx("option", { value: "", children: "None" }), (options?.carePlans || []).map((plan) => (_jsx("option", { value: plan._id, children: plan.title }, plan._id)))] }) })] }));
}
function EnrollForm({ options, actorId, busy, onCancel, onSubmit, }) {
    const clinicianDefault = (options?.clinicians || []).some((person) => person._id === actorId)
        ? actorId || ''
        : options?.clinicians[0]?._id || '';
    const [programType, setProgramType] = useState('hypertension');
    const [name, setName] = useState('');
    const [status, setStatus] = useState('active');
    const [enrolledDate, setEnrolledDate] = useState(todayInput());
    const [ownerClinicianId, setOwner] = useState(clinicianDefault);
    const [diagnosisId, setDiagnosisId] = useState('');
    const [carePlanId, setCarePlanId] = useState('');
    useEffect(() => {
        if (!ownerClinicianId && clinicianDefault)
            setOwner(clinicianDefault);
    }, [clinicianDefault, ownerClinicianId]);
    async function submit(event) {
        event.preventDefault();
        await onSubmit({
            programType,
            name: name.trim() || undefined,
            status,
            enrolledDate,
            ownerClinicianId,
            diagnosisId: diagnosisId || undefined,
            carePlanId: carePlanId || undefined,
        });
    }
    return (_jsxs("form", { onSubmit: submit, className: "border border-gray-200 rounded-lg p-4 mb-4 space-y-3", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3", children: [_jsx(Field, { label: "Program", children: _jsx("select", { className: inputCls, value: programType, onChange: (event) => setProgramType(event.target.value), children: PROGRAM_TYPES.map((item) => (_jsx("option", { value: item.value, children: item.label }, item.value))) }) }), _jsx(Field, { label: programType === 'custom' ? 'Name' : 'Name (optional)', children: _jsx("input", { className: inputCls, value: name, required: programType === 'custom', onChange: (event) => setName(event.target.value) }) }), _jsx(Field, { label: "Status", children: _jsxs("select", { className: inputCls, value: status, onChange: (event) => setStatus(event.target.value), children: [_jsx("option", { value: "active", children: "Active" }), _jsx("option", { value: "on_hold", children: "On Hold" })] }) }), _jsx(Field, { label: "Enrolled", children: _jsx("input", { className: inputCls, type: "date", required: true, value: enrolledDate, onChange: (event) => setEnrolledDate(event.target.value) }) }), _jsx(Field, { label: "Owner", children: _jsxs("select", { className: inputCls, required: true, value: ownerClinicianId, onChange: (event) => setOwner(event.target.value), children: [_jsx("option", { value: "", children: "Select a clinician" }), (options?.clinicians || []).map((person) => (_jsx("option", { value: person._id, children: person.displayName }, person._id)))] }) }), _jsx(LinkFields, { options: options, diagnosisId: diagnosisId, carePlanId: carePlanId, onDiagnosis: setDiagnosisId, onCarePlan: setCarePlanId })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { className: btnPrimary, type: "submit", disabled: busy, children: "Enroll" }), _jsx("button", { className: btnGhost, type: "button", onClick: onCancel, disabled: busy, children: "Cancel" })] })] }));
}
function MetricForm({ program, caregiver, busy, initial, submitLabel, onCancel, onSubmit, }) {
    const sources = caregiver ? SOURCES.filter((item) => item.value !== 'clinic') : SOURCES;
    const startingType = initial?.metricType || defaultMetric(program.programType);
    const [metricType, setMetricType] = useState(startingType);
    const [label, setLabel] = useState(initial?.label || (program.programType === 'copd' ? 'Peak flow' : ''));
    const [value, setValue] = useState(initial?.value || '');
    const [unit, setUnit] = useState(initial?.unit || UNITS[startingType]);
    const [recordedAt, setRecordedAt] = useState(initial ? dateTimeInput(initial.recordedAt) : nowLocalInput());
    const [source, setSource] = useState(initial?.source || (caregiver ? 'home' : 'clinic'));
    const [abnormal, setAbnormal] = useState(Boolean(initial?.abnormal));
    function changeType(next) {
        setMetricType(next);
        if (!initial)
            setUnit(UNITS[next]);
    }
    async function submit(event) {
        event.preventDefault();
        const body = {
            value,
            unit,
            recordedAt,
            source,
        };
        if (!initial) {
            body.metricType = metricType;
            if (metricType === 'custom') {
                body.label = label.trim();
                body.abnormal = abnormal;
            }
        }
        else if (initial.metricType === 'custom') {
            body.label = label.trim();
            body.abnormal = abnormal;
        }
        await onSubmit(body);
    }
    return (_jsxs("form", { onSubmit: submit, className: "mt-3 border border-gray-100 rounded-lg p-3 space-y-3 bg-gray-50", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3", children: [_jsx(Field, { label: "Metric", children: _jsx("select", { className: inputCls, value: metricType, disabled: Boolean(initial), onChange: (event) => changeType(event.target.value), children: METRIC_TYPES.map((item) => (_jsx("option", { value: item.value, children: item.label }, item.value))) }) }), metricType === 'custom' && (_jsx(Field, { label: "Name", children: _jsx("input", { className: inputCls, required: true, value: label, onChange: (event) => setLabel(event.target.value) }) })), _jsx(Field, { label: "Value", children: _jsx("input", { className: inputCls, required: true, value: value, placeholder: metricType === 'blood_pressure' ? '128/82' : '', inputMode: metricType === 'blood_pressure' || metricType === 'custom' ? 'text' : 'decimal', onChange: (event) => setValue(event.target.value) }) }), _jsx(Field, { label: "Unit", children: _jsx("input", { className: inputCls, required: true, value: unit, onChange: (event) => setUnit(event.target.value) }) }), _jsx(Field, { label: "Recorded", children: _jsx("input", { className: inputCls, type: "datetime-local", required: true, value: recordedAt, onChange: (event) => setRecordedAt(event.target.value) }) }), _jsx(Field, { label: "Source", children: _jsx("select", { className: inputCls, value: source, onChange: (event) => setSource(event.target.value), children: sources.map((item) => (_jsx("option", { value: item.value, children: item.label }, item.value))) }) })] }), metricType === 'custom' && (_jsxs("label", { className: "flex items-center gap-2 text-sm text-gray-700", children: [_jsx("input", { type: "checkbox", checked: abnormal, onChange: (event) => setAbnormal(event.target.checked) }), "Flag as abnormal"] })), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { className: btnPrimary, type: "submit", disabled: busy, children: submitLabel }), _jsx("button", { className: btnGhost, type: "button", onClick: onCancel, disabled: busy, children: "Cancel" })] })] }));
}
function ProgramCard({ patientId, program, canWrite, canRecord, caregiver, busy, onRun, focused = false, focusMetricId = '', }) {
    const api = clinicalApi.monitoring(patientId);
    const [status, setStatus] = useState(program.status);
    const [completedDate, setCompletedDate] = useState(program.completedDate?.slice(0, 10) || todayInput());
    const [recording, setRecording] = useState(false);
    const [correcting, setCorrecting] = useState(null);
    const next = PROGRAM_NEXT[program.status];
    const choices = statusChoices(program.status, next, PROGRAM_STATUSES);
    const activity = [...(program.timeline || [])].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    useEffect(() => {
        setStatus(program.status);
    }, [program.status]);
    return (_jsxs("article", { id: chartRecordId('program', program._id), className: `rounded-lg border border-gray-200 p-4 ${focusedRecordClass(focused)}`, children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("h3", { className: "font-medium text-gray-900", children: program.title }), program.programType === 'custom' && _jsx(StatusBadge, { value: "custom" }), _jsx(StatusBadge, { value: program.status })] }), _jsxs("p", { className: "text-sm text-gray-600 mt-1", children: ["Enrolled ", day(program.enrolledDate), program.owner ? ` · ${program.owner}` : program.ownerClinicianId ? ` · ${providerName(program.ownerClinicianId)}` : '', program.completedDate ? ` · completed ${day(program.completedDate)}` : ''] }), _jsxs("p", { className: "text-sm text-gray-600", children: [program.diagnosisLabel || 'No linked diagnosis', program.carePlanTitle ? ` · ${program.carePlanTitle}` : ''] }), program.status === 'on_hold' && (_jsx("p", { className: "text-sm text-amber-800 mt-2", children: "The program is on hold. Readings can still be recorded." })), _jsxs("div", { className: "mt-3", children: [_jsx("h4", { className: "text-xs font-medium text-gray-500 mb-1", children: "Recent values" }), (program.recentMetrics || []).length === 0 ? (_jsx("p", { className: "text-sm text-gray-500", children: "No readings yet." })) : (_jsx("ul", { className: "space-y-1", children: (program.recentMetrics || []).map((reading) => (_jsxs("li", { id: chartRecordId('metric', reading._id), className: `flex flex-wrap items-center justify-between gap-2 text-sm ${focusedRecordClass(reading._id === focusMetricId)}`, children: [_jsxs("span", { className: reading.abnormal ? 'text-red-700 font-medium' : 'text-gray-900', children: [reading.displayLabel, " ", reading.value, " ", reading.unit, reading.abnormal ? ' · Abnormal' : '', _jsxs("span", { className: "text-gray-500 font-normal", children: [' ', "\u00B7 ", day(reading.recordedAt), " \u00B7 ", sourceLabel(reading.source)] })] }), canRecord && !(caregiver && reading.source === 'clinic') && (_jsx("button", { type: "button", className: btnText, onClick: () => setCorrecting(reading._id), children: "Correct" })), correcting === reading._id && (_jsx("div", { className: "w-full basis-full", children: _jsx(MetricForm, { program: program, caregiver: caregiver, busy: busy, initial: reading, submitLabel: "Save correction", onCancel: () => setCorrecting(null), onSubmit: (body) => onRun(async () => {
                                            await api.updateMetric(reading._id, body);
                                            setCorrecting(null);
                                        }) }) }))] }, reading._id))) }))] }), canRecord && program.status !== 'completed' && (_jsx("div", { className: "mt-3", children: recording ? (_jsx(MetricForm, { program: program, caregiver: caregiver, busy: busy, submitLabel: "Record reading", onCancel: () => setRecording(false), onSubmit: (body) => onRun(async () => {
                        await api.recordMetric(program._id, body);
                        setRecording(false);
                    }) })) : (_jsx("button", { type: "button", className: btnGhost, onClick: () => setRecording(true), disabled: busy, children: "Record reading" })) })), canWrite && next.length > 0 && (_jsxs("form", { className: "mt-3 flex flex-wrap items-end gap-2", onSubmit: (event) => {
                    event.preventDefault();
                    if (status === program.status)
                        return;
                    void onRun(async () => {
                        await api.setProgramStatus(program._id, {
                            status,
                            completedDate: status === 'completed' ? completedDate : undefined,
                        });
                    });
                }, children: [_jsx(Field, { label: "Status", children: _jsx("select", { className: inputCls, value: status, onChange: (event) => setStatus(event.target.value), children: choices.map((item) => (_jsx("option", { value: item.value, children: item.label }, item.value))) }) }), status === 'completed' && (_jsx(Field, { label: "Completed", children: _jsx("input", { className: inputCls, type: "date", required: true, value: completedDate, onChange: (event) => setCompletedDate(event.target.value) }) })), _jsx("button", { className: btnPrimary, type: "submit", disabled: busy || status === program.status, children: "Update status" })] })), _jsx("h4", { className: "text-xs font-medium text-gray-500 mt-4 mb-2", children: "Activity" }), _jsx(ActivityList, { points: activity.slice(0, 8) })] }));
}
function RecallEditor({ recall, options, busy, onCancel, onSubmit, }) {
    const [reason, setReason] = useState(recall.reason);
    const [dueDate, setDueDate] = useState(recall.dueDate.slice(0, 10));
    const [assignedProvider, setProvider] = useState(providerId(recall.assignedProvider));
    const [diagnosisId, setDiagnosisId] = useState(recall.diagnosisId || '');
    const [carePlanId, setCarePlanId] = useState(providerId(recall.carePlanId));
    async function submit(event) {
        event.preventDefault();
        await onSubmit({
            reason,
            dueDate,
            assignedProvider,
            diagnosisId: diagnosisId || null,
            carePlanId: carePlanId || null,
        });
    }
    return (_jsxs("form", { onSubmit: submit, className: "mt-3 grid grid-cols-1 md:grid-cols-2 gap-3", children: [_jsx(Field, { label: "Reason", children: _jsx("input", { className: inputCls, required: true, value: reason, onChange: (event) => setReason(event.target.value) }) }), _jsx(Field, { label: "Due", children: _jsx("input", { className: inputCls, type: "date", required: true, value: dueDate, onChange: (event) => setDueDate(event.target.value) }) }), _jsx(Field, { label: "Assigned provider", children: _jsxs("select", { className: inputCls, required: true, value: assignedProvider, onChange: (event) => setProvider(event.target.value), children: [_jsx("option", { value: "", children: "Select a clinician" }), (options?.clinicians || []).map((person) => (_jsx("option", { value: person._id, children: person.displayName }, person._id)))] }) }), _jsx(LinkFields, { options: options, diagnosisId: diagnosisId, carePlanId: carePlanId, onDiagnosis: setDiagnosisId, onCarePlan: setCarePlanId }), _jsxs("div", { className: "flex gap-2 md:col-span-2", children: [_jsx("button", { className: btnPrimary, type: "submit", disabled: busy, children: "Save recall" }), _jsx("button", { className: btnGhost, type: "button", onClick: onCancel, disabled: busy, children: "Cancel" })] })] }));
}
export function MonitoringPanel({ patientId, canWrite, canRecord, caregiver, actorId, recordFocus = null, }) {
    const [programs, setPrograms] = useState([]);
    const [recalls, setRecalls] = useState([]);
    const [trends, setTrends] = useState(null);
    const [options, setOptions] = useState(null);
    const [programView, setProgramView] = useState(recordFocus?.tab === 'monitoring' ? 'all' : 'open');
    const [recallView, setRecallView] = useState(recordFocus?.tab === 'monitoring' ? 'all' : 'open');
    const [showEnroll, setShowEnroll] = useState(false);
    const [showRecall, setShowRecall] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    async function load() {
        const api = clinicalApi.monitoring(patientId);
        const [programPage, recallPage, trendData, optionData] = await Promise.all([
            api.programs('?limit=100'),
            api.recalls('?limit=100'),
            api.trends(),
            api.options(),
        ]);
        setPrograms(programPage.data);
        setRecalls(recallPage.data);
        setTrends(trendData);
        setOptions(optionData);
    }
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        load()
            .then(() => {
            if (!cancelled)
                setError('');
        })
            .catch((err) => {
            if (!cancelled)
                setError(messageOf(err));
        })
            .finally(() => {
            if (!cancelled)
                setLoading(false);
        });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [patientId]);
    async function run(work) {
        setBusy(true);
        setError('');
        try {
            await work();
            await load();
        }
        catch (err) {
            setError(messageOf(err));
        }
        finally {
            setBusy(false);
        }
    }
    const monitorFocus = recordFocus?.tab === 'monitoring' ? recordFocus : null;
    const monitorFocusId = monitorFocus?.scope === 'program' ? monitorFocus.recordId : monitorFocus?.fallbackId || '';
    const seenMonitorFocus = useRef(0);
    useEffect(() => {
        if (!monitorFocus || loading)
            return;
        if (seenMonitorFocus.current === monitorFocus.token)
            return;
        seenMonitorFocus.current = monitorFocus.token;
        setProgramView('all');
        setRecallView('all');
        return watchChartRecord(monitorFocus.scope, monitorFocus.recordId, monitorFocus.scope === 'metric' ? 'program' : undefined, monitorFocus.fallbackId);
    }, [monitorFocus, loading]);
    const visiblePrograms = programs.filter((program) => {
        if (programView === 'all')
            return true;
        if (programView === 'open')
            return program.status === 'active' || program.status === 'on_hold';
        return program.status === programView;
    });
    const visibleRecalls = recalls
        .filter((recall) => {
        if (recallView === 'all')
            return true;
        if (recallView === 'open')
            return recall.status === 'due' || recall.status === 'scheduled' || recall.status === 'overdue';
        if (recallView === 'upcoming')
            return recall.status === 'due' || recall.status === 'scheduled';
        return recall.status === recallView;
    })
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    const activity = [...programs.flatMap((program) => program.timeline || []), ...recalls.flatMap((recall) => recall.timeline || [])]
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
        .slice(0, 20);
    return (_jsxs("div", { className: "space-y-6", children: [error && (_jsx("div", { className: "bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm", children: error })), _jsx(TrendBoard, { trends: trends }), _jsxs(Panel, { title: "Monitoring programs", subtitle: "Hypertension, diabetes, COPD, heart failure, CKD, and custom follow-up", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3 mb-4", children: [_jsxs("select", { className: inputCls + ' max-w-xs', value: programView, onChange: (event) => setProgramView(event.target.value), children: [_jsx("option", { value: "open", children: "Open" }), _jsx("option", { value: "active", children: "Active" }), _jsx("option", { value: "on_hold", children: "On Hold" }), _jsx("option", { value: "completed", children: "Completed" }), _jsx("option", { value: "all", children: "All" })] }), canWrite && (_jsx("button", { type: "button", className: btnPrimary, onClick: () => setShowEnroll((open) => !open), disabled: busy, children: showEnroll ? 'Close enrollment' : 'Enroll patient' }))] }), showEnroll && canWrite && (_jsx(EnrollForm, { options: options, actorId: actorId, busy: busy, onCancel: () => setShowEnroll(false), onSubmit: async (body) => {
                            await run(async () => {
                                await clinicalApi.monitoring(patientId).createProgram(body);
                                setShowEnroll(false);
                            });
                        } })), loading ? (_jsx("p", { className: "text-sm text-gray-500", children: "Loading programs..." })) : visiblePrograms.length === 0 ? (_jsx("p", { className: "text-sm text-gray-500", children: "No monitoring programs in this view." })) : (_jsx("div", { className: "space-y-4", children: visiblePrograms.map((program) => (_jsx(ProgramCard, { patientId: patientId, program: program, canWrite: canWrite, canRecord: canRecord, caregiver: caregiver, busy: busy, onRun: run, focused: program._id === monitorFocusId, focusMetricId: recordFocus?.scope === 'metric' ? recordFocus.recordId : '' }, program._id))) }))] }), _jsx(RecallSection, { patientId: patientId, recalls: visibleRecalls, options: options, actorId: actorId, canWrite: canWrite, busy: busy, loading: loading, view: recallView, showForm: showRecall, onView: setRecallView, onToggleForm: () => setShowRecall((open) => !open), onCloseForm: () => setShowRecall(false), onRun: run, focusId: monitorFocus?.scope === 'recall' ? monitorFocus.recordId : '' }), _jsx(Panel, { title: "Monitoring activity", subtitle: "Enrollment, readings, recalls, and completed programs", children: _jsx(ActivityList, { points: activity }) })] }));
}
function RecallSection({ patientId, recalls, options, actorId, canWrite, busy, loading, view, showForm, onView, onToggleForm, onCloseForm, onRun, focusId = '', }) {
    const clinicianDefault = (options?.clinicians || []).some((person) => person._id === actorId)
        ? actorId || ''
        : options?.clinicians[0]?._id || '';
    const [reason, setReason] = useState(RECALL_REASONS[0]);
    const [dueDate, setDueDate] = useState(todayInput());
    const [assignedProvider, setProvider] = useState(clinicianDefault);
    const [status, setStatus] = useState('due');
    const [diagnosisId, setDiagnosisId] = useState('');
    const [carePlanId, setCarePlanId] = useState('');
    useEffect(() => {
        if (!assignedProvider && clinicianDefault)
            setProvider(clinicianDefault);
    }, [assignedProvider, clinicianDefault]);
    return (_jsxs(Panel, { title: "Recalls", subtitle: "Repeat labs, follow-up visits, annual review, and medication review", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3 mb-4", children: [_jsxs("select", { className: inputCls + ' max-w-xs', value: view, onChange: (event) => onView(event.target.value), children: [_jsx("option", { value: "open", children: "Open" }), _jsx("option", { value: "overdue", children: "Overdue" }), _jsx("option", { value: "upcoming", children: "Upcoming" }), _jsx("option", { value: "completed", children: "Completed" }), _jsx("option", { value: "all", children: "All" })] }), canWrite && (_jsx("button", { type: "button", className: btnPrimary, onClick: onToggleForm, disabled: busy, children: showForm ? 'Close recall' : 'Add recall' }))] }), showForm && canWrite && (_jsxs("form", { className: "border border-gray-200 rounded-lg p-4 mb-4 space-y-3", onSubmit: (event) => {
                    event.preventDefault();
                    void onRun(async () => {
                        await clinicalApi.monitoring(patientId).createRecall({
                            reason,
                            dueDate,
                            assignedProvider,
                            status,
                            diagnosisId: diagnosisId || undefined,
                            carePlanId: carePlanId || undefined,
                        });
                        onCloseForm();
                    });
                }, children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3", children: [_jsxs(Field, { label: "Reason", children: [_jsx("input", { className: inputCls, required: true, list: "recall-reasons", value: reason, onChange: (event) => setReason(event.target.value) }), _jsx("datalist", { id: "recall-reasons", children: RECALL_REASONS.map((item) => (_jsx("option", { value: item }, item))) })] }), _jsx(Field, { label: "Due", children: _jsx("input", { className: inputCls, type: "date", required: true, value: dueDate, onChange: (event) => setDueDate(event.target.value) }) }), _jsx(Field, { label: "Assigned provider", children: _jsxs("select", { className: inputCls, required: true, value: assignedProvider, onChange: (event) => setProvider(event.target.value), children: [_jsx("option", { value: "", children: "Select a clinician" }), (options?.clinicians || []).map((person) => (_jsx("option", { value: person._id, children: person.displayName }, person._id)))] }) }), _jsx(Field, { label: "Status", children: _jsxs("select", { className: inputCls, value: status, onChange: (event) => setStatus(event.target.value), children: [_jsx("option", { value: "due", children: "Due" }), _jsx("option", { value: "scheduled", children: "Scheduled" })] }) }), _jsx(LinkFields, { options: options, diagnosisId: diagnosisId, carePlanId: carePlanId, onDiagnosis: setDiagnosisId, onCarePlan: setCarePlanId })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { className: btnPrimary, type: "submit", disabled: busy, children: "Create recall" }), _jsx("button", { className: btnGhost, type: "button", onClick: onCloseForm, disabled: busy, children: "Cancel" })] })] })), loading ? (_jsx("p", { className: "text-sm text-gray-500", children: "Loading recalls..." })) : recalls.length === 0 ? (_jsx("p", { className: "text-sm text-gray-500", children: "No recalls in this view." })) : (_jsx("div", { className: "space-y-3", children: recalls.map((recall) => (_jsx(RecallCard, { patientId: patientId, recall: recall, options: options, canWrite: canWrite, busy: busy, onRun: onRun, focused: recall._id === focusId }, recall._id))) }))] }));
}
function RecallCard({ patientId, recall, options, canWrite, busy, onRun, focused = false, }) {
    const next = RECALL_NEXT[recall.status];
    const [status, setStatus] = useState(next[0] || 'completed');
    const [dueDate, setDueDate] = useState(() => {
        const current = recall.dueDate.slice(0, 10);
        return current < todayInput() ? todayInput() : current;
    });
    const [editing, setEditing] = useState(false);
    const open = recall.status !== 'completed' && recall.status !== 'cancelled';
    return (_jsxs("article", { id: chartRecordId('recall', recall._id), className: `rounded-lg border border-gray-200 p-4 ${focusedRecordClass(focused)}`, children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("h3", { className: "font-medium text-gray-900", children: recall.reason }), _jsx(StatusBadge, { value: recall.status })] }), _jsxs("p", { className: "text-sm text-gray-600 mt-1", children: ["Due ", day(recall.dueDate), recall.assignedProviderName ? ` · ${recall.assignedProviderName}` : '', recall.completedAt ? ` · completed ${day(recall.completedAt)}` : ''] }), _jsxs("p", { className: "text-sm text-gray-600", children: [recall.diagnosisLabel || 'No linked diagnosis', recall.carePlanTitle ? ` · ${recall.carePlanTitle}` : ''] }), canWrite && open && (_jsx("div", { className: "mt-3 flex flex-wrap gap-2", children: _jsx("button", { type: "button", className: btnText, onClick: () => setEditing((openEdit) => !openEdit), children: editing ? 'Close edit' : 'Edit' }) })), editing && (_jsx(RecallEditor, { recall: recall, options: options, busy: busy, onCancel: () => setEditing(false), onSubmit: (body) => onRun(async () => {
                    await clinicalApi.monitoring(patientId).updateRecall(recall._id, body);
                    setEditing(false);
                }) })), canWrite && next.length > 0 && (_jsxs("form", { className: "mt-3 flex flex-wrap items-end gap-2", onSubmit: (event) => {
                    event.preventDefault();
                    void onRun(async () => {
                        await clinicalApi.monitoring(patientId).setRecallStatus(recall._id, {
                            status,
                            dueDate: status === 'due' || status === 'scheduled' ? dueDate : undefined,
                        });
                    });
                }, children: [_jsx(Field, { label: "Move to", children: _jsx("select", { className: inputCls, value: status, onChange: (event) => setStatus(event.target.value), children: RECALL_STATUSES.filter((item) => next.includes(item.value)).map((item) => (_jsx("option", { value: item.value, children: item.label }, item.value))) }) }), (status === 'due' || status === 'scheduled') && (_jsx(Field, { label: "Due date", children: _jsx("input", { className: inputCls, type: "date", required: true, value: dueDate, onChange: (event) => setDueDate(event.target.value) }) })), _jsx("button", { className: btnPrimary, type: "submit", disabled: busy, children: "Update recall" })] }))] }));
}
