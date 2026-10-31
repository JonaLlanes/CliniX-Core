import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { visitsApi } from '../api/client';
import { StatusBadge } from './StatusBadge';
import { formatAddress } from './canadianRegistration';
import { formatAppointmentWhen, formatClock, patientLabel, providerLabel, typeLabel, } from './appointmentDisplay';
import { flowStatus, formatDob, healthCardLabel, } from './visitDisplay';
import { EncounterVisitSection } from './EncounterPanels';
const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm';
const labelCls = 'block text-xs font-medium text-gray-600 mb-1';
const btnPrimary = 'px-4 py-2 bg-clinical-teal text-white rounded-lg text-sm hover:bg-clinical-teal-dark disabled:opacity-50';
const btnGhost = 'px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50';
const LANGUAGE = {
    en: 'English',
    fr: 'French',
    other: 'Other',
};
function Field({ label, value }) {
    return (_jsxs("div", { children: [_jsx("div", { className: "text-xs text-gray-500", children: label }), _jsx("div", { className: "text-sm text-gray-900", children: value || '—' })] }));
}
export default function VisitWorkbench({ row, rooms, canOperate, canLaunchEncounter, onUpdated, }) {
    const navigate = useNavigate();
    const appointment = row.appointment;
    const patient = appointment.patientId;
    const visit = row.visit;
    const status = flowStatus(row);
    const card = healthCardLabel(patient);
    const address = formatAddress(patient.address) || patient.contact?.address || '';
    const [demographicsChecked, setDemographicsChecked] = useState(false);
    const [healthCardChecked, setHealthCardChecked] = useState(false);
    const [note, setNote] = useState('');
    const [reason, setReason] = useState('');
    const [room, setRoom] = useState(visit?.examRoom || rooms[0] || '');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        setDemographicsChecked(false);
        setHealthCardChecked(false);
        setNote('');
        setReason('');
        setRoom(visit?.examRoom || rooms[0] || '');
        setError('');
    }, [appointment._id, visit?.status, visit?.examRoom, rooms]);
    const needsCheckIn = status === 'booked' ||
        status === 'confirmed' ||
        (status === 'arrived' && (!visit || !visit.demographicsVerified || !visit.healthCardVerified));
    const roomable = !!visit &&
        !needsCheckIn &&
        ['arrived', 'waiting', 'roomed', 'in_progress'].includes(status);
    const canNoShow = status === 'confirmed' || status === 'arrived' || status === 'waiting';
    const canCancel = ['booked', 'confirmed', 'arrived', 'waiting', 'roomed', 'in_progress'].includes(status);
    async function run(action) {
        setSaving(true);
        setError('');
        try {
            await action();
            await onUpdated();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Request failed');
        }
        finally {
            setSaving(false);
        }
    }
    function onCheckIn(event) {
        event.preventDefault();
        void run(() => visitsApi.checkIn({
            appointmentId: appointment._id,
            demographicsVerified: true,
            healthCardVerified: true,
            note: note.trim() || undefined,
        }).then(() => undefined));
    }
    function changeStatus(next) {
        void run(() => visitsApi
            .setStatus({
            appointmentId: appointment._id,
            status: next,
            reason: reason.trim() || undefined,
            note: note.trim() || undefined,
        })
            .then(() => undefined));
    }
    function onAssignRoom(event) {
        event.preventDefault();
        void run(() => visitsApi.assignRoom({ appointmentId: appointment._id, examRoom: room }).then(() => undefined));
    }
    async function startVisit() {
        setSaving(true);
        setError('');
        try {
            await visitsApi.setStatus({ appointmentId: appointment._id, status: 'in_progress' });
            navigate(`/patients/${patient._id}`);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Could not start the visit');
            setSaving(false);
        }
    }
    return (_jsxs("section", { id: "visit-detail", className: "bg-white rounded-lg border border-gray-200 p-5 space-y-5", children: [_jsxs("div", { className: "flex flex-wrap items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-lg font-semibold text-gray-900", children: patientLabel(patient) }), _jsxs("p", { className: "text-sm text-gray-600 mt-1", children: [patient.mrn, " \u00B7 ", formatAppointmentWhen(appointment.startTime, appointment.endTime)] })] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx(StatusBadge, { value: status }), _jsx(Link, { to: `/patients/${patient._id}`, className: "text-sm text-clinical-teal hover:underline", children: "Open chart" })] })] }), error && (_jsx("div", { className: "bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm", children: error })), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-4", children: [_jsxs("div", { className: "rounded-lg border border-gray-200 p-4 space-y-3", children: [_jsx("h3", { className: "text-sm font-semibold text-gray-900", children: "Appointment" }), _jsx(Field, { label: "When", value: `${formatClock(appointment.startTime)}–${formatClock(appointment.endTime)}` }), _jsx(Field, { label: "Type", value: typeLabel(appointment.appointmentType) }), _jsx(Field, { label: "Location", value: appointment.clinicLocation }), _jsx(Field, { label: "Provider", value: providerLabel(appointment.providerId) }), _jsxs("div", { children: [_jsx("div", { className: "text-xs text-gray-500 mb-1", children: "Appointment status" }), _jsx(StatusBadge, { value: appointment.status })] }), visit?.examRoom && _jsx(Field, { label: "Exam room", value: visit.examRoom }), visit?.arrivalAt && _jsx(Field, { label: "Arrived", value: formatClock(visit.arrivalAt) }), appointment.cancelReason && _jsx(Field, { label: "Cancel reason", value: appointment.cancelReason }), visit?.cancelReason && visit.cancelReason !== appointment.cancelReason && (_jsx(Field, { label: "Visit cancel reason", value: visit.cancelReason }))] }), _jsxs("div", { className: "rounded-lg border border-gray-200 p-4 space-y-3", children: [_jsx("h3", { className: "text-sm font-semibold text-gray-900", children: "Demographics" }), _jsx(Field, { label: "Legal name", value: `${patient.givenName} ${patient.familyName}` }), _jsx(Field, { label: "Preferred name", value: patient.preferredName && patient.preferredName !== patient.givenName ? patient.preferredName : '—' }), _jsx(Field, { label: "Date of birth", value: formatDob(patient.birthDate) }), _jsx(Field, { label: "Sex at birth", value: patient.sex }), _jsx(Field, { label: "Gender identity", value: patient.genderIdentity }), _jsx(Field, { label: "Language", value: LANGUAGE[patient.language || ''] || patient.language }), _jsx(Field, { label: "Phone", value: patient.contact?.phone }), _jsx(Field, { label: "Email", value: patient.contact?.email }), _jsx(Field, { label: "Address", value: address })] }), _jsxs("div", { className: "rounded-lg border border-gray-200 p-4 space-y-3", children: [_jsx("h3", { className: "text-sm font-semibold text-gray-900", children: "Health card" }), card ? (_jsx("p", { className: "font-mono text-sm text-gray-900", children: card })) : (_jsx("p", { className: "text-sm text-amber-800", children: "No health card on file. Review this with the patient before check-in." })), visit?.demographicsVerified && visit.healthCardVerified && (_jsx("p", { className: "text-sm text-green-800", children: "Demographics and health card were reviewed at check-in." }))] })] }), canOperate && needsCheckIn && (_jsxs("form", { onSubmit: onCheckIn, className: "border-t border-gray-100 pt-4 space-y-3", children: [_jsx("h3", { className: "text-sm font-semibold text-gray-900", children: "Check in" }), _jsxs("label", { className: "flex items-start gap-2 text-sm text-gray-800", children: [_jsx("input", { type: "checkbox", className: "mt-0.5", checked: demographicsChecked, onChange: (event) => setDemographicsChecked(event.target.checked) }), "Demographics verified with the patient"] }), _jsxs("label", { className: "flex items-start gap-2 text-sm text-gray-800", children: [_jsx("input", { type: "checkbox", className: "mt-0.5", checked: healthCardChecked, onChange: (event) => setHealthCardChecked(event.target.checked) }), "Health card information reviewed"] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, htmlFor: "check-in-note", children: "Note (optional)" }), _jsx("input", { id: "check-in-note", value: note, onChange: (event) => setNote(event.target.value), className: inputCls })] }), _jsx("button", { type: "submit", className: btnPrimary, disabled: saving || !demographicsChecked || !healthCardChecked, children: saving ? 'Checking in...' : 'Check in' })] })), canOperate && !needsCheckIn && (status === 'arrived' || status === 'roomed') && (_jsxs("div", { className: "border-t border-gray-100 pt-4 flex flex-wrap gap-2", children: [status === 'arrived' && (_jsx("button", { type: "button", className: btnPrimary, disabled: saving, onClick: () => changeStatus('waiting'), children: "Send to waiting room" })), status === 'roomed' && (_jsx("button", { type: "button", className: btnGhost, disabled: saving, onClick: () => changeStatus('waiting'), children: "Return to waiting room" }))] })), canOperate && roomable && (_jsxs("form", { onSubmit: onAssignRoom, className: "border-t border-gray-100 pt-4 space-y-3", children: [_jsx("h3", { className: "text-sm font-semibold text-gray-900", children: visit?.examRoom ? 'Reassign room' : 'Assign exam room' }), _jsxs("div", { className: "flex flex-wrap gap-2 items-end", children: [_jsxs("div", { className: "min-w-48", children: [_jsx("label", { className: labelCls, htmlFor: "exam-room", children: "Exam room" }), _jsx("select", { id: "exam-room", value: room, onChange: (event) => setRoom(event.target.value), className: inputCls, children: rooms.map((item) => (_jsx("option", { value: item, children: item }, item))) })] }), _jsx("button", { type: "submit", className: btnPrimary, disabled: saving || !room || room === visit?.examRoom, children: visit?.examRoom ? 'Reassign' : 'Assign room' })] })] })), canOperate && (status === 'roomed' || status === 'in_progress') && (_jsxs("div", { className: "border-t border-gray-100 pt-4 flex flex-wrap gap-2", children: [status === 'roomed' && (_jsx("button", { type: "button", className: btnPrimary, disabled: saving, onClick: () => void startVisit(), children: "Start visit" })), status === 'in_progress' && (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: btnPrimary, disabled: saving, onClick: () => changeStatus('completed'), children: "Complete visit" }), _jsx(Link, { to: `/patients/${patient._id}`, className: `${btnGhost} inline-flex items-center`, children: "Open chart" })] }))] })), visit ? (_jsx(EncounterVisitSection, { patientId: patient._id, visitId: visit._id, appointmentId: appointment._id, clinicLocation: appointment.clinicLocation, appointmentType: appointment.appointmentType, defaultAttendingId: appointment.providerId.role === 'clinician' ? appointment.providerId._id : '', visitStatus: status, canManage: canLaunchEncounter, onChanged: onUpdated })) : (_jsxs("div", { className: "border-t border-gray-100 pt-4", children: [_jsx("h3", { className: "text-sm font-semibold text-gray-900 mb-3", children: "Timeline" }), appointment.createdAt ? (_jsx("ol", { className: "space-y-3", children: _jsxs("li", { className: "flex gap-3 text-sm", children: [_jsx("div", { className: "w-36 shrink-0 text-gray-500", children: formatClock(appointment.createdAt) }), _jsx("div", { className: "font-medium text-gray-900", children: "Appointment booked" })] }) })) : (_jsx("p", { className: "text-sm text-gray-500", children: "No visit events yet." }))] })), canOperate && (canNoShow || canCancel) && status !== 'completed' && (_jsxs("div", { className: "border-t border-gray-100 pt-4 space-y-3", children: [_jsx("h3", { className: "text-sm font-semibold text-gray-900", children: "Close without finishing" }), canCancel && (_jsxs("div", { children: [_jsx("label", { className: labelCls, htmlFor: "cancel-visit-reason", children: "Cancel reason (optional)" }), _jsx("input", { id: "cancel-visit-reason", value: reason, onChange: (event) => setReason(event.target.value), className: inputCls })] })), _jsxs("div", { className: "flex flex-wrap gap-2", children: [canNoShow && (_jsx("button", { type: "button", className: btnGhost, disabled: saving, onClick: () => changeStatus('no_show'), children: "No show" })), canCancel && (_jsx("button", { type: "button", disabled: saving, onClick: () => changeStatus('cancelled'), className: "px-3 py-2 border border-red-200 text-red-700 rounded-lg text-sm hover:bg-red-50 disabled:opacity-50", children: "Cancel visit" }))] })] })), !canOperate && (_jsx("p", { className: "text-sm text-gray-500 border-t border-gray-100 pt-4", children: "Check-in and room updates are available to clinicians, nurses, and administrators on the care team." }))] }));
}
