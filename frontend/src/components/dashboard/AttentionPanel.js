import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from 'react-router-dom';
import { Bone, EmptyBlock, SectionCard } from './ui';
const GROUPS = [
    { id: 'critical', label: 'Critical results', row: 'border-rose-200 bg-white' },
    { id: 'recall', label: 'Overdue recalls', row: 'border-amber-200 bg-white' },
    { id: 'medication', label: 'High-alert medications', row: 'border-orange-200 bg-white' },
    { id: 'abnormal', label: 'Unresolved abnormalities', row: 'border-amber-200 bg-white' },
];
export default function AttentionPanel({ items, ready }) {
    const populated = GROUPS.map((group) => ({
        ...group,
        items: items.filter((item) => item.kind === group.id),
    })).filter((group) => group.items.length > 0);
    return (_jsxs(SectionCard, { id: "clinical-attention", title: "Clinical Attention Needed", subtitle: "Overdue recalls, critical results, high-alert medications, and unresolved abnormalities.", warning: true, children: [!ready && (_jsxs("div", { className: "space-y-2", "aria-busy": "true", children: [_jsx("span", { className: "sr-only", children: "Loading clinical attention" }), _jsx(Bone, { className: "h-20 w-full" }), _jsx(Bone, { className: "h-20 w-full" }), _jsx(Bone, { className: "h-20 w-full" })] })), ready && populated.length === 0 && (_jsx(EmptyBlock, { title: "No clinical alerts in the charts reviewed", body: "Overdue recalls, critical results, high-alert medications, and unresolved abnormalities will collect here." })), ready && populated.length > 0 && (_jsx("div", { className: "space-y-4", children: populated.map((group) => (_jsxs("div", { children: [_jsx("h3", { className: "text-xs font-semibold uppercase tracking-wide text-amber-900", children: group.label }), _jsx("ul", { className: "mt-2 space-y-2", children: group.items.map((item) => (_jsx("li", { className: `rounded-xl border px-3 py-2.5 ${group.row}`, children: _jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "truncate text-sm font-semibold text-slate-950", children: item.title }), _jsxs("p", { className: "truncate text-xs text-slate-600", children: [item.patientName, " \u00B7 MRN ", item.mrn] }), item.detail && _jsx("p", { className: "mt-1 text-xs leading-relaxed text-slate-600", children: item.detail })] }), _jsx(Link, { to: item.href, className: "shrink-0 text-xs font-semibold text-amber-950 underline-offset-2 hover:underline", children: "Open chart" })] }) }, item.id))) })] }, group.id))) }))] }));
}
