import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
const DEMO_USERS = [
    { email: 'doctor@clinix.local', password: 'Doctor123!', role: 'Clinician' },
    { email: 'nurse@clinix.local', password: 'Nurse123!', role: 'Nurse' },
    { email: 'caregiver@clinix.local', password: 'Caregiver123!', role: 'Caregiver' },
    { email: 'pharmacist@clinix.local', password: 'Pharm123!', role: 'Pharmacist' },
    { email: 'admin@clinix.local', password: 'Admin123!', role: 'Admin' },
    { email: 'insight@clinix.local', password: 'Insight123!', role: 'Insight' },
];
export default function LoginPage() {
    const { user, login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [notice, setNotice] = useState(() => sessionStorage.getItem('clinix_session_notice') || '');
    useEffect(() => {
        if (!notice)
            return;
        sessionStorage.removeItem('clinix_session_notice');
    }, [notice]);
    if (user)
        return _jsx(Navigate, { to: "/", replace: true });
    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(email, password);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed');
        }
        finally {
            setLoading(false);
        }
    }
    async function quickLogin(demoEmail, demoPassword) {
        setEmail(demoEmail);
        setPassword(demoPassword);
        setError('');
        setLoading(true);
        try {
            await login(demoEmail, demoPassword);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed');
        }
        finally {
            setLoading(false);
        }
    }
    return (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-gray-100", children: _jsxs("div", { className: "bg-white rounded-2xl shadow-xl p-8 w-full max-w-md", children: [_jsxs("div", { className: "text-center mb-8", children: [_jsx("div", { className: "inline-flex items-center justify-center w-14 h-14 bg-clinical-teal rounded-xl mb-4", children: _jsx("span", { className: "text-white text-2xl font-bold", children: "+" }) }), _jsx("h1", { className: "text-2xl font-bold text-gray-900", children: "CliniX Core" }), _jsx("p", { className: "text-gray-500 mt-1", children: "Electronic Health Record" })] }), notice && !error && (_jsx("div", { role: "status", className: "mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950", children: notice })), error && (_jsx("div", { role: "alert", id: "login-error", className: "mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900", children: error })), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "login-email", className: "mb-1 block text-sm font-medium text-gray-700", children: "Email" }), _jsx("input", { id: "login-email", type: "email", autoComplete: "username", value: email, onChange: (e) => setEmail(e.target.value), "aria-invalid": error ? true : undefined, className: "w-full rounded-lg border border-gray-300 px-4 py-2.5", required: true })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "login-password", className: "mb-1 block text-sm font-medium text-gray-700", children: "Password" }), _jsx("input", { id: "login-password", type: "password", autoComplete: "current-password", value: password, onChange: (e) => setPassword(e.target.value), "aria-invalid": error ? true : undefined, "aria-describedby": error ? 'login-error' : undefined, className: "w-full rounded-lg border border-gray-300 px-4 py-2.5", required: true })] }), _jsx("button", { type: "submit", disabled: loading, className: "w-full py-2.5 bg-clinical-teal text-white rounded-lg font-medium hover:bg-clinical-teal-dark transition-colors disabled:opacity-50", children: loading ? 'Signing in...' : 'Sign in' })] }), _jsxs("div", { className: "mt-6 pt-6 border-t border-gray-200", children: [_jsx("p", { className: "text-xs text-gray-500 text-center mb-3", children: "Quick demo login" }), _jsx("div", { className: "grid grid-cols-2 gap-2", children: DEMO_USERS.map((u) => (_jsx("button", { type: "button", onClick: () => quickLogin(u.email, u.password), disabled: loading, "aria-label": `Sign in as ${u.role}`, className: "text-xs py-2 px-3 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 disabled:opacity-50", children: u.role }, u.email))) })] })] }) }));
}
