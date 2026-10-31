import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { visitsApi } from '../api/client';
import { StatusBadge } from './StatusBadge';
import { localDateInput } from './appointmentDisplay';
const ACTIVE = ['arrived', 'waiting', 'roomed', 'in_progress'];
function appointmentIdOf(visit) {
    return typeof visit.appointmentId === 'string' ? visit.appointmentId : visit.appointmentId._id;
}
function boardDate(visit) {
    if (typeof visit.appointmentId === 'string' || !visit.appointmentId.startTime) {
        return localDateInput();
    }
    return localDateInput(new Date(visit.appointmentId.startTime));
}
export default function ActiveVisitBanner({ patientId }) {
    const [visit, setVisit] = useState(null);
    useEffect(() => {
        let active = true;
        visitsApi
            .forPatient(patientId)
            .then((res) => {
            if (!active)
                return;
            setVisit(res.data.find((item) => ACTIVE.includes(item.status)) ?? null);
        })
            .catch(() => {
            if (active)
                setVisit(null);
        });
        return () => {
            active = false;
        };
    }, [patientId]);
    if (!visit)
        return null;
    return (_jsxs("div", { className: "mb-4 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2 text-sm text-teal-950", children: [_jsx("span", { className: "font-medium", children: "Clinic visit" }), _jsx(StatusBadge, { value: visit.status }), visit.examRoom && _jsx("span", { children: visit.examRoom })] }), _jsx(Link, { to: `/check-in?appointmentId=${appointmentIdOf(visit)}&date=${boardDate(visit)}`, className: "text-sm text-clinical-teal hover:underline", children: "Open check-in" })] }));
}
