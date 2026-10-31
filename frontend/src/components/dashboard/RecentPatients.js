import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { chartLink } from './chartLink';
import { formatLastOpened, readRecentCharts } from './recentCharts';
import { EmptyBlock, SectionCard } from './ui';
export default function RecentPatients() {
    const [charts, setCharts] = useState([]);
    useEffect(() => {
        setCharts(readRecentCharts());
    }, []);
    return (_jsx(SectionCard, { id: "recent-patients", title: "Recently viewed patients", subtitle: "Charts you opened on this browser. Selecting one returns you to that chart.", children: charts.length === 0 ? (_jsx(EmptyBlock, { title: "No recent charts", body: "Open a patient from the schedule, the worklist, or Find Patient. The last charts you viewed will stay here." })) : (_jsx("ul", { className: "grid gap-2 sm:grid-cols-2", children: charts.map((chart) => (_jsx("li", { children: _jsxs(Link, { to: chartLink(chart.id), className: "block rounded-xl border border-slate-200 px-3 py-3 transition hover:border-teal-200 hover:bg-teal-50/40", children: [_jsx("p", { className: "truncate text-sm font-semibold text-slate-950", children: chart.name }), _jsxs("p", { className: "mt-0.5 text-xs text-slate-500", children: ["MRN ", chart.mrn] }), _jsxs("p", { className: "mt-1 text-xs font-medium text-slate-600", children: ["Last opened ", formatLastOpened(chart.openedAt)] })] }) }, chart.id))) })) }));
}
