import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from 'react-router-dom';
import { StatusBadge } from '../StatusBadge';
import { formatClock, providerLabel, typeLabel } from '../appointmentDisplay';
import { flowStatus, waitedLabel } from '../visitDisplay';
import { chartLink } from './chartLink';
import { Bone, EmptyBlock, SectionCard } from './ui';
const STATUS_BAR = {
    booked: 'bg-blue-500',
    confirmed: 'bg-teal-600',
    arrived: 'bg-emerald-500',
    completed: 'bg-slate-400',
    cancelled: 'bg-rose-500',
    no_show: 'bg-amber-500',
};
const LEGEND = [
    { status: 'booked', label: 'Booked', bar: 'bg-blue-500' },
    { status: 'confirmed', label: 'Confirmed', bar: 'bg-teal-600' },
    { status: 'arrived', label: 'Arrived', bar: 'bg-emerald-500' },
    { status: 'completed', label: 'Completed', bar: 'bg-slate-400' },
    { status: 'cancelled', label: 'Cancelled', bar: 'bg-rose-500' },
    { status: 'no_show', label: 'No-show', bar: 'bg-amber-500' },
];
function patientName(row) {
    const patient = row.appointment.patientId;
    if (!patient || typeof patient !== 'object')
        return 'Patient';
    return `${patient.familyName}, ${patient.givenName}`;
}
function patientId(row) {
    const patient = row.appointment.patientId;
    if (!patient || typeof patient !== 'object')
        return '';
    return patient._id;
}
export default function SchedulePanel({ rows, ready }) {
    return (_jsxs(SectionCard, { id: "todays-schedule", title: "Today\u2019s schedule", subtitle: "Every appointment on today\u2019s board. Open the chart without leaving the day.", action: _jsx(Link, { to: "/schedule", className: "text-sm font-medium text-clinical-teal hover:underline", children: "Provider schedule" }), children: [_jsx("ul", { className: "mb-4 flex flex-wrap gap-x-4 gap-y-2", "aria-label": "Appointment status colors", children: LEGEND.map((item) => (_jsxs("li", { className: "inline-flex items-center gap-2 text-xs font-medium text-slate-600", children: [_jsx("span", { className: `h-2.5 w-2.5 rounded-full ${item.bar}`, "aria-hidden": true }), item.label] }, item.status))) }), !ready && (_jsxs("div", { className: "space-y-2", "aria-busy": "true", children: [_jsx("span", { className: "sr-only", children: "Loading today\u2019s schedule" }), Array.from({ length: 4 }, (_, index) => (_jsx(Bone, { className: "h-16 w-full" }, index)))] })), ready && rows.length === 0 && (_jsx(EmptyBlock, { title: "No appointments today", body: "The clinic day is clear. Book a visit from the schedule, or check another date on the provider calendar." })), ready && rows.length > 0 && (_jsx("ul", { className: "divide-y divide-slate-100", children: rows.map((row) => {
                    const id = patientId(row);
                    const status = row.appointment.status;
                    const flow = flowStatus(row);
                    const floorLabel = flow === 'waiting' ? 'Waiting' : flow === 'roomed' ? 'Roomed' : flow === 'in_progress' ? 'In progress' : '';
                    const wait = waitedLabel(row.visit?.arrivalAt);
                    const meta = [
                        providerLabel(row.appointment.providerId),
                        typeLabel(row.appointment.appointmentType),
                        row.appointment.clinicLocation,
                        row.visit?.examRoom || '',
                        floorLabel,
                        wait,
                    ].filter(Boolean);
                    const muted = status === 'cancelled' || status === 'no_show';
                    return (_jsxs("li", { className: `flex items-center gap-3 py-3 ${muted ? 'opacity-70' : ''}`, children: [_jsx("span", { className: `h-12 w-1 shrink-0 rounded-full ${STATUS_BAR[status] ?? 'bg-slate-300'}`, "aria-hidden": true }), _jsx("div", { className: "w-16 shrink-0 text-sm font-semibold tabular-nums text-slate-900", children: formatClock(row.appointment.startTime) }), _jsxs("div", { className: "min-w-0 flex-1", children: [id ? (_jsx(Link, { to: chartLink(id), className: "block truncate text-sm font-semibold text-slate-950 hover:text-teal-800 hover:underline", children: patientName(row) })) : (_jsx("p", { className: "truncate text-sm font-semibold text-slate-950", children: patientName(row) })), _jsx("p", { className: "truncate text-xs text-slate-500", children: meta.join(' · ') })] }), _jsx(StatusBadge, { value: status }), id && (_jsx(Link, { to: chartLink(id), className: "hidden shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-teal-200 hover:text-teal-800 sm:inline-flex", children: "Open chart" }))] }, row.appointment._id));
                }) }))] }));
}
