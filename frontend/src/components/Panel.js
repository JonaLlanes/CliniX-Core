import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from 'react-router-dom';
export default function Panel({ title, subtitle, link, linkLabel = 'View all', children, className = '', }) {
    return (_jsxs("div", { className: `bg-white rounded-lg border border-gray-200 p-6 ${className}`, children: [(title || link) && (_jsxs("div", { className: "flex items-start justify-between mb-4 gap-4", children: [_jsxs("div", { children: [title && _jsx("h2", { className: "font-semibold text-gray-900", children: title }), subtitle && _jsx("p", { className: "text-xs text-gray-500 mt-0.5", children: subtitle })] }), link && (_jsx(Link, { to: link, className: "text-sm text-clinical-teal hover:underline shrink-0", children: linkLabel }))] })), children] }));
}
export function EmptyState({ text, hint }) {
    return (_jsxs("div", { className: "py-8 text-center", children: [_jsx("p", { className: "text-sm font-medium text-gray-800", children: text }), hint && _jsx("p", { className: "mx-auto mt-1 max-w-md text-sm text-gray-600", children: hint })] }));
}
