import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { StatusBadge } from '../StatusBadge';
import { Bone, EmptyBlock, SectionCard } from './ui';
const FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'encounter', label: 'Unsigned encounters' },
    { id: 'order', label: 'Pending orders' },
    { id: 'referral', label: 'Outstanding referrals' },
    { id: 'task', label: 'Open tasks' },
];
const KIND_LABEL = {
    encounter: 'Unsigned encounter',
    order: 'Pending order',
    referral: 'Outstanding referral',
    task: 'Open task',
};
const PRIORITY_STYLE = {
    stat: 'bg-red-100 text-red-800',
    urgent: 'bg-amber-100 text-amber-900',
    high: 'bg-orange-100 text-orange-900',
    routine: 'bg-slate-100 text-slate-600',
};
const PRIORITY_LABEL = {
    stat: 'Stat',
    urgent: 'Urgent',
    high: 'High',
    routine: 'Routine',
};
const EMPTY = {
    all: {
        title: 'No open work',
        body: 'Unsigned encounters, pending orders, outstanding referrals, and open tasks show up here.',
    },
    encounter: {
        title: 'No unsigned encounters',
        body: 'Encounters that still need a note or a signature show up here.',
    },
    order: {
        title: 'No pending orders',
        body: 'Orders that are still open show up here.',
    },
    referral: {
        title: 'No outstanding referrals',
        body: 'Active referrals and follow-ups show up here.',
    },
    task: {
        title: 'No open tasks',
        body: 'Unfinished care tasks show up here.',
    },
};
function countOf(items, id) {
    if (id === 'all')
        return items.length;
    return items.filter((item) => item.kind === id).length;
}
export default function WorklistPanel({ items, ready, filter, onFilter, note, }) {
    const visible = useMemo(() => (filter === 'all' ? items : items.filter((item) => item.kind === filter)), [filter, items]);
    const tabRefs = useRef([]);
    function onTabKey(event, index) {
        let next = index;
        if (event.key === 'ArrowRight')
            next = (index + 1) % FILTERS.length;
        else if (event.key === 'ArrowLeft')
            next = (index - 1 + FILTERS.length) % FILTERS.length;
        else if (event.key === 'Home')
            next = 0;
        else if (event.key === 'End')
            next = FILTERS.length - 1;
        else
            return;
        event.preventDefault();
        onFilter(FILTERS[next].id);
        tabRefs.current[next]?.focus();
    }
    const empty = EMPTY[filter];
    return (_jsxs(SectionCard, { id: "care-team-worklist", title: "Care team worklist", subtitle: note || 'Unsigned encounters, pending orders, outstanding referrals, and open tasks.', children: [_jsx("div", { className: "mb-4 flex max-w-full gap-2 overflow-x-auto pb-1", role: "tablist", "aria-label": "Worklist", children: FILTERS.map((item, index) => {
                    const selected = filter === item.id;
                    const count = ready ? countOf(items, item.id) : null;
                    return (_jsxs("button", { ref: (node) => {
                            tabRefs.current[index] = node;
                        }, type: "button", role: "tab", id: `worklist-tab-${item.id}`, "aria-selected": selected, "aria-controls": "worklist-panel", tabIndex: selected ? 0 : -1, onClick: () => onFilter(item.id), onKeyDown: (event) => onTabKey(event, index), className: `shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition ${selected ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`, children: [item.label, count != null && _jsxs("span", { className: selected ? 'text-teal-100' : 'text-slate-600', children: [" ", count] })] }, item.id));
                }) }), !ready && (_jsxs("div", { className: "space-y-2", "aria-busy": "true", "aria-live": "polite", children: [_jsx("span", { className: "sr-only", children: "Loading the worklist" }), Array.from({ length: 5 }, (_, index) => (_jsx(Bone, { className: "h-16 w-full" }, index)))] })), ready && visible.length === 0 && (_jsx(EmptyBlock, { title: empty.title, body: empty.body })), ready && visible.length > 0 && (_jsx("div", { id: "worklist-panel", role: "tabpanel", "aria-labelledby": `worklist-tab-${filter}`, className: "max-w-full overflow-x-auto", children: _jsxs("table", { className: "w-full min-w-[40rem] text-left text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-xs font-semibold uppercase tracking-wide text-slate-600", children: [_jsx("th", { className: "pb-2 pr-3 font-semibold", children: "Patient" }), _jsx("th", { className: "pb-2 pr-3 font-semibold", children: "Work" }), _jsx("th", { className: "pb-2 pr-3 font-semibold", children: "Priority" }), _jsx("th", { className: "pb-2 pr-3 font-semibold", children: "Status" }), _jsx("th", { className: "pb-2 text-right font-semibold", children: "Action" })] }) }), _jsx("tbody", { children: visible.map((item) => (_jsxs("tr", { className: "border-t border-slate-100", children: [_jsxs("td", { className: "py-3 pr-3 align-middle", children: [_jsx(Link, { to: item.href, className: "font-medium text-slate-950 hover:text-teal-800 hover:underline", children: item.patientName }), _jsxs("p", { className: "text-xs text-slate-500", children: ["MRN ", item.mrn] })] }), _jsxs("td", { className: "max-w-[16rem] py-3 pr-3 align-middle", children: [_jsx("p", { className: "text-[11px] font-semibold uppercase tracking-wide text-slate-600", children: KIND_LABEL[item.kind] }), _jsx("p", { className: "truncate font-medium text-slate-800", title: item.title, children: item.title })] }), _jsx("td", { className: "py-3 pr-3 align-middle", children: _jsx("span", { className: `inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLE[item.priority]}`, children: PRIORITY_LABEL[item.priority] }) }), _jsx("td", { className: "py-3 pr-3 align-middle", children: _jsx(StatusBadge, { value: item.status }) }), _jsx("td", { className: "py-3 text-right align-middle", children: _jsx(Link, { to: item.href, className: "inline-flex rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800", children: item.action }) })] }, item.id))) })] }) }))] }));
}
