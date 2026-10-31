import type { Allergy, Medication } from '../../api/client';
import {
  activeAllergies,
  criticalFindings,
  formatChartDate,
  isHighRiskMedication,
  medicationDetail,
  medicationLabel,
  type ChartSnapshotData,
  type ChartTab,
} from './chartDisplay';

function AlertMark() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M8 1.8 14.5 14H1.5L8 1.8z" strokeLinejoin="round" />
      <path d="M8 6.2v3.4" strokeLinecap="round" />
      <path d="M8 11.6h.01" strokeLinecap="round" />
    </svg>
  );
}

function ReviewButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="shrink-0 text-sm font-medium underline-offset-2 hover:underline">
      {label}
    </button>
  );
}

export default function ChartSafety({
  allergies,
  allergiesReady,
  snapshot,
  ready,
  overdueCount,
  onOpen,
}: {
  allergies: Allergy[];
  allergiesReady: boolean;
  snapshot: ChartSnapshotData | null;
  ready: boolean;
  overdueCount: number;
  onOpen: (tab: ChartTab) => void;
}) {
  if (!ready) {
    return (
      <div className="grid gap-3 md:grid-cols-2" aria-hidden>
        <div className="h-28 animate-pulse rounded-2xl bg-slate-200" />
        <div className="h-28 animate-pulse rounded-2xl bg-slate-200" />
      </div>
    );
  }

  const active = allergiesReady ? activeAllergies(allergies) : [];
  const severe = active.some((allergy) => allergy.severity === 'severe');
  const findings = criticalFindings(snapshot?.orderResults || [], snapshot?.abnormalResults || []);
  const recalls = snapshot?.overdueRecalls || [];
  const recallTotal = Math.max(recalls.length, overdueCount);
  const highRisk = (snapshot?.medications || []).filter((medication) => isHighRiskMedication(medication));
  const criticalLevel = findings.some((item) => item.level === 'critical');

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <article
        className={`rounded-2xl border p-4 shadow-sm ${
          !allergiesReady
            ? 'border-slate-200 bg-white'
            : active.length === 0
              ? 'border-emerald-200 bg-emerald-50'
              : severe
                ? 'border-red-300 bg-red-50'
                : 'border-rose-200 bg-rose-50'
        }`}
        role={severe ? 'alert' : 'status'}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p
              className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide ${
                !allergiesReady
                  ? 'text-slate-500'
                  : active.length === 0
                    ? 'text-emerald-800'
                    : severe
                      ? 'text-red-800'
                      : 'text-rose-800'
              }`}
            >
              {active.length > 0 && <AlertMark />}
              {severe ? 'Severe allergy' : 'Allergies'}
            </p>
            {!allergiesReady ? (
              <div className="mt-2 h-4 w-40 animate-pulse rounded bg-slate-200" />
            ) : (
              <p className={`mt-1 text-sm font-semibold ${active.length === 0 ? 'text-emerald-950' : 'text-red-950'}`}>
                {active.length === 0
                  ? 'No known allergies'
                  : `${active.length} active allerg${active.length === 1 ? 'y' : 'ies'}`}
              </p>
            )}
          </div>
          <ReviewButton label="Open list" onClick={() => onOpen('allergies')} />
        </div>
        {allergiesReady && active.length > 0 && (
          <ul className="mt-3 space-y-1.5 text-sm text-red-950">
            {active.slice(0, 4).map((allergy) => (
              <li key={allergy._id} className="flex items-start justify-between gap-3">
                <span>
                  <span className="font-medium">{allergy.substance}</span>
                  <span className="text-red-800"> — {allergy.reaction}</span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${
                    allergy.severity === 'severe' ? 'bg-red-700 text-white' : 'bg-white text-red-900'
                  }`}
                >
                  {allergy.severity}
                </span>
              </li>
            ))}
          </ul>
        )}
      </article>

      {findings.length > 0 && (
        <article
          className={`rounded-2xl border p-4 shadow-sm ${
            criticalLevel ? 'border-red-300 bg-red-50' : 'border-orange-200 bg-orange-50'
          }`}
          role="alert"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide ${criticalLevel ? 'text-red-900' : 'text-orange-900'}`}>
                <AlertMark />
                {criticalLevel ? 'Critical results' : 'Abnormal results'}
              </p>
              <p className="mt-1 text-sm font-semibold text-red-950">
                {findings.length} result{findings.length === 1 ? '' : 's'} need review
              </p>
            </div>
            <ReviewButton label="Open orders" onClick={() => onOpen('orders')} />
          </div>
          <ul className="mt-3 space-y-1.5 text-sm text-red-950">
            {findings.slice(0, 4).map((finding) => (
              <li key={finding.id}>
                <span className="font-medium">{finding.title}</span>
                {finding.detail ? <span className="text-red-800"> — {finding.detail}</span> : null}
                <span className="ml-2 text-[11px] font-semibold uppercase">
                  {finding.level === 'critical' ? 'Critical' : 'Abnormal'}
                </span>
              </li>
            ))}
          </ul>
        </article>
      )}

      {recallTotal > 0 && (
        <article className="rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm" role="alert">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-950">
                <AlertMark />
                Overdue recalls
              </p>
              <p className="mt-1 text-sm font-semibold text-amber-950">
                {recallTotal} recall{recallTotal === 1 ? '' : 's'} past due
              </p>
            </div>
            <ReviewButton label="Open monitoring" onClick={() => onOpen('monitoring')} />
          </div>
          {recalls.length > 0 && (
            <ul className="mt-3 space-y-1.5 text-sm text-amber-950">
              {recalls.slice(0, 4).map((recall) => (
                <li key={recall._id} className="flex items-start justify-between gap-3">
                  <span className="font-medium">{recall.reason}</span>
                  <span className="shrink-0 text-amber-800">Due {formatChartDate(recall.dueDate)}</span>
                </li>
              ))}
            </ul>
          )}
        </article>
      )}

      {highRisk.length > 0 && (
        <article className="rounded-2xl border border-orange-300 bg-orange-50 p-4 shadow-sm" role="alert">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-orange-950">
                <AlertMark />
                High-alert medications
              </p>
              <p className="mt-1 text-sm font-semibold text-orange-950">
                {highRisk.length} active high-alert medication{highRisk.length === 1 ? '' : 's'}
              </p>
            </div>
            <ReviewButton label="Open medications" onClick={() => onOpen('medications')} />
          </div>
          <ul className="mt-3 space-y-1.5 text-sm text-orange-950">
            {highRisk.slice(0, 4).map((medication: Medication) => (
              <li key={medication._id}>
                <span className="font-medium">{medicationLabel(medication)}</span>
                {medicationDetail(medication) ? (
                  <span className="text-orange-800"> — {medicationDetail(medication)}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </article>
      )}
    </div>
  );
}
