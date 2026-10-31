import { FormEvent, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  clinicalApi,
  type MetricSource,
  type MetricType,
  type MonitoringDashboard,
  type MonitoringMetric,
  type MonitoringOptions,
  type MonitoringProgram,
  type MonitoringRecall,
  type MonitoringTimelinePoint,
  type MonitoringTrends,
  type ProgramStatus,
  type ProgramType,
  type RecallStatus,
  type TrendDirection,
  type TrendSeries,
} from '../api/client';
import Panel from './Panel';
import { StatusBadge } from './StatusBadge';
import { chartRecordId, focusedRecordClass, watchChartRecord, type ChartRecordFocus } from './chart/recordFocus';
import { formatEncounterWhen, providerId, providerName } from './encounterDisplay';

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm';
const labelCls = 'block text-xs font-medium text-gray-600 mb-1';
const btnPrimary =
  'px-4 py-2 bg-clinical-teal text-white rounded-lg text-sm hover:bg-clinical-teal-dark disabled:opacity-50';
const btnGhost = 'px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50';
const btnText = 'text-sm text-clinical-teal hover:underline disabled:opacity-50';

const PROGRAM_TYPES: { value: ProgramType; label: string }[] = [
  { value: 'hypertension', label: 'Hypertension' },
  { value: 'diabetes', label: 'Diabetes' },
  { value: 'copd', label: 'COPD' },
  { value: 'heart_failure', label: 'Heart Failure' },
  { value: 'ckd', label: 'CKD' },
  { value: 'custom', label: 'Custom' },
];

const PROGRAM_STATUSES: { value: ProgramStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
];

const PROGRAM_NEXT: Record<ProgramStatus, ProgramStatus[]> = {
  active: ['on_hold', 'completed'],
  on_hold: ['active', 'completed'],
  completed: [],
};

const METRIC_TYPES: { value: MetricType; label: string }[] = [
  { value: 'blood_pressure', label: 'Blood Pressure' },
  { value: 'weight', label: 'Weight' },
  { value: 'bmi', label: 'BMI' },
  { value: 'a1c', label: 'A1C' },
  { value: 'ldl', label: 'LDL' },
  { value: 'egfr', label: 'eGFR' },
  { value: 'custom', label: 'Custom' },
];

const UNITS: Record<MetricType, string> = {
  blood_pressure: 'mmHg',
  weight: 'kg',
  bmi: 'kg/m²',
  a1c: '%',
  ldl: 'mmol/L',
  egfr: 'mL/min/1.73 m²',
  custom: '',
};

const SOURCES: { value: MetricSource; label: string }[] = [
  { value: 'clinic', label: 'Clinic' },
  { value: 'home', label: 'Home' },
  { value: 'device', label: 'Device' },
  { value: 'caregiver', label: 'Caregiver' },
];

