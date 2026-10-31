import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { patientsApi } from '../../api/client';
import { CalendarIcon, CheckInIcon, ReportsIcon, SearchIcon, UsersIcon } from '../icons';
import { chartLink } from './chartLink';
import { QuickActionCard } from './ui';
function EncounterIcon({ className = 'h-6 w-6' }) {
    return (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, className: className, children: [_jsx("path", { d: "M8 4.5h8M9 4.5V7h6V4.5" }), _jsx("rect", { x: "6", y: "7", width: "12", height: "13", rx: "2" }), _jsx("path", { d: "M9 12h6M9 15.5h4" })] }));
}
export default function QuickActions() {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [hits, setHits] = useState([]);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => {
        if (!open)
            return;
        setSearching(true);
        const handle = window.setTimeout(() => {
            patientsApi
                .list({ q: query.trim() || undefined, limit: 8 })
                .then((page) => {
                setHits(page.data);
                setError('');
            })
                .catch((err) => {
                setHits([]);
                setError(err instanceof Error ? err.message : 'Search failed');
            })
                .finally(() => setSearching(false));
        }, 250);
        return () => window.clearTimeout(handle);
    }, [open, query]);
    function close() {
        setOpen(false);
        setQuery('');
        setHits([]);
        setError('');
    }
    function choose(patient) {
        close();
        navigate(chartLink(patient._id, 'encounters'));
    }
    return (_jsxs("section", { "aria-label": "Quick actions", children: [_jsxs("div", { className: "grid grid-cols-2 gap-3 lg:grid-cols-5", children: [_jsx(QuickActionCard, { to: "/", title: "Find Patient", body: "Search the registry and open a chart.", icon: _jsx(SearchIcon, { className: "h-6 w-6" }) }), _jsx(QuickActionCard, { title: "New Encounter", body: "Pick a patient and open the encounter.", icon: _jsx(EncounterIcon, {}), onClick: () => setOpen(true) }), _jsx(QuickActionCard, { to: "/schedule", title: "Book Appointment", body: "Open a provider day and reserve a slot.", icon: _jsx(CalendarIcon, { className: "h-6 w-6" }) }), _jsx(QuickActionCard, { to: "/check-in", title: "Open Check-In Board", body: "Arrivals, the waiting room, and rooming.", icon: _jsx(CheckInIcon, { className: "h-6 w-6" }) }), _jsx(QuickActionCard, { to: "/reports", title: "Reports", body: "Operations, workload, and cohorts.", icon: _jsx(ReportsIcon, { className: "h-6 w-6" }) })] }), open && (_jsx("div", { className: "fixed inset-0 z-50 flex items-start justify-center bg-slate-950/40 p-4 sm:pt-24", role: "presentation", onClick: close, children: _jsxs("div", { role: "dialog", "aria-modal": "true", "aria-labelledby": "encounter-search-title", className: "w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:p-5", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h2", { id: "encounter-search-title", className: "text-base font-semibold text-slate-950", children: "New encounter" }), _jsx("p", { className: "mt-1 text-sm text-slate-500", children: "Search by name or MRN. The chart opens on Encounters." })] }), _jsx("button", { type: "button", className: "rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100", onClick: close, children: "Close" })] }), _jsxs("label", { className: "mt-4 block", children: [_jsx("span", { className: "sr-only", children: "Patient search" }), _jsx("input", { autoFocus: true, value: query, onChange: (event) => setQuery(event.target.value), placeholder: "Name or MRN", className: "h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm focus:border-clinical-teal focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-100" })] }), _jsxs("div", { className: "mt-3 max-h-72 overflow-auto", children: [searching && _jsx("p", { className: "px-1 py-3 text-sm text-slate-500", children: "Searching charts\u2026" }), error && _jsx("p", { className: "rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700", children: error }), !searching && !error && query.trim() && hits.length === 0 && (_jsxs("p", { className: "flex items-center gap-2 px-1 py-3 text-sm text-slate-500", children: [_jsx(UsersIcon, { className: "h-4 w-4" }), "No matching charts."] })), _jsx("ul", { className: "space-y-1", children: hits.map((patient) => (_jsx("li", { children: _jsxs("button", { type: "button", onClick: () => choose(patient), className: "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-teal-50", children: [_jsxs("span", { children: [_jsxs("span", { className: "block text-sm font-semibold text-slate-950", children: [patient.familyName, ", ", patient.givenName] }), _jsxs("span", { className: "block text-xs text-slate-500", children: ["MRN ", patient.mrn] })] }), _jsx("span", { className: "text-xs font-semibold text-teal-800", children: "Open" })] }) }, patient._id))) })] })] }) }))] }));
}
