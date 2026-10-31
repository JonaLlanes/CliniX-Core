import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { OnboardingProvider, useOnboarding } from '../context/OnboardingContext';
import CommandPalette from './command/CommandPalette';
import { commandShortcutLabel } from './command/commands';
import OnboardingOverlay from './onboarding/OnboardingOverlay';
import {
  BellIcon,
  BrandMark,
  CalendarIcon,
  CheckInIcon,
  CloseIcon,
  DashboardIcon,
  MenuIcon,
  ReportsIcon,
  SearchIcon,
  SettingsIcon,
  UsersIcon,
} from './icons';
import { TOUR_STEPS, accountRoleLabel } from '../onboarding/content';
import { useFocusTrap } from './a11y';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: DashboardIcon, tour: 'dashboard' },
  { to: '/', label: 'Patients', icon: UsersIcon, tour: undefined },
  { to: '/schedule', label: 'Schedule', icon: CalendarIcon, tour: 'schedule' },
  { to: '/check-in', label: 'Check-In', icon: CheckInIcon, tour: 'check-in' },
  { to: '/reports', label: 'Reports', icon: ReportsIcon, tour: 'reports' },
  { to: '/settings', label: 'Settings', icon: SettingsIcon, tour: undefined },
] as const;

function itemActive(pathname: string, to: string) {
  if (to === '/') return pathname === '/' || pathname.startsWith('/patients');
  return pathname === to || pathname.startsWith(`${to}/`);
}

