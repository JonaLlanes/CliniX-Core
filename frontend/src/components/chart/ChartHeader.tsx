import { Link } from 'react-router-dom';
import type { CareTeamMember, Patient } from '../../api/client';
import { ageLabel, formatChartDate, primaryProviderName, sexAtBirthLabel } from './chartDisplay';

export type ChartQuickAction = 'encounters' | 'orders' | 'referrals';

function CountBadge({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'rose' | 'teal' | 'amber' | 'slate';
}) {
  const tones = {
    rose: 'bg-rose-50 text-rose-950 ring-rose-200',
    teal: 'bg-teal-50 text-teal-950 ring-teal-200',
    amber: 'bg-amber-50 text-amber-950 ring-amber-200',
    slate: 'bg-white text-slate-700 ring-slate-200',
  };
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ring-1 ${tones[tone]}`}>
      <span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </span>
  );
}

function BadgeSkeleton() {
  return <span className="inline-block h-7 w-28 animate-pulse rounded-full bg-slate-200" />;
}

export default function ChartHeader({
  patient,
  directory,
  allergyCount,
  medicationCount,
  conditionCount,
  lastVisit,
  severeAllergy,
  countsReady,
  canEncounter,
  canOrder,
  canReferral,
  onAction,
}: {
  patient: Patient;
  directory: CareTeamMember[];
  allergyCount: number | null;
  medicationCount: number | null;
  conditionCount: number | null;
  lastVisit: string | null;
  severeAllergy: boolean;
  countsReady: boolean;
  canEncounter: boolean;
  canOrder: boolean;
  canReferral: boolean;
  onAction: (action: ChartQuickAction) => void;
}) {
  const preferred = patient.preferredName?.trim();
  const showActions = canEncounter || canOrder || canReferral;
  const allergyTone = allergyCount ? 'rose' : 'slate';
  const conditionTone = conditionCount ? 'amber' : 'slate';

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <Link to="/" className="text-xs font-medium text-teal-800 hover:underline">
          ← Patients
        </Link>
        <h1 className="mt-1 truncate text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">
          {patient.familyName}, {patient.givenName}
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Preferred name{' '}
          <span className="font-medium text-slate-800">{preferred || '—'}</span>
        </p>
        <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
          <div>
            <dt className="sr-only">MRN</dt>
            <dd className="font-medium text-slate-800">{patient.mrn}</dd>
          </div>
          <div>
            <dt className="sr-only">Age</dt>
            <dd>
              <span className="text-slate-600">Age</span> {ageLabel(patient.birthDate)}
            </dd>
          </div>
          <div>
            <dt className="sr-only">Sex at birth</dt>
            <dd>
              <span className="text-slate-600">Sex at birth</span> {sexAtBirthLabel(patient.sex)}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="sr-only">Primary provider</dt>
            <dd className="truncate">
              <span className="text-slate-600">Primary provider</span>{' '}
              {primaryProviderName(patient, directory)}
            </dd>
          </div>
        </dl>
      </div>

      <div className="flex flex-col gap-3 lg:items-end">
        <div className="flex flex-wrap gap-2" aria-label="Chart summary">
          {countsReady ? (
            <>
              <CountBadge
                label={severeAllergy ? 'Severe allergy' : 'Allergies'}
                value={allergyCount ? String(allergyCount) : 'None'}
                tone={allergyTone}
              />
              <CountBadge
                label="Medications"
                value={medicationCount != null ? String(medicationCount) : '—'}
                tone={medicationCount ? 'teal' : 'slate'}
              />
              <CountBadge
                label="Conditions"
                value={conditionCount != null ? String(conditionCount) : '—'}
                tone={conditionTone}
              />
              <CountBadge
                label="Last visit"
                value={lastVisit ? formatChartDate(lastVisit) : 'None'}
                tone="slate"
              />
            </>
          ) : (
            <>
              <BadgeSkeleton />
              <BadgeSkeleton />
              <BadgeSkeleton />
              <BadgeSkeleton />
            </>
          )}
        </div>
        {showActions && (
          <div className="flex flex-wrap gap-2">
            {canEncounter && (
              <button
                type="button"
                onClick={() => onAction('encounters')}
                className="rounded-xl bg-teal-700 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-800"
              >
                New encounter
              </button>
            )}
            {canOrder && (
              <button
                type="button"
                onClick={() => onAction('orders')}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
              >
                New order
              </button>
            )}
            {canReferral && (
              <button
                type="button"
                onClick={() => onAction('referrals')}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
              >
                New referral
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
