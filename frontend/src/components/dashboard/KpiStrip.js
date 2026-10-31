import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BellIcon, BuildingIcon, CalendarIcon, PulseIcon, UsersIcon } from '../icons';
import { OpsCard } from './ui';
function OrderIcon(iconProps) {
    const { className = 'h-5 w-5', ...props } = iconProps;
    return (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, className: className, ...props, children: [_jsx("rect", { x: "6", y: "3.5", width: "12", height: "17", rx: "2" }), _jsx("path", { d: "M9 8.5h6M9 12.5h6M9 16.5h3.5" })] }));
}
function ReferralIcon(iconProps) {
    const { className = 'h-5 w-5', ...props } = iconProps;
    return (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, className: className, ...props, children: [_jsx("path", { d: "M7 7h9.5M13.5 4.5 16.5 7l-3 2.5" }), _jsx("path", { d: "M17 17H7.5M10.5 14.5 7.5 17l3 2.5" })] }));
}
const CARDS = [
    { id: 'appointments', label: "Today's Appointments", icon: _jsx(CalendarIcon, { className: "h-5 w-5" }) },
    { id: 'waiting', label: 'Waiting Patients', icon: _jsx(UsersIcon, { className: "h-5 w-5" }) },
    { id: 'roomed', label: 'Roomed Patients', icon: _jsx(BuildingIcon, { className: "h-5 w-5" }) },
    { id: 'encounters', label: 'Active Encounters', icon: _jsx(PulseIcon, { className: "h-5 w-5" }) },
    { id: 'orders', label: 'Open Orders', icon: _jsx(OrderIcon, { className: "h-5 w-5" }) },
    { id: 'referrals', label: 'Pending Referrals', icon: _jsx(ReferralIcon, { className: "h-5 w-5" }) },
    { id: 'recalls', label: 'Overdue Recalls', icon: _jsx(BellIcon, { className: "h-5 w-5" }) },
];
export default function KpiStrip({ values, trends, onSelect, }) {
    return (_jsx("section", { "aria-label": "Clinic totals", children: _jsx("div", { className: "grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7", children: CARDS.map((card) => (_jsx(OpsCard, { label: card.label, value: values[card.id], trend: values[card.id] == null ? null : trends[card.id], icon: card.icon, onClick: () => onSelect(card.id) }, card.id))) }) }));
}
