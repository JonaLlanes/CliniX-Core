import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { authApi, encountersApi, visitsApi, } from '../api/client';
import { StatusBadge } from './StatusBadge';
import { typeLabel } from './appointmentDisplay';
import EncounterTimeline from './EncounterTimeline';
import { DiagnosisPanel } from './DiagnosisPanel';
import { MedicationSummary } from './MedicationPanel';
import Panel, { EmptyState } from './Panel';
import { LAUNCH_VISIT_STATUSES, formatEncounterWhen, providerId, providerName, } from './encounterDisplay';
import { chartRecordId, focusedRecordClass, watchChartRecord } from './chart/recordFocus';
const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm';
const labelCls = 'block text-xs font-medium text-gray-600 mb-1';
const btnPrimary = 'px-4 py-2 bg-clinical-teal text-white rounded-lg text-sm hover:bg-clinical-teal-dark disabled:opacity-50';
const btnGhost = 'px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50';
function messageOf(err) {
    return err instanceof Error ? err.message : 'Request failed';
}
function Field({ label, children }) {
    return (_jsxs("div", { children: [_jsx("div", { className: "text-xs text-gray-500", children: label }), _jsx("div", { className: "text-sm text-gray-900 mt-0.5", children: children })] }));
}
function useClinicians(enabled) {
    const [clinicians, setClinicians] = useState([]);
    const [error, setError] = useState('');
    useEffect(() => {
        if (!enabled)
            return;
        let cancelled = false;
        authApi
            .directory()
            .then((res) => {
            if (!cancelled)
                setClinicians(res.data.filter((person) => person.role === 'clinician'));
        })
            .catch((err) => {
            if (!cancelled)
                setError(messageOf(err));
        });
        return () => {
            cancelled = true;
        };
    }, [enabled]);
    return { clinicians, error };
}
function ProviderSelect({ id, label, value, clinicians, allowEmpty, emptyLabel, onChange, }) {
    return (_jsxs("div", { children: [_jsx("label", { className: labelCls, htmlFor: id, children: label }), _jsxs("select", { id: id, value: value, onChange: (event) => onChange(event.target.value), className: inputCls, required: !allowEmpty, children: [allowEmpty && _jsx("option", { value: "", children: emptyLabel || 'None' }), !allowEmpty && _jsx("option", { value: "", children: "Select a clinician" }), clinicians.map((person) => (_jsx("option", { value: person._id, children: person.displayName }, person._id)))] })] }));
}
export function EncounterLaunch({ patientId, visitId, appointmentId, clinicLocation, appointmentType, defaultAttendingId, onCreated, }) {
    const { clinicians, error: directoryError } = useClinicians(true);
    const [complaint, setComplaint] = useState('');
    const [reason, setReason] = useState('');
    const [attendingId, setAttendingId] = useState(defaultAttendingId);
    const [supervisingId, setSupervisingId] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        setAttendingId(defaultAttendingId);
    }, [defaultAttendingId]);
    const supervisingOptions = clinicians.filter((person) => person._id !== attendingId);
    async function onSubmit(event) {
        event.preventDefault();
        setSaving(true);
        setError('');
        try {
            const created = await encountersApi.create(patientId, {
                patientId,
                visitId,
                appointmentId,
                clinicLocation,
                appointmentType,
                attendingProviderId: attendingId,
                supervisingProviderId: supervisingId || undefined,
                chiefComplaint: complaint.trim(),
                reasonForVisit: reason.trim(),
            });
            await onCreated(created);
        }
        catch (err) {
            setError(messageOf(err));
        }
        finally {
            setSaving(false);
        }
    }
    return (_jsxs("form", { onSubmit: onSubmit, className: "space-y-3", children: [_jsxs("p", { className: "text-sm text-gray-600", children: [typeLabel(appointmentType), " \u00B7 ", clinicLocation, ". The visit moves to in progress when the encounter opens."] }), (error || directoryError) && (_jsx("div", { className: "bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm", children: error || directoryError })), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3", children: [_jsxs("div", { className: "md:col-span-2", children: [_jsx("label", { className: labelCls, htmlFor: `complaint-${visitId}`, children: "Chief complaint" }), _jsx("input", { id: `complaint-${visitId}`, value: complaint, onChange: (event) => setComplaint(event.target.value), className: inputCls, required: true, maxLength: 500 })] }), _jsxs("div", { className: "md:col-span-2", children: [_jsx("label", { className: labelCls, htmlFor: `reason-${visitId}`, children: "Reason for visit" }), _jsx("textarea", { id: `reason-${visitId}`, value: reason, onChange: (event) => setReason(event.target.value), className: inputCls, rows: 2, required: true, maxLength: 1000 })] }), _jsx(ProviderSelect, { id: `attending-${visitId}`, label: "Attending provider", value: attendingId, clinicians: clinicians, onChange: (value) => {
                            setAttendingId(value);
                            if (value === supervisingId)
                                setSupervisingId('');
                        } }), _jsx(ProviderSelect, { id: `supervising-${visitId}`, label: "Supervising provider (optional)", value: supervisingId, clinicians: supervisingOptions, allowEmpty: true, onChange: setSupervisingId })] }), _jsx("button", { type: "submit", className: btnPrimary, disabled: saving || !attendingId, children: saving ? 'Opening encounter...' : 'Start encounter' })] }));
}
export function EncounterSummary({ patientId, refreshKey = 0, canManage, onOpen, }) {
    const [summary, setSummary] = useState(null);
    const [error, setError] = useState('');
    useEffect(() => {
        let cancelled = false;
        encountersApi
            .summary(patientId)
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
    }, [patientId, refreshKey]);
    const canStart = canManage && summary?.visitId && !summary.encounterId;
    const showAction = Boolean(onOpen && summary && (summary.encounterId || canStart));
    return (_jsxs(Panel, { title: "Encounter summary", subtitle: "Provider, complaint, status, room, and start time for the current encounter", children: [error && (_jsx("div", { className: "mb-3 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm", children: error })), !summary ? (_jsx("p", { className: "text-sm text-gray-500", children: "Loading encounter..." })) : !summary.encounterId ? (_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [_jsxs("p", { className: "text-sm text-gray-600", children: [summary.visitId
                                ? 'This visit does not have an encounter yet.'
                                : 'No encounter on this chart yet.', summary.visitStatus ? (_jsxs(_Fragment, { children: [' ', "Visit status ", _jsx(StatusBadge, { value: summary.visitStatus }), summary.room ? ` · ${summary.room}` : ''] })) : null] }), showAction && (_jsx("button", { type: "button", className: btnPrimary, onClick: onOpen, children: "Start encounter" }))] })) : (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "grid grid-cols-2 md:grid-cols-5 gap-4", children: [_jsx(Field, { label: "Provider", children: summary.provider || '—' }), _jsx(Field, { label: "Complaint", children: summary.chiefComplaint || '—' }), _jsx(Field, { label: "Status", children: _jsx(StatusBadge, { value: summary.status }) }), _jsx(Field, { label: "Room", children: summary.room || '—' }), _jsx(Field, { label: "Start time", children: formatEncounterWhen(summary.openedAt) })] }), showAction && (_jsx("button", { type: "button", className: btnGhost, onClick: onOpen, children: "View encounter" }))] }))] }));
}
export function EncounterVisitSection({ patientId, visitId, appointmentId, clinicLocation, appointmentType, defaultAttendingId, visitStatus, canManage, onChanged, }) {
    const [encounter, setEncounter] = useState(null);
    const [timeline, setTimeline] = useState([]);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const launchable = LAUNCH_VISIT_STATUSES.includes(visitStatus);
    useEffect(() => {
        let cancelled = false;
        setLoaded(false);
        encountersApi
            .current(patientId, visitId)
            .then((view) => {
            if (cancelled)
                return;
            setEncounter(view.encounter);
            setTimeline(view.displayTimeline || []);
            setError('');
            setLoaded(true);
        })
            .catch((err) => {
            if (!cancelled) {
                setError(messageOf(err));
                setLoaded(true);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [patientId, visitId, visitStatus]);
    async function moveToInProgress() {
        if (!encounter)
            return;
        setSaving(true);
        setError('');
        try {
            const updated = await encountersApi.setStatus(patientId, encounter._id, 'in_progress');
            setEncounter(updated);
            setTimeline(updated.displayTimeline || []);
        }
        catch (err) {
            setError(messageOf(err));
        }
        finally {
            setSaving(false);
        }
    }
    return (_jsxs("div", { className: "border-t border-gray-100 pt-4 space-y-4", children: [_jsx("h3", { className: "text-sm font-semibold text-gray-900", children: "Encounter" }), error && (_jsx("div", { className: "bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm", children: error })), !loaded ? (_jsx("p", { className: "text-sm text-gray-500", children: "Loading encounter..." })) : encounter ? (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-3", children: [_jsx(Field, { label: "Provider", children: providerName(encounter.attendingProviderId) }), _jsx(Field, { label: "Complaint", children: encounter.chiefComplaint }), _jsx(Field, { label: "Status", children: _jsx(StatusBadge, { value: encounter.status }) }), _jsx(Field, { label: "Start time", children: formatEncounterWhen(encounter.openedAt) })] }), canManage && encounter.status === 'open' && (_jsx("button", { type: "button", className: btnPrimary, disabled: saving, onClick: () => void moveToInProgress(), children: saving ? 'Updating...' : 'Move to in progress' })), encounter.status === 'in_progress' && (_jsx("p", { className: "text-sm text-gray-600", children: "Documentation will move this encounter to awaiting signature." })), (encounter.status === 'signed' || encounter.status === 'amended') && (_jsx("p", { className: "text-sm text-gray-600", children: "This encounter is locked." }))] })) : launchable && canManage ? (_jsx(EncounterLaunch, { patientId: patientId, visitId: visitId, appointmentId: appointmentId, clinicLocation: clinicLocation, appointmentType: appointmentType, defaultAttendingId: defaultAttendingId, onCreated: async (created) => {
                    setEncounter(created);
                    setTimeline(created.displayTimeline || []);
                    await onChanged();
                } }, visitId)) : launchable ? (_jsx("p", { className: "text-sm text-gray-600", children: "A clinician opens the encounter for this visit." })) : (_jsx("p", { className: "text-sm text-gray-600", children: "An encounter opens after the patient is waiting, roomed, or in progress." })), encounter && (_jsx(DiagnosisPanel, { patientId: patientId, encounterId: encounter._id, canManage: canManage, locked: encounter.status === 'signed' || encounter.status === 'amended', defaultOwnerId: providerId(encounter.attendingProviderId), onActivity: async () => {
                    const view = await encountersApi.current(patientId, visitId);
                    setEncounter(view.encounter);
                    setTimeline(view.displayTimeline || []);
                } }, encounter._id)), _jsx(MedicationSummary, { patientId: patientId }), _jsxs("div", { children: [_jsx("h3", { className: "text-sm font-semibold text-gray-900 mb-3", children: "Timeline" }), _jsx(EncounterTimeline, { events: timeline })] })] }));
}
function EncounterDetail({ patientId, encounter, canManage, onUpdated, onSelect, }) {
    const unlocked = encounter.status === 'open' || encounter.status === 'in_progress' || encounter.status === 'awaiting_signature';
    const { clinicians } = useClinicians(canManage && unlocked);
    const [attendingId, setAttendingId] = useState(providerId(encounter.attendingProviderId));
    const [supervisingId, setSupervisingId] = useState(providerId(encounter.supervisingProviderId));
    const [complaint, setComplaint] = useState(encounter.chiefComplaint);
    const [reason, setReason] = useState(encounter.reasonForVisit);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        setAttendingId(providerId(encounter.attendingProviderId));
        setSupervisingId(providerId(encounter.supervisingProviderId));
        setComplaint(encounter.chiefComplaint);
        setReason(encounter.reasonForVisit);
        setError('');
    }, [encounter]);
    async function run(action) {
        setSaving(true);
        setError('');
        try {
            onUpdated(await action());
        }
        catch (err) {
            setError(messageOf(err));
        }
        finally {
            setSaving(false);
        }
    }
    const providersChanged = attendingId !== providerId(encounter.attendingProviderId) ||
        supervisingId !== providerId(encounter.supervisingProviderId);
    return (_jsxs("div", { className: "mt-4 border border-gray-200 rounded-lg p-4 space-y-4", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [_jsx("h3", { className: "font-semibold text-gray-900", children: "Encounter detail" }), _jsx(StatusBadge, { value: encounter.status })] }), error && (_jsx("div", { className: "bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm", children: error })), _jsxs("div", { className: "grid grid-cols-2 md:grid-cols-3 gap-3", children: [_jsx(Field, { label: "Provider", children: providerName(encounter.attendingProviderId) }), _jsx(Field, { label: "Complaint", children: encounter.chiefComplaint }), _jsx(Field, { label: "Room", children: encounter.room || '—' }), _jsx(Field, { label: "Start time", children: formatEncounterWhen(encounter.openedAt) }), _jsx(Field, { label: "Location", children: encounter.clinicLocation }), _jsx(Field, { label: "Appointment type", children: typeLabel(encounter.appointmentType) }), _jsx(Field, { label: "Created by", children: providerName(encounter.createdBy) }), _jsx(Field, { label: "Supervising", children: providerName(encounter.supervisingProviderId) }), _jsxs(Field, { label: "Signed by", children: [encounter.signedBy ? providerName(encounter.signedBy) : '—', encounter.signedAt ? ` · ${formatEncounterWhen(encounter.signedAt)}` : ''] })] }), _jsx(Field, { label: "Reason for visit", children: encounter.reasonForVisit }), encounter.amendsEncounterId && (_jsx("button", { type: "button", className: "text-sm text-clinical-teal hover:underline", onClick: () => onSelect(String(encounter.amendsEncounterId)), children: "View signed encounter" })), encounter.amendmentId && (_jsx("button", { type: "button", className: "text-sm text-clinical-teal hover:underline", onClick: () => onSelect(encounter.amendmentId || ''), children: "View amendment" })), canManage && encounter.status === 'open' && (_jsx("button", { type: "button", className: btnPrimary, disabled: saving, onClick: () => void run(() => encountersApi.setStatus(patientId, encounter._id, 'in_progress')), children: "Move to in progress" })), encounter.status === 'in_progress' && (_jsx("p", { className: "text-sm text-gray-600", children: "Documentation will move this encounter to awaiting signature." })), canManage && encounter.status === 'awaiting_signature' && (_jsx("button", { type: "button", className: btnPrimary, disabled: saving, onClick: () => void run(() => encountersApi.sign(patientId, encounter._id)), children: "Sign encounter" })), (encounter.status === 'signed' || encounter.status === 'amended') && (_jsx("p", { className: "text-sm text-gray-600", children: "This encounter is locked." })), canManage && unlocked && (_jsxs("form", { className: "grid grid-cols-1 md:grid-cols-3 gap-3 items-end", onSubmit: (event) => {
                    event.preventDefault();
                    void run(() => encountersApi.assignProviders(patientId, encounter._id, {
                        attendingProviderId: attendingId,
                        supervisingProviderId: supervisingId || null,
                    }));
                }, children: [_jsx(ProviderSelect, { id: `edit-attending-${encounter._id}`, label: "Attending provider", value: attendingId, clinicians: clinicians, onChange: (value) => {
                            setAttendingId(value);
                            if (value === supervisingId)
                                setSupervisingId('');
                        } }), _jsx(ProviderSelect, { id: `edit-supervising-${encounter._id}`, label: "Supervising provider", value: supervisingId, clinicians: clinicians.filter((person) => person._id !== attendingId), allowEmpty: true, onChange: setSupervisingId }), _jsx("button", { type: "submit", className: btnGhost, disabled: saving || !providersChanged || !attendingId, children: "Save providers" })] })), canManage && encounter.status === 'signed' && encounter.isCurrent && (_jsxs("form", { className: "space-y-3 border-t border-gray-100 pt-4", onSubmit: (event) => {
                    event.preventDefault();
                    void run(() => encountersApi.amend(patientId, encounter._id, {
                        chiefComplaint: complaint.trim(),
                        reasonForVisit: reason.trim(),
                        attendingProviderId: attendingId || undefined,
                        supervisingProviderId: supervisingId || undefined,
                    }));
                }, children: [_jsx("h4", { className: "text-sm font-semibold text-gray-900", children: "Amendment" }), _jsx("p", { className: "text-sm text-gray-600", children: "The signed encounter stays locked. This opens a linked amendment on the same visit." }), _jsxs("div", { children: [_jsx("label", { className: labelCls, htmlFor: `amend-complaint-${encounter._id}`, children: "Chief complaint" }), _jsx("input", { id: `amend-complaint-${encounter._id}`, value: complaint, onChange: (event) => setComplaint(event.target.value), className: inputCls, required: true })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, htmlFor: `amend-reason-${encounter._id}`, children: "Reason for visit" }), _jsx("textarea", { id: `amend-reason-${encounter._id}`, value: reason, onChange: (event) => setReason(event.target.value), className: inputCls, rows: 2, required: true })] }), _jsx("button", { type: "submit", className: btnPrimary, disabled: saving, children: "Create amendment" })] })), _jsx(DiagnosisPanel, { patientId: patientId, encounterId: encounter._id, canManage: canManage, locked: !unlocked, defaultOwnerId: providerId(encounter.attendingProviderId), onActivity: async () => {
                    onUpdated(await encountersApi.get(patientId, encounter._id));
                } }, encounter._id), _jsx(MedicationSummary, { patientId: patientId }), _jsxs("div", { children: [_jsx("h4", { className: "text-sm font-semibold text-gray-900 mb-3", children: "Timeline" }), _jsx(EncounterTimeline, { events: encounter.displayTimeline || [] })] })] }));
}
export function EncounterChart({ patientId, canManage, onChanged, focusToken = 0, recordFocus = null, }) {
    const [items, setItems] = useState([]);
    const [visits, setVisits] = useState([]);
    const [selectedId, setSelectedId] = useState('');
    const [detail, setDetail] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    async function loadList() {
        const [encounterPage, visitPage] = await Promise.all([
            encountersApi.list(patientId, 100),
            visitsApi.forPatient(patientId),
        ]);
        setItems(encounterPage.data);
        setVisits(visitPage.data);
        return encounterPage.data;
    }
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        loadList()
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
    const active = visits.find((visit) => LAUNCH_VISIT_STATUSES.includes(visit.status)) || null;
    const activeAppointment = active && typeof active.appointmentId === 'object' ? active.appointmentId : null;
    const activeHasEncounter = Boolean(active && items.some((item) => item.visitId === active._id && item.isCurrent));
    useEffect(() => {
        if (selectedId)
            return;
        const preferred = active
            ? items.find((item) => item.visitId === active._id && item.isCurrent)
            : items.find((item) => item.isCurrent) || items[0];
        if (preferred)
            setSelectedId(preferred._id);
    }, [items, active, selectedId]);
    useEffect(() => {
        if (!selectedId) {
            setDetail(null);
            return;
        }
        let cancelled = false;
        encountersApi
            .get(patientId, selectedId)
            .then((encounter) => {
            if (!cancelled)
                setDetail(encounter);
        })
            .catch((err) => {
            if (!cancelled)
                setError(messageOf(err));
        });
        return () => {
            cancelled = true;
        };
    }, [patientId, selectedId]);
    async function afterChange(encounter) {
        await loadList();
        setSelectedId(encounter._id);
        setDetail(encounter);
        onChanged();
    }
    const defaultAttending = active && typeof active.providerId === 'object' && active.providerId.role === 'clinician'
        ? active.providerId._id
        : '';
    useEffect(() => {
        if (!focusToken || loading || recordFocus?.tab === 'encounters')
            return;
        const node = document.getElementById('chart-new-encounter') || document.getElementById('chart-encounter-list');
        node?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, [focusToken, loading, activeHasEncounter, recordFocus]);
    const focusTokenForRecord = recordFocus?.tab === 'encounters' ? recordFocus.token : 0;
    const focusRecordId = recordFocus?.tab === 'encounters' ? recordFocus.recordId : '';
    useEffect(() => {
        if (!focusTokenForRecord || !focusRecordId || loading)
            return;
        setSelectedId(focusRecordId);
        return watchChartRecord('encounter', focusRecordId, 'encounter-detail', focusRecordId);
    }, [focusTokenForRecord, focusRecordId, loading]);
    return (_jsxs("div", { className: "space-y-4", children: [error && (_jsx("div", { className: "bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm", children: error })), canManage && active && activeAppointment && !activeHasEncounter && (_jsx("div", { id: "chart-new-encounter", className: "scroll-mt-64", children: _jsx(Panel, { title: "Start encounter", subtitle: "Waiting, roomed, and in-progress visits can open an encounter", children: _jsx(EncounterLaunch, { patientId: patientId, visitId: active._id, appointmentId: activeAppointment._id, clinicLocation: activeAppointment.clinicLocation, appointmentType: activeAppointment.appointmentType, defaultAttendingId: defaultAttending, onCreated: afterChange }, active._id) }) })), _jsx("div", { id: "chart-encounter-list", className: "scroll-mt-64", children: _jsxs(Panel, { title: "Encounters", children: [loading ? (_jsx("p", { className: "text-sm text-gray-500", children: "Loading encounters..." })) : items.length === 0 ? (_jsx(EmptyState, { text: "No encounters on this chart", hint: "Start an encounter from the chart header when the visit begins." })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-xs font-medium text-gray-500 border-b border-gray-200", children: [_jsx("th", { className: "pb-3 pr-3", children: "Started" }), _jsx("th", { className: "pb-3 pr-3", children: "Provider" }), _jsx("th", { className: "pb-3 pr-3", children: "Complaint" }), _jsx("th", { className: "pb-3 pr-3", children: "Status" }), _jsx("th", { className: "pb-3", children: "Room" })] }) }), _jsx("tbody", { className: "divide-y divide-gray-100", children: items.map((item) => (_jsxs("tr", { id: chartRecordId('encounter', item._id), className: `${item._id === selectedId ? 'bg-teal-50' : ''} ${focusedRecordClass(item._id === focusRecordId, 'row')}`.trim(), children: [_jsx("td", { className: "py-3 pr-3 whitespace-nowrap", children: _jsx("button", { type: "button", className: "text-left hover:underline", onClick: () => setSelectedId(item._id), children: formatEncounterWhen(item.openedAt) }) }), _jsx("td", { className: "py-3 pr-3", children: providerName(item.attendingProviderId) }), _jsx("td", { className: "py-3 pr-3 text-gray-700", children: item.chiefComplaint }), _jsx("td", { className: "py-3 pr-3", children: _jsx(StatusBadge, { value: item.status }) }), _jsx("td", { className: "py-3", children: item.room || '—' })] }, item._id))) })] }) })), detail && (_jsx("div", { id: chartRecordId('encounter-detail', detail._id), children: _jsx(EncounterDetail, { patientId: patientId, encounter: detail, canManage: canManage, onUpdated: (encounter) => void afterChange(encounter), onSelect: setSelectedId }) }))] }) })] }));
}
