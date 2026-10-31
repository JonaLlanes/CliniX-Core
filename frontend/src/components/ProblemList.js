import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { clinicalApi, } from '../api/client';
import Panel from './Panel';
import { EncounterDiagnosisList, ProblemSections } from './DiagnosisPanel';
import { providerId } from './encounterDisplay';
const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm';
const labelCls = 'block text-xs font-medium text-gray-600 mb-1';
const btnPrimary = 'px-4 py-2 bg-clinical-teal text-white rounded-lg text-sm hover:bg-clinical-teal-dark';
const btnGhost = 'px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50';
function dateInput(value) {
    return value ? value.slice(0, 10) : '';
}
function todayInput() {
    return new Date().toISOString().slice(0, 10);
}
function ProblemForm({ initial, clinicians, onSubmit, onCancel, }) {
    const [status, setStatus] = useState(initial?.status || 'active');
    const [resolvedDate, setResolvedDate] = useState(dateInput(initial?.resolvedDate) || (initial?.status === 'resolved' ? '' : ''));
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    async function submit(event) {
        event.preventDefault();
        const fd = new FormData(event.currentTarget);
        const body = {
            display: fd.get('display'),
            status,
            severity: fd.get('severity'),
            onsetDate: fd.get('onsetDate') || undefined,
            clinicianOwner: fd.get('clinicianOwner') || undefined,
            codeSystem: fd.get('codeSystem') || undefined,
            code: fd.get('code') || undefined,
        };
        if (status === 'resolved')
            body.resolvedDate = resolvedDate || undefined;
        setSaving(true);
        setError('');
        try {
            await onSubmit(body);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed');
        }
        finally {
            setSaving(false);
        }
    }
    return (_jsxs("form", { onSubmit: submit, className: "bg-white rounded-lg border border-gray-200 p-6", children: [error && (_jsx("div", { className: "mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm", children: error })), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [_jsxs("div", { className: "md:col-span-2", children: [_jsx("label", { className: labelCls, children: "Problem" }), _jsx("input", { name: "display", required: true, defaultValue: initial?.display || '', className: inputCls })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Status" }), _jsxs("select", { value: status, onChange: (event) => {
                                    const next = event.target.value;
                                    setStatus(next);
                                    if (next === 'resolved' && !resolvedDate)
                                        setResolvedDate(todayInput());
                                }, className: inputCls, children: [_jsx("option", { value: "active", children: "Active" }), _jsx("option", { value: "inactive", children: "Inactive" }), _jsx("option", { value: "resolved", children: "Resolved" })] })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Severity" }), _jsxs("select", { name: "severity", defaultValue: initial?.severity || 'unknown', className: inputCls, children: [_jsx("option", { value: "mild", children: "Mild" }), _jsx("option", { value: "moderate", children: "Moderate" }), _jsx("option", { value: "severe", children: "Severe" }), _jsx("option", { value: "unknown", children: "Unknown" })] })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Onset" }), _jsx("input", { name: "onsetDate", type: "date", defaultValue: dateInput(initial?.onsetDate), className: inputCls })] }), status === 'resolved' && (_jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Resolved" }), _jsx("input", { type: "date", value: resolvedDate, onChange: (event) => setResolvedDate(event.target.value), className: inputCls, required: true })] })), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Clinician owner" }), _jsxs("select", { name: "clinicianOwner", defaultValue: providerId(initial?.clinicianOwner), className: inputCls, children: [_jsx("option", { value: "", children: "\u2014" }), clinicians.map((person) => (_jsx("option", { value: person._id, children: person.displayName }, person._id)))] })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Code system" }), _jsxs("select", { name: "codeSystem", defaultValue: initial?.codeSystem || 'ICD-10-CA', className: inputCls, children: [_jsx("option", { value: "", children: "\u2014" }), _jsx("option", { value: "ICD-10-CA", children: "ICD-10-CA" }), _jsx("option", { value: "ICD-10", children: "ICD-10" }), _jsx("option", { value: "SNOMED", children: "SNOMED" })] })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Code" }), _jsx("input", { name: "code", defaultValue: initial?.code || '', className: inputCls, placeholder: "I10" })] })] }), _jsxs("div", { className: "mt-4 flex gap-2", children: [_jsx("button", { type: "submit", className: btnPrimary, disabled: saving, children: saving ? 'Saving...' : initial ? 'Save problem' : 'Add problem' }), initial && (_jsx("button", { type: "button", onClick: onCancel, className: btnGhost, children: "Cancel" }))] })] }));
}
export default function ProblemList({ patientId, problems, diagnoses, clinicians, canWriteProblems, canManageDiagnoses, onChange, }) {
    const [editing, setEditing] = useState(null);
    const [formKey, setFormKey] = useState(0);
    const active = problems.filter((problem) => problem.status === 'active');
    const inactive = problems.filter((problem) => problem.status === 'inactive');
    const resolved = problems.filter((problem) => problem.status === 'resolved');
    return (_jsxs("div", { className: "space-y-6", children: [canWriteProblems && (_jsx(ProblemForm, { initial: editing, clinicians: clinicians, onCancel: () => setEditing(null), onSubmit: async (body) => {
                    if (editing)
                        await clinicalApi.conditions(patientId).update(editing._id, body);
                    else
                        await clinicalApi.conditions(patientId).create(body);
                    setEditing(null);
                    setFormKey((value) => value + 1);
                    await onChange();
                } }, editing?._id || `new-${formKey}`)), _jsx(ProblemSections, { title: "Active problems", emptyLabel: "No active problems.", items: active, canWrite: canWriteProblems, onEdit: setEditing }), _jsx(ProblemSections, { title: "Resolved problems", emptyLabel: "No resolved problems.", items: resolved, canWrite: canWriteProblems, onEdit: setEditing }), _jsx(ProblemSections, { title: "Inactive problems", emptyLabel: "No inactive problems.", items: inactive, canWrite: canWriteProblems, onEdit: setEditing }), _jsx(Panel, { title: "Encounter diagnoses", subtitle: "Visit diagnoses stay on the encounter until they are promoted onto the problem list", children: _jsx(EncounterDiagnosisList, { patientId: patientId, diagnoses: diagnoses, problems: problems, clinicians: clinicians, canManage: canManageDiagnoses, canEdit: false, groupByEncounter: true, onChanged: onChange }) })] }));
}