function initials(name: string) {
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
  const [menu, setMenu] = useState<'notifications' | 'profile' | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const notifyPanelRef = useRef<HTMLDivElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const notifyButtonRef = useRef<HTMLButtonElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const shortcutLabel = useMemo(() => commandShortcutLabel(), []);

  const tourTarget = active && step === 'tour' ? TOUR_STEPS[tourIndex]?.id : null;
  const showDrawer = tourTarget ? tourTarget !== 'patient-search' : mobileOpen;
  const modalOpen = active && step !== 'tour';

  useEffect(() => {
    if (!menu) return;
    function onPointer(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenu(null);
    }
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [menu]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
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
    if (!lock) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [modalOpen, showDrawer, compact]);

  useEffect(() => {
    setMenu(null);
    if (!tourTarget) setMobileOpen(false);
  }, [pathname, tourTarget]);

  const drawerOpen = Boolean(showDrawer && compact && !tourTarget);
  useFocusTrap(drawerOpen, drawerRef);

  useEffect(() => {
    if (drawerOpen) drawerRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }, [drawerOpen]);

  useEffect(() => {
    if (menu === 'notifications') notifyPanelRef.current?.focus();
    if (menu === 'profile') profileMenuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [menu]);

  const setPalette = useCallback((next: boolean) => {
    setPaletteOpen(next);
    if (!next) return;
    setMenu(null);
    if (!tourTarget) setMobileOpen(false);
  }, [tourTarget]);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen overflow-x-clip bg-slate-50 text-slate-800">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      {showDrawer && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
          aria-label="Close menu"
          onClick={() => {
            if (!tourTarget) setMobileOpen(false);
          }}
        />
      )}

      <aside
        ref={drawerRef}
        id="main-menu"
        inert={compact && !showDrawer ? true : undefined}
        aria-label="Main menu"
        {...(drawerOpen ? { role: 'dialog' as const, 'aria-modal': true as const } : {})}
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:translate-x-0 ${
          showDrawer ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between gap-3 border-b border-slate-200 px-4">
          <Link to="/dashboard" className="flex min-w-0 items-center gap-3">
            <BrandMark />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-slate-900">CliniX Core</span>
              <span className="block truncate text-[11px] text-slate-500">Clinical workspace</span>
            </span>
          </Link>
          {!tourTarget && (
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          )}
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Primary">
          {NAV.map((item) => {
            const activeItem = itemActive(pathname, item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                to={item.to}
                data-tour={item.tour}
                aria-current={activeItem ? 'page' : undefined}
                onClick={() => {
                  if (!tourTarget) setMobileOpen(false);
                }}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  activeItem
                    ? 'bg-teal-50 text-teal-900'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className={`h-5 w-5 ${activeItem ? 'text-clinical-teal' : 'text-slate-400 group-hover:text-slate-500'}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 px-4 py-4 text-[11px] leading-relaxed text-slate-600">
          Clinic day · America/Toronto
        </div>
      </aside>

      <div className={`flex min-h-screen flex-col lg:pl-72 ${modalOpen ? 'pointer-events-none select-none' : ''}`} aria-hidden={modalOpen}>
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-3 backdrop-blur sm:px-5">
          <div className="flex shrink-0 items-center gap-2 lg:hidden">
            <button
              ref={menuButtonRef}
              type="button"
              className="grid h-10 w-10 place-items-center rounded-xl text-slate-700 hover:bg-slate-100"
              aria-label="Open menu"
              aria-expanded={showDrawer}
              aria-controls="main-menu"
              onClick={() => setMobileOpen(true)}
            >
              <MenuIcon className="h-5 w-5" />
            </button>
            <Link to="/dashboard" className="hidden text-sm font-semibold text-slate-900 min-[420px]:block">
              CliniX
            </Link>
          </div>

          <button
            type="button"
            data-tour="patient-search"
            aria-haspopup="dialog"
            aria-expanded={paletteOpen}
            aria-keyshortcuts="Control+K Meta+K Slash"
            onClick={() => setPalette(true)}
            className="flex h-10 min-w-0 flex-1 max-w-xl items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 pl-3 pr-2 text-left text-sm text-slate-600 transition hover:border-slate-300 hover:bg-white"
          >
            <SearchIcon className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">Search patients, MRN, health card, or appointments</span>
            <kbd className="hidden shrink-0 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-slate-500 sm:inline">
              {shortcutLabel}
            </kbd>
          </button>

          <div className="relative ml-auto flex shrink-0 items-center gap-1 sm:gap-2" ref={menuRef}>
            <button
              ref={notifyButtonRef}
              type="button"
              className="relative grid h-10 w-10 place-items-center rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              aria-label="Notifications"
              aria-expanded={menu === 'notifications'}
              aria-controls="notifications-panel"
              onClick={() => setMenu((current) => (current === 'notifications' ? null : 'notifications'))}
            >
              <BellIcon className="h-5 w-5" />
            </button>

            <button
              ref={profileButtonRef}
              type="button"
              className="flex items-center gap-2 rounded-xl py-1 pl-1 pr-1 hover:bg-slate-100 sm:pr-2"
              aria-label="Account menu"
              aria-expanded={menu === 'profile'}
              aria-haspopup="menu"
              aria-controls="account-menu"
              onClick={() => setMenu((current) => (current === 'profile' ? null : 'profile'))}
            >
              <span className="grid h-9 w-9 place-items-center rounded-full bg-teal-700 text-xs font-semibold text-white">
                {initials(user?.displayName ?? '')}
              </span>
              <span className="hidden text-left sm:block">
                <span className="block max-w-[9rem] truncate text-sm font-medium text-slate-800">{user?.displayName}</span>
                <span className="block text-[11px] text-slate-500">{accountRoleLabel(user?.role)}</span>
              </span>
            </button>

            {menu === 'notifications' && (
              <div
                ref={notifyPanelRef}
                id="notifications-panel"
                role="dialog"
                aria-label="Notifications"
                tabIndex={-1}
                className="absolute right-0 top-12 w-80 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl outline-none"
              >
                <p className="text-sm font-semibold text-slate-900">Notifications</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  No new notifications. Chart alerts and clinic messages will show up here.
                </p>
              </div>
            )}

            {menu === 'profile' && (
              <div
                ref={profileMenuRef}
                id="account-menu"
                role="menu"
                aria-label="Account"
                className="absolute right-0 top-12 w-60 rounded-2xl border border-slate-200 bg-white py-1 shadow-xl"
                onKeyDown={(event) => {
                  const items = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]')];
                  const index = items.indexOf(document.activeElement as HTMLElement);
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    items[(index + 1) % items.length]?.focus();
                  } else if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    items[(index - 1 + items.length) % items.length]?.focus();
                  } else if (event.key === 'Home') {
                    event.preventDefault();
                    items[0]?.focus();
                  } else if (event.key === 'End') {
                    event.preventDefault();
                    items[items.length - 1]?.focus();
                  }
                }}
              >
                <div className="border-b border-slate-100 px-3 py-2.5">
                  <p className="truncate text-sm font-semibold text-slate-900">{user?.displayName}</p>
                  <p className="truncate text-xs text-slate-500">{user?.email}</p>
                  <p className="mt-1 text-xs text-teal-800">{accountRoleLabel(user?.role)}</p>
                </div>
                <Link
                  to="/settings"
                  role="menuitem"
                  className="block px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => setMenu(null)}
                >
                  Settings
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  className="block w-full px-3 py-2.5 text-left text-sm text-rose-700 hover:bg-rose-50"
                  onClick={handleLogout}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="min-w-0 max-w-full flex-1 p-4 outline-none sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      <CommandPalette open={paletteOpen} suspended={modalOpen} onOpenChange={setPalette} />
      {active && <OnboardingOverlay />}
    </div>
  );
}

export default function AppLayout() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <OnboardingProvider key={user.id} user={user}>
      <Shell />
    </OnboardingProvider>
  );
}
