import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import StatCard from '../../components/StatCard';
import Panel from '../../components/Panel';
import { TrendChart } from '../../components/reports/Charts';
import { reportsApi } from '../../api/reports';
import { ExportButton, ReportMessage, useReportLoad } from './ReportsShell';
export default function OperationalReportPage() {
    const ops = useReportLoad(reportsApi.operational);
    const referrals = useReportLoad(reportsApi.referrals);
    const orders = useReportLoad(reportsApi.orders);
    const loading = ops.loading || referrals.loading || orders.loading;
    const error = ops.error || referrals.error || orders.error;
    if (!ops.ready || loading || error || !ops.data || !referrals.data || !orders.data) {
        return (_jsx("div", { className: "space-y-8", children: _jsx(ReportMessage, { loading: loading, error: error, ready: ops.ready, onRetry: () => {
                    ops.retry();
                    referrals.retry();
                    orders.retry();
                } }) }));
    }
    const operations = ops.data;
    const referralReport = referrals.data;
    const orderReport = orders.data;
    return (_jsxs("div", { className: "space-y-8", children: [_jsxs("section", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-semibold text-gray-900", children: "Operations" }), _jsxs("p", { className: "text-xs text-gray-500 mt-0.5", children: [operations.range.label, ". Appointments are scheduled in this range. Open encounters, referrals, and orders are current."] })] }), _jsx(ExportButton, { kind: "appointments", label: "Export appointments" })] }), _jsxs("div", { className: "grid gap-4 sm:grid-cols-2 xl:grid-cols-4", children: [_jsx(StatCard, { label: "Appointments", value: operations.appointments, tone: "accent", hint: "Scheduled in this range" }), _jsx(StatCard, { label: "Completed visits", value: operations.completedVisits, tone: "good", hint: "Completed appointments" }), _jsx(StatCard, { label: "No-shows", value: operations.noShows, tone: operations.noShows ? 'warn' : 'default' }), _jsx(StatCard, { label: "Cancellations", value: operations.cancellations, tone: operations.cancellations ? 'bad' : 'default' }), _jsx(StatCard, { label: "Average wait", value: operations.averageWaitMinutes == null ? '—' : `${operations.averageWaitMinutes} min`, hint: operations.waitSamples
                                    ? `${operations.waitSamples} arrival${operations.waitSamples === 1 ? '' : 's'} to room`
                                    : 'No roomed visits in this range' }), _jsx(StatCard, { label: "Active encounters", value: operations.activeEncounters, hint: "Open, in progress, or awaiting signature" }), _jsx(StatCard, { label: "Active referrals", value: operations.activeReferrals, hint: "Draft through scheduled" }), _jsx(StatCard, { label: "Active orders", value: operations.activeOrders, hint: "Draft through resulted" })] }), _jsx(Panel, { title: "Appointment volume", subtitle: operations.range.bucket === 'week' ? 'Weekly' : 'Daily', children: _jsx(TrendChart, { bucket: operations.range.bucket, points: operations.trend, series: [
                                { key: 'appointments', label: 'Appointments', color: '#0d9488' },
                                { key: 'completedVisits', label: 'Completed', color: '#16a34a' },
                                { key: 'noShows', label: 'No-shows', color: '#d97706' },
                                { key: 'cancellations', label: 'Cancellations', color: '#dc2626' },
                            ] }) })] }), _jsxs("section", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-semibold text-gray-900", children: "Referrals" }), _jsx("p", { className: "text-xs text-gray-500 mt-0.5", children: "Created, completed, and cancelled in this range. Awaiting follow-up is the current queue." })] }), _jsx(ExportButton, { kind: "referrals", label: "Export referrals" })] }), _jsxs("div", { className: "grid gap-4 sm:grid-cols-2 xl:grid-cols-4", children: [_jsx(StatCard, { label: "Referrals created", value: referralReport.created, tone: "accent" }), _jsx(StatCard, { label: "Referrals completed", value: referralReport.completed, tone: "good" }), _jsx(StatCard, { label: "Referrals cancelled", value: referralReport.cancelled, tone: referralReport.cancelled ? 'bad' : 'default' }), _jsx(StatCard, { label: "Awaiting follow-up", value: referralReport.awaitingFollowUp, tone: referralReport.awaitingFollowUp ? 'warn' : 'default', hint: "Current queue" })] }), _jsx(Panel, { title: "Referral activity", subtitle: referralReport.range.bucket === 'week' ? 'Weekly' : 'Daily', children: _jsx(TrendChart, { bucket: referralReport.range.bucket, points: referralReport.trend, series: [
                                { key: 'created', label: 'Created', color: '#0d9488' },
                                { key: 'completed', label: 'Completed', color: '#16a34a' },
                                { key: 'cancelled', label: 'Cancelled', color: '#dc2626' },
                            ] }) })] }), _jsxs("section", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-semibold text-gray-900", children: "Orders" }), _jsx("p", { className: "text-xs text-gray-500 mt-0.5", children: "Completed and cancelled in this range. Active orders and outstanding results are current." })] }), _jsx(ExportButton, { kind: "orders", label: "Export orders" })] }), _jsxs("div", { className: "grid gap-4 sm:grid-cols-2 xl:grid-cols-4", children: [_jsx(StatCard, { label: "Active orders", value: orderReport.active, hint: "Draft through resulted" }), _jsx(StatCard, { label: "Completed orders", value: orderReport.completed, tone: "good" }), _jsx(StatCard, { label: "Cancelled orders", value: orderReport.cancelled, tone: orderReport.cancelled ? 'bad' : 'default' }), _jsx(StatCard, { label: "Outstanding results", value: orderReport.outstandingResults, tone: orderReport.outstandingResults ? 'warn' : 'default', hint: "Ordered, scheduled, or collected" })] }), _jsx(Panel, { title: "Order completions", subtitle: orderReport.range.bucket === 'week' ? 'Weekly' : 'Daily', children: _jsx(TrendChart, { bucket: orderReport.range.bucket, points: orderReport.trend, series: [
                                { key: 'completed', label: 'Completed', color: '#16a34a' },
                                { key: 'cancelled', label: 'Cancelled', color: '#dc2626' },
                            ] }) })] })] }));
}
