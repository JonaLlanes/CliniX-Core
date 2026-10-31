import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import StatCard from '../../components/StatCard';
import Panel from '../../components/Panel';
import { BarList, TrendChart } from '../../components/reports/Charts';
import { reportsApi, } from '../../api/reports';
import { ExportButton, ReportMessage, useReportLoad } from './ReportsShell';
export default function ClinicalReportPage() {
    const clinical = useReportLoad(reportsApi.clinical);
    const medications = useReportLoad(reportsApi.medications);
    const monitoring = useReportLoad(reportsApi.monitoring);
    const loading = clinical.loading || medications.loading || monitoring.loading;
    const error = clinical.error || medications.error || monitoring.error;
    if (!clinical.ready || loading || error || !clinical.data || !medications.data || !monitoring.data) {
        return (_jsx("div", { className: "space-y-8", children: _jsx(ReportMessage, { loading: loading, error: error, ready: clinical.ready, onRetry: () => {
                    clinical.retry();
                    medications.retry();
                    monitoring.retry();
                } }) }));
    }
    const panel = clinical.data;
    const medicationReport = medications.data;
    const monitoringReport = monitoring.data;
    return (_jsxs("div", { className: "space-y-8", children: [_jsxs("section", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-semibold text-gray-900", children: "Clinical panel" }), _jsxs("p", { className: "text-xs text-gray-500 mt-0.5", children: [panel.range.label, ". Census figures are current. Patients seen are arrived or completed visits in this range."] })] }), _jsxs("div", { className: "grid gap-4 sm:grid-cols-2 xl:grid-cols-4", children: [_jsx(StatCard, { label: "Active patients", value: panel.activePatients, tone: "accent", hint: "Registered charts" }), _jsx(StatCard, { label: "Patients seen", value: panel.patientsSeen, hint: "Arrived or completed in this range" }), _jsx(StatCard, { label: "Active problems", value: panel.activeProblems }), _jsx(StatCard, { label: "Active medications", value: panel.activeMedications }), _jsx(StatCard, { label: "Active care plans", value: panel.activeCarePlans }), _jsx(StatCard, { label: "Monitoring enrollments", value: panel.monitoringEnrollments, hint: "Active programs" }), _jsx(StatCard, { label: "Overdue recalls", value: panel.overdueRecalls, tone: panel.overdueRecalls ? 'bad' : 'default', hint: "Open and past due" })] }), _jsx(Panel, { title: "Patients seen", subtitle: panel.range.bucket === 'week' ? 'Weekly' : 'Daily', children: _jsx(TrendChart, { bucket: panel.range.bucket, points: panel.seenTrend, series: [{ key: 'patientsSeen', label: 'Patients seen', color: '#0d9488' }] }) })] }), _jsxs("section", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-semibold text-gray-900", children: "Medications" }), _jsx("p", { className: "text-xs text-gray-500 mt-0.5", children: "Active medications are current. Discontinued medications and allergy acknowledgements are in this range." })] }), _jsxs("div", { className: "grid gap-4 sm:grid-cols-3", children: [_jsx(StatCard, { label: "Active medications", value: medicationReport.active, tone: "accent" }), _jsx(StatCard, { label: "Discontinued medications", value: medicationReport.discontinued }), _jsx(StatCard, { label: "Allergy acknowledgements", value: medicationReport.allergyAcknowledgements, hint: "Warnings acknowledged in this range" })] })] }), _jsxs("section", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-semibold text-gray-900", children: "Monitoring" }), _jsx("p", { className: "text-xs text-gray-500 mt-0.5", children: "Active programs and overdue recalls are current. Completed recalls and abnormal readings are in this range." })] }), _jsx(ExportButton, { kind: "recalls", label: "Export recalls" })] }), _jsxs("div", { className: "grid gap-4 sm:grid-cols-2 xl:grid-cols-4", children: [_jsx(StatCard, { label: "Active monitoring programs", value: monitoringReport.activePrograms, tone: "accent" }), _jsx(StatCard, { label: "Overdue recalls", value: monitoringReport.overdueRecalls, tone: monitoringReport.overdueRecalls ? 'bad' : 'default' }), _jsx(StatCard, { label: "Completed recalls", value: monitoringReport.completedRecalls, tone: "good" }), _jsx(StatCard, { label: "Abnormal readings", value: monitoringReport.abnormalReadings, tone: monitoringReport.abnormalReadings ? 'warn' : 'default' })] }), _jsxs("div", { className: "grid gap-4 lg:grid-cols-2", children: [_jsx(Panel, { title: "Abnormal readings by type", children: _jsx(BarList, { items: monitoringReport.abnormalByType.map((item) => ({
                                        label: item.label,
                                        value: item.count,
                                    })) }) }), _jsx(Panel, { title: "Abnormal readings", subtitle: monitoringReport.range.bucket === 'week' ? 'Weekly' : 'Daily', children: _jsx(TrendChart, { bucket: monitoringReport.range.bucket, points: monitoringReport.trend, series: [{ key: 'abnormalReadings', label: 'Abnormal readings', color: '#d97706' }] }) })] })] })] }));
}
