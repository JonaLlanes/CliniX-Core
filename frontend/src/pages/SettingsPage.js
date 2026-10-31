import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useOnboarding } from '../context/OnboardingContext';
import { accountRoleLabel, onboardingRoleLabel } from '../onboarding/content';
function formatWhen(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime()))
        return iso;
    return new Intl.DateTimeFormat('en-CA', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
}
export default function SettingsPage() {
    const { user, logout } = useAuth();
    const { record, restart } = useOnboarding();
    const navigate = useNavigate();
    const [confirmRestart, setConfirmRestart] = useState(false);
    const selectedRole = onboardingRoleLabel(record?.role);
    function signOut() {
        logout();
        navigate('/login');
    }
    return (_jsxs("div", { className: "mx-auto max-w-3xl space-y-6", children: [_jsxs("header", { children: [_jsx("h1", { className: "text-2xl font-semibold tracking-tight text-slate-900", children: "Settings" }), _jsx("p", { className: "mt-1 text-sm text-slate-600", children: "Account details and the product tour saved in this browser." })] }), _jsxs("section", { className: "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm", children: [_jsx("h2", { className: "text-sm font-semibold text-slate-900", children: "Account" }), _jsxs("dl", { className: "mt-4 grid gap-4 sm:grid-cols-2", children: [_jsxs("div", { children: [_jsx("dt", { className: "text-xs font-medium uppercase tracking-wide text-slate-600", children: "Name" }), _jsx("dd", { className: "mt-1 text-sm text-slate-800", children: user?.displayName })] }), _jsxs("div", { children: [_jsx("dt", { className: "text-xs font-medium uppercase tracking-wide text-slate-600", children: "Email" }), _jsx("dd", { className: "mt-1 text-sm text-slate-800", children: user?.email })] }), _jsxs("div", { children: [_jsx("dt", { className: "text-xs font-medium uppercase tracking-wide text-slate-600", children: "Sign-in role" }), _jsx("dd", { className: "mt-1 text-sm text-slate-800", children: accountRoleLabel(user?.role) })] }), _jsxs("div", { children: [_jsx("dt", { className: "text-xs font-medium uppercase tracking-wide text-slate-600", children: "Clinic day" }), _jsx("dd", { className: "mt-1 text-sm text-slate-800", children: "America/Toronto" })] })] }), _jsx("p", { className: "mt-4 text-xs leading-relaxed text-slate-500", children: "Sign-in permissions are set on the account. The tour role below does not change them." })] }), _jsxs("section", { className: "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm", children: [_jsx("h2", { className: "text-sm font-semibold text-slate-900", children: "Onboarding" }), _jsxs("dl", { className: "mt-4 grid gap-4 sm:grid-cols-2", children: [_jsxs("div", { children: [_jsx("dt", { className: "text-xs font-medium uppercase tracking-wide text-slate-600", children: "Selected role" }), _jsx("dd", { className: "mt-1 text-sm text-slate-800", children: selectedRole ?? 'Not selected' })] }), _jsxs("div", { children: [_jsx("dt", { className: "text-xs font-medium uppercase tracking-wide text-slate-600", children: "Status" }), _jsx("dd", { className: "mt-1 text-sm text-slate-800", children: record?.completed
                                            ? record.skippedTour
                                                ? 'Completed, tour skipped'
                                                : 'Completed'
                                            : 'Not finished' })] }), record?.completedAt && (_jsxs("div", { className: "sm:col-span-2", children: [_jsx("dt", { className: "text-xs font-medium uppercase tracking-wide text-slate-600", children: "Saved" }), _jsx("dd", { className: "mt-1 text-sm text-slate-800", children: formatWhen(record.completedAt) })] }))] }), _jsx("p", { className: "mt-4 text-sm leading-relaxed text-slate-600", children: "Restart walks through the welcome, role, and product tour again. This clears the saved setup for your account in this browser only." }), confirmRestart ? (_jsxs("div", { className: "mt-4 flex flex-wrap items-center gap-2", children: [_jsx("button", { type: "button", onClick: restart, className: "rounded-xl bg-clinical-teal px-4 py-2.5 text-sm font-semibold text-white hover:bg-clinical-teal-dark", children: "Start again" }), _jsx("button", { type: "button", onClick: () => setConfirmRestart(false), className: "rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50", children: "Cancel" })] })) : (_jsx("button", { type: "button", onClick: () => setConfirmRestart(true), className: "mt-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-semibold text-teal-800 hover:bg-teal-100", children: "Restart onboarding" }))] }), _jsx("div", { className: "flex justify-end", children: _jsx("button", { type: "button", onClick: signOut, className: "text-sm font-medium text-rose-700 hover:text-rose-800", children: "Sign out" }) })] }));
}
