import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Link } from 'react-router-dom';
const TREND_TONE = {
    neutral: 'bg-slate-100 text-slate-600',
    good: 'bg-emerald-50 text-emerald-800',
    warn: 'bg-amber-100 text-amber-900',
};
const ARROW = {
    up: '↑',
    down: '↓',
    flat: '→',
};
export function TrendChip({ trend }) {
    return (_jsxs("span", { className: `inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${TREND_TONE[trend.tone]}`, children: [_jsx("span", { "aria-hidden": true, children: ARROW[trend.direction] }), _jsx("span", { className: "truncate", children: trend.label })] }));
}
export function OpsCard({ label, value, trend, icon, onClick, }) {
    return (_jsxs("button", { type: "button", onClick: onClick, className: "flex min-h-[8.5rem] flex-col rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-teal-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500", children: [_jsxs("span", { className: "flex items-start justify-between gap-2", children: [_jsx("span", { className: "grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal-50 text-clinical-teal", children: icon }), trend ? _jsx(TrendChip, { trend: trend }) : _jsx("span", { className: "h-5 w-16 animate-pulse rounded-full bg-slate-100" })] }), value == null ? (_jsx("span", { className: "mt-4 h-8 w-14 animate-pulse rounded-lg bg-slate-200" })) : (_jsx("span", { className: "mt-4 text-3xl font-semibold tabular-nums tracking-tight text-slate-950", children: value })), _jsx("span", { className: "mt-1 text-sm font-medium text-slate-600", children: label })] }));
}
export function QuickActionCard({ title, body, icon, to, onClick, }) {
    const className = 'group flex min-h-[9.5rem] flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-teal-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 sm:p-5';
    const inner = (_jsxs(_Fragment, { children: [_jsx("span", { className: "grid h-12 w-12 place-items-center rounded-2xl bg-teal-700 text-white shadow-sm transition group-hover:bg-teal-800", children: icon }), _jsxs("span", { className: "mt-4 block", children: [_jsx("span", { className: "block text-base font-semibold text-slate-950", children: title }), _jsx("span", { className: "mt-1 block text-sm leading-snug text-slate-500", children: body })] })] }));
    if (to) {
        return (_jsx(Link, { to: to, className: className, children: inner }));
    }
    return (_jsx("button", { type: "button", onClick: onClick, className: className, children: inner }));
}
export function SectionCard({ id, title, subtitle, action, children, warning = false, }) {
    return (_jsxs("section", { id: id, className: `scroll-mt-24 rounded-2xl border shadow-sm ${warning ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`, children: [_jsxs("div", { className: `flex flex-wrap items-start justify-between gap-3 border-b px-4 py-4 sm:px-5 ${warning ? 'border-amber-200' : 'border-slate-100'}`, children: [_jsxs("div", { className: "min-w-0", children: [_jsx("h2", { className: `text-base font-semibold ${warning ? 'text-amber-950' : 'text-slate-950'}`, children: title }), subtitle && (_jsx("p", { className: `mt-1 max-w-3xl text-sm leading-relaxed ${warning ? 'text-amber-950' : 'text-slate-600'}`, children: subtitle }))] }), action] }), _jsx("div", { className: "p-4 sm:p-5", children: children })] }));
}
export function EmptyBlock({ title, body }) {
    return (_jsxs("div", { className: "rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center", children: [_jsx("p", { className: "text-sm font-medium text-slate-800", children: title }), _jsx("p", { className: "mx-auto mt-1 max-w-md text-sm leading-relaxed text-slate-500", children: body })] }));
}
export function Bone({ className }) {
    return _jsx("div", { className: `animate-pulse rounded-xl bg-slate-200 ${className}` });
}
