import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { OnboardingProvider, useOnboarding } from '../context/OnboardingContext';
import CommandPalette from './command/CommandPalette';
import { commandShortcutLabel } from './command/commands';
import OnboardingOverlay from './onboarding/OnboardingOverlay';
import { BellIcon, BrandMark, CalendarIcon, CheckInIcon, CloseIcon, DashboardIcon, MenuIcon, ReportsIcon, SearchIcon, SettingsIcon, UsersIcon, } from './icons';
import { TOUR_STEPS, accountRoleLabel } from '../onboarding/content';
import { useFocusTrap } from './a11y';
const NAV = [
    { to: '/dashboard', label: 'Dashboard', icon: DashboardIcon, tour: 'dashboard' },
    { to: '/', label: 'Patients', icon: UsersIcon, tour: undefined },
    { to: '/schedule', label: 'Schedule', icon: CalendarIcon, tour: 'schedule' },
    { to: '/check-in', label: 'Check-In', icon: CheckInIcon, tour: 'check-in' },
    { to: '/reports', label: 'Reports', icon: ReportsIcon, tour: 'reports' },
    { to: '/settings', label: 'Settings', icon: SettingsIcon, tour: undefined },
];
function itemActive(pathname, to) {
    if (to === '/')
        return pathname === '/' || pathname.startsWith('/patients');
    return pathname === to || pathname.startsWith(`${to}/`);
}
function initials(name) {
    const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
    const value = parts.map((part) => part[0]?.toUpperCase() ?? '').join('');
    return value || 'CX';
}
function useCompact() {
    const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 1023px)').matches);
    useEffect(() => {
        const mq = window.matchMedia('(max-width: 1023px)');
        const apply = () => setCompact(mq.matches);
        apply();
        mq.addEventListener('change', apply);
        return () => mq.removeEventListener('change', apply);
    }, []);
    return compact;
}
function Shell() {
    const { user, logout } = useAuth();
    const { active, step, tourIndex } = useOnboarding();
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const compact = useCompact();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [menu, setMenu] = useState(null);
    const [paletteOpen, setPaletteOpen] = useState(false);
    const menuRef = useRef(null);
    const profileMenuRef = useRef(null);
    const notifyPanelRef = useRef(null);
    const profileButtonRef = useRef(null);
    const notifyButtonRef = useRef(null);
    const menuButtonRef = useRef(null);
    const drawerRef = useRef(null);
    const shortcutLabel = useMemo(() => commandShortcutLabel(), []);
    const tourTarget = active && step === 'tour' ? TOUR_STEPS[tourIndex]?.id : null;
    const showDrawer = tourTarget ? tourTarget !== 'patient-search' : mobileOpen;
    const modalOpen = active && step !== 'tour';
    useEffect(() => {
        if (!menu)
            return;
        function onPointer(event) {
            if (!menuRef.current?.contains(event.target))
                setMenu(null);
        }
        document.addEventListener('mousedown', onPointer);
        return () => document.removeEventListener('mousedown', onPointer);
    }, [menu]);
    useEffect(() => {
        function onKey(event) {
            if (event.key !== 'Escape')
                return;
            if (menu) {
                const which = menu;
                setMenu(null);
                (which === 'profile' ? profileButtonRef : notifyButtonRef).current?.focus();
                return;
            }
            if (mobileOpen && !tourTarget) {
                setMobileOpen(false);
                menuButtonRef.current?.focus();
            }
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [menu, mobileOpen, tourTarget]);
    useEffect(() => {
        const lock = modalOpen || (showDrawer && compact);
        if (!lock)
            return;
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previous;
        };
    }, [modalOpen, showDrawer, compact]);
    useEffect(() => {
        setMenu(null);
        if (!tourTarget)
            setMobileOpen(false);
    }, [pathname, tourTarget]);
    const drawerOpen = Boolean(showDrawer && compact && !tourTarget);
    useFocusTrap(drawerOpen, drawerRef);
    useEffect(() => {
        if (drawerOpen)
            drawerRef.current?.querySelector('button')?.focus();
    }, [drawerOpen]);
    useEffect(() => {
        if (menu === 'notifications')
            notifyPanelRef.current?.focus();
        if (menu === 'profile')
            profileMenuRef.current?.querySelector('[role="menuitem"]')?.focus();
    }, [menu]);
    const setPalette = useCallback((next) => {
        setPaletteOpen(next);
        if (!next)
            return;
        setMenu(null);
        if (!tourTarget)
            setMobileOpen(false);
    }, [tourTarget]);
    function handleLogout() {
        logout();
        navigate('/login');
    }
    return (_jsxs("div", { className: "min-h-screen overflow-x-clip bg-slate-50 text-slate-800", children: [_jsx("a", { href: "#main-content", className: "skip-link", children: "Skip to content" }), showDrawer && (_jsx("button", { type: "button", className: "fixed inset-0 z-40 bg-slate-950/40 lg:hidden", "aria-label": "Close menu", onClick: () => {
                    if (!tourTarget)
                        setMobileOpen(false);
                } })), _jsxs("aside", { ref: drawerRef, id: "main-menu", inert: compact && !showDrawer ? true : undefined, "aria-label": "Main menu", ...(drawerOpen ? { role: 'dialog', 'aria-modal': true } : {}), className: `fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:translate-x-0 ${showDrawer ? 'translate-x-0' : '-translate-x-full'}`, children: [_jsxs("div", { className: "flex h-16 items-center justify-between gap-3 border-b border-slate-200 px-4", children: [_jsxs(Link, { to: "/dashboard", className: "flex min-w-0 items-center gap-3", children: [_jsx(BrandMark, {}), _jsxs("span", { className: "min-w-0", children: [_jsx("span", { className: "block truncate text-sm font-semibold text-slate-900", children: "CliniX Core" }), _jsx("span", { className: "block truncate text-[11px] text-slate-500", children: "Clinical workspace" })] })] }), !tourTarget && (_jsx("button", { type: "button", className: "grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden", "aria-label": "Close menu", onClick: () => setMobileOpen(false), children: _jsx(CloseIcon, { className: "h-5 w-5" }) }))] }), _jsx("nav", { className: "flex-1 space-y-1 overflow-y-auto p-3", "aria-label": "Primary", children: NAV.map((item) => {
                            const activeItem = itemActive(pathname, item.to);
                            const Icon = item.icon;
                            return (_jsxs(Link, { to: item.to, "data-tour": item.tour, "aria-current": activeItem ? 'page' : undefined, onClick: () => {
                                    if (!tourTarget)
                                        setMobileOpen(false);
                                }, className: `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${activeItem
                                    ? 'bg-teal-50 text-teal-900'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`, children: [_jsx(Icon, { className: `h-5 w-5 ${activeItem ? 'text-clinical-teal' : 'text-slate-400 group-hover:text-slate-500'}` }), item.label] }, item.label));
                        }) }), _jsx("div", { className: "border-t border-slate-200 px-4 py-4 text-[11px] leading-relaxed text-slate-600", children: "Clinic day \u00B7 America/Toronto" })] }), _jsxs("div", { className: `flex min-h-screen flex-col lg:pl-72 ${modalOpen ? 'pointer-events-none select-none' : ''}`, "aria-hidden": modalOpen, children: [_jsxs("header", { className: "sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-3 backdrop-blur sm:px-5", children: [_jsxs("div", { className: "flex shrink-0 items-center gap-2 lg:hidden", children: [_jsx("button", { ref: menuButtonRef, type: "button", className: "grid h-10 w-10 place-items-center rounded-xl text-slate-700 hover:bg-slate-100", "aria-label": "Open menu", "aria-expanded": showDrawer, "aria-controls": "main-menu", onClick: () => setMobileOpen(true), children: _jsx(MenuIcon, { className: "h-5 w-5" }) }), _jsx(Link, { to: "/dashboard", className: "hidden text-sm font-semibold text-slate-900 min-[420px]:block", children: "CliniX" })] }), _jsxs("button", { type: "button", "data-tour": "patient-search", "aria-haspopup": "dialog", "aria-expanded": paletteOpen, "aria-keyshortcuts": "Control+K Meta+K Slash", onClick: () => setPalette(true), className: "flex h-10 min-w-0 flex-1 max-w-xl items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 pl-3 pr-2 text-left text-sm text-slate-600 transition hover:border-slate-300 hover:bg-white", children: [_jsx(SearchIcon, { className: "h-4 w-4 shrink-0" }), _jsx("span", { className: "min-w-0 flex-1 truncate", children: "Search patients, MRN, health card, or appointments" }), _jsx("kbd", { className: "hidden shrink-0 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-slate-500 sm:inline", children: shortcutLabel })] }), _jsxs("div", { className: "relative ml-auto flex shrink-0 items-center gap-1 sm:gap-2", ref: menuRef, children: [_jsx("button", { ref: notifyButtonRef, type: "button", className: "relative grid h-10 w-10 place-items-center rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900", "aria-label": "Notifications", "aria-expanded": menu === 'notifications', "aria-controls": "notifications-panel", onClick: () => setMenu((current) => (current === 'notifications' ? null : 'notifications')), children: _jsx(BellIcon, { className: "h-5 w-5" }) }), _jsxs("button", { ref: profileButtonRef, type: "button", className: "flex items-center gap-2 rounded-xl py-1 pl-1 pr-1 hover:bg-slate-100 sm:pr-2", "aria-label": "Account menu", "aria-expanded": menu === 'profile', "aria-haspopup": "menu", "aria-controls": "account-menu", onClick: () => setMenu((current) => (current === 'profile' ? null : 'profile')), children: [_jsx("span", { className: "grid h-9 w-9 place-items-center rounded-full bg-teal-700 text-xs font-semibold text-white", children: initials(user?.displayName ?? '') }), _jsxs("span", { className: "hidden text-left sm:block", children: [_jsx("span", { className: "block max-w-[9rem] truncate text-sm font-medium text-slate-800", children: user?.displayName }), _jsx("span", { className: "block text-[11px] text-slate-500", children: accountRoleLabel(user?.role) })] })] }), menu === 'notifications' && (_jsxs("div", { ref: notifyPanelRef, id: "notifications-panel", role: "dialog", "aria-label": "Notifications", tabIndex: -1, className: "absolute right-0 top-12 w-80 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl outline-none", children: [_jsx("p", { className: "text-sm font-semibold text-slate-900", children: "Notifications" }), _jsx("p", { className: "mt-2 text-sm leading-relaxed text-slate-600", children: "No new notifications. Chart alerts and clinic messages will show up here." })] })), menu === 'profile' && (_jsxs("div", { ref: profileMenuRef, id: "account-menu", role: "menu", "aria-label": "Account", className: "absolute right-0 top-12 w-60 rounded-2xl border border-slate-200 bg-white py-1 shadow-xl", onKeyDown: (event) => {
                                            const items = [...event.currentTarget.querySelectorAll('[role="menuitem"]')];
                                            const index = items.indexOf(document.activeElement);
                                            if (event.key === 'ArrowDown') {
                                                event.preventDefault();
                                                items[(index + 1) % items.length]?.focus();
                                            }
                                            else if (event.key === 'ArrowUp') {
                                                event.preventDefault();
                                                items[(index - 1 + items.length) % items.length]?.focus();
                                            }
                                            else if (event.key === 'Home') {
                                                event.preventDefault();
                                                items[0]?.focus();
                                            }
                                            else if (event.key === 'End') {
                                                event.preventDefault();
                                                items[items.length - 1]?.focus();
                                            }
                                        }, children: [_jsxs("div", { className: "border-b border-slate-100 px-3 py-2.5", children: [_jsx("p", { className: "truncate text-sm font-semibold text-slate-900", children: user?.displayName }), _jsx("p", { className: "truncate text-xs text-slate-500", children: user?.email }), _jsx("p", { className: "mt-1 text-xs text-teal-800", children: accountRoleLabel(user?.role) })] }), _jsx(Link, { to: "/settings", role: "menuitem", className: "block px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50", onClick: () => setMenu(null), children: "Settings" }), _jsx("button", { type: "button", role: "menuitem", className: "block w-full px-3 py-2.5 text-left text-sm text-rose-700 hover:bg-rose-50", onClick: handleLogout, children: "Sign out" })] }))] })] }), _jsx("main", { id: "main-content", tabIndex: -1, className: "min-w-0 max-w-full flex-1 p-4 outline-none sm:p-6 lg:p-8", children: _jsx(Outlet, {}) })] }), _jsx(CommandPalette, { open: paletteOpen, suspended: modalOpen, onOpenChange: setPalette }), active && _jsx(OnboardingOverlay, {})] }));
}
export default function AppLayout() {
    const { user } = useAuth();
    if (!user)
        return null;
    return (_jsx(OnboardingProvider, { user: user, children: _jsx(Shell, {}) }, user.id));
}
