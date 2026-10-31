import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
function AlertMark() {
    return (_jsxs("svg", { viewBox: "0 0 16 16", "aria-hidden": true, className: "h-4 w-4", fill: "none", stroke: "currentColor", strokeWidth: "1.75", children: [_jsx("path", { d: "M8 1.8 14.5 14H1.5L8 1.8z", strokeLinejoin: "round" }), _jsx("path", { d: "M8 6.2v3.4", strokeLinecap: "round" }), _jsx("path", { d: "M8 11.6h.01", strokeLinecap: "round" })] }));
}
export default function AllergyBanner({ allergies }) {
    const active = allergies.filter((allergy) => allergy.status === 'active');
    if (active.length === 0) {
        return (_jsx("div", { className: "mb-6 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700", role: "status", children: "No active allergies on file" }));
    }
    const severe = active.some((allergy) => allergy.severity === 'severe');
    return (_jsxs("div", { className: "mb-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3", role: severe ? 'alert' : 'status', children: [_jsxs("div", { className: "flex items-center gap-2 text-sm font-semibold text-red-900", children: [_jsx(AlertMark, {}), severe ? 'Severe allergy' : 'Allergies'] }), _jsx("ul", { className: "mt-1 space-y-1 text-sm text-red-950", children: active.map((allergy) => (_jsxs("li", { children: [_jsx("span", { className: "font-medium", children: allergy.substance }), ' — ', allergy.reaction, _jsxs("span", { className: "font-semibold text-red-900", children: [" (", allergy.severity, ")"] })] }, allergy._id))) })] }));
}
