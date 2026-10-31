import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { ApiError, clinicalApi, encountersApi, } from '../api/client';
import Panel, { EmptyState } from './Panel';
import { StatusBadge } from './StatusBadge';
import { formatEncounterWhen, providerName } from './encounterDisplay';
const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm';
const labelCls = 'block text-xs font-medium text-gray-600 mb-1';
const btnPrimary = 'px-4 py-2 bg-clinical-teal text-white rounded-lg text-sm hover:bg-clinical-teal-dark disabled:opacity-50';
const btnGhost = 'px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50';
const btnText = 'text-sm text-clinical-teal hover:underline disabled:opacity-50';
const ROUTES = [
    'oral',
    'sublingual',
    'inhalation',
    'intranasal',
    'topical',
    'transdermal',
    'ophthalmic',
    'otic',
    'rectal',
    'subcutaneous',
    'intramuscular',
    'intravenous',
];
const ACTIONS = {
    hold: { title: 'Hold medication', submit: 'Hold medication' },
    resume: { title: 'Resume medication', submit: 'Resume medication' },
    discontinue: { title: 'Discontinue medication', submit: 'Discontinue medication' },
    complete: { title: 'Complete course', submit: 'Complete course' },
};
function messageOf(err) {
    return err instanceof Error ? err.message : 'Request failed';
}
function warningsOf(err) {
    return err instanceof ApiError && err.warnings?.length ? err.warnings : null;
}
function todayInput() {
    const date = new Date();
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 10);
}
function dateInput(value) {
    return value ? value.slice(0, 10) : '';
}
function refId(value) {
    if (!value)
        return '';
    return typeof value === 'string' ? value : value._id;
}
function drugKey(draft) {
    return `${draft.genericName.trim().toLowerCase()}|${draft.brandName.trim().toLowerCase()}|${draft.din.trim()}`;
}
function emptyDraft(prescribedBy = '') {
    return {
        genericName: '',
        brandName: '',
        din: '',
        strength: '',
        dosage: '',
        route: 'oral',
        frequency: '',
        indication: '',
        startDate: todayInput(),
        prescribedBy,
        encounterId: '',
        conditionId: '',
        reason: '',
        date: todayInput(),
    };
}
function draftFrom(medication) {
    return {
        genericName: medication.genericName || medication.name || '',
        brandName: medication.brandName || '',
        din: medication.din || '',
        strength: medication.strength || '',
        dosage: medication.dosage || medication.dose || '',
        route: medication.route || 'oral',
        frequency: medication.frequency || '',
        indication: medication.indication || '',
        startDate: dateInput(medication.startDate),
        prescribedBy: refId(medication.prescribedBy),
        encounterId: refId(medication.encounterId),
        conditionId: refId(medication.conditionId),
        reason: '',
        date: todayInput(),
    };
}
function medicationTitle(medication) {
    const generic = medication.genericName || medication.name || 'Medication';
    return medication.brandName ? `${generic} (${medication.brandName})` : generic;
}
function regimen(medication) {
    return [medication.strength, medication.dosage || medication.dose, medication.route, medication.frequency]
        .filter(Boolean)
        .join(' · ');
}
function blank(value) {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}
function payload(draft, acknowledged) {
    return {
        genericName: draft.genericName.trim(),
        brandName: blank(draft.brandName),
        din: blank(draft.din),
        strength: blank(draft.strength),
        dosage: draft.dosage.trim(),
        route: draft.route.trim(),
        frequency: draft.frequency.trim(),
        indication: blank(draft.indication),
        startDate: draft.startDate,
        prescribedBy: draft.prescribedBy,
        encounterId: draft.encounterId || null,
        conditionId: draft.conditionId || null,
        reason: draft.reason.trim() || undefined,
        date: draft.date || undefined,
        allergyAcknowledgment: acknowledged ? { acknowledged: true } : undefined,
    };
}
function AllergyWarningBanner({ warnings }) {
    if (warnings.length === 0)
        return null;
    return (_jsxs("div", { className: "rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950", children: [_jsx("p", { className: "font-semibold", children: "Allergy warning" }), _jsx("ul", { className: "mt-2 space-y-1", children: warnings.map((warning) => (_jsxs("li", { children: [_jsx("span", { className: "font-medium", children: warning.substance }), warning.reaction ? ` — ${warning.reaction}` : '', " (", warning.severity, "). Matched on ", warning.matchedOn, "."] }, warning.allergyId))) }), _jsx("p", { className: "mt-2", children: "This does not stop the medication. Acknowledge the warning to continue." })] }));
}
function Field({ label, children, }) {
    return (_jsxs("div", { children: [_jsx("label", { className: labelCls, children: label }), children] }));
}
function MedicationForm({ draft, setDraft, prescribers, encounters, conditions, warnings, editing, saving, error, onSubmit, onCancel, }) {
    function set(key, value) {
        setDraft({ ...draft, [key]: value });
    }
    return (_jsxs("form", { onSubmit: onSubmit, className: "bg-white rounded-lg border border-gray-200 p-6 space-y-4", children: [_jsxs("div", { children: [_jsx("h3", { className: "font-semibold text-gray-900", children: editing ? 'Change medication' : 'Start medication' }), _jsx("p", { className: "text-xs text-gray-500 mt-0.5", children: editing
                            ? 'A change stays on the medication timeline.'
                            : 'Record the medication the patient is taking. This does not send a prescription.' })] }), error && (_jsx("div", { className: "bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm", children: error })), _jsx(AllergyWarningBanner, { warnings: warnings }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [_jsx(Field, { label: "Generic name", children: _jsx("input", { value: draft.genericName, onChange: (event) => set('genericName', event.target.value), className: inputCls, required: true }) }), _jsx(Field, { label: "Brand name", children: _jsx("input", { value: draft.brandName, onChange: (event) => set('brandName', event.target.value), className: inputCls }) }), _jsx(Field, { label: "DIN", children: _jsx("input", { value: draft.din, onChange: (event) => set('din', event.target.value), className: inputCls, inputMode: "numeric", pattern: "\\d{8}", maxLength: 8, placeholder: "8 digits", title: "DIN must be 8 digits" }) }), _jsx(Field, { label: "Strength", children: _jsx("input", { value: draft.strength, onChange: (event) => set('strength', event.target.value), className: inputCls, placeholder: "10 mg" }) }), _jsx(Field, { label: "Dosage", children: _jsx("input", { value: draft.dosage, onChange: (event) => set('dosage', event.target.value), className: inputCls, required: true, placeholder: "1 tablet" }) }), _jsxs(Field, { label: "Route", children: [_jsx("input", { value: draft.route, onChange: (event) => set('route', event.target.value), className: inputCls, list: "medication-routes", required: true }), _jsx("datalist", { id: "medication-routes", children: ROUTES.map((route) => (_jsx("option", { value: route }, route))) })] }), _jsx(Field, { label: "Frequency", children: _jsx("input", { value: draft.frequency, onChange: (event) => set('frequency', event.target.value), className: inputCls, required: true, placeholder: "once daily" }) }), _jsx(Field, { label: "Start date", children: _jsx("input", { type: "date", value: draft.startDate, onChange: (event) => set('startDate', event.target.value), className: inputCls, required: true }) }), _jsx(Field, { label: "Prescribed by", children: _jsxs("select", { value: draft.prescribedBy, onChange: (event) => set('prescribedBy', event.target.value), className: inputCls, required: true, children: [_jsx("option", { value: "", children: "Select a clinician" }), prescribers.map((person) => (_jsx("option", { value: person._id, children: person.displayName }, person._id)))] }) }), _jsxs("div", { className: "md:col-span-3", children: [_jsx("label", { className: labelCls, children: "Indication" }), _jsx("input", { value: draft.indication, onChange: (event) => set('indication', event.target.value), className: inputCls })] }), _jsx(Field, { label: "Related diagnosis", children: _jsxs("select", { value: draft.conditionId, onChange: (event) => set('conditionId', event.target.value), className: inputCls, children: [_jsx("option", { value: "", children: "None" }), conditions.map((condition) => (_jsxs("option", { value: condition._id, children: [condition.display, condition.code ? ` · ${condition.code}` : ''] }, condition._id)))] }) }), _jsx(Field, { label: "Encounter", children: _jsxs("select", { value: draft.encounterId, onChange: (event) => set('encounterId', event.target.value), className: inputCls, children: [_jsx("option", { value: "", children: "None" }), encounters.map((encounter) => (_jsxs("option", { value: encounter._id, children: [dateInput(encounter.openedAt), " \u00B7 ", encounter.chiefComplaint] }, encounter._id)))] }) }), editing && (_jsxs(_Fragment, { children: [_jsx(Field, { label: "Change date", children: _jsx("input", { type: "date", value: draft.date, onChange: (event) => set('date', event.target.value), className: inputCls, required: true }) }), _jsxs("div", { className: "md:col-span-3", children: [_jsx("label", { className: labelCls, children: "Reason for change" }), _jsx("input", { value: draft.reason, onChange: (event) => set('reason', event.target.value), className: inputCls, required: true })] })] }))] }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx("button", { type: "submit", className: btnPrimary, disabled: saving, children: saving
                            ? 'Saving...'
                            : warnings.length
                                ? editing
                                    ? 'Acknowledge and save'
                                    : 'Acknowledge and start'
                                : editing
                                    ? 'Save changes'
                                    : 'Start medication' }), onCancel && (_jsx("button", { type: "button", className: btnGhost, onClick: onCancel, children: "Cancel" }))] })] }));
}
function TimelineList({ points }) {
    if (points.length === 0)
        return _jsx(EmptyState, { text: "No medication events yet." });
    const ordered = points.slice().sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return (_jsx("ol", { className: "space-y-3", children: ordered.map((point, index) => (_jsxs("li", { className: "flex gap-3 text-sm", children: [_jsx("div", { className: "w-36 shrink-0 text-gray-500", children: formatEncounterWhen(point.at) }), _jsxs("div", { children: [_jsx("div", { className: "font-medium text-gray-900", children: point.label }), point.detail && _jsx("div", { className: "text-gray-600", children: point.detail }), providerName(point.clinicianId) !== '—' && (_jsx("div", { className: "text-xs text-gray-500 mt-0.5", children: providerName(point.clinicianId) }))] })] }, `${point.action}-${point.at}-${index}`))) }));
}
function MedicationRow({ medication, canWrite, onAction, onEdit, }) {
    const [open, setOpen] = useState(false);
    const diagnosis = medication.conditionId && typeof medication.conditionId === 'object' ? medication.conditionId.display : '';
    const current = medication.status === 'active' || medication.status === 'on-hold';
    return (_jsxs("li", { className: "py-4", children: [_jsxs("div", { className: "flex flex-wrap items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsx("div", { className: "font-medium text-gray-900", children: medicationTitle(medication) }), _jsxs("div", { className: "text-sm text-gray-600 mt-0.5", children: [medication.din ? `DIN ${medication.din} · ` : '', regimen(medication)] }), medication.indication && _jsxs("div", { className: "text-sm text-gray-600 mt-0.5", children: ["Indication: ", medication.indication] }), diagnosis && _jsxs("div", { className: "text-sm text-gray-600 mt-0.5", children: ["Related diagnosis: ", diagnosis] }), medication.adherenceNotes && _jsx("div", { className: "text-xs text-gray-500 mt-1", children: medication.adherenceNotes }), _jsxs("div", { className: "text-xs text-gray-500 mt-1", children: ["Started ", dateInput(medication.startDate), medication.endDate ? ` · Ended ${dateInput(medication.endDate)}` : '', " \u00B7 Prescribed by", ' ', providerName(medication.prescribedBy)] })] }), _jsx(StatusBadge, { value: medication.status })] }), _jsxs("div", { className: "mt-3 flex flex-wrap gap-3", children: [canWrite && medication.status === 'active' && (_jsx("button", { type: "button", className: btnText, onClick: () => onAction(medication, 'hold'), children: "Hold" })), canWrite && medication.status === 'on-hold' && (_jsx("button", { type: "button", className: btnText, onClick: () => onAction(medication, 'resume'), children: "Resume" })), canWrite && current && (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: btnText, onClick: () => onAction(medication, 'complete'), children: "Complete course" }), _jsx("button", { type: "button", className: btnText, onClick: () => onAction(medication, 'discontinue'), children: "Discontinue" })] })), canWrite && (_jsx("button", { type: "button", className: btnText, onClick: () => onEdit(medication), children: "Change" })), _jsx("button", { type: "button", className: btnText, onClick: () => setOpen((value) => !value), children: open ? 'Hide history' : 'History' })] }), open && (_jsx("div", { className: "mt-3 border-t border-gray-100 pt-3", children: _jsx(TimelineList, { points: medication.timeline || [] }) }))] }));
}
function MedicationGroup({ title, subtitle, items, canWrite, onAction, onEdit, }) {
    return (_jsx(Panel, { title: title, subtitle: subtitle, children: items.length === 0 ? (_jsx(EmptyState, { text: `No ${title.toLowerCase()}.` })) : (_jsx("ul", { className: "divide-y divide-gray-100", children: items.map((medication) => (_jsx(MedicationRow, { medication: medication, canWrite: canWrite, onAction: onAction, onEdit: onEdit }, medication._id))) })) }));
}
export function MedicationPanel({ patientId, canWrite, actorId, }) {
    const [items, setItems] = useState([]);
    const [prescribers, setPrescribers] = useState([]);
    const [encounters, setEncounters] = useState([]);
    const [conditions, setConditions] = useState([]);
    const [draft, setDraft] = useState(emptyDraft());
    const [editingId, setEditingId] = useState(null);
    const [warnings, setWarnings] = useState([]);
    const [warningKey, setWarningKey] = useState('');
    const [actionTarget, setActionTarget] = useState(null);
    const [actionReason, setActionReason] = useState('');
    const [actionDate, setActionDate] = useState(todayInput());
    const [actionClinician, setActionClinician] = useState(actorId || '');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const actors = useMemo(() => {
        if (!actorId || prescribers.some((person) => person._id === actorId))
            return prescribers;
        return [{ _id: actorId, displayName: 'Current user', role: '' }, ...prescribers];
    }, [actorId, prescribers]);
    async function load() {
        const [medicationPage, people, encounterPage, conditionPage] = await Promise.all([
            clinicalApi.medications(patientId).list('?limit=100'),
            clinicalApi.medications(patientId).clinicians(),
            encountersApi.list(patientId),
            clinicalApi.conditions(patientId).list('?limit=100'),
        ]);
        setItems(medicationPage.data);
        setPrescribers(people.data);
        setEncounters(encounterPage.data);
        setConditions(conditionPage.data);
        setDraft((current) => current.prescribedBy ? current : emptyDraft(people.data.some((person) => person._id === actorId) ? actorId : ''));
        if (!actionClinician && actorId)
            setActionClinician(actorId);
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
    function rememberWarnings(next, key) {
        setWarnings(next);
        setWarningKey(key);
    }
    function updateDraft(next) {
        if (drugKey(next) !== drugKey(draft))
            rememberWarnings([], '');
        setDraft(next);
    }
    async function onSubmit(event) {
        event.preventDefault();
        const key = drugKey(draft);
        setSaving(true);
        setError('');
        try {
            let acknowledged = warningKey === key && warnings.length > 0;
            if (!acknowledged) {
                const checked = await clinicalApi.medications(patientId).check({
                    genericName: draft.genericName.trim(),
                    brandName: draft.brandName.trim() || undefined,
                    din: draft.din.trim() || undefined,
                });
                if (checked.warnings.length) {
                    rememberWarnings(checked.warnings, key);
                    return;
                }
            }
            const body = payload(draft, acknowledged);
            if (editingId)
                await clinicalApi.medications(patientId).update(editingId, body);
            else
                await clinicalApi.medications(patientId).create(body);
            setEditingId(null);
            rememberWarnings([], '');
            setDraft(emptyDraft(draft.prescribedBy));
            await load();
        }
        catch (err) {
            const found = warningsOf(err);
            if (found)
                rememberWarnings(found, key);
            else
                setError(messageOf(err));
        }
        finally {
            setSaving(false);
        }
    }
    async function submitAction(event) {
        event.preventDefault();
        if (!actionTarget)
            return;
        setSaving(true);
        setError('');
        const body = {
            reason: actionReason.trim(),
            date: actionDate,
            clinicianId: actionClinician || undefined,
        };
        try {
            const api = clinicalApi.medications(patientId);
            const id = actionTarget.medication._id;
            if (actionTarget.action === 'hold')
                await api.hold(id, body);
            if (actionTarget.action === 'resume')
                await api.resume(id, body);
            if (actionTarget.action === 'discontinue')
                await api.discontinue(id, body);
            if (actionTarget.action === 'complete')
                await api.complete(id, body);
            setActionTarget(null);
            setActionReason('');
            await load();
        }
        catch (err) {
            setError(messageOf(err));
        }
        finally {
            setSaving(false);
        }
    }
    const active = items.filter((item) => item.status === 'active');
    const held = items.filter((item) => item.status === 'on-hold');
    const historical = items.filter((item) => item.status === 'completed');
    const discontinued = items.filter((item) => item.status === 'discontinued');
    const timeline = items.flatMap((item) => item.timeline || []);
    return (_jsxs("div", { className: "space-y-6", children: [error && !editingId && (_jsx("div", { className: "bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm", children: error })), canWrite && (_jsx(MedicationForm, { draft: draft, setDraft: updateDraft, prescribers: prescribers, encounters: encounters, conditions: conditions, warnings: warnings, editing: Boolean(editingId), saving: saving, error: editingId ? error : '', onSubmit: onSubmit, onCancel: editingId
                    ? () => {
                        setEditingId(null);
                        rememberWarnings([], '');
                        setDraft(emptyDraft(draft.prescribedBy));
                        setError('');
                    }
                    : undefined })), actionTarget && (_jsxs("form", { onSubmit: submitAction, className: "bg-white rounded-lg border border-gray-200 p-6 space-y-4", children: [_jsxs("div", { children: [_jsx("h3", { className: "font-semibold text-gray-900", children: ACTIONS[actionTarget.action].title }), _jsx("p", { className: "text-sm text-gray-600 mt-1", children: medicationTitle(actionTarget.medication) })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [_jsxs("div", { className: "md:col-span-3", children: [_jsx("label", { className: labelCls, children: "Reason" }), _jsx("input", { value: actionReason, onChange: (event) => setActionReason(event.target.value), className: inputCls, required: true })] }), _jsx(Field, { label: "Date", children: _jsx("input", { type: "date", value: actionDate, onChange: (event) => setActionDate(event.target.value), className: inputCls, required: true }) }), _jsx(Field, { label: "Clinician", children: _jsxs("select", { value: actionClinician, onChange: (event) => setActionClinician(event.target.value), className: inputCls, required: true, children: [_jsx("option", { value: "", children: "Select a clinician" }), actors.map((person) => (_jsx("option", { value: person._id, children: person.displayName }, person._id)))] }) })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { type: "submit", className: btnPrimary, disabled: saving, children: saving ? 'Saving...' : ACTIONS[actionTarget.action].submit }), _jsx("button", { type: "button", className: btnGhost, onClick: () => setActionTarget(null), children: "Cancel" })] })] })), loading ? (_jsx("p", { className: "text-sm text-gray-500", children: "Loading medications..." })) : (_jsxs(_Fragment, { children: [_jsx(MedicationGroup, { title: "Active medications", subtitle: "Medications the patient is taking now", items: active, canWrite: canWrite, onAction: (medication, action) => {
                            setActionTarget({ medication, action });
                            setActionDate(todayInput());
                            setActionReason('');
                        }, onEdit: (medication) => {
                            setEditingId(medication._id);
                            setDraft(draftFrom(medication));
                            rememberWarnings([], '');
                        } }), _jsx(MedicationGroup, { title: "On hold", subtitle: "Paused medications that remain on the record", items: held, canWrite: canWrite, onAction: (medication, action) => {
                            setActionTarget({ medication, action });
                            setActionDate(todayInput());
                            setActionReason('');
                        }, onEdit: (medication) => {
                            setEditingId(medication._id);
                            setDraft(draftFrom(medication));
                            rememberWarnings([], '');
                        } }), _jsx(MedicationGroup, { title: "Historical medications", subtitle: "Courses that were completed", items: historical, canWrite: canWrite, onAction: (medication, action) => setActionTarget({ medication, action }), onEdit: (medication) => {
                            setEditingId(medication._id);
                            setDraft(draftFrom(medication));
                            rememberWarnings([], '');
                        } }), _jsx(MedicationGroup, { title: "Discontinued medications", subtitle: "Stopped medications. The record is kept.", items: discontinued, canWrite: canWrite, onAction: (medication, action) => setActionTarget({ medication, action }), onEdit: (medication) => {
                            setEditingId(medication._id);
                            setDraft(draftFrom(medication));
                            rememberWarnings([], '');
                        } }), _jsx(Panel, { title: "Medication timeline", subtitle: "Start, change, hold, resume, and stop events", children: _jsx(TimelineList, { points: timeline }) })] }))] }));
}
export function MedicationSummary({ patientId, onOpen, }) {
    const [summary, setSummary] = useState(null);
    const [error, setError] = useState('');
    useEffect(() => {
        let cancelled = false;
        clinicalApi
            .medications(patientId)
            .summary()
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
    const active = summary?.active.filter((item) => item.status === 'active') || [];
    const held = summary?.active.filter((item) => item.status === 'on-hold') || [];
    return (_jsxs(Panel, { title: "Medication summary", subtitle: "Active medications, recent changes, and related diagnoses", children: [error && (_jsx("div", { className: "mb-3 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm", children: error })), !summary ? (_jsx("p", { className: "text-sm text-gray-500", children: "Loading medications..." })) : (_jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-6", children: [_jsxs("section", { children: [_jsx("h3", { className: "text-xs font-medium text-gray-500 mb-2", children: "Active medications" }), active.length === 0 && held.length === 0 ? (_jsx("p", { className: "text-sm text-gray-500", children: "No active medications." })) : (_jsxs("ul", { className: "space-y-2 text-sm", children: [active.map((medication) => (_jsxs("li", { children: [_jsx("div", { className: "font-medium text-gray-900", children: medicationTitle(medication) }), _jsx("div", { className: "text-gray-600", children: regimen(medication) })] }, medication._id))), held.map((medication) => (_jsxs("li", { className: "flex items-start justify-between gap-2", children: [_jsxs("div", { children: [_jsx("div", { className: "font-medium text-gray-900", children: medicationTitle(medication) }), _jsx("div", { className: "text-gray-600", children: regimen(medication) })] }), _jsx(StatusBadge, { value: "on-hold" })] }, medication._id)))] }))] }), _jsxs("section", { children: [_jsx("h3", { className: "text-xs font-medium text-gray-500 mb-2", children: "Recent changes" }), summary.recentChanges.length === 0 ? (_jsx("p", { className: "text-sm text-gray-500", children: "No recent medication changes." })) : (_jsx("ul", { className: "space-y-2 text-sm", children: summary.recentChanges.map((change, index) => (_jsxs("li", { children: [_jsx("div", { className: "font-medium text-gray-900", children: change.label }), _jsxs("div", { className: "text-gray-600", children: [medicationTitle(change), " \u00B7 ", formatEncounterWhen(change.at)] })] }, `${change.medicationId}-${change.at}-${index}`))) }))] }), _jsxs("section", { children: [_jsx("h3", { className: "text-xs font-medium text-gray-500 mb-2", children: "Related diagnosis" }), summary.relatedDiagnoses.length === 0 ? (_jsx("p", { className: "text-sm text-gray-500", children: "No related diagnosis is linked yet." })) : (_jsx("ul", { className: "space-y-2 text-sm", children: summary.relatedDiagnoses.map((item) => (_jsxs("li", { children: [_jsx("div", { className: "font-medium text-gray-900", children: medicationTitle(item) }), _jsxs("div", { className: "text-gray-600", children: [item.diagnosis?.display, item.diagnosis?.code ? ` · ${item.diagnosis.code}` : ''] })] }, item.medicationId))) }))] })] })), onOpen && (_jsx("button", { type: "button", className: `${btnText} mt-4`, onClick: onOpen, children: "Open medication record" }))] }));
}
