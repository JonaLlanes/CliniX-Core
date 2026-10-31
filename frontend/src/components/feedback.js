import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function ErrorNotice({ title = 'This could not be loaded', message, onRetry, }) {
    return (_jsxs("div", { role: "alert", className: "rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-950", children: [_jsx("p", { className: "font-semibold", children: title }), _jsx("p", { className: "mt-1 text-rose-900", children: message }), onRetry && (_jsx("button", { type: "button", onClick: onRetry, className: "mt-3 rounded-lg bg-rose-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-900", children: "Try again" }))] }));
}
export function SkeletonBlock({ className = '' }) {
    return _jsx("div", { className: `animate-pulse rounded-xl bg-slate-200 motion-reduce:animate-none ${className}` });
}
export function CardSkeleton({ rows = 3, label }) {
    return (_jsxs("div", { className: "space-y-3", "aria-busy": "true", "aria-live": "polite", children: [_jsx("span", { className: "sr-only", children: label }), _jsx(SkeletonBlock, { className: "h-8 w-48" }), _jsx("div", { className: "grid gap-3 sm:grid-cols-2 xl:grid-cols-3", children: Array.from({ length: rows }, (_, index) => (_jsx(SkeletonBlock, { className: "h-28" }, index))) })] }));
}
export function RowSkeleton({ rows = 6, label }) {
    return (_jsxs("div", { className: "space-y-2", "aria-busy": "true", "aria-live": "polite", children: [_jsx("span", { className: "sr-only", children: label }), Array.from({ length: rows }, (_, index) => (_jsx(SkeletonBlock, { className: "h-12 w-full" }, index)))] }));
}
export function EmptyPanel({ title, body, action, }) {
    return (_jsxs("div", { className: "rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center", children: [_jsx("p", { className: "text-sm font-medium text-slate-800", children: title }), body && _jsx("p", { className: "mx-auto mt-1 max-w-md text-sm text-slate-600", children: body }), action && _jsx("div", { className: "mt-3", children: action })] }));
}
