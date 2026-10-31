import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { clinicalApi, encountersApi, } from '../api/client';
import Panel, { EmptyState } from './Panel';
import { StatusBadge } from './StatusBadge';
import { formatEncounterWhen, providerName } from './encounterDisplay';
import { chartRecordId, focusedRecordClass, watchChartRecord } from './chart/recordFocus';
const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm';
const labelCls = 'block text-xs font-medium text-gray-600 mb-1';
const btnPrimary = 'px-4 py-2 bg-clinical-teal text-white rounded-lg text-sm hover:bg-clinical-teal-dark disabled:opacity-50';
const btnGhost = 'px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50';
const btnText = 'text-sm text-clinical-teal hover:underline disabled:opacity-50';
const btnDanger = 'text-sm text-red-700 hover:underline disabled:opacity-50';
const ORDER_TYPES = [
    { value: 'laboratory', label: 'Laboratory' },
    { value: 'diagnostic_imaging', label: 'Diagnostic Imaging' },
    { value: 'procedure', label: 'Procedure' },
];
const PRIORITIES = [
    { value: 'routine', label: 'Routine' },
    { value: 'urgent', label: 'Urgent' },
    { value: 'stat', label: 'Stat' },
];
const RESULT_STATUSES = [
    { value: 'preliminary', label: 'Preliminary' },
    { value: 'final', label: 'Final' },
    { value: 'corrected', label: 'Corrected' },
];
const PRIORITY_RANK = { stat: 0, urgent: 1, routine: 2 };
const STATUS_COPY = {
    ordered: {
        title: 'Place order',
        submit: 'Place order',
        hint: 'Placing the order records it on the chart timeline.',
    },
    scheduled: {
        title: 'Schedule order',
        submit: 'Schedule',
        hint: 'Record when this order was scheduled.',
    },
    collected: {
        title: 'Record collection',
        submit: 'Mark collected',
        hint: 'For a laboratory order this is the specimen collection time.',
    },
    completed: {
        title: 'Complete order',
        submit: 'Complete order',
        hint: 'Complete the order after a result is on the chart.',
    },
};
function messageOf(err) {
    return err instanceof Error ? err.message : 'Request failed';
}
function nowInput() {
    const date = new Date();
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
}
function emptyDraft(orderedBy = '') {
    return {
        encounterId: '',
        diagnosisId: '',
        conditionId: '',
        orderedBy,
        orderType: 'laboratory',
        orderName: '',
        priority: 'routine',
        clinicalReason: '',
        instructions: '',
    };
}
function emptyResult() {
    return {
        resultType: '',
        value: '',
        unit: '',
        referenceRange: '',
        resultDate: nowInput(),
        interpretation: '',
        status: 'final',
    };
}
function refId(value) {
    if (!value)
        return '';
    if (typeof value === 'string')
        return value;
    if (typeof value === 'object' && '_id' in value)
        return String(value._id);
    return '';
}
function diagnosisText(value) {
    if (!value || typeof value === 'string')
        return value ? 'Linked diagnosis' : '—';
    return [value.code, value.description].filter(Boolean).join(' · ') || 'Linked diagnosis';
}
function encounterText(value) {
    if (!value || typeof value === 'string')
        return value ? 'Linked encounter' : '—';
    const when = value.openedAt ? formatEncounterWhen(value.openedAt) : '';
    return [value.chiefComplaint, when].filter(Boolean).join(' · ') || 'Linked encounter';
}
function problemText(value) {
    if (!value || typeof value === 'string')
        return '';
    return [value.display, value.code].filter(Boolean).join(' · ');
}
function resultValue(result) {
    return [result.value, result.unit].filter(Boolean).join(' ');
}
function byPriority(a, b) {
    const rank = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (rank)
        return rank;
    const aTime = new Date(a.orderedAt || a.createdAt || 0).getTime();
    const bTime = new Date(b.orderedAt || b.createdAt || 0).getTime();
    return bTime - aTime;
}
function Field({ label, children }) {
    return (_jsxs("label", { className: "block", children: [_jsx("span", { className: labelCls, children: label }), children] }));
}
function OrderCard({ order, canWrite, onAction, focused = false, }) {
    const problem = problemText(order.conditionId);
    const collectLabel = order.orderType === 'laboratory' ? 'Mark specimen collected' : 'Mark collected';
    return (_jsxs("li", { id: chartRecordId('order', order._id), className: `py-4 ${focusedRecordClass(focused)}`, children: [_jsxs("div", { className: "flex flex-wrap items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsx("div", { className: "font-medium text-gray-900", children: order.orderName }), _jsxs("div", { className: "mt-1 flex flex-wrap gap-2", children: [_jsx(StatusBadge, { value: order.orderType }), _jsx(StatusBadge, { value: order.priority }), _jsx(StatusBadge, { value: order.status })] })] }), _jsxs("div", { className: "text-xs text-gray-500", children: [order.orderedAt ? `Ordered ${formatEncounterWhen(order.orderedAt)}` : 'Not placed yet', order.orderedBy ? ` · ${providerName(order.orderedBy)}` : ''] })] }), _jsxs("dl", { className: "mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm", children: [_jsxs("div", { children: [_jsx("dt", { className: "text-xs text-gray-500", children: "Diagnosis" }), _jsx("dd", { className: "text-gray-800", children: diagnosisText(order.diagnosisId) })] }), _jsxs("div", { children: [_jsx("dt", { className: "text-xs text-gray-500", children: "Encounter" }), _jsx("dd", { className: "text-gray-800", children: encounterText(order.encounterId) })] }), problem && (_jsxs("div", { children: [_jsx("dt", { className: "text-xs text-gray-500", children: "Problem list" }), _jsx("dd", { className: "text-gray-800", children: problem })] })), _jsxs("div", { className: problem ? '' : 'md:col-span-2', children: [_jsx("dt", { className: "text-xs text-gray-500", children: "Clinical reason" }), _jsx("dd", { className: "text-gray-800", children: order.clinicalReason })] })] }), order.instructions && (_jsxs("p", { className: "text-sm text-gray-600 mt-2", children: ["Instructions: ", order.instructions] })), !!order.results?.length && (_jsx("ul", { className: "mt-3 space-y-2", children: order.results.map((result) => (_jsxs("li", { className: "text-sm text-gray-700", children: [_jsx("span", { className: "mr-2", children: _jsx(StatusBadge, { value: result.status }) }), result.resultType, ": ", resultValue(result), result.referenceRange ? ` (range ${result.referenceRange})` : '', ' · ', formatEncounterWhen(result.resultDate), result.interpretation ? ` · ${result.interpretation}` : ''] }, result._id))) })), !!order.statusHistory?.length && (_jsx("ol", { className: "mt-3 space-y-1", children: order.statusHistory.map((event) => (_jsxs("li", { className: "flex flex-wrap items-center gap-2 text-xs text-gray-600", children: [_jsx(StatusBadge, { value: event.status }), _jsx("span", { children: formatEncounterWhen(event.at) }), _jsx("span", { children: providerName(event.actorId) }), event.note && _jsx("span", { children: event.note })] }, event._id || `${event.status}-${event.at}`))) })), canWrite && (_jsxs("div", { className: "mt-3 flex flex-wrap gap-3", children: [order.status === 'draft' && (_jsx("button", { type: "button", className: btnText, onClick: () => onAction({ kind: 'status', order, status: 'ordered' }), children: "Place order" })), order.status === 'ordered' && (_jsx("button", { type: "button", className: btnText, onClick: () => onAction({ kind: 'status', order, status: 'scheduled' }), children: "Schedule" })), (order.status === 'ordered' || order.status === 'scheduled') && (_jsx("button", { type: "button", className: btnText, onClick: () => onAction({ kind: 'status', order, status: 'collected' }), children: collectLabel })), ['ordered', 'scheduled', 'collected', 'resulted', 'completed'].includes(order.status) && (_jsx("button", { type: "button", className: btnText, onClick: () => onAction({ kind: 'result', order }), children: order.status === 'resulted' || order.status === 'completed' ? 'Add result' : 'Enter result' })), order.status === 'resulted' && (_jsx("button", { type: "button", className: btnText, onClick: () => onAction({ kind: 'status', order, status: 'completed' }), children: "Complete order" })), order.status !== 'completed' && order.status !== 'cancelled' && (_jsx("button", { type: "button", className: btnDanger, onClick: () => onAction({ kind: 'cancel', order }), children: "Cancel order" }))] }))] }));
}
function OrderGroup({ title, subtitle, orders, canWrite, empty, onAction, focusId = '', }) {
    return (_jsx(Panel, { title: title, subtitle: subtitle, children: orders.length === 0 ? (_jsx(EmptyState, { text: empty })) : (_jsx("ul", { className: "divide-y divide-gray-100", children: orders.map((order) => (_jsx(OrderCard, { order: order, canWrite: canWrite, onAction: onAction, focused: order._id === focusId }, order._id))) })) }));
}
export function OrderPanel({ patientId, canWrite, actorId, focusToken = 0, recordFocus = null, }) {
    const [section, setSection] = useState('active');
    const [active, setActive] = useState([]);
    const [closed, setClosed] = useState([]);
    const [results, setResults] = useState([]);
    const [encounters, setEncounters] = useState([]);
    const [diagnoses, setDiagnoses] = useState([]);
    const [problems, setProblems] = useState([]);
    const [clinicians, setClinicians] = useState([]);
    const [draft, setDraft] = useState(emptyDraft());
    const [pending, setPending] = useState(null);
    const [actionAt, setActionAt] = useState(nowInput());
    const [actionNote, setActionNote] = useState('');
    const [resultDraft, setResultDraft] = useState(emptyResult());
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const intent = useRef('ordered');
    const encounterDiagnoses = diagnoses.filter((item) => refId(item.encounterId) === draft.encounterId);
    async function load() {
        const [activePage, closedPage, resultPage, encounterPage, diagnosisPage, problemPage, people] = await Promise.all([
            clinicalApi.orders(patientId).list('?view=active&limit=100'),
            clinicalApi.orders(patientId).list('?view=completed&limit=100'),
            clinicalApi.orders(patientId).results('?limit=100'),
            encountersApi.list(patientId),
            clinicalApi.diagnoses(patientId).list('?limit=100'),
            clinicalApi.conditions(patientId).list('?limit=100'),
            clinicalApi.orders(patientId).clinicians(),
        ]);
        setActive([...activePage.data].sort(byPriority));
        setClosed([...closedPage.data].sort(byPriority));
        setResults(resultPage.data);
        setEncounters(encounterPage.data);
        setDiagnoses(diagnosisPage.data);
        setProblems(problemPage.data);
        setClinicians(people.data);
        setDraft((current) => {
            if (current.orderName || current.encounterId || current.clinicalReason)
                return current;
            const orderedBy = people.data.some((person) => person._id === actorId) ? actorId || '' : current.orderedBy;
            const encounterId = encounterPage.data.length === 1 ? encounterPage.data[0]._id : '';
            return { ...emptyDraft(orderedBy), encounterId };
        });
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
    useEffect(() => {
        if (!focusToken || recordFocus?.tab === 'orders')
            return;
        setSection('active');
    }, [focusToken, recordFocus]);
    const orderFocusToken = recordFocus?.tab === 'orders' ? recordFocus.token : 0;
    const orderFocusId = recordFocus?.tab === 'orders' ? recordFocus.recordId : '';
    const seenOrderFocus = useRef(0);
    useEffect(() => {
        if (!orderFocusToken || !orderFocusId || loading)
            return;
        if (seenOrderFocus.current === orderFocusToken)
            return;
        const order = [...active, ...closed].find((item) => item._id === orderFocusId);
        if (!order && active.length === 0 && closed.length === 0)
            return;
        seenOrderFocus.current = orderFocusToken;
        if (order)
            setSection(order.status === 'completed' || order.status === 'cancelled' ? 'completed' : 'active');
        return watchChartRecord('order', orderFocusId);
    }, [orderFocusToken, orderFocusId, loading, active, closed]);
    useEffect(() => {
        if (!focusToken || loading || section !== 'active' || recordFocus?.tab === 'orders')
            return;
        document.getElementById('chart-new-order')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, [focusToken, loading, section, recordFocus]);
    function openAction(next) {
        setPending(next);
        setActionAt(nowInput());
        setActionNote('');
        setResultDraft(emptyResult());
        setError('');
    }
    async function onCreate(event) {
        event.preventDefault();
        setSaving(true);
        setError('');
        const body = {
            encounterId: draft.encounterId,
            diagnosisId: draft.diagnosisId,
            conditionId: draft.conditionId || null,
            orderedBy: draft.orderedBy,
            orderType: draft.orderType,
            orderName: draft.orderName.trim(),
            priority: draft.priority,
            clinicalReason: draft.clinicalReason.trim(),
            instructions: draft.instructions.trim() || undefined,
            status: intent.current,
        };
        try {
            await clinicalApi.orders(patientId).create(body);
            const orderedBy = draft.orderedBy;
            const encounterId = draft.encounterId;
            setDraft({ ...emptyDraft(orderedBy), encounterId });
            await load();
        }
        catch (err) {
            setError(messageOf(err));
        }
        finally {
            setSaving(false);
        }
    }
    async function onPending(event) {
        event.preventDefault();
        if (!pending)
            return;
        setSaving(true);
        setError('');
        try {
            const api = clinicalApi.orders(patientId);
            if (pending.kind === 'status') {
                await api.setStatus(pending.order._id, {
                    status: pending.status,
                    at: actionAt,
                    note: actionNote.trim() || undefined,
                });
            }
            else if (pending.kind === 'cancel') {
                await api.cancel(pending.order._id, { reason: actionNote.trim(), at: actionAt });
            }
            else {
                await api.addResult(pending.order._id, {
                    resultType: resultDraft.resultType.trim(),
                    value: resultDraft.value.trim(),
                    unit: resultDraft.unit.trim() || undefined,
                    referenceRange: resultDraft.referenceRange.trim() || undefined,
                    resultDate: resultDraft.resultDate,
                    interpretation: resultDraft.interpretation.trim() || undefined,
                    status: resultDraft.status,
                });
            }
            setPending(null);
            await load();
        }
        catch (err) {
            setError(messageOf(err));
        }
        finally {
            setSaving(false);
        }
    }
    const completed = closed.filter((order) => order.status === 'completed');
    const cancelled = closed.filter((order) => order.status === 'cancelled');
    const activity = [...active, ...closed]
        .flatMap((order) => order.timeline || [])
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    const tabs = [
        { id: 'active', label: 'Active Orders' },
        { id: 'completed', label: 'Completed Orders' },
        { id: 'results', label: 'Results' },
    ];
    return (_jsxs("div", { className: "space-y-6", children: [_jsx("div", { className: "flex flex-wrap gap-1 border-b border-gray-200", role: "tablist", children: tabs.map((tab) => (_jsx("button", { type: "button", role: "tab", "aria-selected": section === tab.id, onClick: () => setSection(tab.id), className: `px-4 py-2 text-sm font-medium border-b-2 -mb-px ${section === tab.id
                        ? 'border-clinical-teal text-clinical-teal'
                        : 'border-transparent text-gray-500 hover:text-gray-700'}`, children: tab.label }, tab.id))) }), error && (_jsx("div", { className: "bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm", children: error })), section === 'active' && canWrite && (_jsxs("form", { id: "chart-new-order", onSubmit: onCreate, className: "scroll-mt-64 bg-white rounded-lg border border-gray-200 p-6 space-y-4", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-semibold text-gray-900", children: "New order" }), _jsx("p", { className: "text-xs text-gray-500 mt-0.5", children: "Local laboratory, imaging, and procedure orders for this chart." })] }), encounters.length === 0 ? (_jsx("p", { className: "text-sm text-gray-600", children: "Open an encounter before placing an order." })) : (_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsx(Field, { label: "Encounter", children: _jsxs("select", { value: draft.encounterId, onChange: (event) => {
                                        const encounterId = event.target.value;
                                        setDraft((current) => ({
                                            ...current,
                                            encounterId,
                                            diagnosisId: diagnoses.some((item) => refId(item.encounterId) === encounterId && item._id === current.diagnosisId)
                                                ? current.diagnosisId
                                                : '',
                                        }));
                                    }, className: inputCls, required: true, children: [_jsx("option", { value: "", children: "Select an encounter" }), encounters.map((encounter) => (_jsxs("option", { value: encounter._id, children: [encounter.chiefComplaint, " \u00B7 ", formatEncounterWhen(encounter.openedAt)] }, encounter._id)))] }) }), _jsx(Field, { label: "Encounter diagnosis", children: _jsxs("select", { value: draft.diagnosisId, onChange: (event) => setDraft((current) => ({ ...current, diagnosisId: event.target.value })), className: inputCls, required: true, disabled: !draft.encounterId, children: [_jsx("option", { value: "", children: "Select a diagnosis" }), encounterDiagnoses.map((item) => (_jsxs("option", { value: item._id, children: [item.code, " \u00B7 ", item.description, item.primaryDiagnosis ? ' · Primary' : ''] }, item._id)))] }) }), draft.encounterId && encounterDiagnoses.length === 0 && (_jsx("p", { className: "md:col-span-2 text-sm text-gray-600", children: "Record a diagnosis on this encounter before placing an order." })), _jsx(Field, { label: "Problem list item", children: _jsxs("select", { value: draft.conditionId, onChange: (event) => setDraft((current) => ({ ...current, conditionId: event.target.value })), className: inputCls, children: [_jsx("option", { value: "", children: "No problem list item" }), problems.map((problem) => (_jsxs("option", { value: problem._id, children: [problem.display, problem.code ? ` · ${problem.code}` : '', " \u00B7 ", problem.status] }, problem._id)))] }) }), _jsx(Field, { label: "Ordered by", children: _jsxs("select", { value: draft.orderedBy, onChange: (event) => setDraft((current) => ({ ...current, orderedBy: event.target.value })), className: inputCls, required: true, children: [_jsx("option", { value: "", children: "Select a clinician" }), clinicians.map((person) => (_jsx("option", { value: person._id, children: person.displayName }, person._id)))] }) }), _jsx(Field, { label: "Order type", children: _jsx("select", { value: draft.orderType, onChange: (event) => setDraft((current) => ({ ...current, orderType: event.target.value })), className: inputCls, required: true, children: ORDER_TYPES.map((type) => (_jsx("option", { value: type.value, children: type.label }, type.value))) }) }), _jsx(Field, { label: "Priority", children: _jsx("select", { value: draft.priority, onChange: (event) => setDraft((current) => ({ ...current, priority: event.target.value })), className: inputCls, required: true, children: PRIORITIES.map((priority) => (_jsx("option", { value: priority.value, children: priority.label }, priority.value))) }) }), _jsx("div", { className: "md:col-span-2", children: _jsx(Field, { label: "Order name", children: _jsx("input", { value: draft.orderName, onChange: (event) => setDraft((current) => ({ ...current, orderName: event.target.value })), className: inputCls, required: true, maxLength: 200 }) }) }), _jsx("div", { className: "md:col-span-2", children: _jsx(Field, { label: "Clinical reason", children: _jsx("textarea", { value: draft.clinicalReason, onChange: (event) => setDraft((current) => ({ ...current, clinicalReason: event.target.value })), className: inputCls, rows: 2, required: true, maxLength: 1000 }) }) }), _jsx("div", { className: "md:col-span-2", children: _jsx(Field, { label: "Instructions", children: _jsx("textarea", { value: draft.instructions, onChange: (event) => setDraft((current) => ({ ...current, instructions: event.target.value })), className: inputCls, rows: 2, maxLength: 2000 }) }) })] })), encounters.length > 0 && (_jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx("button", { type: "submit", className: btnPrimary, disabled: saving, onClick: () => {
                                    intent.current = 'ordered';
                                }, children: saving ? 'Saving...' : 'Place order' }), _jsx("button", { type: "submit", className: btnGhost, disabled: saving, onClick: () => {
                                    intent.current = 'draft';
                                }, children: "Save draft" })] }))] })), pending && (_jsxs("form", { onSubmit: onPending, className: "bg-white rounded-lg border border-gray-200 p-6 space-y-4", children: [_jsxs("div", { children: [_jsx("h3", { className: "font-semibold text-gray-900", children: pending.kind === 'cancel'
                                    ? 'Cancel order'
                                    : pending.kind === 'result'
                                        ? 'Enter result'
                                        : STATUS_COPY[pending.status].title }), _jsx("p", { className: "text-sm text-gray-600 mt-1", children: pending.order.orderName }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: pending.kind === 'cancel'
                                    ? 'Cancellation stays on the order history.'
                                    : pending.kind === 'result'
                                        ? 'Preliminary, final, and corrected results are kept as separate entries.'
                                        : STATUS_COPY[pending.status].hint })] }), pending.kind === 'result' ? (_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsx(Field, { label: "Result type", children: _jsx("input", { value: resultDraft.resultType, onChange: (event) => setResultDraft((current) => ({ ...current, resultType: event.target.value })), className: inputCls, required: true, maxLength: 120 }) }), _jsx(Field, { label: "Status", children: _jsx("select", { value: resultDraft.status, onChange: (event) => setResultDraft((current) => ({ ...current, status: event.target.value })), className: inputCls, required: true, children: RESULT_STATUSES.map((status) => (_jsx("option", { value: status.value, children: status.label }, status.value))) }) }), _jsx(Field, { label: "Value", children: _jsx("input", { value: resultDraft.value, onChange: (event) => setResultDraft((current) => ({ ...current, value: event.target.value })), className: inputCls, required: true, maxLength: 500 }) }), _jsx(Field, { label: "Unit", children: _jsx("input", { value: resultDraft.unit, onChange: (event) => setResultDraft((current) => ({ ...current, unit: event.target.value })), className: inputCls, maxLength: 40 }) }), _jsx(Field, { label: "Reference range", children: _jsx("input", { value: resultDraft.referenceRange, onChange: (event) => setResultDraft((current) => ({ ...current, referenceRange: event.target.value })), className: inputCls, maxLength: 120 }) }), _jsx(Field, { label: "Result date", children: _jsx("input", { type: "datetime-local", value: resultDraft.resultDate, onChange: (event) => setResultDraft((current) => ({ ...current, resultDate: event.target.value })), className: inputCls, required: true }) }), _jsx("div", { className: "md:col-span-2", children: _jsx(Field, { label: "Interpretation", children: _jsx("textarea", { value: resultDraft.interpretation, onChange: (event) => setResultDraft((current) => ({ ...current, interpretation: event.target.value })), className: inputCls, rows: 2, maxLength: 2000 }) }) })] })) : (_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsx("div", { className: "md:col-span-2", children: _jsx(Field, { label: pending.kind === 'cancel' ? 'Reason' : 'Note', children: _jsx("input", { value: actionNote, onChange: (event) => setActionNote(event.target.value), className: inputCls, required: pending.kind === 'cancel', maxLength: 500 }) }) }), _jsx(Field, { label: "Time", children: _jsx("input", { type: "datetime-local", value: actionAt, onChange: (event) => setActionAt(event.target.value), className: inputCls, required: true }) })] })), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { type: "submit", className: btnPrimary, disabled: saving, children: saving
                                    ? 'Saving...'
                                    : pending.kind === 'cancel'
                                        ? 'Cancel order'
                                        : pending.kind === 'result'
                                            ? 'Save result'
                                            : STATUS_COPY[pending.status].submit }), _jsx("button", { type: "button", className: btnGhost, onClick: () => setPending(null), children: "Close" })] })] })), loading ? (_jsx("p", { className: "text-sm text-gray-500", children: "Loading orders..." })) : (_jsxs(_Fragment, { children: [section === 'active' && (_jsx(OrderGroup, { title: "Active Orders", subtitle: "Draft, ordered, scheduled, collected, and resulted orders", orders: active, canWrite: canWrite, empty: "No active orders.", onAction: openAction, focusId: orderFocusId })), section === 'completed' && (_jsxs("div", { className: "space-y-6", children: [_jsx(OrderGroup, { title: "Completed Orders", subtitle: "Orders that have been completed", orders: completed, canWrite: canWrite, empty: "No completed orders.", onAction: openAction, focusId: orderFocusId }), _jsx(OrderGroup, { title: "Cancelled orders", subtitle: "Cancelled orders remain on the chart", orders: cancelled, canWrite: canWrite, empty: "No cancelled orders.", onAction: openAction, focusId: orderFocusId })] })), section === 'results' && (_jsx(Panel, { title: "Results", subtitle: "Preliminary, final, and corrected results entered in the clinic", children: results.length === 0 ? (_jsx(EmptyState, { text: "No results recorded", hint: "Laboratory and imaging results show up here after they are entered." })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-xs font-medium text-gray-500 border-b border-gray-200", children: [_jsx("th", { className: "py-2 pr-3", children: "Order" }), _jsx("th", { className: "py-2 pr-3", children: "Status" }), _jsx("th", { className: "py-2 pr-3", children: "Priority" }), _jsx("th", { className: "py-2 pr-3", children: "Diagnosis" }), _jsx("th", { className: "py-2 pr-3", children: "Encounter" }), _jsx("th", { className: "py-2 pr-3", children: "Result" }), _jsx("th", { className: "py-2 pr-3", children: "Value" }), _jsx("th", { className: "py-2 pr-3", children: "Range" }), _jsx("th", { className: "py-2 pr-3", children: "Interpretation" }), _jsx("th", { className: "py-2", children: "Date" })] }) }), _jsx("tbody", { children: results.map((result) => (_jsxs("tr", { className: "border-b border-gray-100 align-top", children: [_jsxs("td", { className: "py-3 pr-3", children: [_jsx("div", { className: "font-medium text-gray-900", children: result.order?.orderName || 'Order' }), result.order && (_jsx("div", { className: "mt-1", children: _jsx(StatusBadge, { value: result.order.orderType }) }))] }), _jsx("td", { className: "py-3 pr-3", children: _jsx(StatusBadge, { value: result.order?.status }) }), _jsx("td", { className: "py-3 pr-3", children: _jsx(StatusBadge, { value: result.order?.priority }) }), _jsx("td", { className: "py-3 pr-3 text-gray-700", children: diagnosisText(result.order?.diagnosisId) }), _jsx("td", { className: "py-3 pr-3 text-gray-700", children: encounterText(result.order?.encounterId) }), _jsxs("td", { className: "py-3 pr-3", children: [_jsx("div", { className: "text-gray-900", children: result.resultType }), _jsx("div", { className: "mt-1", children: _jsx(StatusBadge, { value: result.status }) })] }), _jsx("td", { className: "py-3 pr-3 text-gray-800", children: resultValue(result) }), _jsx("td", { className: "py-3 pr-3 text-gray-700", children: result.referenceRange || '—' }), _jsx("td", { className: "py-3 pr-3 text-gray-700", children: result.interpretation || '—' }), _jsx("td", { className: "py-3 text-gray-600 whitespace-nowrap", children: formatEncounterWhen(result.resultDate) })] }, result._id))) })] }) })) })), _jsx(Panel, { title: "Order activity", subtitle: "Placed, scheduled, collected, resulted, and completed events", children: activity.length === 0 ? (_jsx(EmptyState, { text: "Order activity appears here after an order is placed." })) : (_jsx("ol", { className: "space-y-3", children: activity.map((point, index) => (_jsxs("li", { className: "flex gap-3 text-sm", children: [_jsx("div", { className: "w-36 shrink-0 text-gray-500", children: formatEncounterWhen(point.at) }), _jsxs("div", { children: [_jsx("div", { className: "font-medium text-gray-900", children: point.label }), _jsx("div", { className: "text-gray-600", children: point.detail })] })] }, `${point.action}-${point.at}-${index}`))) })) })] }))] }));
}
export function OrderSummary({ patientId, onOpen, }) {
    const [summary, setSummary] = useState(null);
    const [error, setError] = useState('');
    useEffect(() => {
        let cancelled = false;
        clinicalApi
            .orders(patientId)
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
    return (_jsxs(Panel, { title: "Orders", subtitle: "Active laboratory, imaging, and procedure orders", children: [error && (_jsx("div", { className: "mb-3 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm", children: error })), !summary ? (_jsx("p", { className: "text-sm text-gray-500", children: "Loading orders..." })) : summary.active.length === 0 ? (_jsx("p", { className: "text-sm text-gray-500", children: "No active orders." })) : (_jsx("ul", { className: "space-y-3", children: summary.active.map((order) => (_jsxs("li", { className: "text-sm", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("span", { className: "font-medium text-gray-900", children: order.orderName }), _jsx(StatusBadge, { value: order.priority }), _jsx(StatusBadge, { value: order.status })] }), _jsxs("div", { className: "text-gray-600 mt-0.5", children: [diagnosisText(order.diagnosisId), " \u00B7 ", encounterText(order.encounterId)] })] }, order._id))) })), onOpen && (_jsx("button", { type: "button", className: `${btnText} mt-4`, onClick: onOpen, children: "Open orders" }))] }));
}
