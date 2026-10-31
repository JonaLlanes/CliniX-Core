import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { auditApi } from '../api/client';
import Panel, { EmptyState } from './Panel';
import { StatusBadge } from './StatusBadge';
const EVENT_LABELS = {
    encounter_created: 'Encounter created',
    encounter_status_changed: 'Status changed',
    encounter_provider_assigned: 'Provider assigned',
    diagnosis_created: 'Diagnosis created',
    problem_updated: 'Problem updated',
    problem_status_changed: 'Problem status changed',
    medication_added: 'Medication added',
    medication_changed: 'Medication changed',
    medication_held: 'Medication held',
    medication_resumed: 'Medication resumed',
    medication_discontinued: 'Medication discontinued',
    medication_completed: 'Medication completed',
    medication_allergy_warning_acknowledged: 'Allergy warning acknowledged',
    order_created: 'Order created',
    order_status_changed: 'Order status changed',
    order_result_entered: 'Result entered',
    order_cancelled: 'Order cancelled',
    care_plan_created: 'Care plan created',
    care_plan_updated: 'Care plan updated',
    care_plan_status_changed: 'Care plan status changed',
    care_plan_completed: 'Care plan completed',
    care_plan_goal_added: 'Goal added',
    care_plan_goal_updated: 'Goal updated',
    care_plan_goal_achieved: 'Goal achieved',
    care_plan_intervention_added: 'Intervention added',
    care_plan_intervention_updated: 'Intervention updated',
    care_plan_progress_added: 'Progress note added',
    referral_created: 'Referral created',
    referral_status_changed: 'Referral status changed',
    referral_outcome_updated: 'Referral outcome updated',
    referral_cancelled: 'Referral cancelled',
    referral_document_added: 'Referral document added',
    referral_follow_up_updated: 'Referral follow-up updated',
};
function actorName(event) {
    if (event.userId && typeof event.userId === 'object') {
        return event.userId.displayName || 'Unknown user';
    }
    return 'Unknown user';
}
function pretty(value) {
    if (value == null)
        return '';
    return JSON.stringify(value, null, 2);
}
export default function AuditHistory({ patientId }) {
    const [events, setEvents] = useState([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [openId, setOpenId] = useState(null);
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        auditApi
            .list(patientId)
            .then((res) => {
            if (!cancelled) {
                setEvents(res.data);
                setError('');
            }
        })
            .catch((err) => {
            if (!cancelled)
                setError(err instanceof Error ? err.message : 'Failed to load audit history');
        })
            .finally(() => {
            if (!cancelled)
                setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [patientId]);
    return (_jsxs(Panel, { title: "Audit history", subtitle: "Who created, changed, or removed chart records", children: [error && (_jsx("div", { className: "mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm", children: error })), loading ? (_jsx("p", { className: "text-sm text-gray-500", children: "Loading audit history..." })) : events.length === 0 ? (_jsx(EmptyState, { text: "No chart changes recorded yet." })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-xs font-medium text-gray-500 border-b border-gray-200", children: [_jsx("th", { className: "pb-3 pr-3", children: "When" }), _jsx("th", { className: "pb-3 pr-3", children: "User" }), _jsx("th", { className: "pb-3 pr-3", children: "Role" }), _jsx("th", { className: "pb-3 pr-3", children: "Action" }), _jsx("th", { className: "pb-3", children: "Record" })] }) }), _jsx("tbody", { className: "divide-y divide-gray-100", children: events.map((event) => {
                                const open = openId === event._id;
                                const detail = event.action === 'update' || event.before != null || event.after != null;
                                return (_jsxs("tr", { className: "align-top", children: [_jsx("td", { className: "py-3 pr-3 whitespace-nowrap text-gray-600", children: new Date(event.timestamp).toLocaleString() }), _jsx("td", { className: "py-3 pr-3", children: actorName(event) }), _jsx("td", { className: "py-3 pr-3 text-gray-600", children: event.role }), _jsx("td", { className: "py-3 pr-3", children: _jsx(StatusBadge, { value: event.action }) }), _jsxs("td", { className: "py-3", children: [_jsx("div", { className: "font-medium", children: event.resourceType }), event.event && (_jsx("div", { className: "text-xs text-gray-500 mt-1", children: EVENT_LABELS[event.event] || event.event })), detail && (_jsx("button", { type: "button", className: "mt-1 text-xs text-clinical-teal hover:underline", onClick: () => setOpenId(open ? null : event._id), children: open ? 'Hide values' : 'Before / after' })), open && (_jsxs("div", { className: "mt-2 grid grid-cols-1 lg:grid-cols-2 gap-3", children: [_jsx("pre", { className: "text-xs bg-gray-50 border border-gray-200 rounded p-3 overflow-auto max-h-64 whitespace-pre-wrap", children: pretty(event.before) || '—' }), _jsx("pre", { className: "text-xs bg-gray-50 border border-gray-200 rounded p-3 overflow-auto max-h-64 whitespace-pre-wrap", children: pretty(event.after) || '—' })] }))] })] }, event._id));
                            }) })] }) }))] }));
}
