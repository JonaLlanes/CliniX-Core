import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { chartLink } from '../dashboard/chartLink';
import { StatusBadge } from '../StatusBadge';
import { formatClock, patientLabel, providerLabel, typeLabel, } from '../appointmentDisplay';
import { flowStatus } from '../visitDisplay';
import { durationLabel, formatDuration, toneWord, visitClock, } from './timing';
const TONE_CLASS = {
    green: 'bg-emerald-50 text-emerald-950 ring-emerald-200',
    yellow: 'bg-amber-50 text-amber-950 ring-amber-200',
    red: 'bg-rose-50 text-rose-950 ring-rose-200',
    none: 'bg-slate-50 text-slate-600 ring-slate-200',
};
const linkCls = 'inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center text-xs font-medium leading-tight text-slate-700 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600';
function DurationStat({ label, minutes, tone, empty, }) {
    const word = toneWord(tone);
    return (_jsxs("div", { className: `rounded-lg px-2 py-1.5 ring-1 ${TONE_CLASS[tone]}`, "aria-label": durationLabel(label, minutes, tone, empty), children: [_jsx("p", { className: "text-[10px] font-semibold uppercase tracking-wide", "aria-hidden": true, children: label }), _jsx("p", { className: "text-sm font-semibold tabular-nums", "aria-hidden": true, children: formatDuration(minutes) }), word && (_jsx("p", { className: "text-[10px] font-medium", "aria-hidden": true, children: word }))] }));
}
function nameList(names, noun) {
    if (names.length === 0)
        return noun;
    const shown = names.slice(0, 3).join(', ');
    const extra = names.length > 3 ? `, and ${names.length - 3} more` : '';
    return `${noun}: ${shown}${extra}`;
}
export default function PatientCard({ row, now, date, selected, rooms, canOperate, flags, pending, onSelect, onApply, onCheckIn, }) {
    const appointment = row.appointment;
    const patient = appointment.patientId;
    const status = flowStatus(row);
    const clock = visitClock(row, now);
    const name = patientLabel(patient);
    const nameId = useId();
    const panelId = useId();
    const hintId = useId();
    const roomFieldId = useId();
    const [open, setOpen] = useState(false);
    const [room, setRoom] = useState(rooms[0] || '');
    const panelRef = useRef(null);
    const toggleRef = useRef(null);
    useEffect(() => {
        setOpen(false);
    }, [status]);
    useEffect(() => {
        setRoom((current) => (rooms.includes(current) ? current : rooms[0] || ''));
    }, [rooms]);
    useEffect(() => {
        if (!open)
            return;
        const node = panelRef.current?.querySelector('select, button');
        node?.focus();
        function onKey(event) {
            if (event.key === 'Escape') {
                setOpen(false);
                toggleRef.current?.focus();
            }
        }
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open]);
    const terminal = status === 'completed' || status === 'no_show' || status === 'cancelled';
    const scheduled = status === 'booked' || status === 'confirmed';
    const alertBorder = clock.waitTone === 'red' || clock.roomedTone === 'red'
        ? 'border-rose-300'
        : clock.waitTone === 'yellow' || clock.roomedTone === 'yellow'
            ? 'border-amber-300'
            : 'border-slate-200';
    const scheduleHref = `/schedule?${new URLSearchParams({
        patientId: patient._id,
        providerId: appointment.providerId._id,
        appointmentId: appointment._id,
        date,
    }).toString()}`;
    function apply(action) {
        onApply(action);
    }
    return (_jsxs("article", { "aria-labelledby": nameId, className: `rounded-2xl border bg-white p-3 shadow-sm ${selected ? 'border-teal-600 ring-2 ring-teal-600' : alertBorder}`, children: [_jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsxs("button", { type: "button", onClick: onSelect, "aria-pressed": selected, className: "min-w-0 flex-1 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600", children: [_jsx("h3", { id: nameId, className: "truncate text-sm font-semibold text-slate-950", title: name, children: name }), _jsxs("p", { className: "mt-0.5 font-mono text-xs text-slate-500", children: ["MRN ", patient.mrn] })] }), _jsx(StatusBadge, { value: status })] }), _jsxs("dl", { className: "mt-3 space-y-1 text-xs text-slate-600", children: [_jsxs("div", { className: "flex justify-between gap-3", children: [_jsx("dt", { className: "text-slate-500", children: "Appointment" }), _jsxs("dd", { className: "text-right font-medium text-slate-800", children: [formatClock(appointment.startTime), "\u2013", formatClock(appointment.endTime)] })] }), _jsxs("div", { className: "flex justify-between gap-3", children: [_jsx("dt", { className: "text-slate-500", children: "Visit type" }), _jsx("dd", { className: "text-right font-medium text-slate-800", children: typeLabel(appointment.appointmentType) })] }), _jsxs("div", { className: "flex justify-between gap-3", children: [_jsx("dt", { className: "text-slate-500", children: "Provider" }), _jsx("dd", { className: "truncate text-right font-medium text-slate-800", title: providerLabel(appointment.providerId), children: providerLabel(appointment.providerId) })] }), _jsxs("div", { className: "flex justify-between gap-3", children: [_jsx("dt", { className: "text-slate-500", children: "Clinic" }), _jsx("dd", { className: "text-right font-medium text-slate-800", children: appointment.clinicLocation })] }), row.visit?.examRoom && (_jsxs("div", { className: "flex justify-between gap-3", children: [_jsx("dt", { className: "text-slate-500", children: "Room" }), _jsx("dd", { className: "text-right font-medium text-slate-800", children: row.visit.examRoom })] }))] }), _jsx("div", { className: "mt-3 flex min-h-5 flex-wrap gap-1.5", children: flags === undefined ? (_jsxs(_Fragment, { children: [_jsx("span", { className: "h-5 w-16 animate-pulse rounded-full bg-slate-200 motion-reduce:animate-none" }), _jsx("span", { className: "sr-only", children: "Loading clinical alerts" })] })) : (_jsxs(_Fragment, { children: [flags.severeNames.length > 0 && (_jsxs("span", { className: "rounded-full bg-red-700 px-2 py-0.5 text-[11px] font-semibold text-white", title: flags.severeNames.join(', '), children: [flags.severeNames.length === 1 ? 'Severe allergy' : `Severe allergy · ${flags.severeNames.length}`, _jsxs("span", { className: "sr-only", children: [". ", nameList(flags.severeNames, 'Substances')] })] })), flags.allergyNames.length > 0 && (_jsxs("span", { className: "rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-950", title: flags.allergyNames.join(', '), children: [flags.allergyNames.length === 1 ? 'Allergy warning' : `Allergy warning · ${flags.allergyNames.length}`, _jsxs("span", { className: "sr-only", children: [". ", nameList(flags.allergyNames, 'Substances')] })] })), flags.criticalResults > 0 && (_jsx("span", { className: "rounded-full bg-red-700 px-2 py-0.5 text-[11px] font-semibold text-white", children: flags.criticalResults === 1 ? 'Critical result' : `Critical result · ${flags.criticalResults}` })), flags.abnormalResults > 0 && (_jsx("span", { className: "rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-950", children: flags.abnormalResults === 1 ? 'Abnormal result' : `Abnormal result · ${flags.abnormalResults}` })), flags.highAlertNames.length > 0 && (_jsxs("span", { className: "rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-950", title: flags.highAlertNames.join(', '), children: [flags.highAlertNames.length === 1
                                    ? 'High-alert medication'
                                    : `High-alert medication · ${flags.highAlertNames.length}`, _jsxs("span", { className: "sr-only", children: [". ", nameList(flags.highAlertNames, 'Medications')] })] })), flags.overdueRecalls > 0 && (_jsx("span", { className: "rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-950", children: flags.overdueRecalls === 1 ? 'Overdue recall' : `Overdue recall · ${flags.overdueRecalls}` })), flags.incomplete && (_jsx("span", { className: "rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700", children: "Alerts incomplete" })), !flags.incomplete &&
                            flags.allergyNames.length === 0 &&
                            flags.severeNames.length === 0 &&
                            flags.highAlertNames.length === 0 &&
                            flags.criticalResults === 0 &&
                            flags.abnormalResults === 0 &&
                            flags.overdueRecalls === 0 && (_jsx("span", { className: "sr-only", children: "No allergy, critical result, high-alert medication, or overdue recall on file." }))] })) }), _jsxs("div", { className: "mt-3 grid grid-cols-3 gap-1.5", children: [_jsx(DurationStat, { label: "Current wait", minutes: clock.waitMinutes, tone: clock.waitTone, empty: "not started" }), _jsx(DurationStat, { label: "Roomed", minutes: clock.roomedMinutes, tone: clock.roomedTone, empty: "not roomed" }), _jsx(DurationStat, { label: "Clinic time", minutes: clock.clinicMinutes, tone: clock.clinicTone, empty: "not started" })] }), _jsxs("div", { className: "mt-3 grid grid-cols-2 gap-1.5", role: "group", "aria-label": `Actions for ${name}`, children: [_jsx(Link, { to: chartLink(patient._id), className: linkCls, children: "Open chart" }), _jsx(Link, { to: chartLink(patient._id, 'encounters'), className: linkCls, children: "Open encounter" }), _jsx(Link, { to: scheduleHref, className: linkCls, children: "Open appointment" }), terminal || !canOperate ? (_jsx("button", { type: "button", className: `${linkCls} disabled:cursor-not-allowed disabled:opacity-50`, disabled: true, "aria-describedby": hintId, title: terminal ? 'No further status change' : 'Available to clinicians, nurses, and administrators', children: "Change status" })) : (_jsx("button", { ref: toggleRef, type: "button", className: `${linkCls} border-teal-700 bg-teal-700 text-white hover:border-teal-800 hover:bg-teal-800 hover:text-white`, "aria-expanded": open, "aria-controls": panelId, disabled: pending, onClick: () => setOpen((current) => !current), children: pending ? 'Updating…' : 'Change status' }))] }), _jsx("p", { id: hintId, className: "sr-only", children: terminal
                    ? 'This visit has no further status change.'
                    : !canOperate
                        ? 'Status changes are available to clinicians, nurses, and administrators.'
                        : '' }), open && canOperate && (_jsxs("div", { id: panelId, ref: panelRef, className: "mt-2 rounded-xl border border-slate-200 bg-slate-50 p-2", children: [scheduled && (_jsxs("div", { className: "space-y-2", children: [_jsx("p", { className: "text-xs leading-relaxed text-slate-600", children: "Check-in reviews demographics and the health card, then marks the patient arrived." }), _jsx("button", { type: "button", className: `${linkCls} w-full bg-white`, onClick: () => {
                                    setOpen(false);
                                    onCheckIn();
                                }, children: "Check in" })] })), status === 'arrived' && (_jsx("button", { type: "button", className: `${linkCls} w-full bg-white`, disabled: pending, onClick: () => apply({ type: 'status', status: 'waiting' }), children: "Send to waiting room" })), status === 'waiting' && (_jsxs("form", { className: "space-y-2", onSubmit: (event) => {
                            event.preventDefault();
                            if (room)
                                apply({ type: 'room', examRoom: room });
                        }, children: [_jsx("label", { className: "block text-xs font-medium text-slate-700", htmlFor: roomFieldId, children: "Exam room" }), rooms.length === 0 ? (_jsx("p", { className: "text-xs text-amber-900", children: "No exam rooms are configured for this clinic." })) : (_jsx("select", { id: roomFieldId, value: room, onChange: (event) => setRoom(event.target.value), className: "w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm", children: rooms.map((item) => (_jsx("option", { value: item, children: item }, item))) })), _jsx("button", { type: "submit", className: `${linkCls} w-full bg-white`, disabled: pending || !room, children: "Assign room" })] })), status === 'roomed' && (_jsxs("div", { className: "space-y-1.5", children: [_jsx("button", { type: "button", className: `${linkCls} w-full bg-white`, disabled: pending, onClick: () => apply({ type: 'status', status: 'in_progress' }), children: "Start visit" }), _jsx("button", { type: "button", className: `${linkCls} w-full bg-white`, disabled: pending, onClick: () => apply({ type: 'status', status: 'waiting' }), children: "Return to waiting room" })] })), status === 'in_progress' && (_jsx("button", { type: "button", className: `${linkCls} w-full bg-white`, disabled: pending, onClick: () => apply({ type: 'status', status: 'completed' }), children: "Complete visit" }))] }))] }));
}
