import { FormEvent, useEffect, useState } from 'react';
import { NavLink, Outlet, useSearchParams } from 'react-router-dom';
import { downloadReport } from '../../api/reports';
import { ErrorNotice, CardSkeleton } from '../../components/feedback';
import { REPORT_PRESETS } from './reportDisplay';

const tabs = [
  { to: '/reports', label: 'Operations', end: true },
  { to: '/reports/clinical', label: 'Clinical', end: false },
  { to: '/reports/cohorts', label: 'Cohorts', end: false },
];

export function useReportQuery() {
  const [params] = useSearchParams();
  const preset = params.get('preset') || 'today';
  const from = params.get('from') || '';
  const to = params.get('to') || '';
  const query = new URLSearchParams();
  query.set('preset', preset);
  if (preset === 'custom') {
    if (from) query.set('from', from);
    if (to) query.set('to', to);
  }
  return {
    preset,
    from,
    to,
    qs: query.toString(),
    ready: preset !== 'custom' || Boolean(from && to && from <= to),
  };
}

export function useReportLoad<T>(load: (qs: string) => Promise<T>) {
  const { qs, ready } = useReportQuery();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(ready);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!ready) {
      setData(null);
      setError('');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    load(qs)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setData(null);
          setError(err instanceof Error ? err.message : 'Unable to load report');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [qs, ready, load, attempt]);

  return { data, error, loading, ready, retry: () => setAttempt((value) => value + 1) };
}

export function ReportMessage({
  loading,
  error,
  ready,
  onRetry,
}: {
  loading: boolean;
  error: string;
  ready: boolean;
  onRetry?: () => void;
}) {
  if (!ready) {
    return <p className="text-sm text-slate-600">Choose a start date and an end date.</p>;
  }
  if (loading) {
    return <CardSkeleton rows={3} label="Loading report" />;
  }
  if (error) {
    return <ErrorNotice title="This report could not be loaded" message={error} onRetry={onRetry} />;
  }
  return null;
}

export function ExportButton({ kind, label }: { kind: string; label: string }) {
  const { qs, ready } = useReportQuery();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onClick() {
    setBusy(true);
    setError('');
    try {
      await downloadReport(kind, qs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={onClick}
        disabled={!ready || busy}
        className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        {busy ? 'Exporting…' : label}
      </button>
      {error && <p role="alert" className="mt-1 text-xs text-red-800">{error}</p>}
    </div>
  );
}

export default function ReportsShell() {
  const [params, setParams] = useSearchParams();
  const preset = params.get('preset') || 'today';
  const from = params.get('from') || '';
  const to = params.get('to') || '';
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const search = params.toString();

  function selectPreset(nextPreset: string) {
    const next = new URLSearchParams(params);
    next.set('preset', nextPreset);
    if (nextPreset !== 'custom') {
      next.delete('from');
      next.delete('to');
    }
    setParams(next);
  }

  function applyCustom(event: FormEvent) {
    event.preventDefault();
    const next = new URLSearchParams(params);
    next.set('preset', 'custom');
    next.set('from', draftFrom);
    next.set('to', draftTo);
    setParams(next);
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Reports</h1>
          <p className="mt-1 text-sm text-slate-600">
            Clinic-wide operations and population health. Activity follows the selected dates. Open work is the current clinic total.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {REPORT_PRESETS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={preset === item.id}
              onClick={() => selectPreset(item.id)}
              className={`px-3 py-2 rounded-lg text-sm border ${
                preset === item.id
                  ? 'bg-teal-50 border-clinical-teal text-clinical-teal font-medium'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {preset === 'custom' && (
        <form onSubmit={applyCustom} className="flex flex-wrap items-end gap-3 bg-white border border-gray-200 rounded-lg p-4">
          <label className="text-sm text-gray-600">
            From
            <input
              type="date"
              value={draftFrom}
              onChange={(event) => setDraftFrom(event.target.value)}
              className="mt-1 block border border-gray-300 rounded-lg px-3 py-2"
              required
            />
          </label>
          <label className="text-sm text-gray-600">
            To
            <input
              type="date"
              value={draftTo}
              onChange={(event) => setDraftTo(event.target.value)}
              className="mt-1 block border border-gray-300 rounded-lg px-3 py-2"
              required
            />
          </label>
          <button
            type="submit"
            className="px-4 py-2 bg-clinical-teal text-white rounded-lg text-sm hover:bg-clinical-teal-dark"
          >
            Apply
          </button>
        </form>
      )}

      <nav className="flex max-w-full gap-2 overflow-x-auto border-b border-gray-200" aria-label="Report sections">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={{ pathname: tab.to, search }}
            end={tab.end}
            className={({ isActive }) =>
              `px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                isActive
                  ? 'border-clinical-teal text-clinical-teal'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
