import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { patientsApi, type Patient } from '../../api/client';
import { CalendarIcon, CheckInIcon, ReportsIcon, SearchIcon, UsersIcon } from '../icons';
import { chartLink } from './chartLink';
import { QuickActionCard } from './ui';

function EncounterIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d="M8 4.5h8M9 4.5V7h6V4.5" />
      <rect x="6" y="7" width="12" height="13" rx="2" />
      <path d="M9 12h6M9 15.5h4" />
    </svg>
  );
}

export default function QuickActions() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Patient[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setSearching(true);
    const handle = window.setTimeout(() => {
      patientsApi
        .list({ q: query.trim() || undefined, limit: 8 })
        .then((page) => {
          setHits(page.data);
          setError('');
        })
        .catch((err: unknown) => {
          setHits([]);
          setError(err instanceof Error ? err.message : 'Search failed');
        })
        .finally(() => setSearching(false));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [open, query]);

  function close() {
    setOpen(false);
    setQuery('');
    setHits([]);
    setError('');
  }

  function choose(patient: Patient) {
    close();
    navigate(chartLink(patient._id, 'encounters'));
  }

  return (
    <section aria-label="Quick actions">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <QuickActionCard to="/" title="Find Patient" body="Search the registry and open a chart." icon={<SearchIcon className="h-6 w-6" />} />
        <QuickActionCard
          title="New Encounter"
          body="Pick a patient and open the encounter."
          icon={<EncounterIcon />}
          onClick={() => setOpen(true)}
        />
        <QuickActionCard to="/schedule" title="Book Appointment" body="Open a provider day and reserve a slot." icon={<CalendarIcon className="h-6 w-6" />} />
        <QuickActionCard to="/check-in" title="Open Check-In Board" body="Arrivals, the waiting room, and rooming." icon={<CheckInIcon className="h-6 w-6" />} />
        <QuickActionCard to="/reports" title="Reports" body="Operations, workload, and cohorts." icon={<ReportsIcon className="h-6 w-6" />} />
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/40 p-4 sm:pt-24" role="presentation" onClick={close}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="encounter-search-title"
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="encounter-search-title" className="text-base font-semibold text-slate-950">
                  New encounter
                </h2>
                <p className="mt-1 text-sm text-slate-500">Search by name or MRN. The chart opens on Encounters.</p>
              </div>
              <button type="button" className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100" onClick={close}>
                Close
              </button>
            </div>
            <label className="mt-4 block">
              <span className="sr-only">Patient search</span>
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name or MRN"
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm focus:border-clinical-teal focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
            </label>
            <div className="mt-3 max-h-72 overflow-auto">
              {searching && <p className="px-1 py-3 text-sm text-slate-500">Searching charts…</p>}
              {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
              {!searching && !error && query.trim() && hits.length === 0 && (
                <p className="flex items-center gap-2 px-1 py-3 text-sm text-slate-500">
                  <UsersIcon className="h-4 w-4" />
                  No matching charts.
                </p>
              )}
              <ul className="space-y-1">
                {hits.map((patient) => (
                  <li key={patient._id}>
                    <button
                      type="button"
                      onClick={() => choose(patient)}
                      className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-teal-50"
                    >
                      <span>
                        <span className="block text-sm font-semibold text-slate-950">
                          {patient.familyName}, {patient.givenName}
                        </span>
                        <span className="block text-xs text-slate-500">MRN {patient.mrn}</span>
                      </span>
                      <span className="text-xs font-semibold text-teal-800">Open</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
