import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { memo, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AttentionPanel from '../components/dashboard/AttentionPanel';
import KpiStrip from '../components/dashboard/KpiStrip';
import QuickActions from '../components/dashboard/QuickActions';
import RecentPatients from '../components/dashboard/RecentPatients';
import SchedulePanel from '../components/dashboard/SchedulePanel';
import WorklistPanel from '../components/dashboard/WorklistPanel';
import { useClinicOperations } from '../components/dashboard/useClinicOperations';
import { useAuth } from '../context/AuthContext';
import { useOnboarding } from '../context/OnboardingContext';
import { accountRoleLabel, clinicDateLine, greetingForClinic, suggestedOnboardingRole, workspaceBlurb } from '../onboarding/content';
import { ErrorNotice } from '../components/feedback';
import { canViewPopulationReports } from './reports/reportDisplay';
const MemoKpi = memo(KpiStrip);
const MemoQuick = memo(QuickActions);
const MemoWorklist = memo(WorklistPanel);
const MemoAttention = memo(AttentionPanel);
const MemoSchedule = memo(SchedulePanel);
const MemoRecent = memo(RecentPatients);
function scrollToSection(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
export default function DashboardPage() {
    const { user } = useAuth();
    const { role } = useOnboarding();
    const navigate = useNavigate();
    const canView = canViewPopulationReports(user?.role);
    const ops = useClinicOperations(canView);
    const [workFilter, setWorkFilter] = useState('all');
    const blurb = workspaceBlurb(role ?? suggestedOnboardingRole(user?.role));
    const kpiValues = useMemo(() => ({
        appointments: ops.appointments,
        waiting: ops.waiting,
        roomed: ops.roomed,
        encounters: ops.encounters,
        orders: ops.orders,
        referrals: ops.referrals,
        recalls: ops.recalls,
    }), [ops.appointments, ops.waiting, ops.roomed, ops.encounters, ops.orders, ops.referrals, ops.recalls]);
    const onKpi = useCallback((id) => {
        if (id === 'appointments') {
            scrollToSection('todays-schedule');
            return;
        }
        if (id === 'waiting' || id === 'roomed') {
            navigate('/check-in');
            return;
        }
        if (id === 'recalls') {
            scrollToSection('clinical-attention');
            return;
        }
        const filter = id === 'encounters' ? 'encounter' : id === 'orders' ? 'order' : 'referral';
        setWorkFilter(filter);
        scrollToSection('care-team-worklist');
    }, [navigate]);
    return (_jsxs("div", { className: "mx-auto max-w-[90rem] space-y-6", children: [_jsxs("header", { className: "flex flex-wrap items-end justify-between gap-4", children: [_jsxs("div", { children: [_jsxs("p", { className: "text-sm font-medium text-clinical-teal", children: [clinicDateLine(), " \u00B7 America/Toronto"] }), _jsxs("h1", { className: "mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl", children: [greetingForClinic(), ", ", user?.displayName] }), _jsx("p", { className: "mt-2 max-w-2xl text-sm leading-relaxed text-slate-600", children: blurb })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [ops.refreshing && ops.readyBoard && (_jsx("span", { className: "text-xs font-medium text-slate-600", role: "status", children: "Updating\u2026" })), _jsx("button", { type: "button", onClick: ops.refresh, className: "rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-teal-200 hover:text-teal-800", children: "Refresh" }), _jsx("span", { className: "inline-flex rounded-full bg-white px-3 py-1 text-xs font-medium text-teal-800 ring-1 ring-teal-100", children: accountRoleLabel(user?.role) })] })] }), (ops.boardError || ops.workError) && (_jsx(ErrorNotice, { title: ops.boardError ? 'Today’s clinic board did not load' : 'The care team worklist did not load', message: ops.boardError || ops.workError, onRetry: ops.refresh })), _jsx(MemoKpi, { values: kpiValues, trends: ops.trends, onSelect: onKpi }), _jsx(MemoQuick, {}), _jsxs("div", { className: "grid items-start gap-6 xl:grid-cols-5", children: [_jsx("div", { className: "min-w-0 xl:col-span-3", children: _jsx(MemoWorklist, { items: ops.work, ready: ops.readyWork, filter: workFilter, onFilter: setWorkFilter, note: ops.scopeNote }) }), _jsx("div", { className: "min-w-0 xl:col-span-2", children: _jsx(MemoAttention, { items: ops.attention, ready: ops.readyWork }) })] }), _jsx(MemoSchedule, { rows: ops.schedule, ready: ops.readyBoard }), _jsx(MemoRecent, {})] }));
}
