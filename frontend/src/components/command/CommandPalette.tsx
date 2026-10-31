import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  appointmentsApi,
  patientsApi,
  type Appointment,
  type Patient,
} from '../../api/client';
import {
  formatAppointmentWhen,
  isPerson,
  patientLabel,
  providerLabel,
  refId,
  typeLabel,
} from '../appointmentDisplay';
import { ageLabel, type ChartTab } from '../chart/chartDisplay';
import { chartLink } from '../dashboard/chartLink';
import { useFocusTrap } from '../a11y';
import { formatLastOpened, readRecentCharts, rememberChart, type RecentChart } from '../dashboard/recentCharts';
import {
  CalendarIcon,
  CheckInIcon,
  CloseIcon,
  DashboardIcon,
  ReportsIcon,
  SearchIcon,
  UsersIcon,
} from '../icons';
import { PALETTE_COMMANDS, commandById, type PaletteCommand } from './commands';
import { readRecentCommands, rememberCommand, type RecentCommand } from './recentCommands';

const PATIENT_LIMIT = 8;
const APPOINTMENT_LIMIT = 6;
const SEARCH_DEBOUNCE_MS = 140;
const APPOINTMENT_PAST_MS = 14 * 24 * 60 * 60 * 1000;
const APPOINTMENT_FUTURE_MS = 45 * 24 * 60 * 60 * 1000;

const STATUS_LABEL: Record<string, string> = {
  booked: 'Booked',
  confirmed: 'Confirmed',
  arrived: 'Arrived',
  no_show: 'No-show',
  cancelled: 'Cancelled',
  completed: 'Completed',
};

const PICK_COPY: Partial<Record<ChartTab, { title: string; placeholder: string }>> = {
  encounters: { title: 'New encounter', placeholder: 'Find a patient for a new encounter' },
  orders: { title: 'New order', placeholder: 'Find a patient for a new order' },
  referrals: { title: 'New referral', placeholder: 'Find a patient for a new referral' },
};

type PaletteItem = {
  id: string;
  group: string;
  section: 'entity' | 'command';
  title: string;
  subtitle: string;
  kind: 'patient' | 'appointment' | 'command' | 'recent';
  run: () => void;
};

type Props = {
  open: boolean;
  suspended?: boolean;
  onOpenChange: (open: boolean) => void;
};

function isPaletteShortcut(event: KeyboardEvent) {
  if (event.repeat || event.altKey || event.shiftKey) return false;
  if (event.key.toLowerCase() !== 'k') return false;
  return event.metaKey || event.ctrlKey;
}

