import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { clinicalApi, } from '../api/client';
import Panel, { EmptyState } from './Panel';
import { StatusBadge } from './StatusBadge';
import { formatEncounterWhen, providerName } from './encounterDisplay';
import { chartRecordId, focusedRecordClass, watchChartRecord } from './chart/recordFocus';
const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm';
const labelCls = 'block text-xs font-medium text-gray-600 mb-1';
const btnPrimary = 'px-4 py-2 bg-clinical-teal text-white rounded-lg text-sm hover:bg-clinical-teal-dark disabled:opacity-50';
const btnGhost = 'px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50';
const btnText = 'text-sm text-clinical-teal hover:underline disabled:opacity-50';
const PLAN_STATUSES = [
    { value: 'draft', label: 'Draft' },
    { value: 'active', label: 'Active' },
    { value: 'on_hold', label: 'On Hold' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
];
const PLAN_NEXT = {
    draft: ['active', 'cancelled'],
    active: ['on_hold', 'completed', 'cancelled'],
    on_hold: ['active', 'completed', 'cancelled'],
    completed: [],
    cancelled: [],
};
const GOAL_NEXT = {
    not_started: ['in_progress', 'achieved', 'cancelled'],
    in_progress: ['not_started', 'achieved', 'cancelled'],
    achieved: [],
    cancelled: [],
};
const INTERVENTION_NEXT = {
    planned: ['active', 'completed', 'cancelled'],
    active: ['planned', 'completed', 'cancelled'],
    completed: [],
    cancelled: [],
};
const ROLES = [
    { value: 'clinician', label: 'Clinician' },
    { value: 'nurse', label: 'Nurse' },
    { value: 'caregiver', label: 'Caregiver' },
    { value: 'pharmacist', label: 'Pharmacist' },
];
const VIEWS = [
    { value: 'current', label: 'Current' },
    { value: 'active', label: 'Active' },
    { value: 'closed', label: 'Closed' },
    { value: 'all', label: 'All' },
];
function messageOf(err) {
    return err instanceof Error ? err.message : 'Request failed';
}
function todayInput() {
    const date = new Date();
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 10);
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
function refId(value) {
    if (!value)
        return '';
    return typeof value === 'string' ? value : value._id;
}
function ids(values) {
    return values || [];
}
function statusChoices(current, next, labels) {
    const allowed = new Set([current, ...next]);
    return labels.filter((item) => allowed.has(item.value));
}
function Field({ label, children }) {
    return (_jsxs("div", { children: [_jsx("label", { className: labelCls, children: label }), children] }));
}
export function CarePlanSummary({ patientId, onOpen, }) {
    const [summary, setSummary] = useState(null);
    const [error, setError] = useState('');
    useEffect(() => {
        let cancelled = false;
        clinicalApi
            .carePlans(patientId)
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
    return (_jsxs(Panel, { title: "Care plans", subtitle: "Active plans, overdue goals, and upcoming tasks", children: [error && (_jsx("div", { className: "mb-3 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm", children: error })), !summary ? (_jsx("p", { className: "text-sm text-gray-500", children: "Loading care plans..." })) : (_jsxs("div", { className: "space-y-5", children: [_jsxs("section", { children: [_jsx("h3", { className: "text-sm font-medium text-gray-900 mb-2", children: "Active plans" }), summary.active.length === 0 ? (_jsx("p", { className: "text-sm text-gray-500", children: "No active care plans." })) : (_jsx("ul", { className: "space-y-2", children: summary.active.map((plan) => (_jsxs("li", { className: "text-sm", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("span", { className: "font-medium text-gray-900", children: plan.title }), _jsx(StatusBadge, { value: plan.status })] }), _jsxs("div", { className: "text-gray-600", children: [plan.primaryDiagnosis || 'No primary diagnosis', plan.owner ? ` · ${plan.owner}` : '', plan.targetDate ? ` · target ${day(plan.targetDate)}` : ''] })] }, plan._id))) }))] }), summary.onHold.length > 0 && (_jsxs("section", { children: [_jsx("h3", { className: "text-sm font-medium text-gray-900 mb-2", children: "On hold" }), _jsx("ul", { className: "space-y-2", children: summary.onHold.map((plan) => (_jsxs("li", { className: "text-sm flex flex-wrap items-center gap-2", children: [_jsx("span", { className: "font-medium text-gray-900", children: plan.title }), _jsx(StatusBadge, { value: plan.status })] }, plan._id))) })] })), _jsxs("section", { children: [_jsx("h3", { className: "text-sm font-medium text-gray-900 mb-2", children: "Overdue goals" }), summary.overdueGoals.length === 0 ? (_jsx("p", { className: "text-sm text-gray-500", children: "No overdue goals." })) : (_jsx("ul", { className: "space-y-2", children: summary.overdueGoals.map((goal) => (_jsxs("li", { className: "text-sm", children: [_jsxs("div", { className: "font-medium text-gray-900", children: [goal.description, goal.targetValue ? ` · ${goal.targetValue}` : ''] }), _jsxs("div", { className: "text-gray-600", children: [goal.carePlanTitle, " \u00B7 due ", day(goal.targetDate)] })] }, goal._id))) }))] }), _jsxs("section", { children: [_jsx("h3", { className: "text-sm font-medium text-gray-900 mb-2", children: "Upcoming tasks" }), summary.upcomingTasks.length === 0 ? (_jsx("p", { className: "text-sm text-gray-500", children: "No upcoming care plan tasks." })) : (_jsx("ul", { className: "space-y-2", children: summary.upcomingTasks.map((task) => (_jsxs("li", { className: "text-sm", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("span", { className: "font-medium text-gray-900", children: task.title }), _jsx(StatusBadge, { value: task.status })] }), _jsxs("div", { className: "text-gray-600", children: [task.carePlanTitle, " \u00B7 ", task.assigneeRole, task.dueDate ? ` · due ${day(task.dueDate)}` : ''] })] }, task._id))) }))] })] })), onOpen && (_jsx("button", { type: "button", className: `${btnText} mt-4`, onClick: onOpen, children: "Open care plans" }))] }));
}
export function CarePlanPanel({ patientId, canWrite, actorId, recordFocus = null, }) {
    const [plans, setPlans] = useState([]);
    const [options, setOptions] = useState(null);
    const [view, setView] = useState(recordFocus?.tab === 'care' ? 'all' : 'current');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    async function load(nextView = view) {
        setLoading(true);
        try {
            const [listed, opts] = await Promise.all([
                clinicalApi.carePlans(patientId).list(`?view=${nextView}&limit=100`),
                clinicalApi.carePlans(patientId).options(),
            ]);
            setPlans(listed.data);
            setOptions(opts);
            setError('');
        }
        catch (err) {
            setError(messageOf(err));
        }
        finally {
            setLoading(false);
        }
    }
    useEffect(() => {
        load(view);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [patientId, view]);
    const careFocus = recordFocus?.tab === 'care' ? recordFocus : null;
    const seenCareFocus = useRef(0);
    useEffect(() => {
        if (!careFocus)
            return;
        setView('all');
    }, [careFocus]);
    useEffect(() => {
        if (!careFocus || loading || view !== 'all')
            return;
        if (seenCareFocus.current === careFocus.token)
            return;
        seenCareFocus.current = careFocus.token;
        return watchChartRecord('care', careFocus.recordId);
    }, [careFocus, loading, view]);
    async function run(action) {
        setBusy(true);
        try {
            await action();
            setError('');
            await load();
        }
        catch (err) {
            setError(messageOf(err));
            throw err;
        }
        finally {
            setBusy(false);
        }
    }
    return (_jsxs("div", { className: "space-y-6", children: [error && (_jsx("div", { className: "bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm", children: error })), canWrite && options && (_jsx(CreatePlan, { options: options, actorId: actorId, busy: busy, onSubmit: (body) => run(() => clinicalApi.carePlans(patientId).create(body).then(() => undefined)) })), _jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [_jsx("h2", { className: "font-semibold text-gray-900", children: "Care plans" }), _jsx("select", { className: inputCls, style: { width: 'auto' }, value: view, onChange: (event) => setView(event.target.value), children: VIEWS.map((item) => (_jsx("option", { value: item.value, children: item.label }, item.value))) })] }), loading ? (_jsx("p", { className: "text-sm text-gray-500", children: "Loading care plans..." })) : plans.length === 0 ? (_jsx(Panel, { children: _jsx(EmptyState, { text: "No care plans in this view", hint: "Active, on-hold, and completed plans for this chart are listed here." }) })) : (plans.map((plan) => (_jsx("div", { id: chartRecordId('care', plan._id), className: focusedRecordClass(plan._id === careFocus?.recordId), children: _jsx(PlanCard, { plan: plan, options: options, canWrite: canWrite, busy: busy, onRun: run, patientId: patientId }) }, plan._id))))] }));
}
function CreatePlan({ options, actorId, busy, onSubmit, }) {
    const ownerDefault = options.clinicians.find((person) => person._id === actorId)?._id || options.clinicians[0]?._id || '';
    const [formError, setFormError] = useState('');
    async function submit(event) {
        event.preventDefault();
        const form = event.currentTarget;
        const fd = new FormData(form);
        const status = String(fd.get('status') || 'draft');
        const primaryDiagnosisId = String(fd.get('primaryDiagnosisId') || '');
        if (status === 'active' && !primaryDiagnosisId) {
            setFormError('An active care plan needs a primary diagnosis');
            return;
        }
        const problemIds = fd.getAll('problemIds').map(String);
        const encounterDiagnosisIds = fd.getAll('encounterDiagnosisIds').map(String);
        try {
            await onSubmit({
                title: fd.get('title'),
                description: fd.get('description'),
                status,
                startDate: fd.get('startDate'),
                targetDate: fd.get('targetDate') || undefined,
                ownerClinicianId: fd.get('ownerClinicianId'),
                encounterId: fd.get('encounterId') || undefined,
                primaryDiagnosisId: primaryDiagnosisId || undefined,
                problemIds,
                encounterDiagnosisIds,
            });
            setFormError('');
            form.reset();
        }
        catch {
            setFormError('');
        }
    }
    return (_jsxs("form", { onSubmit: submit, className: "bg-white rounded-lg border border-gray-200 p-6", children: [_jsx("h3", { className: "font-semibold text-gray-900 mb-1", children: "New care plan" }), _jsx("p", { className: "text-sm text-gray-500 mb-4", children: "Start a longitudinal plan and link it to an active problem or an encounter diagnosis." }), formError && (_jsx("div", { className: "mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm", children: formError })), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsx(Field, { label: "Title", children: _jsx("input", { name: "title", required: true, className: inputCls }) }), _jsx(Field, { label: "Status", children: _jsxs("select", { name: "status", defaultValue: "active", className: inputCls, children: [_jsx("option", { value: "draft", children: "Draft" }), _jsx("option", { value: "active", children: "Active" })] }) }), _jsx("div", { className: "md:col-span-2", children: _jsx(Field, { label: "Description", children: _jsx("textarea", { name: "description", required: true, rows: 3, className: inputCls }) }) }), _jsx(Field, { label: "Start date", children: _jsx("input", { name: "startDate", type: "date", required: true, defaultValue: todayInput(), className: inputCls }) }), _jsx(Field, { label: "Target date", children: _jsx("input", { name: "targetDate", type: "date", className: inputCls }) }), _jsx(Field, { label: "Owner", children: _jsx("select", { name: "ownerClinicianId", required: true, defaultValue: ownerDefault, className: inputCls, children: options.clinicians.map((person) => (_jsx("option", { value: person._id, children: person.displayName }, person._id))) }) }), _jsx(Field, { label: "Encounter", children: _jsxs("select", { name: "encounterId", defaultValue: "", className: inputCls, children: [_jsx("option", { value: "", children: "Not linked" }), options.encounters.map((encounter) => (_jsxs("option", { value: encounter._id, children: [encounter.chiefComplaint || 'Encounter', " \u00B7 ", day(encounter.openedAt)] }, encounter._id)))] }) }), _jsx("div", { className: "md:col-span-2", children: _jsx(DiagnosisPicker, { options: options }) })] }), _jsx("button", { type: "submit", disabled: busy, className: `${btnPrimary} mt-4`, children: "Create care plan" })] }));
}
function DiagnosisPicker({ options, primaryId = '', problemIds = [], diagnosisIds = [], }) {
    return (_jsxs("div", { className: "space-y-3", children: [_jsx(Field, { label: "Primary diagnosis", children: _jsxs("select", { name: "primaryDiagnosisId", defaultValue: primaryId, className: inputCls, children: [_jsx("option", { value: "", children: "None yet" }), _jsx("optgroup", { label: "Active problems", children: options.problems.map((problem) => (_jsxs("option", { value: problem._id, children: [problem.code ? `${problem.code} · ` : '', problem.display] }, problem._id))) }), _jsx("optgroup", { label: "Encounter diagnoses", children: options.diagnoses.map((diagnosis) => (_jsxs("option", { value: diagnosis._id, children: [diagnosis.code, " \u00B7 ", diagnosis.description] }, diagnosis._id))) })] }) }), _jsxs("details", { children: [_jsx("summary", { className: "text-sm text-clinical-teal cursor-pointer", children: "Also link problems and diagnoses" }), _jsxs("div", { className: "mt-3 grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs font-medium text-gray-600 mb-2", children: "Active problems" }), _jsxs("div", { className: "max-h-36 overflow-auto space-y-1", children: [options.problems.length === 0 && _jsx("p", { className: "text-sm text-gray-500", children: "No active problems." }), options.problems.map((problem) => (_jsxs("label", { className: "flex items-start gap-2 text-sm text-gray-700", children: [_jsx("input", { type: "checkbox", name: "problemIds", value: problem._id, defaultChecked: problemIds.includes(problem._id), className: "mt-1" }), _jsxs("span", { children: [problem.code ? `${problem.code} · ` : '', problem.display] })] }, problem._id)))] })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs font-medium text-gray-600 mb-2", children: "Encounter diagnoses" }), _jsxs("div", { className: "max-h-36 overflow-auto space-y-1", children: [options.diagnoses.length === 0 && _jsx("p", { className: "text-sm text-gray-500", children: "No encounter diagnoses." }), options.diagnoses.map((diagnosis) => (_jsxs("label", { className: "flex items-start gap-2 text-sm text-gray-700", children: [_jsx("input", { type: "checkbox", name: "encounterDiagnosisIds", value: diagnosis._id, defaultChecked: diagnosisIds.includes(diagnosis._id), className: "mt-1" }), _jsxs("span", { children: [diagnosis.code, " \u00B7 ", diagnosis.description] })] }, diagnosis._id)))] })] })] })] })] }));
}
function PlanCard({ plan, options, canWrite, busy, patientId, onRun, }) {
    const [editing, setEditing] = useState(false);
    const [completedDate, setCompletedDate] = useState(todayInput());
    const [pendingStatus, setPendingStatus] = useState('');
    const closed = plan.status === 'completed' || plan.status === 'cancelled';
    const editable = canWrite && !closed;
    const api = clinicalApi.carePlans(patientId);
    function saveStatus(status) {
        if (status === plan.status)
            return;
        if (status === 'completed') {
            setPendingStatus(status);
            return;
        }
        setPendingStatus('');
        onRun(() => api.setStatus(plan._id, { status }).then(() => undefined)).catch(() => undefined);
    }
    return (_jsxs(Panel, { title: plan.title, subtitle: plan.description, children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2 mb-4", children: [editable ? (_jsx("select", { className: inputCls, style: { width: 'auto' }, value: pendingStatus || plan.status, disabled: busy, onChange: (event) => saveStatus(event.target.value), children: statusChoices(plan.status, PLAN_NEXT[plan.status], PLAN_STATUSES).map((item) => (_jsx("option", { value: item.value, children: item.label }, item.value))) })) : (_jsx(StatusBadge, { value: plan.status })), pendingStatus === 'completed' && (_jsxs(_Fragment, { children: [_jsx("input", { type: "date", className: inputCls, style: { width: 'auto' }, value: completedDate, onChange: (event) => setCompletedDate(event.target.value) }), _jsx("button", { type: "button", className: btnPrimary, disabled: busy, onClick: () => onRun(() => api.setStatus(plan._id, { status: 'completed', completedDate }).then(() => undefined)).catch(() => undefined), children: "Complete plan" })] })), editable && options && (_jsx("button", { type: "button", className: btnText, onClick: () => setEditing((open) => !open), children: editing ? 'Close editor' : 'Edit plan' }))] }), _jsxs("dl", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm mb-4", children: [_jsxs("div", { children: [_jsx("dt", { className: "text-gray-500", children: "Owner" }), _jsx("dd", { children: providerName(plan.ownerClinicianId) })] }), _jsxs("div", { children: [_jsx("dt", { className: "text-gray-500", children: "Start" }), _jsx("dd", { children: day(plan.startDate) })] }), _jsxs("div", { children: [_jsx("dt", { className: "text-gray-500", children: "Target" }), _jsx("dd", { children: day(plan.targetDate) })] }), _jsxs("div", { children: [_jsx("dt", { className: "text-gray-500", children: "Completed" }), _jsx("dd", { children: day(plan.completedDate) })] })] }), editing && options && (_jsx(EditPlan, { plan: plan, options: options, busy: busy, onSave: (body) => onRun(() => api.update(plan._id, body).then(() => setEditing(false))) })), _jsx("h3", { className: "text-sm font-medium text-gray-900 mb-2", children: "Linked diagnoses" }), (plan.linkedDiagnoses || []).length === 0 ? (_jsx("p", { className: "text-sm text-gray-500 mb-4", children: "No diagnosis is linked yet." })) : (_jsx("ul", { className: "space-y-1 mb-4", children: (plan.linkedDiagnoses || []).map((item) => (_jsxs("li", { className: "flex flex-wrap items-center gap-2 text-sm", children: [_jsx("span", { children: item.label }), _jsx("span", { className: "text-xs text-gray-500", children: item.kind === 'problem' ? 'Problem' : 'Encounter diagnosis' }), item.primary && _jsx("span", { className: "text-xs font-medium text-clinical-teal", children: "Primary" })] }, `${item.kind}-${item.id}`))) })), _jsx(GoalList, { plan: plan, editable: editable, busy: busy, patientId: patientId, onRun: onRun }), _jsx(InterventionList, { plan: plan, editable: editable, busy: busy, patientId: patientId, onRun: onRun }), _jsx(RelatedChart, { plan: plan }), _jsx(ProgressList, { plan: plan, canWrite: canWrite && plan.status !== 'cancelled', busy: busy, onAdd: (note) => onRun(() => api.addProgress(plan._id, { note }).then(() => undefined)) }), _jsx("h3", { className: "text-sm font-medium text-gray-900 mt-6 mb-2", children: "Plan activity" }), (plan.timeline || []).length === 0 ? (_jsx("p", { className: "text-sm text-gray-500", children: "Activity appears after the plan, a goal, or an intervention is recorded." })) : (_jsx("ol", { className: "space-y-3", children: (plan.timeline || []).map((point, index) => (_jsxs("li", { className: "flex gap-3 text-sm", children: [_jsx("div", { className: "w-36 shrink-0 text-gray-500", children: formatEncounterWhen(point.at) }), _jsxs("div", { children: [_jsx("div", { className: "font-medium text-gray-900", children: point.label }), _jsx("div", { className: "text-gray-600", children: point.detail })] })] }, `${point.action}-${point.at}-${index}`))) }))] }));
}
function EditPlan({ plan, options, busy, onSave, }) {
    async function submit(event) {
        event.preventDefault();
        const fd = new FormData(event.currentTarget);
        try {
            await onSave({
                title: fd.get('title'),
                description: fd.get('description'),
                startDate: fd.get('startDate'),
                targetDate: fd.get('targetDate') || null,
                ownerClinicianId: fd.get('ownerClinicianId'),
                encounterId: fd.get('encounterId') || null,
                primaryDiagnosisId: fd.get('primaryDiagnosisId') || null,
                problemIds: fd.getAll('problemIds').map(String),
                encounterDiagnosisIds: fd.getAll('encounterDiagnosisIds').map(String),
            });
        }
        catch {
            // The plan panel shows the error.
        }
    }
    return (_jsxs("form", { onSubmit: submit, className: "mb-6 border border-gray-200 rounded-lg p-4 space-y-4", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsx(Field, { label: "Title", children: _jsx("input", { name: "title", required: true, defaultValue: plan.title, className: inputCls }) }), _jsx(Field, { label: "Owner", children: _jsx("select", { name: "ownerClinicianId", required: true, defaultValue: refId(plan.ownerClinicianId), className: inputCls, children: options.clinicians.map((person) => (_jsx("option", { value: person._id, children: person.displayName }, person._id))) }) }), _jsx("div", { className: "md:col-span-2", children: _jsx(Field, { label: "Description", children: _jsx("textarea", { name: "description", required: true, rows: 3, defaultValue: plan.description || '', className: inputCls }) }) }), _jsx(Field, { label: "Start date", children: _jsx("input", { name: "startDate", type: "date", required: true, defaultValue: plan.startDate?.slice(0, 10) || '', className: inputCls }) }), _jsx(Field, { label: "Target date", children: _jsx("input", { name: "targetDate", type: "date", defaultValue: plan.targetDate?.slice(0, 10) || '', className: inputCls }) }), _jsx(Field, { label: "Encounter", children: _jsxs("select", { name: "encounterId", defaultValue: refId(plan.encounterId), className: inputCls, children: [_jsx("option", { value: "", children: "Not linked" }), options.encounters.map((encounter) => (_jsxs("option", { value: encounter._id, children: [encounter.chiefComplaint || 'Encounter', " \u00B7 ", day(encounter.openedAt)] }, encounter._id)))] }) })] }), _jsx(DiagnosisPicker, { options: options, primaryId: plan.primaryDiagnosisId || '', problemIds: ids(plan.problemIds), diagnosisIds: ids(plan.encounterDiagnosisIds) }), _jsx("button", { type: "submit", disabled: busy, className: btnPrimary, children: "Save plan" })] }));
}
function GoalList({ plan, editable, busy, patientId, onRun, }) {
    const goals = plan.goals || [];
    const api = clinicalApi.carePlans(patientId);
    async function add(event) {
        event.preventDefault();
        const form = event.currentTarget;
        const fd = new FormData(form);
        try {
            await onRun(async () => {
                await api.addGoal(plan._id, {
                    description: fd.get('description'),
                    targetValue: fd.get('targetValue') || undefined,
                    targetDate: fd.get('targetDate'),
                    status: fd.get('status'),
                });
                form.reset();
            });
        }
        catch {
            // The plan panel shows the error.
        }
    }
    return (_jsxs("section", { className: "mb-6", children: [_jsx("h3", { className: "text-sm font-medium text-gray-900 mb-2", children: "Goals" }), goals.length === 0 ? (_jsx("p", { className: "text-sm text-gray-500 mb-3", children: "No goals yet." })) : (_jsx("ul", { className: "space-y-2 mb-3", children: goals.map((goal) => (_jsxs("li", { className: "flex flex-wrap items-center gap-2 text-sm", children: [_jsxs("span", { className: goal.overdue ? 'text-amber-800' : 'text-gray-900', children: [goal.description, goal.targetValue ? ` · ${goal.targetValue}` : '', " \u00B7 ", day(goal.targetDate)] }), goal.overdue && _jsx("span", { className: "text-xs font-medium text-amber-700", children: "Overdue" }), editable && GOAL_NEXT[goal.status].length > 0 ? (_jsx("select", { className: inputCls, style: { width: 'auto' }, value: goal.status, disabled: busy, onChange: (event) => onRun(() => api.updateGoal(plan._id, goal._id, { status: event.target.value }).then(() => undefined)).catch(() => undefined), children: statusChoices(goal.status, GOAL_NEXT[goal.status], [
                                { value: 'not_started', label: 'Not Started' },
                                { value: 'in_progress', label: 'In Progress' },
                                { value: 'achieved', label: 'Achieved' },
                                { value: 'cancelled', label: 'Cancelled' },
                            ]).map((item) => (_jsx("option", { value: item.value, children: item.label }, item.value))) })) : (_jsx(StatusBadge, { value: goal.status }))] }, goal._id))) })), editable && (_jsxs("form", { onSubmit: add, className: "grid grid-cols-1 md:grid-cols-4 gap-3", children: [_jsx("input", { name: "description", required: true, placeholder: "Goal", className: inputCls }), _jsx("input", { name: "targetValue", placeholder: "Target value", className: inputCls }), _jsx("input", { name: "targetDate", type: "date", required: true, className: inputCls }), _jsxs("div", { className: "flex gap-2", children: [_jsxs("select", { name: "status", defaultValue: "not_started", className: inputCls, children: [_jsx("option", { value: "not_started", children: "Not Started" }), _jsx("option", { value: "in_progress", children: "In Progress" }), _jsx("option", { value: "achieved", children: "Achieved" })] }), _jsx("button", { type: "submit", disabled: busy, className: btnGhost, children: "Add" })] })] }))] }));
}
function InterventionList({ plan, editable, busy, patientId, onRun, }) {
    const items = plan.interventions || [];
    const api = clinicalApi.carePlans(patientId);
    async function add(event) {
        event.preventDefault();
        const form = event.currentTarget;
        const fd = new FormData(form);
        try {
            await onRun(async () => {
                await api.addIntervention(plan._id, {
                    description: fd.get('description'),
                    assignedRole: fd.get('assignedRole'),
                    dueDate: fd.get('dueDate'),
                    status: fd.get('status'),
                });
                form.reset();
            });
        }
        catch {
            // The plan panel shows the error.
        }
    }
    return (_jsxs("section", { className: "mb-6", children: [_jsx("h3", { className: "text-sm font-medium text-gray-900 mb-2", children: "Interventions" }), items.length === 0 ? (_jsx("p", { className: "text-sm text-gray-500 mb-3", children: "No interventions yet." })) : (_jsx("ul", { className: "space-y-2 mb-3", children: items.map((item) => (_jsxs("li", { className: "flex flex-wrap items-center gap-2 text-sm", children: [_jsxs("span", { children: [item.description, " \u00B7 ", ROLES.find((role) => role.value === item.assignedRole)?.label || item.assignedRole, " \u00B7", ' ', day(item.dueDate)] }), item.overdue && _jsx("span", { className: "text-xs font-medium text-amber-700", children: "Overdue" }), editable && INTERVENTION_NEXT[item.status].length > 0 ? (_jsx("select", { className: inputCls, style: { width: 'auto' }, value: item.status, disabled: busy, onChange: (event) => onRun(() => api
                                .updateIntervention(plan._id, item._id, { status: event.target.value })
                                .then(() => undefined)).catch(() => undefined), children: statusChoices(item.status, INTERVENTION_NEXT[item.status], [
                                { value: 'planned', label: 'Planned' },
                                { value: 'active', label: 'Active' },
                                { value: 'completed', label: 'Completed' },
                                { value: 'cancelled', label: 'Cancelled' },
                            ]).map((choice) => (_jsx("option", { value: choice.value, children: choice.label }, choice.value))) })) : (_jsx(StatusBadge, { value: item.status }))] }, item._id))) })), editable && (_jsxs("form", { onSubmit: add, className: "grid grid-cols-1 md:grid-cols-4 gap-3", children: [_jsx("input", { name: "description", required: true, placeholder: "Intervention", className: inputCls }), _jsx("select", { name: "assignedRole", defaultValue: "nurse", className: inputCls, children: ROLES.map((role) => (_jsx("option", { value: role.value, children: role.label }, role.value))) }), _jsx("input", { name: "dueDate", type: "date", required: true, className: inputCls }), _jsxs("div", { className: "flex gap-2", children: [_jsxs("select", { name: "status", defaultValue: "planned", className: inputCls, children: [_jsx("option", { value: "planned", children: "Planned" }), _jsx("option", { value: "active", children: "Active" }), _jsx("option", { value: "completed", children: "Completed" })] }), _jsx("button", { type: "submit", disabled: busy, className: btnGhost, children: "Add" })] })] }))] }));
}
function RelatedChart({ plan }) {
    const medications = plan.relatedMedications || [];
    const orders = plan.relatedOrders || [];
    const results = plan.recentResults || [];
    return (_jsxs("section", { className: "mb-2", children: [_jsx("h3", { className: "text-sm font-medium text-gray-900 mb-1", children: "Related chart" }), _jsx("p", { className: "text-xs text-gray-500 mb-3", children: "Medications, orders, and results are read-only links from the same problem, diagnosis, or encounter." }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-4", children: [_jsxs("div", { children: [_jsx("h4", { className: "text-xs font-medium text-gray-600 mb-2", children: "Medications" }), medications.length === 0 ? (_jsx("p", { className: "text-sm text-gray-500", children: "None linked." })) : (_jsx("ul", { className: "space-y-2", children: medications.map((item) => (_jsxs("li", { className: "text-sm", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("span", { children: item.name }), _jsx(StatusBadge, { value: item.status })] }), _jsx("div", { className: "text-gray-600", children: [item.dose, item.frequency].filter(Boolean).join(' · ') || '—' })] }, item._id))) }))] }), _jsxs("div", { children: [_jsx("h4", { className: "text-xs font-medium text-gray-600 mb-2", children: "Orders" }), orders.length === 0 ? (_jsx("p", { className: "text-sm text-gray-500", children: "None linked." })) : (_jsx("ul", { className: "space-y-2", children: orders.map((item) => (_jsxs("li", { className: "text-sm", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("span", { children: item.orderName }), _jsx(StatusBadge, { value: item.status })] }), _jsxs("div", { className: "text-gray-600", children: [item.orderType, " \u00B7 ", item.priority] })] }, item._id))) }))] }), _jsxs("div", { children: [_jsx("h4", { className: "text-xs font-medium text-gray-600 mb-2", children: "Recent results" }), results.length === 0 ? (_jsx("p", { className: "text-sm text-gray-500", children: "None linked." })) : (_jsx("ul", { className: "space-y-2", children: results.map((item) => (_jsxs("li", { className: "text-sm", children: [_jsxs("div", { children: [item.resultType, ": ", item.value, item.unit ? ` ${item.unit}` : ''] }), _jsxs("div", { className: "text-gray-600", children: [item.orderName, " \u00B7 ", day(item.resultDate)] })] }, item._id))) }))] })] })] }));
}
function ProgressList({ plan, canWrite, busy, onAdd, }) {
    const notes = plan.progress || [];
    async function submit(event) {
        event.preventDefault();
        const form = event.currentTarget;
        const note = String(new FormData(form).get('note') || '');
        try {
            await onAdd(note);
            form.reset();
        }
        catch {
            // The plan panel shows the error.
        }
    }
    return (_jsxs("section", { className: "mt-6", children: [_jsx("h3", { className: "text-sm font-medium text-gray-900 mb-2", children: "Progress" }), notes.length === 0 ? (_jsx("p", { className: "text-sm text-gray-500 mb-3", children: "No progress notes yet." })) : (_jsx("ol", { className: "space-y-3 mb-4", children: notes.map((note, index) => (_jsxs("li", { className: "text-sm", children: [_jsxs("div", { className: "text-xs text-gray-500", children: [providerName(note.authorId), " \u00B7 ", formatEncounterWhen(note.at)] }), _jsx("p", { className: "text-gray-800 whitespace-pre-wrap mt-1", children: note.note })] }, note._id || `${note.at}-${index}`))) })), canWrite && (_jsxs("form", { onSubmit: submit, children: [_jsx("textarea", { name: "note", required: true, rows: 3, placeholder: "Progress note", className: inputCls }), _jsx("button", { type: "submit", disabled: busy, className: `${btnPrimary} mt-3`, children: "Add progress note" })] }))] }));
}
