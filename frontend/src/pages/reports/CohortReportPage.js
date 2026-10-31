import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import Panel from '../../components/Panel';
import { BarList } from '../../components/reports/Charts';
import { reportsApi } from '../../api/reports';
import { ExportButton, ReportMessage, useReportLoad } from './ReportsShell';
export default function CohortReportPage() {
    const report = useReportLoad(reportsApi.cohorts);
    return (_jsx("div", { className: "space-y-6", children: !report.ready || report.loading || report.error || !report.data ? (_jsx(ReportMessage, { loading: report.loading, error: report.error, ready: report.ready, onRetry: report.retry })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-semibold text-gray-900", children: "Chronic disease cohorts" }), _jsxs("p", { className: "text-xs text-gray-500 mt-0.5", children: [report.data.range.label, ". Patients with an active problem or an open monitoring program. Abnormal readings are in this range."] })] }), _jsx(ExportButton, { kind: "cohorts", label: "Export cohorts" })] }), _jsx("div", { className: "grid gap-4 md:grid-cols-2 xl:grid-cols-3", children: report.data.cohorts.map((cohort) => (_jsxs("article", { className: "bg-white rounded-lg border border-gray-200 p-5", children: [_jsx("h3", { className: "font-semibold text-gray-900", children: cohort.label }), _jsx("p", { className: "text-3xl font-bold text-clinical-teal mt-2", children: cohort.patients.toLocaleString() }), _jsx("p", { className: "text-xs text-gray-500", children: "Patients" }), _jsxs("dl", { className: "mt-4 space-y-2 text-sm", children: [_jsx(Row, { label: "Active care plans", value: cohort.activeCarePlans }), _jsx(Row, { label: "Overdue recalls", value: cohort.overdueRecalls, warn: cohort.overdueRecalls > 0 }), _jsx(Row, { label: "Abnormal readings", value: cohort.recentAbnormalReadings, warn: cohort.recentAbnormalReadings > 0 })] })] }, cohort.key))) }), _jsx(Panel, { title: "Cohort size", subtitle: "Patients in each chronic disease cohort", children: _jsx(BarList, { items: report.data.cohorts.map((cohort) => ({
                            label: cohort.label,
                            value: cohort.patients,
                            hint: [
                                countPhrase(cohort.activeCarePlans, 'care plan'),
                                countPhrase(cohort.overdueRecalls, 'overdue recall', 'overdue recalls'),
                                countPhrase(cohort.recentAbnormalReadings, 'abnormal reading', 'abnormal readings'),
                            ].join(' · '),
                        })) }) })] })) }));
}
function Row({ label, value, warn = false }) {
    return (_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsx("dt", { className: "text-gray-600", children: label }), _jsx("dd", { className: `font-medium ${warn ? 'text-amber-700' : 'text-gray-900'}`, children: value.toLocaleString() })] }));
}
function countPhrase(count, singular, plural = `${singular}s`) {
    return `${count} ${count === 1 ? singular : plural}`;
}
