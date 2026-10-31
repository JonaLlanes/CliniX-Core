import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function StatCard({ label, value, hint, tone = 'default', }) {
    const tones = {
        default: 'text-gray-900',
        good: 'text-green-600',
        warn: 'text-amber-600',
        bad: 'text-red-600',
        accent: 'text-clinical-teal',
    };
    return (_jsxs("div", { className: "bg-white rounded-lg border border-gray-200 p-5", children: [_jsx("p", { className: "text-sm text-gray-500", children: label }), _jsx("p", { className: `text-3xl font-bold mt-1 ${tones[tone]}`, children: value }), hint && _jsx("p", { className: "text-xs text-gray-400 mt-1", children: hint })] }));
}
