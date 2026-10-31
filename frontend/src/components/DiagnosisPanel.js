import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { authApi, clinicalApi, } from '../api/client';
import { StatusBadge } from './StatusBadge';
import Panel from './Panel';
import { formatEncounterWhen, providerName } from './encounterDisplay';
const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm';
const labelCls = 'block text-xs font-medium text-gray-600 mb-1';
const btnPrimary = 'px-4 py-2 bg-clinical-teal text-white rounded-lg text-sm hover:bg-clinical-teal-dark disabled:opacity-50';
const btnGhost = 'px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50';
const DIAGNOSIS_TYPES = ['working', 'final', 'encounter'];
function messageOf(err) {
    return err instanceof Error ? err.message : 'Request failed';
}
function dateInput(value) {
    return value ? value.slice(0, 10) : '';
}
function encounterMeta(dx) {
    if (dx.encounterId && typeof dx.encounterId === 'object') {
        return {
            id: dx.encounterId._id,
            title: dx.encounterId.chiefComplaint || 'Encounter',
            at: dx.encounterId.openedAt,
        };
    }
    return { id: String(dx.encounterId), title: 'Encounter', at: undefined };
}
function problemName(dx) {
    if (!dx.promotedProblemId || typeof dx.promotedProblemId === 'string')
        return '';
    return dx.promotedProblemId.display || '';
}
function defaultOwner(dx, fallback) {
    if (dx.recordedBy && typeof dx.recordedBy === 'object' && dx.recordedBy.role === 'clinician') {
        return dx.recordedBy._id;
    }
    return fallback || '';
}
function DiagnosisForm({ initial, onSubmit, onCancel, }) {
    const [code, setCode] = useState(initial?.code || '');
    const [description, setDescription] = useState(initial?.description || '');
    const [diagnosisType, setDiagnosisType] = useState(initial?.diagnosisType || 'working');
    const [primaryDiagnosis, setPrimaryDiagnosis] = useState(initial?.primaryDiagnosis || false);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    async function submit(event) {
        event.preventDefault();
        setSaving(true);
        setError('');
        try {
            await onSubmit({
                code: code.trim(),
                description: description.trim(),
                diagnosisType,
                primaryDiagnosis,
            });
        }
        catch (err) {
            setError(messageOf(err));
        }
        finally {
            setSaving(false);
        }
    }
    return (_jsxs("form", { onSubmit: submit, className: "space-y-3", children: [error && (_jsx("div", { className: "bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm", children: error })), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: labelCls, htmlFor: "dx-code", children: "ICD-10-CA code" }), _jsx("input", { id: "dx-code", value: code, onChange: (event) => setCode(event.target.value), className: inputCls, placeholder: "I10", required: true, maxLength: 8 })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, htmlFor: "dx-type", children: "Diagnosis type" }), _jsx("select", { id: "dx-type", value: diagnosisType, onChange: (event) => setDiagnosisType(event.target.value), className: inputCls, children: DIAGNOSIS_TYPES.map((type) => (_jsx("option", { value: type, children: type === 'working' ? 'Working' : type === 'final' ? 'Final' : 'Encounter' }, type))) })] }), _jsxs("div", { className: "md:col-span-2", children: [_jsx("label", { className: labelCls, htmlFor: "dx-description", children: "Description" }), _jsx("input", { id: "dx-description", value: description, onChange: (event) => setDescription(event.target.value), className: inputCls, required: true, maxLength: 500 })] })] }), _jsxs("label", { className: "flex items-center gap-2 text-sm text-gray-700", children: [_jsx("input", { type: "checkbox", checked: primaryDiagnosis, onChange: (event) => setPrimaryDiagnosis(event.target.checked) }), "Primary diagnosis for this encounter"] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { type: "submit", className: btnPrimary, disabled: saving, children: saving ? 'Saving...' : initial ? 'Save diagnosis' : 'Record diagnosis' }), initial && (_jsx("button", { type: "button", className: btnGhost, onClick: onCancel, children: "Cancel" }))] })] }));
}
function PromoteForm({ diagnosis, problems, clinicians, defaultOwnerId, onCancel, onPromote, }) {
    const [target, setTarget] = useState('active_problem');
    const [problemId, setProblemId] = useState(problems[0]?._id || '');
    const [severity, setSeverity] = useState('unknown');
    const [status, setStatus] = useState('');
    const [onsetDate, setOnsetDate] = useState(dateInput(diagnosis.recordedAt));
    const [ownerId, setOwnerId] = useState(defaultOwner(diagnosis, defaultOwnerId));
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    async function submit(event) {
        event.preventDefault();
        if (!ownerId) {
            setError('Choose a clinician owner');
            return;
        }
        if (target === 'existing_problem' && !problemId) {
            setError('Choose a problem to update');
            return;
        }
        setSaving(true);
        setError('');
        try {
            await onPromote({
                target,
                problemId: target === 'existing_problem' ? problemId : undefined,
                severity: target === 'active_problem' ? severity : undefined,
                onsetDate: target === 'active_problem' ? onsetDate || undefined : undefined,
                status: target === 'existing_problem' && status ? status : undefined,
                clinicianOwner: ownerId,
            });
        }
        catch (err) {
            setError(messageOf(err));
            setSaving(false);
        }
    }
    return (_jsxs("form", { onSubmit: submit, className: "mt-3 space-y-3 rounded-lg bg-gray-50 border border-gray-200 p-3", children: [error && (_jsx("div", { className: "bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm", children: error })), _jsxs("div", { className: "flex flex-wrap gap-3 text-sm", children: [_jsxs("label", { className: "flex items-center gap-2", children: [_jsx("input", { type: "radio", name: `promote-${diagnosis._id}`, checked: target === 'active_problem', onChange: () => setTarget('active_problem') }), "Active problem"] }), _jsxs("label", { className: "flex items-center gap-2", children: [_jsx("input", { type: "radio", name: `promote-${diagnosis._id}`, checked: target === 'existing_problem', onChange: () => setTarget('existing_problem') }), "Update existing problem"] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3", children: [target === 'existing_problem' ? (_jsxs("div", { className: "md:col-span-2", children: [_jsx("label", { className: labelCls, children: "Problem" }), _jsxs("select", { value: problemId, onChange: (event) => setProblemId(event.target.value), className: inputCls, required: true, children: [_jsx("option", { value: "", children: "Select a problem" }), problems.map((problem) => (_jsxs("option", { value: problem._id, children: [problem.display, " (", problem.status, ")"] }, problem._id)))] }), _jsxs("p", { className: "mt-1 text-xs text-gray-500", children: ["Copies ICD-10-CA ", diagnosis.code, " onto the selected problem."] })] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Severity" }), _jsxs("select", { value: severity, onChange: (event) => setSeverity(event.target.value), className: inputCls, children: [_jsx("option", { value: "mild", children: "Mild" }), _jsx("option", { value: "moderate", children: "Moderate" }), _jsx("option", { value: "severe", children: "Severe" }), _jsx("option", { value: "unknown", children: "Unknown" })] })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Onset" }), _jsx("input", { type: "date", value: onsetDate, onChange: (event) => setOnsetDate(event.target.value), className: inputCls })] })] })), target === 'existing_problem' && (_jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Status" }), _jsxs("select", { value: status, onChange: (event) => setStatus(event.target.value), className: inputCls, children: [_jsx("option", { value: "", children: "Keep current status" }), _jsx("option", { value: "active", children: "Active" }), _jsx("option", { value: "inactive", children: "Inactive" }), _jsx("option", { value: "resolved", children: "Resolved" })] })] })), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Clinician owner" }), _jsxs("select", { value: ownerId, onChange: (event) => setOwnerId(event.target.value), className: inputCls, required: true, children: [_jsx("option", { value: "", children: "Select a clinician" }), clinicians.map((person) => (_jsx("option", { value: person._id, children: person.displayName }, person._id)))] })] })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { type: "submit", className: btnPrimary, disabled: saving, children: saving ? 'Saving...' : target === 'active_problem' ? 'Add active problem' : 'Update problem' }), _jsx("button", { type: "button", className: btnGhost, onClick: onCancel, children: "Cancel" })] })] }));
}
export function EncounterDiagnosisList({ patientId, diagnoses, problems, clinicians, canManage, canEdit, defaultOwnerId, groupByEncounter, onEdit, onChanged, }) {
    const [promoteId, setPromoteId] = useState(null);
    const [error, setError] = useState('');
    const [removingId, setRemovingId] = useState('');
    const ordered = [...diagnoses].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
    async function promote(diagnosisId, body) {
        await clinicalApi.diagnoses(patientId).promote(diagnosisId, body);
        setPromoteId(null);
        await onChanged();
    }
    async function remove(diagnosis) {
        setRemovingId(diagnosis._id);
        setError('');
        try {
            await clinicalApi.diagnoses(patientId).remove(diagnosis._id);
            if (promoteId === diagnosis._id)
                setPromoteId(null);
            await onChanged();
        }
        catch (err) {
            setError(messageOf(err));
        }
        finally {
            setRemovingId('');
        }
    }
    function rows(items) {
        if (items.length === 0) {
            return _jsx("p", { className: "text-sm text-gray-500", children: "No encounter diagnoses." });
        }
        return (_jsx("ul", { className: "divide-y divide-gray-100", children: items.map((dx) => {
                const promoted = Boolean(dx.promotedProblemId);
                const linked = problemName(dx);
                return (_jsxs("li", { className: "py-3", children: [_jsxs("div", { className: "flex flex-wrap items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsxs("div", { className: "font-medium text-gray-900", children: [dx.code, " \u00B7 ", dx.description] }), _jsxs("div", { className: "mt-1 flex flex-wrap items-center gap-2 text-sm", children: [_jsx(StatusBadge, { value: dx.diagnosisType }), dx.primaryDiagnosis && (_jsx("span", { className: "text-xs font-medium text-clinical-teal", children: "Primary" })), _jsxs("span", { className: "text-gray-500", children: [formatEncounterWhen(dx.recordedAt), " \u00B7 ", providerName(dx.recordedBy)] })] }), promoted && (_jsxs("p", { className: "mt-1 text-sm text-gray-600", children: [dx.promotion === 'active_problem' ? 'Added as an active problem' : 'Problem list updated', linked ? `: ${linked}` : ''] }))] }), _jsxs("div", { className: "flex flex-wrap gap-3 text-sm", children: [canEdit && onEdit && !promoted && (_jsx("button", { type: "button", className: "text-clinical-teal hover:underline", onClick: () => onEdit(dx), children: "Edit" })), canEdit && !promoted && (_jsx("button", { type: "button", className: "text-red-700 hover:underline disabled:opacity-50", disabled: removingId === dx._id, onClick: () => void remove(dx), children: removingId === dx._id ? 'Removing...' : 'Remove' })), canManage && !promoted && (_jsx("button", { type: "button", className: "text-clinical-teal hover:underline", onClick: () => setPromoteId(promoteId === dx._id ? null : dx._id), children: promoteId === dx._id ? 'Close' : 'Promote' }))] })] }), promoteId === dx._id && (_jsx(PromoteForm, { diagnosis: dx, problems: problems, clinicians: clinicians, defaultOwnerId: defaultOwnerId, onCancel: () => setPromoteId(null), onPromote: (body) => promote(dx._id, body) }))] }, dx._id));
            }) }));
    }
    if (!groupByEncounter) {
        return (_jsxs("div", { children: [error && (_jsx("div", { className: "mb-3 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm", children: error })), rows(ordered)] }));
    }
    const groups = new Map();
    for (const dx of ordered) {
        const meta = encounterMeta(dx);
        const group = groups.get(meta.id) || { id: meta.id, title: meta.title, at: meta.at, items: [] };
        group.items.push(dx);
        groups.set(meta.id, group);
    }
    const grouped = [...groups.values()].sort((a, b) => (b.at || '').localeCompare(a.at || ''));
    return (_jsxs("div", { className: "space-y-5", children: [error && (_jsx("div", { className: "bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm", children: error })), grouped.length === 0 ? (_jsx("p", { className: "text-sm text-gray-500", children: "No encounter diagnoses." })) : (grouped.map((group) => (_jsxs("section", { children: [_jsxs("h3", { className: "text-sm font-semibold text-gray-900", children: [group.title, group.at ? _jsx("span", { className: "ml-2 font-normal text-gray-500", children: formatEncounterWhen(group.at) }) : null] }), rows(group.items)] }, group.id))))] }));
}
export function DiagnosisPanel({ patientId, encounterId, canManage, locked, defaultOwnerId, onActivity, }) {
    const [diagnoses, setDiagnoses] = useState([]);
    const [problems, setProblems] = useState([]);
    const [clinicians, setClinicians] = useState([]);
    const [editing, setEditing] = useState(null);
    const [error, setError] = useState('');
    const [loaded, setLoaded] = useState(false);
    async function load() {
        const [dx, problemPage] = await Promise.all([
            clinicalApi.diagnoses(patientId).list(`?encounterId=${encodeURIComponent(encounterId)}&limit=100`),
            clinicalApi.conditions(patientId).list('?limit=100'),
        ]);
        setDiagnoses(dx.data);
        setProblems(problemPage.data);
    }
    useEffect(() => {
        let cancelled = false;
        setLoaded(false);
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
                setLoaded(true);
        });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [patientId, encounterId]);
    useEffect(() => {
        if (!canManage)
            return;
        let cancelled = false;
        authApi
            .directory()
            .then((res) => {
            if (!cancelled)
                setClinicians(res.data.filter((person) => person.role === 'clinician'));
        })
            .catch(() => {
            if (!cancelled)
                setClinicians([]);
        });
        return () => {
            cancelled = true;
        };
    }, [canManage]);
    async function refresh() {
        await load();
        setEditing(null);
        await onActivity();
    }
    const editable = canManage && !locked;
    return (_jsxs("div", { className: "space-y-3 border-t border-gray-100 pt-4", children: [_jsx("h4", { className: "text-sm font-semibold text-gray-900", children: "Diagnoses" }), error && (_jsx("div", { className: "bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm", children: error })), editable && (_jsx(DiagnosisForm, { initial: editing, onCancel: () => setEditing(null), onSubmit: async (body) => {
                    if (editing)
                        await clinicalApi.diagnoses(patientId).update(editing._id, body);
                    else
                        await clinicalApi.diagnoses(patientId).create({ ...body, encounterId });
                    await refresh();
                } }, editing?._id || 'new')), locked && (_jsx("p", { className: "text-sm text-gray-600", children: "This encounter is locked. A recorded diagnosis can still be promoted to the problem list." })), !loaded ? (_jsx("p", { className: "text-sm text-gray-500", children: "Loading diagnoses..." })) : (_jsx(EncounterDiagnosisList, { patientId: patientId, diagnoses: diagnoses, problems: problems, clinicians: clinicians, canManage: canManage, canEdit: editable, defaultOwnerId: defaultOwnerId, onEdit: setEditing, onChanged: refresh }))] }));
}
export function codeLabel(problem) {
    const text = [problem.codeSystem, problem.code].filter(Boolean).join(' ');
    return text || '—';
}
export function ProblemSections({ title, emptyLabel, items, canWrite, onEdit, }) {
    return (_jsx(Panel, { title: title, children: items.length === 0 ? (_jsx("p", { className: "text-sm text-gray-500", children: emptyLabel })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-xs font-medium text-gray-500 border-b border-gray-200", children: [_jsx("th", { className: "pb-3 pr-3", children: "Problem" }), _jsx("th", { className: "pb-3 pr-3", children: "Status" }), _jsx("th", { className: "pb-3 pr-3", children: "Severity" }), _jsx("th", { className: "pb-3 pr-3", children: "Code" }), _jsx("th", { className: "pb-3 pr-3", children: "Onset" }), _jsx("th", { className: "pb-3 pr-3", children: "Resolved" }), _jsx("th", { className: "pb-3 pr-3", children: "Clinician" }), _jsx("th", { className: "pb-3" })] }) }), _jsx("tbody", { className: "divide-y divide-gray-100", children: items.map((problem) => (_jsxs("tr", { children: [_jsxs("td", { className: "py-3 pr-3 font-medium", children: [problem.display, problem.sourceDiagnosisId && (_jsx("div", { className: "text-xs font-normal text-gray-500", children: "From a visit diagnosis" }))] }), _jsx("td", { className: "py-3 pr-3", children: _jsx(StatusBadge, { value: problem.status }) }), _jsx("td", { className: "py-3 pr-3", children: _jsx(StatusBadge, { value: problem.severity }) }), _jsx("td", { className: "py-3 pr-3 text-gray-600", children: codeLabel(problem) }), _jsx("td", { className: "py-3 pr-3 text-gray-600", children: dateInput(problem.onsetDate) || '—' }), _jsx("td", { className: "py-3 pr-3 text-gray-600", children: dateInput(problem.resolvedDate) || '—' }), _jsx("td", { className: "py-3 pr-3 text-gray-600", children: providerName(problem.clinicianOwner) }), _jsx("td", { className: "py-3 text-right", children: canWrite && (_jsx("button", { type: "button", className: "text-clinical-teal hover:underline", onClick: () => onEdit(problem), children: "Edit" })) })] }, problem._id))) })] }) })) }));
}
