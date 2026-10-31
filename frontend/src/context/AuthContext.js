import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, } from 'react';
import { authApi } from '../api/client';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('clinix_token'));
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        function onExpired() {
            setToken(null);
            setUser(null);
            setLoading(false);
        }
        window.addEventListener('clinix-session-expired', onExpired);
        return () => window.removeEventListener('clinix-session-expired', onExpired);
    }, []);
    useEffect(() => {
        if (!token) {
            setLoading(false);
            return;
        }
        authApi
            .me()
            .then((r) => setUser(r.user))
            .catch(() => {
            localStorage.removeItem('clinix_token');
            setToken(null);
            setUser(null);
        })
            .finally(() => setLoading(false));
    }, [token]);
    const login = useCallback(async (email, password) => {
        const res = await authApi.login(email, password);
        localStorage.setItem('clinix_token', res.token);
        setToken(res.token);
        setUser(res.user);
    }, []);
    const logout = useCallback(() => {
        localStorage.removeItem('clinix_token');
        setToken(null);
        setUser(null);
    }, []);
    const value = useMemo(() => ({ user, token, loading, login, logout }), [user, token, loading, login, logout]);
    return _jsx(AuthContext.Provider, { value: value, children: children });
}
export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx)
        throw new Error('useAuth outside AuthProvider');
    return ctx;
}