function tokensOf(query: string) {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

function compact(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function matchesTokens(haystack: string, query: string) {
  const tokens = tokensOf(query);
  if (!tokens.length) return true;
  const hay = haystack.toLowerCase();
  const digits = compact(hay);
  return tokens.every((token) => hay.includes(token) || digits.includes(compact(token)));
}

function patientTitle(patient: Patient) {
  const preferred =
    patient.preferredName && patient.preferredName !== patient.givenName
      ? ` (${patient.preferredName})`
      : '';
  return `${patient.familyName}, ${patient.givenName}${preferred}`;
}

function formatMrn(mrn: string) {
  const value = mrn.trim();
  if (/^mrn([\s-]|$)/i.test(value)) return value;
  return `MRN ${value}`;
}

function patientSubtitle(patient: Patient) {
  const parts = [formatMrn(patient.mrn)];
  const age = ageLabel(patient.birthDate);
  if (age !== '—') parts.push(age);
  const health = patient.provincialHealth;
  if (health?.healthCardNumber) {
    const version = health.versionCode ? ` ${health.versionCode}` : '';
    parts.push(`${health.province} ${health.healthCardNumber}${version}`);
  }
  return parts.join(' · ');
}

function patientHaystack(patient: Patient) {
  const health = patient.provincialHealth;
  return [
    patient.givenName,
    patient.familyName,
    patient.preferredName,
    patient.mrn,
    health?.province,
    health?.healthCardNumber,
    health?.versionCode,
  ]
    .filter(Boolean)
    .join(' ');
}

function statusLabel(status: string) {
  return STATUS_LABEL[status] ?? status;
}

function appointmentHaystack(appointment: Appointment) {
  const person = isPerson(appointment.patientId) ? appointment.patientId : null;
  return [
    person?.givenName,
    person?.familyName,
    person?.preferredName,
    person?.mrn,
    typeLabel(appointment.appointmentType),
    appointment.appointmentType,
    appointment.clinicLocation,
    appointment.status,
    statusLabel(appointment.status),
    providerLabel(appointment.providerId),
  ]
    .filter(Boolean)
    .join(' ');
}

function appointmentRank(start: string) {
  const delta = new Date(start).getTime() - Date.now();
  if (Number.isNaN(delta)) return Number.MAX_SAFE_INTEGER;
  return delta >= 0 ? delta : Math.abs(delta) + 1e15;
}

function searchToken(query: string) {
  const tokens = tokensOf(query);
  if (tokens.length <= 1) return query.trim();
  return [...tokens].sort((left, right) => right.length - left.length)[0];
}

function optionDomId(id: string) {
  return `palette-option-${id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

function groupItems(items: PaletteItem[]) {
  const groups: { label: string; items: PaletteItem[] }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (!last || last.label !== item.group) groups.push({ label: item.group, items: [item] });
    else last.items.push(item);
  }
  return groups;
}

function useDebounced(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(handle);
  }, [value, delay]);
  return debounced;
}

function RowGlyph({ kind }: { kind: PaletteItem['kind'] }) {
  const className = 'h-4 w-4';
  if (kind === 'appointment') return <CalendarIcon className={className} />;
  return <UsersIcon className={className} />;
}

function CommandGlyph({ id }: { id: string }) {
  const className = 'h-4 w-4';
  if (id === 'find-patient') return <SearchIcon className={className} />;
  if (id === 'book-appointment') return <CalendarIcon className={className} />;
  if (id === 'open-check-in') return <CheckInIcon className={className} />;
  if (id === 'dashboard') return <DashboardIcon className={className} />;
  if (id === 'reports') return <ReportsIcon className={className} />;
  if (id === 'new-encounter') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
        <path d="M8 4.5h8M9 4.5V7h6V4.5" />
        <rect x="6" y="7" width="12" height="13" rx="2" />
        <path d="M9 12h6M9 15.5h4" />
      </svg>
    );
  }
  if (id === 'new-order') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
        <path d="M8 4.5h5.5L18 9v10.5a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 7 19.5v-13A1.5 1.5 0 0 1 8.5 5Z" />
        <path d="M13 4.8V9h4.2M9.5 13h5M9.5 16.5h3.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d="M4.5 8.5 12 4.5l7.5 4v7L12 19.5l-7.5-4v-7Z" />
      <path d="M12 12.2V19M4.8 8.7 12 12.2l7.2-3.5" />
    </svg>
  );
}

export default function CommandPalette({ open, suspended = false, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useFocusTrap(open, dialogRef);
  const listRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  const moved = useRef(false);
  const patientReq = useRef(0);
  const pathRef = useRef(`${pathname}${search}`);

  const [query, setQuery] = useState('');
  const [pickTab, setPickTab] = useState<ChartTab | null>(null);
  const [cursor, setCursor] = useState(0);
  const [recents, setRecents] = useState<RecentChart[]>([]);
  const [recentCmds, setRecentCmds] = useState<RecentCommand[]>([]);
  const [remotePatients, setRemotePatients] = useState<Patient[]>([]);
  const [patientPhase, setPatientPhase] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [patientError, setPatientError] = useState('');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [appointmentPhase, setAppointmentPhase] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  const debounced = useDebounced(query, SEARCH_DEBOUNCE_MS);
  const pick = pickTab ? PICK_COPY[pickTab] : undefined;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (isPaletteShortcut(event)) {
        event.preventDefault();
        event.stopPropagation();
        if (!suspended) onOpenChange(!open);
        return;
      }
      if (
        !open &&
        !suspended &&
        event.key === '/' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey
      ) {
        const target = event.target;
        if (target instanceof HTMLElement) {
          const tag = target.tagName;
          if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return;
        }
        event.preventDefault();
        onOpenChange(true);
        return;
      }
      if (open && event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onOpenChange(false);
      }
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, suspended, onOpenChange]);

  useEffect(() => {
    if (suspended && open) onOpenChange(false);
  }, [suspended, open, onOpenChange]);

  useEffect(() => {
    const next = `${pathname}${search}`;
    if (pathRef.current !== next) {
      pathRef.current = next;
      onOpenChange(false);
    }
  }, [pathname, search, onOpenChange]);

  useEffect(() => {
    if (!open) {
      if (wasOpen.current) returnFocus.current?.focus?.();
      wasOpen.current = false;
      setQuery('');
      setPickTab(null);
      setCursor(0);
      setPatientError('');
      moved.current = false;
      return;
    }
    wasOpen.current = true;
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setRecents(readRecentCharts());
    setRecentCmds(readRecentCommands());
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setAppointmentPhase('loading');
    appointmentsApi
      .list({
        from: new Date(Date.now() - APPOINTMENT_PAST_MS).toISOString(),
        to: new Date(Date.now() + APPOINTMENT_FUTURE_MS).toISOString(),
        limit: 100,
      })
      .then((page) => {
        if (cancelled) return;
        setAppointments(page.data);
        setAppointmentPhase('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setAppointments([]);
        setAppointmentPhase('error');
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const q = debounced.trim();
    if (!q) {
      patientReq.current += 1;
      setRemotePatients([]);
      setPatientPhase('idle');
      setPatientError('');
      return;
    }
    const request = ++patientReq.current;
    setPatientPhase('loading');
    patientsApi
      .list({ q: searchToken(q), limit: 20 })
      .then((page) => {
        if (request !== patientReq.current) return;
        setRemotePatients(page.data.filter((patient) => matchesTokens(patientHaystack(patient), q)));
        setPatientPhase('ready');
        setPatientError('');
      })
      .catch((err: unknown) => {
        if (request !== patientReq.current) return;
        setRemotePatients([]);
        setPatientPhase('error');
        setPatientError(err instanceof Error ? err.message : 'Search failed');
      });
  }, [open, debounced]);

  function close() {
    onOpenChange(false);
  }

  function openChart(entry: { id: string; name: string; mrn: string }, tab?: ChartTab) {
    rememberChart(entry);
    navigate(chartLink(entry.id, tab));
    close();
  }

  function openPatient(patient: Patient, tab?: ChartTab) {
    openChart(
      {
        id: patient._id,
        name: `${patient.familyName}, ${patient.givenName}`,
        mrn: patient.mrn,
      },
      tab
    );
  }

  function openAppointment(appointment: Appointment) {
    const person = isPerson(appointment.patientId) ? appointment.patientId : null;
    const id = refId(appointment.patientId);
    if (person) {
      rememberChart({
        id,
        name: `${person.familyName}, ${person.givenName}`,
        mrn: person.mrn,
      });
    }
    navigate(chartLink(id, 'appointments'));
    close();
  }

  function runCommand(command: PaletteCommand, registryQuery = '') {
    rememberCommand({ id: command.id, label: command.label });
    if (command.kind === 'pick' && command.tab) {
      setPickTab(command.tab);
      setQuery('');
      moved.current = false;
      setCursor(0);
      inputRef.current?.focus();
      return;
    }
    const destination =
      command.id === 'find-patient'
        ? registryQuery.trim()
          ? `/?q=${encodeURIComponent(registryQuery.trim())}`
          : '/'
        : command.to || '/';
    navigate(destination);
    close();
  }

  const trimmed = query.trim();
  const patientPending = Boolean(trimmed) && (trimmed !== debounced.trim() || patientPhase === 'loading');

  const patientHits = useMemo(() => {
    if (!trimmed) return [];
    return remotePatients.filter((patient) => matchesTokens(patientHaystack(patient), trimmed)).slice(0, PATIENT_LIMIT);
  }, [remotePatients, trimmed]);

  const recentPatientHits = useMemo(() => {
    if (!trimmed || patientHits.length > 0) return [];
    return recents
      .filter((chart) => matchesTokens(`${chart.name} ${chart.mrn}`, trimmed))
      .slice(0, PATIENT_LIMIT);
  }, [recents, trimmed, patientHits.length]);

  const appointmentHits = useMemo(() => {
    if (!trimmed || pickTab) return [];
    return appointments
      .filter((appointment) => matchesTokens(appointmentHaystack(appointment), trimmed))
      .sort((left, right) => appointmentRank(left.startTime) - appointmentRank(right.startTime))
      .slice(0, APPOINTMENT_LIMIT);
  }, [appointments, trimmed, pickTab]);

  const items = useMemo(() => {
    const next: PaletteItem[] = [];
    const chartTab = pickTab ?? undefined;

    if (!trimmed && recents.length > 0) {
      recents.slice(0, 5).forEach((chart) => {
        next.push({
          id: `recent-patient:${chart.id}`,
          group: 'Recent patients',
          section: 'entity',
          title: chart.name,
          subtitle: `${formatMrn(chart.mrn)} · ${formatLastOpened(chart.openedAt)}`,
          kind: 'recent',
          run: () => openChart(chart, chartTab),
        });
      });
    }

    if (!trimmed && !pickTab) {
      recentCmds.forEach((recent) => {
        const command = commandById(recent.id);
        if (!command) return;
        next.push({
          id: `recent-command:${command.id}`,
          group: 'Recent commands',
          section: 'command',
          title: command.label,
          subtitle: command.detail,
          kind: 'command',
          run: () => runCommand(command),
        });
      });
    }

    if (trimmed) {
      patientHits.forEach((patient) => {
        next.push({
          id: `patient:${patient._id}`,
          group: 'Patients',
          section: 'entity',
          title: patientTitle(patient),
          subtitle: patientSubtitle(patient),
          kind: 'patient',
          run: () => openPatient(patient, chartTab),
        });
      });
      if (patientHits.length === 0 && patientPending) {
        recentPatientHits.forEach((chart) => {
          next.push({
            id: `preview:${chart.id}`,
            group: 'Patients',
            section: 'entity',
            title: chart.name,
            subtitle: `${formatMrn(chart.mrn)} · Recent`,
            kind: 'recent',
            run: () => openChart(chart, chartTab),
          });
        });
      }
      appointmentHits.forEach((appointment) => {
        next.push({
          id: `appointment:${appointment._id}`,
          group: 'Appointments',
          section: 'entity',
          title: patientLabel(appointment.patientId),
          subtitle: [
            typeLabel(appointment.appointmentType),
            formatAppointmentWhen(appointment.startTime, appointment.endTime),
            appointment.clinicLocation,
            providerLabel(appointment.providerId),
            statusLabel(appointment.status),
          ].join(' · '),
          kind: 'appointment',
          run: () => openAppointment(appointment),
        });
      });
    }

    if (!pickTab) {
      const commands = trimmed
        ? PALETTE_COMMANDS.filter((command) =>
            matchesTokens(`${command.label} ${command.detail} ${command.keywords}`, trimmed)
          )
        : PALETTE_COMMANDS;
      const withRegistry =
        trimmed && !commands.some((command) => command.id === 'find-patient')
          ? [...commands, PALETTE_COMMANDS[0]]
          : commands;
      withRegistry.forEach((command) => {
        const searchingRegistry = Boolean(trimmed) && command.id === 'find-patient';
        next.push({
          id: `command:${command.id}`,
          group: trimmed ? 'Commands' : 'Quick actions',
          section: 'command',
          title: command.label,
          subtitle: searchingRegistry ? `Open the registry for “${trimmed}”` : command.detail,
          kind: 'command',
          run: () => runCommand(command, trimmed),
        });
      });
    }

    return next;
    // Navigation helpers close over the latest chart opener. They are recreated each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    trimmed,
    pickTab,
    recents,
    recentCmds,
    patientHits,
    recentPatientHits,
    patientPending,
    appointmentHits,
  ]);

  const itemKey = items.map((item) => item.id).join('|');

  useEffect(() => {
    moved.current = false;
    setCursor(0);
  }, [trimmed, pickTab]);

  useEffect(() => {
    if (!moved.current) {
      setCursor(0);
      return;
    }
    setCursor((current) => (items.length === 0 ? 0 : Math.min(current, items.length - 1)));
  }, [itemKey, items.length]);

  useEffect(() => {
    const node = listRef.current?.querySelector('[data-active="true"]');
    node?.scrollIntoView({ block: 'nearest' });
  }, [cursor, itemKey]);

  function moveCursor(next: number) {
    if (!items.length) return;
    moved.current = true;
    const last = items.length - 1;
    setCursor(Math.max(0, Math.min(last, next)));
  }

  function onInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveCursor(cursor + 1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveCursor(cursor - 1);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      moveCursor(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      moveCursor(items.length - 1);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      items[cursor]?.run();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key === 'Backspace' && !query && pickTab) {
      event.preventDefault();
      setPickTab(null);
    }
  }

  const active = items[cursor];
  const entityGroups = groupItems(items.filter((item) => item.section === 'entity'));
  const commandGroups = groupItems(items.filter((item) => item.section === 'command'));
  const showSkeletons = Boolean(trimmed) && patientPending && patientHits.length === 0 && recentPatientHits.length === 0;
  const meaningfulCommands = items.filter(
    (item) => item.section === 'command' && item.id !== 'command:find-patient'
  ).length;
  const showEmptyEntities =
    Boolean(trimmed) &&
    !patientPending &&
    patientHits.length === 0 &&
    appointmentHits.length === 0 &&
    patientPhase !== 'error' &&
    (Boolean(pickTab) || meaningfulCommands === 0);
  const showPickEmpty = Boolean(pickTab) && !trimmed && recents.length === 0;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center px-3 pt-[10vh] sm:px-4 sm:pt-[14vh]">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]"
        aria-label="Close command menu"
        onClick={close}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command menu"
        className="command-panel relative flex max-h-[min(40rem,80vh)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        {pick && (
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5">
            <span className="rounded-md bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-900">{pick.title}</span>
            <span className="text-xs text-slate-500">Select a patient to open the chart</span>
            <button
              type="button"
              className="ml-auto rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              onClick={() => {
                setPickTab(null);
                inputRef.current?.focus();
              }}
            >
              Back
            </button>
          </div>
        )}

        <div className="relative border-b border-slate-100">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded="true"
            aria-controls="command-list"
            aria-activedescendant={active ? optionDomId(active.id) : undefined}
            aria-autocomplete="list"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={query}
            placeholder={pick?.placeholder ?? 'Search patients, MRN, health card, or appointments'}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onInputKeyDown}
            className="h-14 w-full bg-transparent pl-11 pr-12 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Clear search"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          )}
          {patientPending && trimmed && (
            <span className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-teal-100">
              <span className="block h-full w-1/3 animate-pulse bg-clinical-teal" />
            </span>
          )}
        </div>

        <div
          ref={listRef}
          id="command-list"
          role="listbox"
          aria-label="Command results"
          className="max-h-[min(28rem,52vh)] min-h-[12rem] overflow-y-auto px-2 pb-2"
        >
          <p className="sr-only" aria-live="polite">
            {items.length === 0 ? 'No results' : `${items.length} results`}
          </p>

          {entityGroups.map((group) => (
            <section key={group.label} role="group" aria-label={group.label} className="pt-2">
              <h2 className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                {group.label}
              </h2>
              {group.items.map((item) => (
                <PaletteRow
                  key={item.id}
                  item={item}
                  active={item.id === active?.id}
                  onSelect={() => {
                    moved.current = true;
                    setCursor(items.findIndex((entry) => entry.id === item.id));
                  }}
                  onRun={item.run}
                />
              ))}
            </section>
          ))}

          {showSkeletons && (
            <section className="px-2 pt-3" aria-hidden>
              <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">Patients</p>
              {[0, 1, 2].map((row) => (
                <div key={row} className="mb-1 flex items-center gap-3 rounded-xl px-2 py-2">
                  <span className="h-8 w-8 animate-pulse rounded-lg bg-slate-100" />
                  <span className="min-w-0 flex-1">
                    <span className="block h-3.5 w-40 animate-pulse rounded bg-slate-200" />
                    <span className="mt-1.5 block h-3 w-56 animate-pulse rounded bg-slate-100" />
                  </span>
                </div>
              ))}
            </section>
          )}

          {patientError && trimmed && (
            <p className="mx-2 mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {patientError}
            </p>
          )}

          {showEmptyEntities && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm font-semibold text-slate-900">No matches for “{trimmed}”</p>
              <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-slate-500">
                {pickTab
                  ? 'Try a legal name, preferred name, MRN, or health card number.'
                  : 'Try a patient name, MRN, health card, or an appointment in the next few weeks.'}
              </p>
            </div>
          )}

          {showPickEmpty && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm font-semibold text-slate-900">No recent patients</p>
              <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-slate-500">
                Search by name, MRN, or health card. The chart opens on {pick?.title.toLowerCase()}.
              </p>
            </div>
          )}

          {appointmentPhase === 'error' && trimmed && !pickTab && (
            <p className="px-4 pt-2 text-xs text-slate-600">Appointments could not be searched. Patient search is still available.</p>
          )}

          {commandGroups.map((group) => (
            <section key={group.label} role="group" aria-label={group.label} className="pt-2">
              <h2 className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                {group.label}
              </h2>
              {group.items.map((item) => (
                <PaletteRow
                  key={item.id}
                  item={item}
                  active={item.id === active?.id}
                  onSelect={() => {
                    moved.current = true;
                    setCursor(items.findIndex((entry) => entry.id === item.id));
                  }}
                  onRun={item.run}
                />
              ))}
            </section>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-2 text-[11px] text-slate-600">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span><Kbd>/</Kbd> or <Kbd>Ctrl</Kbd><Kbd>K</Kbd> open</span>
            <span><Kbd>Up</Kbd><Kbd>Down</Kbd> move</span>
            <span><Kbd>Enter</Kbd> open</span>
            <span><Kbd>Esc</Kbd> close</span>
          </p>
          {appointmentPhase === 'loading' && !trimmed && <span>Loading appointments…</span>}
        </div>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="mx-0.5 inline-flex min-w-[1.1rem] items-center justify-center rounded border border-slate-200 bg-slate-50 px-1 py-0.5 font-sans text-[10px] font-semibold text-slate-500">
      {children}
    </kbd>
  );
}

function PaletteRow({
  item,
  active,
  onSelect,
  onRun,
}: {
  item: PaletteItem;
  active: boolean;
  onSelect: () => void;
  onRun: () => void;
}) {
  const commandId = item.id.startsWith('command:')
    ? item.id.slice('command:'.length)
    : item.id.startsWith('recent-command:')
      ? item.id.slice('recent-command:'.length)
      : '';
  return (
    <div
      id={optionDomId(item.id)}
      role="option"
      aria-selected={active}
      data-active={active ? 'true' : 'false'}
      onMouseEnter={onSelect}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onRun}
      className={`flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 ${
        active ? 'bg-teal-700 text-white' : 'text-slate-900'
      }`}
    >
      <span
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
          active ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'
        }`}
      >
        {commandId ? <CommandGlyph id={commandId} /> : <RowGlyph kind={item.kind} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{item.title}</span>
        <span className={`block truncate text-xs ${active ? 'text-teal-50' : 'text-slate-500'}`}>{item.subtitle}</span>
      </span>
      {active && <span className="shrink-0 pr-1 text-xs font-semibold text-teal-50">Open</span>}
    </div>
  );
}