const RECALL_STATUSES: { value: Exclude<RecallStatus, 'overdue'>; label: string }[] = [
  { value: 'due', label: 'Due' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const RECALL_NEXT: Record<RecallStatus, Exclude<RecallStatus, 'overdue'>[]> = {
  due: ['scheduled', 'completed', 'cancelled'],
  scheduled: ['due', 'completed', 'cancelled'],
  overdue: ['due', 'scheduled', 'completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

const RECALL_REASONS = ['Repeat A1C', 'BP Follow-up', 'Annual Review', 'Medication Review'];

const DIRECTION_TEXT: Record<TrendDirection, string> = {
  up: 'Rising',
  down: 'Falling',
  stable: 'Stable',
  unknown: 'Not enough readings',
};

function messageOf(err: unknown) {
  return err instanceof Error ? err.message : 'Request failed';
}

function nowLocalInput() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function todayInput() {
  return nowLocalInput().slice(0, 10);
}

function dateTimeInput(value?: string) {
  if (!value) return nowLocalInput();
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function day(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function statusChoices<T extends string>(current: T, next: T[], labels: { value: T; label: string }[]) {
  const allowed = new Set([current, ...next]);
  return labels.filter((item) => allowed.has(item.value));
}

function defaultMetric(programType: ProgramType): MetricType {
  if (programType === 'hypertension') return 'blood_pressure';
  if (programType === 'diabetes') return 'a1c';
  if (programType === 'heart_failure') return 'weight';
  if (programType === 'ckd') return 'egfr';
  if (programType === 'copd') return 'custom';
  return 'blood_pressure';
}

function sourceLabel(source: string) {
  return SOURCES.find((item) => item.value === source)?.label || source;
}

function directionTone(metricType: string, direction: TrendDirection) {
  if (direction === 'unknown') return 'text-gray-500';
  if (direction === 'stable') return 'text-gray-700';
  const adverse =
    metricType === 'egfr'
      ? direction === 'down'
      : (metricType === 'blood_pressure' || metricType === 'a1c' || metricType === 'ldl') && direction === 'up';
  if (adverse) return 'text-amber-700';
  if (metricType === 'egfr' && direction === 'up') return 'text-green-700';
  if (
    (metricType === 'blood_pressure' || metricType === 'a1c' || metricType === 'ldl') &&
    direction === 'down'
  ) {
    return 'text-green-700';
  }
  return 'text-gray-800';
}

function directionArrow(direction: TrendDirection) {
  if (direction === 'up') return '↑';
  if (direction === 'down') return '↓';
  if (direction === 'stable') return '→';
  return '';
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

function Sparkline({ points, alert }: { points: TrendSeries['points']; alert?: boolean }) {
  const values = points.map((point) => point.numeric).filter((value): value is number => value != null);
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const width = 148;
  const height = 40;
  const coords = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / span) * (height - 6) - 3;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={`w-36 h-10 ${alert ? 'text-red-600' : 'text-clinical-teal'}`}>
      <polyline fill="none" stroke="currentColor" strokeWidth="2" points={coords} />
    </svg>
  );
}

function DirectionMark({ metricType, direction }: { metricType: string; direction: TrendDirection }) {
  return (
    <p className={`text-sm font-medium ${directionTone(metricType, direction)}`}>
      {directionArrow(direction)} {DIRECTION_TEXT[direction]}
    </p>
  );
}

function ActivityList({ points }: { points: MonitoringTimelinePoint[] }) {
  if (points.length === 0) return <p className="text-sm text-gray-500">No monitoring activity yet.</p>;
  return (
    <ol className="space-y-3">
      {points.map((point, index) => (
        <li key={`${point.action}-${point.at}-${index}`} className="flex gap-3 text-sm">
          <div className="w-36 shrink-0 text-gray-500">{formatEncounterWhen(point.at)}</div>
          <div>
            <div className="font-medium text-gray-900">{point.label}</div>
            {point.detail && <div className="text-gray-600">{point.detail}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}

function TrendCard({ series }: { series: TrendSeries }) {
  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-gray-900">{series.label}</h3>
          {series.latest ? (
            <p className={`text-2xl font-semibold mt-1 ${series.latest.abnormal ? 'text-red-700' : 'text-gray-900'}`}>
              {series.latest.value}{' '}
              <span className="text-sm font-normal text-gray-500">{series.latest.unit || series.unit}</span>
            </p>
          ) : (
            <p className="text-sm text-gray-500 mt-2">No readings yet.</p>
          )}
          <div className="mt-1">
            <DirectionMark metricType={series.metricType} direction={series.direction} />
          </div>
        </div>
        <Sparkline points={series.points} alert={series.latest?.abnormal} />
      </div>
      {series.recent.length > 0 && (
        <ul className="mt-3 space-y-1">
          {series.recent.map((reading) => (
            <li key={reading._id} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className={reading.abnormal ? 'text-red-700 font-medium' : 'text-gray-900'}>
                {reading.value} {reading.unit}
                {reading.abnormal ? ' · Abnormal' : ''}
              </span>
              <span className="text-gray-500">
                {day(reading.recordedAt)} · {sourceLabel(reading.source)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TrendBoard({ trends }: { trends: MonitoringTrends | null }) {
  return (
    <Panel title="Trends" subtitle="Recent blood pressure, weight, A1C, and laboratory values">
      {!trends ? (
        <p className="text-sm text-gray-500">Loading trends...</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <TrendCard series={trends.bloodPressure} />
            <TrendCard series={trends.weight} />
            <TrendCard series={trends.a1c} />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-2">Laboratory values</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {trends.laboratory
                .filter((series) => series.metricType !== 'custom')
                .map((series) => (
                  <TrendCard key={`${series.metricType}-${series.label}`} series={series} />
                ))}
            </div>
          </div>
          {trends.laboratory.some((series) => series.metricType === 'custom') && (
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-2">Other readings</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {trends.laboratory
                  .filter((series) => series.metricType === 'custom')
                  .map((series) => (
                    <TrendCard key={`${series.metricType}-${series.label}`} series={series} />
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

function readingLine(reading?: MonitoringMetric | null) {
  if (!reading) return 'No readings yet';
  return `${reading.displayLabel} ${reading.value} ${reading.unit}`.trim();
}

export function MonitoringSummary({ patientId, onOpen }: { patientId: string; onOpen?: () => void }) {
  const [summary, setSummary] = useState<MonitoringDashboard | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    clinicalApi
      .monitoring(patientId)
      .dashboard()
      .then((data) => {
        if (!cancelled) {
          setSummary(data);
          setError('');
        }
      })
      .catch((err) => {
        if (!cancelled) setError(messageOf(err));
      });
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  return (
    <Panel
      title="Monitoring"
      subtitle="Active programs, recalls, and recent abnormal values"
    >
      {error && (
        <div className="mb-3 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">{error}</div>
      )}
      {!summary ? (
        <p className="text-sm text-gray-500">Loading monitoring...</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <section>
            <h3 className="text-sm font-medium text-gray-900 mb-2">
              Active programs{summary.counts.activePrograms ? ` (${summary.counts.activePrograms})` : ''}
            </h3>
            {summary.activePrograms.length === 0 ? (
              <p className="text-sm text-gray-500">No active monitoring programs.</p>
            ) : (
              <ul className="space-y-2">
                {summary.activePrograms.map((program) => (
                  <li key={program._id} className="text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-gray-900">{program.title}</span>
                      <StatusBadge value={program.status} />
                    </div>
                    <div className="text-gray-600">
                      {program.diagnosisLabel || 'No linked diagnosis'}
                      {program.owner ? ` · ${program.owner}` : ''}
                      {' · '}
                      {readingLine(program.latestMetric)}
                      {program.latestMetric?.abnormal ? ' · Abnormal' : ''}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h3 className="text-sm font-medium text-gray-900 mb-2">
              Overdue recalls{summary.counts.overdueRecalls ? ` (${summary.counts.overdueRecalls})` : ''}
            </h3>
            {summary.overdueRecalls.length === 0 ? (
              <p className="text-sm text-gray-500">No overdue recalls.</p>
            ) : (
              <ul className="space-y-2">
                {summary.overdueRecalls.map((recall) => (
                  <li key={recall._id} className="text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-gray-900">{recall.reason}</span>
                      <StatusBadge value={recall.status} />
                    </div>
                    <div className="text-gray-600">
                      Due {day(recall.dueDate)}
                      {recall.assignedProvider ? ` · ${recall.assignedProvider}` : ''}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h3 className="text-sm font-medium text-gray-900 mb-2">Upcoming recalls</h3>
            {summary.upcomingRecalls.length === 0 ? (
              <p className="text-sm text-gray-500">No recalls due in the next 90 days.</p>
            ) : (
              <ul className="space-y-2">
                {summary.upcomingRecalls.map((recall) => (
                  <li key={recall._id} className="text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-gray-900">{recall.reason}</span>
                      <StatusBadge value={recall.status} />
                    </div>
                    <div className="text-gray-600">
                      Due {day(recall.dueDate)}
                      {recall.assignedProvider ? ` · ${recall.assignedProvider}` : ''}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h3 className="text-sm font-medium text-gray-900 mb-2">Recent abnormal values</h3>
            <p className="text-xs text-gray-500 mb-2">
              Blood pressure outside 90–139 / 60–89, A1C 7% or higher, LDL 3.5 mmol/L or higher, eGFR below 60, BMI
              below 18.5 or 30 or higher.
            </p>
            {summary.recentAbnormal.length === 0 ? (
              <p className="text-sm text-gray-500">No recent abnormal values.</p>
            ) : (
              <ul className="space-y-2">
                {summary.recentAbnormal.map((reading) => (
                  <li key={reading._id} className="text-sm">
                    <div className="font-medium text-red-700">
                      {reading.displayLabel} {reading.value} {reading.unit}
                    </div>
                    <div className="text-gray-600">
                      {reading.programTitle} · {day(reading.recordedAt)} · {sourceLabel(reading.source)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
      {onOpen && (
        <button type="button" className={`${btnText} mt-4`} onClick={onOpen}>
          Open monitoring
        </button>
      )}
    </Panel>
  );
}

function LinkFields({
  options,
  diagnosisId,
  carePlanId,
  onDiagnosis,
  onCarePlan,
}: {
  options: MonitoringOptions | null;
  diagnosisId: string;
  carePlanId: string;
  onDiagnosis: (value: string) => void;
  onCarePlan: (value: string) => void;
}) {
  return (
    <>
      <Field label="Diagnosis">
        <select className={inputCls} value={diagnosisId} onChange={(event) => onDiagnosis(event.target.value)}>
          <option value="">None</option>
          <optgroup label="Problems">
            {(options?.problems || []).map((problem) => (
              <option key={problem._id} value={problem._id}>
                {problem.display}
                {problem.code ? ` · ${problem.code}` : ''}
              </option>
            ))}
          </optgroup>
          <optgroup label="Encounter diagnoses">
            {(options?.diagnoses || []).map((diagnosis) => (
              <option key={diagnosis._id} value={diagnosis._id}>
                {diagnosis.code} · {diagnosis.description}
              </option>
            ))}
          </optgroup>
        </select>
      </Field>
      <Field label="Care plan">
        <select className={inputCls} value={carePlanId} onChange={(event) => onCarePlan(event.target.value)}>
          <option value="">None</option>
          {(options?.carePlans || []).map((plan) => (
            <option key={plan._id} value={plan._id}>
              {plan.title}
            </option>
          ))}
        </select>
      </Field>
    </>
  );
}

function EnrollForm({
  options,
  actorId,
  busy,
  onCancel,
  onSubmit,
}: {
  options: MonitoringOptions | null;
  actorId?: string;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
}) {
  const clinicianDefault = (options?.clinicians || []).some((person) => person._id === actorId)
    ? actorId || ''
    : options?.clinicians[0]?._id || '';
  const [programType, setProgramType] = useState<ProgramType>('hypertension');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'active' | 'on_hold'>('active');
  const [enrolledDate, setEnrolledDate] = useState(todayInput());
  const [ownerClinicianId, setOwner] = useState(clinicianDefault);
  const [diagnosisId, setDiagnosisId] = useState('');
  const [carePlanId, setCarePlanId] = useState('');

  useEffect(() => {
    if (!ownerClinicianId && clinicianDefault) setOwner(clinicianDefault);
  }, [clinicianDefault, ownerClinicianId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    await onSubmit({
      programType,
      name: name.trim() || undefined,
      status,
      enrolledDate,
      ownerClinicianId,
      diagnosisId: diagnosisId || undefined,
      carePlanId: carePlanId || undefined,
    });
  }

  return (
    <form onSubmit={submit} className="border border-gray-200 rounded-lg p-4 mb-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Program">
          <select
            className={inputCls}
            value={programType}
            onChange={(event) => setProgramType(event.target.value as ProgramType)}
          >
            {PROGRAM_TYPES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={programType === 'custom' ? 'Name' : 'Name (optional)'}>
          <input
            className={inputCls}
            value={name}
            required={programType === 'custom'}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field label="Status">
          <select
            className={inputCls}
            value={status}
            onChange={(event) => setStatus(event.target.value as 'active' | 'on_hold')}
          >
            <option value="active">Active</option>
            <option value="on_hold">On Hold</option>
          </select>
        </Field>
        <Field label="Enrolled">
          <input
            className={inputCls}
            type="date"
            required
            value={enrolledDate}
            onChange={(event) => setEnrolledDate(event.target.value)}
          />
        </Field>
        <Field label="Owner">
          <select
            className={inputCls}
            required
            value={ownerClinicianId}
            onChange={(event) => setOwner(event.target.value)}
          >
            <option value="">Select a clinician</option>
            {(options?.clinicians || []).map((person) => (
              <option key={person._id} value={person._id}>
                {person.displayName}
              </option>
            ))}
          </select>
        </Field>
        <LinkFields
          options={options}
          diagnosisId={diagnosisId}
          carePlanId={carePlanId}
          onDiagnosis={setDiagnosisId}
          onCarePlan={setCarePlanId}
        />
      </div>
      <div className="flex gap-2">
        <button className={btnPrimary} type="submit" disabled={busy}>
          Enroll
        </button>
        <button className={btnGhost} type="button" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function MetricForm({
  program,
  caregiver,
  busy,
  initial,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  program: MonitoringProgram;
  caregiver: boolean;
  busy: boolean;
  initial?: MonitoringMetric | null;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
}) {
  const sources = caregiver ? SOURCES.filter((item) => item.value !== 'clinic') : SOURCES;
  const startingType = initial?.metricType || defaultMetric(program.programType);
  const [metricType, setMetricType] = useState<MetricType>(startingType);
  const [label, setLabel] = useState(initial?.label || (program.programType === 'copd' ? 'Peak flow' : ''));
  const [value, setValue] = useState(initial?.value || '');
  const [unit, setUnit] = useState(initial?.unit || UNITS[startingType]);
  const [recordedAt, setRecordedAt] = useState(initial ? dateTimeInput(initial.recordedAt) : nowLocalInput());
  const [source, setSource] = useState<MetricSource>(initial?.source || (caregiver ? 'home' : 'clinic'));
  const [abnormal, setAbnormal] = useState(Boolean(initial?.abnormal));

  function changeType(next: MetricType) {
    setMetricType(next);
    if (!initial) setUnit(UNITS[next]);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const body: Record<string, unknown> = {
      value,
      unit,
      recordedAt,
      source,
    };
    if (!initial) {
      body.metricType = metricType;
      if (metricType === 'custom') {
        body.label = label.trim();
        body.abnormal = abnormal;
      }
    } else if (initial.metricType === 'custom') {
      body.label = label.trim();
      body.abnormal = abnormal;
    }
    await onSubmit(body);
  }

  return (
    <form onSubmit={submit} className="mt-3 border border-gray-100 rounded-lg p-3 space-y-3 bg-gray-50">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Metric">
          <select
            className={inputCls}
            value={metricType}
            disabled={Boolean(initial)}
            onChange={(event) => changeType(event.target.value as MetricType)}
          >
            {METRIC_TYPES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>
        {metricType === 'custom' && (
          <Field label="Name">
            <input className={inputCls} required value={label} onChange={(event) => setLabel(event.target.value)} />
          </Field>
        )}
        <Field label="Value">
          <input
            className={inputCls}
            required
            value={value}
            placeholder={metricType === 'blood_pressure' ? '128/82' : ''}
            inputMode={metricType === 'blood_pressure' || metricType === 'custom' ? 'text' : 'decimal'}
            onChange={(event) => setValue(event.target.value)}
          />
        </Field>
        <Field label="Unit">
          <input className={inputCls} required value={unit} onChange={(event) => setUnit(event.target.value)} />
        </Field>
        <Field label="Recorded">
          <input
            className={inputCls}
            type="datetime-local"
            required
            value={recordedAt}
            onChange={(event) => setRecordedAt(event.target.value)}
          />
        </Field>
        <Field label="Source">
          <select
            className={inputCls}
            value={source}
            onChange={(event) => setSource(event.target.value as MetricSource)}
          >
            {sources.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {metricType === 'custom' && (
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={abnormal} onChange={(event) => setAbnormal(event.target.checked)} />
          Flag as abnormal
        </label>
      )}
      <div className="flex gap-2">
        <button className={btnPrimary} type="submit" disabled={busy}>
          {submitLabel}
        </button>
        <button className={btnGhost} type="button" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function ProgramCard({
  patientId,
  program,
  canWrite,
  canRecord,
  caregiver,
  busy,
  onRun,
  focused = false,
  focusMetricId = '',
}: {
  patientId: string;
  program: MonitoringProgram;
  canWrite: boolean;
  canRecord: boolean;
  caregiver: boolean;
  busy: boolean;
  onRun: (work: () => Promise<void>) => Promise<void>;
  focused?: boolean;
  focusMetricId?: string;
}) {
  const api = clinicalApi.monitoring(patientId);
  const [status, setStatus] = useState<ProgramStatus>(program.status);
  const [completedDate, setCompletedDate] = useState(program.completedDate?.slice(0, 10) || todayInput());
  const [recording, setRecording] = useState(false);
  const [correcting, setCorrecting] = useState<string | null>(null);
  const next = PROGRAM_NEXT[program.status];
  const choices = statusChoices(program.status, next, PROGRAM_STATUSES);
  const activity = [...(program.timeline || [])].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
  );

  useEffect(() => {
    setStatus(program.status);
  }, [program.status]);

  return (
    <article
      id={chartRecordId('program', program._id)}
      className={`rounded-lg border border-gray-200 p-4 ${focusedRecordClass(focused)}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium text-gray-900">{program.title}</h3>
        {program.programType === 'custom' && <StatusBadge value="custom" />}
        <StatusBadge value={program.status} />
      </div>
      <p className="text-sm text-gray-600 mt-1">
        Enrolled {day(program.enrolledDate)}
        {program.owner ? ` · ${program.owner}` : program.ownerClinicianId ? ` · ${providerName(program.ownerClinicianId)}` : ''}
        {program.completedDate ? ` · completed ${day(program.completedDate)}` : ''}
      </p>
      <p className="text-sm text-gray-600">
        {program.diagnosisLabel || 'No linked diagnosis'}
        {program.carePlanTitle ? ` · ${program.carePlanTitle}` : ''}
      </p>
      {program.status === 'on_hold' && (
        <p className="text-sm text-amber-800 mt-2">The program is on hold. Readings can still be recorded.</p>
      )}
      <div className="mt-3">
        <h4 className="text-xs font-medium text-gray-500 mb-1">Recent values</h4>
        {(program.recentMetrics || []).length === 0 ? (
          <p className="text-sm text-gray-500">No readings yet.</p>
        ) : (
          <ul className="space-y-1">
            {(program.recentMetrics || []).map((reading) => (
              <li
                key={reading._id}
                id={chartRecordId('metric', reading._id)}
                className={`flex flex-wrap items-center justify-between gap-2 text-sm ${focusedRecordClass(reading._id === focusMetricId)}`}
              >
                <span className={reading.abnormal ? 'text-red-700 font-medium' : 'text-gray-900'}>
                  {reading.displayLabel} {reading.value} {reading.unit}
                  {reading.abnormal ? ' · Abnormal' : ''}
                  <span className="text-gray-500 font-normal">
                    {' '}
                    · {day(reading.recordedAt)} · {sourceLabel(reading.source)}
                  </span>
                </span>
                {canRecord && !(caregiver && reading.source === 'clinic') && (
                  <button type="button" className={btnText} onClick={() => setCorrecting(reading._id)}>
                    Correct
                  </button>
                )}
                {correcting === reading._id && (
                  <div className="w-full basis-full">
                    <MetricForm
                      program={program}
                      caregiver={caregiver}
                      busy={busy}
                      initial={reading}
                      submitLabel="Save correction"
                      onCancel={() => setCorrecting(null)}
                      onSubmit={(body) =>
                        onRun(async () => {
                          await api.updateMetric(reading._id, body);
                          setCorrecting(null);
                        })
                      }
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {canRecord && program.status !== 'completed' && (
        <div className="mt-3">
          {recording ? (
            <MetricForm
              program={program}
              caregiver={caregiver}
              busy={busy}
              submitLabel="Record reading"
              onCancel={() => setRecording(false)}
              onSubmit={(body) =>
                onRun(async () => {
                  await api.recordMetric(program._id, body);
                  setRecording(false);
                })
              }
            />
          ) : (
            <button type="button" className={btnGhost} onClick={() => setRecording(true)} disabled={busy}>
              Record reading
            </button>
          )}
        </div>
      )}
      {canWrite && next.length > 0 && (
        <form
          className="mt-3 flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (status === program.status) return;
            void onRun(async () => {
              await api.setProgramStatus(program._id, {
                status,
                completedDate: status === 'completed' ? completedDate : undefined,
              });
            });
          }}
        >
          <Field label="Status">
            <select
              className={inputCls}
              value={status}
              onChange={(event) => setStatus(event.target.value as ProgramStatus)}
            >
              {choices.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>
          {status === 'completed' && (
            <Field label="Completed">
              <input
                className={inputCls}
                type="date"
                required
                value={completedDate}
                onChange={(event) => setCompletedDate(event.target.value)}
              />
            </Field>
          )}
          <button className={btnPrimary} type="submit" disabled={busy || status === program.status}>
            Update status
          </button>
        </form>
      )}
      <h4 className="text-xs font-medium text-gray-500 mt-4 mb-2">Activity</h4>
      <ActivityList points={activity.slice(0, 8)} />
    </article>
  );
}

function RecallEditor({
  recall,
  options,
  busy,
  onCancel,
  onSubmit,
}: {
  recall: MonitoringRecall;
  options: MonitoringOptions | null;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [reason, setReason] = useState(recall.reason);
  const [dueDate, setDueDate] = useState(recall.dueDate.slice(0, 10));
  const [assignedProvider, setProvider] = useState(providerId(recall.assignedProvider));
  const [diagnosisId, setDiagnosisId] = useState(recall.diagnosisId || '');
  const [carePlanId, setCarePlanId] = useState(providerId(recall.carePlanId));

  async function submit(event: FormEvent) {
    event.preventDefault();
    await onSubmit({
      reason,
      dueDate,
      assignedProvider,
      diagnosisId: diagnosisId || null,
      carePlanId: carePlanId || null,
    });
  }

  return (
    <form onSubmit={submit} className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
      <Field label="Reason">
        <input className={inputCls} required value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
      <Field label="Due">
        <input className={inputCls} type="date" required value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
      </Field>
      <Field label="Assigned provider">
        <select className={inputCls} required value={assignedProvider} onChange={(event) => setProvider(event.target.value)}>
          <option value="">Select a clinician</option>
          {(options?.clinicians || []).map((person) => (
            <option key={person._id} value={person._id}>
              {person.displayName}
            </option>
          ))}
        </select>
      </Field>
      <LinkFields
        options={options}
        diagnosisId={diagnosisId}
        carePlanId={carePlanId}
        onDiagnosis={setDiagnosisId}
        onCarePlan={setCarePlanId}
      />
      <div className="flex gap-2 md:col-span-2">
        <button className={btnPrimary} type="submit" disabled={busy}>
          Save recall
        </button>
        <button className={btnGhost} type="button" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function MonitoringPanel({
  patientId,
  canWrite,
  canRecord,
  caregiver,
  actorId,
  recordFocus = null,
}: {
  patientId: string;
  canWrite: boolean;
  canRecord: boolean;
  caregiver: boolean;
  actorId?: string;
  recordFocus?: ChartRecordFocus | null;
}) {
  const [programs, setPrograms] = useState<MonitoringProgram[]>([]);
  const [recalls, setRecalls] = useState<MonitoringRecall[]>([]);
  const [trends, setTrends] = useState<MonitoringTrends | null>(null);
  const [options, setOptions] = useState<MonitoringOptions | null>(null);
  const [programView, setProgramView] = useState(recordFocus?.tab === 'monitoring' ? 'all' : 'open');
  const [recallView, setRecallView] = useState(recordFocus?.tab === 'monitoring' ? 'all' : 'open');
  const [showEnroll, setShowEnroll] = useState(false);
  const [showRecall, setShowRecall] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    const api = clinicalApi.monitoring(patientId);
    const [programPage, recallPage, trendData, optionData] = await Promise.all([
      api.programs('?limit=100'),
      api.recalls('?limit=100'),
      api.trends(),
      api.options(),
    ]);
    setPrograms(programPage.data);
    setRecalls(recallPage.data);
    setTrends(trendData);
    setOptions(optionData);
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load()
      .then(() => {
        if (!cancelled) setError('');
      })
      .catch((err) => {
        if (!cancelled) setError(messageOf(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await work();
      await load();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  const monitorFocus = recordFocus?.tab === 'monitoring' ? recordFocus : null;
  const monitorFocusId =
    monitorFocus?.scope === 'program' ? monitorFocus.recordId : monitorFocus?.fallbackId || '';
  const seenMonitorFocus = useRef(0);
  useEffect(() => {
    if (!monitorFocus || loading) return;
    if (seenMonitorFocus.current === monitorFocus.token) return;
    seenMonitorFocus.current = monitorFocus.token;
    setProgramView('all');
    setRecallView('all');
    return watchChartRecord(
      monitorFocus.scope,
      monitorFocus.recordId,
      monitorFocus.scope === 'metric' ? 'program' : undefined,
      monitorFocus.fallbackId
    );
  }, [monitorFocus, loading]);

  const visiblePrograms = programs.filter((program) => {
    if (programView === 'all') return true;
    if (programView === 'open') return program.status === 'active' || program.status === 'on_hold';
    return program.status === programView;
  });
  const visibleRecalls = recalls
    .filter((recall) => {
      if (recallView === 'all') return true;
      if (recallView === 'open') return recall.status === 'due' || recall.status === 'scheduled' || recall.status === 'overdue';
      if (recallView === 'upcoming') return recall.status === 'due' || recall.status === 'scheduled';
      return recall.status === recallView;
    })
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  const activity = [...programs.flatMap((program) => program.timeline || []), ...recalls.flatMap((recall) => recall.timeline || [])]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 20);

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}
      <TrendBoard trends={trends} />
      <Panel title="Monitoring programs" subtitle="Hypertension, diabetes, COPD, heart failure, CKD, and custom follow-up">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <select className={inputCls + ' max-w-xs'} value={programView} onChange={(event) => setProgramView(event.target.value)}>
            <option value="open">Open</option>
            <option value="active">Active</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
            <option value="all">All</option>
          </select>
          {canWrite && (
            <button type="button" className={btnPrimary} onClick={() => setShowEnroll((open) => !open)} disabled={busy}>
              {showEnroll ? 'Close enrollment' : 'Enroll patient'}
            </button>
          )}
        </div>
        {showEnroll && canWrite && (
          <EnrollForm
            options={options}
            actorId={actorId}
            busy={busy}
            onCancel={() => setShowEnroll(false)}
            onSubmit={async (body) => {
              await run(async () => {
                await clinicalApi.monitoring(patientId).createProgram(body);
                setShowEnroll(false);
              });
            }}
          />
        )}
        {loading ? (
          <p className="text-sm text-gray-500">Loading programs...</p>
        ) : visiblePrograms.length === 0 ? (
          <p className="text-sm text-gray-500">No monitoring programs in this view.</p>
        ) : (
          <div className="space-y-4">
            {visiblePrograms.map((program) => (
              <ProgramCard
                key={program._id}
                patientId={patientId}
                program={program}
                canWrite={canWrite}
                canRecord={canRecord}
                caregiver={caregiver}
                busy={busy}
                onRun={run}
                focused={program._id === monitorFocusId}
                focusMetricId={recordFocus?.scope === 'metric' ? recordFocus.recordId : ''}
              />
            ))}
          </div>
        )}
      </Panel>
      <RecallSection
        patientId={patientId}
        recalls={visibleRecalls}
        options={options}
        actorId={actorId}
        canWrite={canWrite}
        busy={busy}
        loading={loading}
        view={recallView}
        showForm={showRecall}
        onView={setRecallView}
        onToggleForm={() => setShowRecall((open) => !open)}
        onCloseForm={() => setShowRecall(false)}
        onRun={run}
        focusId={monitorFocus?.scope === 'recall' ? monitorFocus.recordId : ''}
      />
      <Panel title="Monitoring activity" subtitle="Enrollment, readings, recalls, and completed programs">
        <ActivityList points={activity} />
      </Panel>
    </div>
  );
}

function RecallSection({
  patientId,
  recalls,
  options,
  actorId,
  canWrite,
  busy,
  loading,
  view,
  showForm,
  onView,
  onToggleForm,
  onCloseForm,
  onRun,
  focusId = '',
}: {
  patientId: string;
  recalls: MonitoringRecall[];
  options: MonitoringOptions | null;
  actorId?: string;
  canWrite: boolean;
  busy: boolean;
  loading: boolean;
  view: string;
  showForm: boolean;
  onView: (value: string) => void;
  onToggleForm: () => void;
  onCloseForm: () => void;
  onRun: (work: () => Promise<void>) => Promise<void>;
  focusId?: string;
}) {
  const clinicianDefault = (options?.clinicians || []).some((person) => person._id === actorId)
    ? actorId || ''
    : options?.clinicians[0]?._id || '';
  const [reason, setReason] = useState(RECALL_REASONS[0]);
  const [dueDate, setDueDate] = useState(todayInput());
  const [assignedProvider, setProvider] = useState(clinicianDefault);
  const [status, setStatus] = useState<'due' | 'scheduled'>('due');
  const [diagnosisId, setDiagnosisId] = useState('');
  const [carePlanId, setCarePlanId] = useState('');

  useEffect(() => {
    if (!assignedProvider && clinicianDefault) setProvider(clinicianDefault);
  }, [assignedProvider, clinicianDefault]);

  return (
    <Panel title="Recalls" subtitle="Repeat labs, follow-up visits, annual review, and medication review">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <select className={inputCls + ' max-w-xs'} value={view} onChange={(event) => onView(event.target.value)}>
          <option value="open">Open</option>
          <option value="overdue">Overdue</option>
          <option value="upcoming">Upcoming</option>
          <option value="completed">Completed</option>
          <option value="all">All</option>
        </select>
        {canWrite && (
          <button type="button" className={btnPrimary} onClick={onToggleForm} disabled={busy}>
            {showForm ? 'Close recall' : 'Add recall'}
          </button>
        )}
      </div>
      {showForm && canWrite && (
        <form
          className="border border-gray-200 rounded-lg p-4 mb-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void onRun(async () => {
              await clinicalApi.monitoring(patientId).createRecall({
                reason,
                dueDate,
                assignedProvider,
                status,
                diagnosisId: diagnosisId || undefined,
                carePlanId: carePlanId || undefined,
              });
              onCloseForm();
            });
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Reason">
              <input
                className={inputCls}
                required
                list="recall-reasons"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
              <datalist id="recall-reasons">
                {RECALL_REASONS.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </Field>
            <Field label="Due">
              <input className={inputCls} type="date" required value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </Field>
            <Field label="Assigned provider">
              <select className={inputCls} required value={assignedProvider} onChange={(event) => setProvider(event.target.value)}>
                <option value="">Select a clinician</option>
                {(options?.clinicians || []).map((person) => (
                  <option key={person._id} value={person._id}>
                    {person.displayName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select className={inputCls} value={status} onChange={(event) => setStatus(event.target.value as 'due' | 'scheduled')}>
                <option value="due">Due</option>
                <option value="scheduled">Scheduled</option>
              </select>
            </Field>
            <LinkFields
              options={options}
              diagnosisId={diagnosisId}
              carePlanId={carePlanId}
              onDiagnosis={setDiagnosisId}
              onCarePlan={setCarePlanId}
            />
          </div>
          <div className="flex gap-2">
            <button className={btnPrimary} type="submit" disabled={busy}>
              Create recall
            </button>
            <button className={btnGhost} type="button" onClick={onCloseForm} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      )}
      {loading ? (
        <p className="text-sm text-gray-500">Loading recalls...</p>
      ) : recalls.length === 0 ? (
        <p className="text-sm text-gray-500">No recalls in this view.</p>
      ) : (
        <div className="space-y-3">
          {recalls.map((recall) => (
            <RecallCard
              key={recall._id}
              patientId={patientId}
              recall={recall}
              options={options}
              canWrite={canWrite}
              busy={busy}
              onRun={onRun}
              focused={recall._id === focusId}
            />
          ))}
        </div>
      )}
    </Panel>
  );
}

function RecallCard({
  patientId,
  recall,
  options,
  canWrite,
  busy,
  onRun,
  focused = false,
}: {
  patientId: string;
  recall: MonitoringRecall;
  options: MonitoringOptions | null;
  canWrite: boolean;
  busy: boolean;
  onRun: (work: () => Promise<void>) => Promise<void>;
  focused?: boolean;
}) {
  const next = RECALL_NEXT[recall.status];
  const [status, setStatus] = useState<Exclude<RecallStatus, 'overdue'>>(next[0] || 'completed');
  const [dueDate, setDueDate] = useState(() => {
    const current = recall.dueDate.slice(0, 10);
    return current < todayInput() ? todayInput() : current;
  });
  const [editing, setEditing] = useState(false);
  const open = recall.status !== 'completed' && recall.status !== 'cancelled';

  return (
    <article
      id={chartRecordId('recall', recall._id)}
      className={`rounded-lg border border-gray-200 p-4 ${focusedRecordClass(focused)}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium text-gray-900">{recall.reason}</h3>
        <StatusBadge value={recall.status} />
      </div>
      <p className="text-sm text-gray-600 mt-1">
        Due {day(recall.dueDate)}
        {recall.assignedProviderName ? ` · ${recall.assignedProviderName}` : ''}
        {recall.completedAt ? ` · completed ${day(recall.completedAt)}` : ''}
      </p>
      <p className="text-sm text-gray-600">
        {recall.diagnosisLabel || 'No linked diagnosis'}
        {recall.carePlanTitle ? ` · ${recall.carePlanTitle}` : ''}
      </p>
      {canWrite && open && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={btnText} onClick={() => setEditing((openEdit) => !openEdit)}>
            {editing ? 'Close edit' : 'Edit'}
          </button>
        </div>
      )}
      {editing && (
        <RecallEditor
          recall={recall}
          options={options}
          busy={busy}
          onCancel={() => setEditing(false)}
          onSubmit={(body) =>
            onRun(async () => {
              await clinicalApi.monitoring(patientId).updateRecall(recall._id, body);
              setEditing(false);
            })
          }
        />
      )}
      {canWrite && next.length > 0 && (
        <form
          className="mt-3 flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void onRun(async () => {
              await clinicalApi.monitoring(patientId).setRecallStatus(recall._id, {
                status,
                dueDate: status === 'due' || status === 'scheduled' ? dueDate : undefined,
              });
            });
          }}
        >
          <Field label="Move to">
            <select
              className={inputCls}
              value={status}
              onChange={(event) => setStatus(event.target.value as Exclude<RecallStatus, 'overdue'>)}
            >
              {RECALL_STATUSES.filter((item) => next.includes(item.value)).map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>
          {(status === 'due' || status === 'scheduled') && (
            <Field label="Due date">
              <input className={inputCls} type="date" required value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </Field>
          )}
          <button className={btnPrimary} type="submit" disabled={busy}>
            Update recall
          </button>
        </form>
      )}
    </article>
  );
}
