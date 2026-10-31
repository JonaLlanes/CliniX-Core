import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const PALETTE = ['#0d9488', '#0369a1', '#d97706', '#dc2626', '#7c3aed'];
export function TrendChart({ points, series, bucket = 'day', }) {
    const width = 720;
    const height = 240;
    const pad = { top: 16, right: 16, bottom: 36, left: 36 };
    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;
    const max = Math.max(1, ...points.flatMap((point) => series.map((item) => Number(point[item.key]) || 0)));
    const ticks = [0, Math.round(max / 2), max].filter((value, index, all) => all.indexOf(value) === index);
    const step = points.length > 1 ? innerW / (points.length - 1) : 0;
    const xOf = (index) => (points.length === 1 ? pad.left + innerW / 2 : pad.left + index * step);
    const yOf = (value) => pad.top + innerH - (value / max) * innerH;
    const labelEvery = points.length > 16 ? Math.ceil(points.length / 8) : points.length > 8 ? 2 : 1;
    return (_jsxs("div", { children: [_jsxs("svg", { viewBox: `0 0 ${width} ${height}`, className: "w-full h-auto", role: "img", "aria-label": "Trend chart", children: [ticks.map((tick) => (_jsxs("g", { children: [_jsx("line", { x1: pad.left, x2: width - pad.right, y1: yOf(tick), y2: yOf(tick), stroke: "#e5e7eb" }), _jsx("text", { x: pad.left - 8, y: yOf(tick) + 4, textAnchor: "end", className: "fill-gray-400", fontSize: "11", children: tick })] }, tick))), series.map((item, seriesIndex) => {
                        const color = item.color || PALETTE[seriesIndex % PALETTE.length];
                        const line = points
                            .map((point, index) => `${xOf(index)},${yOf(Number(point[item.key]) || 0)}`)
                            .join(' ');
                        return (_jsxs("g", { children: [points.length > 1 && (_jsx("polyline", { fill: "none", stroke: color, strokeWidth: "2.5", points: line })), points.map((point, index) => {
                                    const value = Number(point[item.key]) || 0;
                                    return (_jsx("circle", { cx: xOf(index), cy: yOf(value), r: "3.5", fill: color, children: _jsx("title", { children: `${item.label} · ${point.date}: ${value}` }) }, `${item.key}-${point.date}`));
                                })] }, item.key));
                    }), points.map((point, index) => index % labelEvery === 0 || index === points.length - 1 ? (_jsx("text", { x: xOf(index), y: height - 10, textAnchor: "middle", className: "fill-gray-500", fontSize: "11", children: bucket === 'week' ? `Wk ${formatAxis(String(point.date))}` : formatAxis(String(point.date)) }, String(point.date))) : null)] }), _jsx("div", { className: "flex flex-wrap gap-4 mt-2", children: series.map((item, index) => (_jsxs("div", { className: "flex items-center gap-2 text-xs text-gray-600", children: [_jsx("span", { className: "inline-block w-3 h-3 rounded-full", style: { background: item.color || PALETTE[index % PALETTE.length] } }), item.label] }, item.key))) })] }));
}
function formatAxis(iso) {
    const [year, month, day] = iso.split('-').map(Number);
    if (!year || !month || !day)
        return iso;
    return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-CA', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
    });
}
export function BarList({ items, }) {
    const max = Math.max(1, ...items.map((item) => item.value));
    if (items.length === 0) {
        return _jsx("p", { className: "text-sm text-gray-500 py-6 text-center", children: "Nothing to chart in this range." });
    }
    return (_jsx("ul", { className: "space-y-3", children: items.map((item) => (_jsxs("li", { children: [_jsxs("div", { className: "flex items-baseline justify-between gap-3 text-sm mb-1", children: [_jsx("span", { className: "text-gray-700", children: item.label }), _jsx("span", { className: "font-semibold text-gray-900", children: item.value.toLocaleString() })] }), _jsx("div", { className: "h-2.5 rounded-full bg-gray-100 overflow-hidden", children: _jsx("div", { className: "h-full rounded-full bg-clinical-teal", style: { width: `${Math.max(item.value > 0 ? 4 : 0, (item.value / max) * 100)}%` } }) }), item.hint && _jsx("p", { className: "text-xs text-gray-400 mt-1", children: item.hint })] }, item.label))) }));
}
