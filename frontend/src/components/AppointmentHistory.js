import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { appointmentsApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Panel, { EmptyState } from './Panel';
import { StatusBadge } from './StatusBadge';
import { chartRecordId, focusedRecordClass, watchChartRecord } from './chart/recordFocus';
import { canBookAppointments, formatAppointmentWhen, localDateInput, providerLabel, refId, typeLabel, } from './appointmentDisplay';
export default function AppointmentHistory({ patientId, focusId = '', focusToken = 0, }) {
    const { user } = useAuth();
    const [items, setItems] = useState([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const canBook = canBookAppointments(user?.role);
    useEffect(() => {
        let active = true;
        setLoading(true);
        appointmentsApi
            .history(patientId, 100)
            .then((res) => {
            if (active) {
                setItems(res.data);
                setError('');
            }
        })
            .catch((err) => {
            if (active)
                setError(err instanceof Error ? err.message : 'Failed to load appointments');
        })
            .finally(() => {
            if (active)
                setLoading(false);
        });
        return () => {
            active = false;
        };
    }, [patientId]);
    useEffect(() => {
        if (!focusToken || !focusId || loading)
            return;
        return watchChartRecord('appointment', focusId);
    }, [focusToken, focusId, loading, items]);
    return (_jsxs(Panel, { title: "Appointment history", subtitle: "Booked visits for this chart, newest first", link: `/schedule?patientId=${patientId}`, linkLabel: canBook ? 'Book appointment' : 'Open schedule', children: [error && (_jsx("div", { className: "mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm", children: error })), loading ? (_jsx("p", { className: "text-sm text-gray-500", children: "Loading appointments..." })) : items.length === 0 ? (_jsx(EmptyState, { text: "No appointments on this chart", hint: "Booked visits for this patient show up here." })) : (_jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-xs font-medium text-gray-500 border-b border-gray-200", children: [_jsx("th", { className: "pb-3 pr-3", children: "When" }), _jsx("th", { className: "pb-3 pr-3", children: "Type" }), _jsx("th", { className: "pb-3 pr-3", children: "Provider" }), _jsx("th", { className: "pb-3 pr-3", children: "Location" }), _jsx("th", { className: "pb-3 pr-3", children: "Status" }), _jsx("th", { className: "pb-3" })] }) }), _jsx("tbody", { className: "divide-y divide-gray-100", children: items.map((item) => (_jsxs("tr", { id: chartRecordId('appointment', item._id), className: focusedRecordClass(item._id === focusId, 'row'), children: [_jsx("td", { className: "py-3 pr-3 whitespace-nowrap", children: formatAppointmentWhen(item.startTime, item.endTime) }), _jsx("td", { className: "py-3 pr-3", children: typeLabel(item.appointmentType) }), _jsx("td", { className: "py-3 pr-3", children: providerLabel(item.providerId) }), _jsx("td", { className: "py-3 pr-3", children: item.clinicLocation }), _jsxs("td", { className: "py-3 pr-3", children: [_jsx(StatusBadge, { value: item.status }), item.cancelReason && (_jsx("div", { className: "text-xs text-gray-500 mt-1", children: item.cancelReason }))] }), _jsxs("td", { className: "py-3 text-right whitespace-nowrap", children: [['booked', 'confirmed', 'arrived'].includes(item.status) && (_jsx(Link, { to: `/check-in?appointmentId=${item._id}&date=${localDateInput(new Date(item.startTime))}`, className: "text-clinical-teal hover:underline mr-3", children: "Check in" })), _jsx(Link, { to: `/schedule?patientId=${patientId}&providerId=${refId(item.providerId)}&appointmentId=${item._id}&date=${localDateInput(new Date(item.startTime))}`, className: "text-clinical-teal hover:underline", children: "Open" })] })] }, item._id))) })] }))] }));
}
