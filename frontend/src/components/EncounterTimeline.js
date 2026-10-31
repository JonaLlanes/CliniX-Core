import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { formatEncounterWhen } from './encounterDisplay';
export default function EncounterTimeline({ events }) {
    if (events.length === 0) {
        return _jsx("p", { className: "text-sm text-gray-500", children: "No encounter events yet." });
    }
    return (_jsx("ol", { className: "space-y-3", children: events.map((event, index) => (_jsxs("li", { className: "flex gap-3 text-sm", children: [_jsx("div", { className: "w-36 shrink-0 text-gray-500", children: formatEncounterWhen(event.at) }), _jsxs("div", { children: [_jsx("div", { className: "font-medium text-gray-900", children: event.label }), event.detail && _jsx("div", { className: "text-gray-600", children: event.detail })] })] }, `${event.kind}-${event.at}-${index}`))) }));
}
