import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Navigate, Route, Routes, Link } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import PatientListPage from './pages/PatientListPage';
import PatientDetailPage from './pages/PatientDetailPage';
import SchedulePage from './pages/SchedulePage';
import CheckInPage from './pages/CheckInPage';
import AppLayout from './components/AppLayout';
import ReportsShell from './pages/reports/ReportsShell';
import DashboardPage from './pages/DashboardPage';
import SettingsPage from './pages/SettingsPage';
import OperationalReportPage from './pages/reports/OperationalReportPage';
import ClinicalReportPage from './pages/reports/ClinicalReportPage';
import CohortReportPage from './pages/reports/CohortReportPage';
import { CardSkeleton } from './components/feedback';
import { canViewPopulationReports } from './pages/reports/reportDisplay';
function ReportsGate() {
    const { user } = useAuth();
    if (!canViewPopulationReports(user?.role)) {
        return (_jsxs("div", { className: "max-w-xl", role: "status", children: [_jsx("h1", { className: "text-2xl font-semibold tracking-tight text-slate-950", children: "Reports" }), _jsx("p", { className: "mt-3 text-sm leading-relaxed text-slate-700", children: "Population reports are available to clinicians, nurses, and administrators. Your sign-in role does not include them." }), _jsx(Link, { to: "/dashboard", className: "mt-4 inline-flex rounded-xl bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800", children: "Back to dashboard" })] }));
    }
    return _jsx(ReportsShell, {});
}
function Protected({ children }) {
    const { user, loading } = useAuth();
    if (loading) {
        return (_jsx("div", { className: "min-h-screen bg-slate-50 p-6", children: _jsx(CardSkeleton, { rows: 4, label: "Checking your session" }) }));
    }
    if (!user)
        return _jsx(Navigate, { to: "/login", replace: true });
    return _jsx(_Fragment, { children: children });
}
export default function App() {
    return (_jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(LoginPage, {}) }), _jsxs(Route, { path: "/", element: _jsx(Protected, { children: _jsx(AppLayout, {}) }), children: [_jsx(Route, { path: "dashboard", element: _jsx(DashboardPage, {}) }), _jsx(Route, { index: true, element: _jsx(PatientListPage, {}) }), _jsx(Route, { path: "patients/:id", element: _jsx(PatientDetailPage, {}) }), _jsx(Route, { path: "schedule", element: _jsx(SchedulePage, {}) }), _jsx(Route, { path: "check-in", element: _jsx(CheckInPage, {}) }), _jsx(Route, { path: "settings", element: _jsx(SettingsPage, {}) }), _jsxs(Route, { path: "reports", element: _jsx(ReportsGate, {}), children: [_jsx(Route, { index: true, element: _jsx(OperationalReportPage, {}) }), _jsx(Route, { path: "clinical", element: _jsx(ClinicalReportPage, {}) }), _jsx(Route, { path: "cohorts", element: _jsx(CohortReportPage, {}) })] })] }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] }));
}
