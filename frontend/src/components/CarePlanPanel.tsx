import { FormEvent, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  clinicalApi,
  type CarePlan,
  type CarePlanGoalStatus,
  type CarePlanInterventionStatus,
  type CarePlanOptions,
  type CarePlanRole,
  type CarePlanStatus,
  type CarePlanSummary as CarePlanSummaryData,
} from '../api/client';
import Panel, { EmptyState } from './Panel';
import { StatusBadge } from './StatusBadge';
import { formatEncounterWhen, providerName } from './encounterDisplay';
import { chartRecordId, focusedRecordClass, watchChartRecord, type ChartRecordFocus } from './chart/recordFocus';

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm';
const labelCls = 'block text-xs font-medium text-gray-600 mb-1';
const btnPrimary =
  'px-4 py-2 bg-clinical-teal text-white rounded-lg text-sm hover:bg-clinical-teal-dark disabled:opacity-50';
const btnGhost = 'px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50';
const btnText = 'text-sm text-clinical-teal hover:underline disabled:opacity-50';

const PLAN_STATUSES: { value: CarePlanStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const PLAN_NEXT: Record<CarePlanStatus, CarePlanStatus[]> = {
  draft: ['active', 'cancelled'],
  active: ['on_hold', 'completed', 'cancelled'],
  on_hold: ['active', 'completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

const GOAL_NEXT: Record<CarePlanGoalStatus, CarePlanGoalStatus[]> = {
  not_started: ['in_progress', 'achieved', 'cancelled'],
  in_progress: ['not_started', 'achieved', 'cancelled'],
  achieved: [],
  cancelled: [],
};

const INTERVENTION_NEXT: Record<CarePlanInterventionStatus, CarePlanInterventionStatus[]> = {
  planned: ['active', 'completed', 'cancelled'],
  active: ['planned', 'completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

const ROLES: { value: CarePlanRole; label: string }[] = [
  { value: 'clinician', label: 'Clinician' },
  { value: 'nurse', label: 'Nurse' },
  { value: 'caregiver', label: 'Caregiver' },
  { value: 'pharmacist', label: 'Pharmacist' },
];

const VIEWS = [
  { value: 'current', label: 'Current' },
  { value: 'active', label: 'Active' },
  { value: 'closed', label: 'Closed' },
  { value: 'all', label: 'All' },
];

function messageOf(err: unknown) {
  return err instanceof Error ? err.message : 'Request failed';
}

function todayInput() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function day(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function refId(value?: string | { _id: string } | null) {
  if (!value) return '';
  return typeof value === 'string' ? value : value._id;
}

function ids(values?: string[]) {
  return values || [];
}

function statusChoices<T extends string>(current: T, next: T[], labels: { value: T; label: string }[]) {
  const allowed = new Set([current, ...next]);
  return labels.filter((item) => allowed.has(item.value));
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

export function CarePlanSummary({
  patientId,
  onOpen,
}: {
  patientId: string;
  onOpen?: () => void;
}) {
  const [summary, setSummary] = useState<CarePlanSummaryData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    clinicalApi
      .carePlans(patientId)
      .summary()
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
    <Panel title="Care plans" subtitle="Active plans, overdue goals, and upcoming tasks">
      {error && (
        <div className="mb-3 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">{error}</div>
      )}
      {!summary ? (
        <p className="text-sm text-gray-500">Loading care plans...</p>
      ) : (
        <div className="space-y-5">
          <section>
            <h3 className="text-sm font-medium text-gray-900 mb-2">Active plans</h3>
            {summary.active.length === 0 ? (
              <p className="text-sm text-gray-500">No active care plans.</p>
            ) : (
              <ul className="space-y-2">
                {summary.active.map((plan) => (
                  <li key={plan._id} className="text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-gray-900">{plan.title}</span>
                      <StatusBadge value={plan.status} />
                    </div>
                    <div className="text-gray-600">
                      {plan.primaryDiagnosis || 'No primary diagnosis'}
                      {plan.owner ? ` · ${plan.owner}` : ''}
                      {plan.targetDate ? ` · target ${day(plan.targetDate)}` : ''}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {summary.onHold.length > 0 && (
            <section>
              <h3 className="text-sm font-medium text-gray-900 mb-2">On hold</h3>
              <ul className="space-y-2">
                {summary.onHold.map((plan) => (
                  <li key={plan._id} className="text-sm flex flex-wrap items-center gap-2">
                    <span className="font-medium text-gray-900">{plan.title}</span>
                    <StatusBadge value={plan.status} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section>
            <h3 className="text-sm font-medium text-gray-900 mb-2">Overdue goals</h3>
            {summary.overdueGoals.length === 0 ? (
              <p className="text-sm text-gray-500">No overdue goals.</p>
            ) : (
              <ul className="space-y-2">
                {summary.overdueGoals.map((goal) => (
                  <li key={goal._id} className="text-sm">
                    <div className="font-medium text-gray-900">
                      {goal.description}
                      {goal.targetValue ? ` · ${goal.targetValue}` : ''}
                    </div>
                    <div className="text-gray-600">
                      {goal.carePlanTitle} · due {day(goal.targetDate)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h3 className="text-sm font-medium text-gray-900 mb-2">Upcoming tasks</h3>
            {summary.upcomingTasks.length === 0 ? (
              <p className="text-sm text-gray-500">No upcoming care plan tasks.</p>
            ) : (
              <ul className="space-y-2">
                {summary.upcomingTasks.map((task) => (
                  <li key={task._id} className="text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-gray-900">{task.title}</span>
                      <StatusBadge value={task.status} />
                    </div>
                    <div className="text-gray-600">
                      {task.carePlanTitle} · {task.assigneeRole}
                      {task.dueDate ? ` · due ${day(task.dueDate)}` : ''}
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
          Open care plans
        </button>
      )}
    </Panel>
  );
}

export function CarePlanPanel({
  patientId,
  canWrite,
  actorId,
  recordFocus = null,
}: {
  patientId: string;
  canWrite: boolean;
  actorId?: string;
  recordFocus?: ChartRecordFocus | null;
}) {
  const [plans, setPlans] = useState<CarePlan[]>([]);
  const [options, setOptions] = useState<CarePlanOptions | null>(null);
  const [view, setView] = useState(recordFocus?.tab === 'care' ? 'all' : 'current');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load(nextView = view) {
    setLoading(true);
    try {
      const [listed, opts] = await Promise.all([
        clinicalApi.carePlans(patientId).list(`?view=${nextView}&limit=100`),
        clinicalApi.carePlans(patientId).options(),
      ]);
      setPlans(listed.data);
      setOptions(opts);
      setError('');
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, view]);

  const careFocus = recordFocus?.tab === 'care' ? recordFocus : null;
  const seenCareFocus = useRef(0);
  useEffect(() => {
    if (!careFocus) return;
    setView('all');
  }, [careFocus]);

  useEffect(() => {
    if (!careFocus || loading || view !== 'all') return;
    if (seenCareFocus.current === careFocus.token) return;
    seenCareFocus.current = careFocus.token;
    return watchChartRecord('care', careFocus.recordId);
  }, [careFocus, loading, view]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
      setError('');
      await load();
    } catch (err) {
      setError(messageOf(err));
      throw err;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}
      {canWrite && options && (
        <CreatePlan
          options={options}
          actorId={actorId}
          busy={busy}
          onSubmit={(body) => run(() => clinicalApi.carePlans(patientId).create(body).then(() => undefined))}
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-gray-900">Care plans</h2>
        <select
          className={inputCls}
          style={{ width: 'auto' }}
          value={view}
          onChange={(event) => setView(event.target.value)}
        >
          {VIEWS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
      {loading ? (
        <p className="text-sm text-gray-500">Loading care plans...</p>
      ) : plans.length === 0 ? (
        <Panel>
          <EmptyState text="No care plans in this view" hint="Active, on-hold, and completed plans for this chart are listed here." />
        </Panel>
      ) : (
        plans.map((plan) => (
          <div key={plan._id} id={chartRecordId('care', plan._id)} className={focusedRecordClass(plan._id === careFocus?.recordId)}>
          <PlanCard
            plan={plan}
            options={options}
            canWrite={canWrite}
            busy={busy}
            onRun={run}
            patientId={patientId}
          />
          </div>
        ))
      )}
    </div>
  );
}

function CreatePlan({
  options,
  actorId,
  busy,
  onSubmit,
}: {
  options: CarePlanOptions;
  actorId?: string;
  busy: boolean;
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
}) {
  const ownerDefault =
    options.clinicians.find((person) => person._id === actorId)?._id || options.clinicians[0]?._id || '';

  const [formError, setFormError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    const status = String(fd.get('status') || 'draft');
    const primaryDiagnosisId = String(fd.get('primaryDiagnosisId') || '');
    if (status === 'active' && !primaryDiagnosisId) {
      setFormError('An active care plan needs a primary diagnosis');
      return;
    }
    const problemIds = fd.getAll('problemIds').map(String);
    const encounterDiagnosisIds = fd.getAll('encounterDiagnosisIds').map(String);
    try {
      await onSubmit({
        title: fd.get('title'),
        description: fd.get('description'),
        status,
        startDate: fd.get('startDate'),
        targetDate: fd.get('targetDate') || undefined,
        ownerClinicianId: fd.get('ownerClinicianId'),
        encounterId: fd.get('encounterId') || undefined,
        primaryDiagnosisId: primaryDiagnosisId || undefined,
        problemIds,
        encounterDiagnosisIds,
      });
      setFormError('');
      form.reset();
    } catch {
      setFormError('');
    }
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-900 mb-1">New care plan</h3>
      <p className="text-sm text-gray-500 mb-4">
        Start a longitudinal plan and link it to an active problem or an encounter diagnosis.
      </p>
      {formError && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">{formError}</div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Title">
          <input name="title" required className={inputCls} />
        </Field>
        <Field label="Status">
          <select name="status" defaultValue="active" className={inputCls}>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
          </select>
        </Field>
        <div className="md:col-span-2">
          <Field label="Description">
            <textarea name="description" required rows={3} className={inputCls} />
          </Field>
        </div>
        <Field label="Start date">
          <input name="startDate" type="date" required defaultValue={todayInput()} className={inputCls} />
        </Field>
        <Field label="Target date">
          <input name="targetDate" type="date" className={inputCls} />
        </Field>
        <Field label="Owner">
          <select name="ownerClinicianId" required defaultValue={ownerDefault} className={inputCls}>
            {options.clinicians.map((person) => (
              <option key={person._id} value={person._id}>
                {person.displayName}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Encounter">
          <select name="encounterId" defaultValue="" className={inputCls}>
            <option value="">Not linked</option>
            {options.encounters.map((encounter) => (
              <option key={encounter._id} value={encounter._id}>
                {encounter.chiefComplaint || 'Encounter'} · {day(encounter.openedAt)}
              </option>
            ))}
          </select>
        </Field>
        <div className="md:col-span-2">
          <DiagnosisPicker options={options} />
        </div>
      </div>
      <button type="submit" disabled={busy} className={`${btnPrimary} mt-4`}>
        Create care plan
      </button>
    </form>
  );
}

function DiagnosisPicker({
  options,
  primaryId = '',
  problemIds = [],
  diagnosisIds = [],
}: {
  options: CarePlanOptions;
  primaryId?: string;
  problemIds?: string[];
  diagnosisIds?: string[];
}) {
  return (
    <div className="space-y-3">
      <Field label="Primary diagnosis">
        <select name="primaryDiagnosisId" defaultValue={primaryId} className={inputCls}>
          <option value="">None yet</option>
          <optgroup label="Active problems">
            {options.problems.map((problem) => (
              <option key={problem._id} value={problem._id}>
                {problem.code ? `${problem.code} · ` : ''}
                {problem.display}
              </option>
            ))}
          </optgroup>
          <optgroup label="Encounter diagnoses">
            {options.diagnoses.map((diagnosis) => (
              <option key={diagnosis._id} value={diagnosis._id}>
                {diagnosis.code} · {diagnosis.description}
              </option>
            ))}
          </optgroup>
        </select>
      </Field>
      <details>
        <summary className="text-sm text-clinical-teal cursor-pointer">Also link problems and diagnoses</summary>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">Active problems</p>
            <div className="max-h-36 overflow-auto space-y-1">
              {options.problems.length === 0 && <p className="text-sm text-gray-500">No active problems.</p>}
              {options.problems.map((problem) => (
                <label key={problem._id} className="flex items-start gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    name="problemIds"
                    value={problem._id}
                    defaultChecked={problemIds.includes(problem._id)}
                    className="mt-1"
                  />
                  <span>
                    {problem.code ? `${problem.code} · ` : ''}
                    {problem.display}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">Encounter diagnoses</p>
            <div className="max-h-36 overflow-auto space-y-1">
              {options.diagnoses.length === 0 && <p className="text-sm text-gray-500">No encounter diagnoses.</p>}
              {options.diagnoses.map((diagnosis) => (
                <label key={diagnosis._id} className="flex items-start gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    name="encounterDiagnosisIds"
                    value={diagnosis._id}
                    defaultChecked={diagnosisIds.includes(diagnosis._id)}
                    className="mt-1"
                  />
                  <span>
                    {diagnosis.code} · {diagnosis.description}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}

function PlanCard({
  plan,
  options,
  canWrite,
  busy,
  patientId,
  onRun,
}: {
  plan: CarePlan;
  options: CarePlanOptions | null;
  canWrite: boolean;
  busy: boolean;
  patientId: string;
  onRun: (action: () => Promise<void>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [completedDate, setCompletedDate] = useState(todayInput());
  const [pendingStatus, setPendingStatus] = useState<CarePlanStatus | ''>('');
  const closed = plan.status === 'completed' || plan.status === 'cancelled';
  const editable = canWrite && !closed;
  const api = clinicalApi.carePlans(patientId);

  function saveStatus(status: CarePlanStatus) {
    if (status === plan.status) return;
    if (status === 'completed') {
      setPendingStatus(status);
      return;
    }
    setPendingStatus('');
    onRun(() => api.setStatus(plan._id, { status }).then(() => undefined)).catch(() => undefined);
  }

  return (
    <Panel
      title={plan.title}
      subtitle={plan.description}
    >
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {editable ? (
          <select
            className={inputCls}
            style={{ width: 'auto' }}
            value={pendingStatus || plan.status}
            disabled={busy}
            onChange={(event) => saveStatus(event.target.value as CarePlanStatus)}
          >
            {statusChoices(plan.status, PLAN_NEXT[plan.status], PLAN_STATUSES).map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        ) : (
          <StatusBadge value={plan.status} />
        )}
        {pendingStatus === 'completed' && (
          <>
            <input
              type="date"
              className={inputCls}
              style={{ width: 'auto' }}
              value={completedDate}
              onChange={(event) => setCompletedDate(event.target.value)}
            />
            <button
              type="button"
              className={btnPrimary}
              disabled={busy}
              onClick={() =>
                onRun(() =>
                  api.setStatus(plan._id, { status: 'completed', completedDate }).then(() => undefined)
                ).catch(() => undefined)
              }
            >
              Complete plan
            </button>
          </>
        )}
        {editable && options && (
          <button type="button" className={btnText} onClick={() => setEditing((open) => !open)}>
            {editing ? 'Close editor' : 'Edit plan'}
          </button>
        )}
      </div>
      <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm mb-4">
        <div>
          <dt className="text-gray-500">Owner</dt>
          <dd>{providerName(plan.ownerClinicianId)}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Start</dt>
          <dd>{day(plan.startDate)}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Target</dt>
          <dd>{day(plan.targetDate)}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Completed</dt>
          <dd>{day(plan.completedDate)}</dd>
        </div>
      </dl>

      {editing && options && (
        <EditPlan
          plan={plan}
          options={options}
          busy={busy}
          onSave={(body) => onRun(() => api.update(plan._id, body).then(() => setEditing(false)))}
        />
      )}

      <h3 className="text-sm font-medium text-gray-900 mb-2">Linked diagnoses</h3>
      {(plan.linkedDiagnoses || []).length === 0 ? (
        <p className="text-sm text-gray-500 mb-4">No diagnosis is linked yet.</p>
      ) : (
        <ul className="space-y-1 mb-4">
          {(plan.linkedDiagnoses || []).map((item) => (
            <li key={`${item.kind}-${item.id}`} className="flex flex-wrap items-center gap-2 text-sm">
              <span>{item.label}</span>
              <span className="text-xs text-gray-500">{item.kind === 'problem' ? 'Problem' : 'Encounter diagnosis'}</span>
              {item.primary && <span className="text-xs font-medium text-clinical-teal">Primary</span>}
            </li>
          ))}
        </ul>
      )}

      <GoalList plan={plan} editable={editable} busy={busy} patientId={patientId} onRun={onRun} />
      <InterventionList plan={plan} editable={editable} busy={busy} patientId={patientId} onRun={onRun} />
      <RelatedChart plan={plan} />
      <ProgressList
        plan={plan}
        canWrite={canWrite && plan.status !== 'cancelled'}
        busy={busy}
        onAdd={(note) => onRun(() => api.addProgress(plan._id, { note }).then(() => undefined))}
      />
      <h3 className="text-sm font-medium text-gray-900 mt-6 mb-2">Plan activity</h3>
      {(plan.timeline || []).length === 0 ? (
        <p className="text-sm text-gray-500">Activity appears after the plan, a goal, or an intervention is recorded.</p>
      ) : (
        <ol className="space-y-3">
          {(plan.timeline || []).map((point, index) => (
            <li key={`${point.action}-${point.at}-${index}`} className="flex gap-3 text-sm">
              <div className="w-36 shrink-0 text-gray-500">{formatEncounterWhen(point.at)}</div>
              <div>
                <div className="font-medium text-gray-900">{point.label}</div>
                <div className="text-gray-600">{point.detail}</div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function EditPlan({
  plan,
  options,
  busy,
  onSave,
}: {
  plan: CarePlan;
  options: CarePlanOptions;
  busy: boolean;
  onSave: (body: Record<string, unknown>) => Promise<void>;
}) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    try {
      await onSave({
        title: fd.get('title'),
        description: fd.get('description'),
        startDate: fd.get('startDate'),
        targetDate: fd.get('targetDate') || null,
        ownerClinicianId: fd.get('ownerClinicianId'),
        encounterId: fd.get('encounterId') || null,
        primaryDiagnosisId: fd.get('primaryDiagnosisId') || null,
        problemIds: fd.getAll('problemIds').map(String),
        encounterDiagnosisIds: fd.getAll('encounterDiagnosisIds').map(String),
      });
    } catch {
      // The plan panel shows the error.
    }
  }

  return (
    <form onSubmit={submit} className="mb-6 border border-gray-200 rounded-lg p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Title">
          <input name="title" required defaultValue={plan.title} className={inputCls} />
        </Field>
        <Field label="Owner">
          <select name="ownerClinicianId" required defaultValue={refId(plan.ownerClinicianId)} className={inputCls}>
            {options.clinicians.map((person) => (
              <option key={person._id} value={person._id}>
                {person.displayName}
              </option>
            ))}
          </select>
        </Field>
        <div className="md:col-span-2">
          <Field label="Description">
            <textarea name="description" required rows={3} defaultValue={plan.description || ''} className={inputCls} />
          </Field>
        </div>
        <Field label="Start date">
          <input name="startDate" type="date" required defaultValue={plan.startDate?.slice(0, 10) || ''} className={inputCls} />
        </Field>
        <Field label="Target date">
          <input name="targetDate" type="date" defaultValue={plan.targetDate?.slice(0, 10) || ''} className={inputCls} />
        </Field>
        <Field label="Encounter">
          <select name="encounterId" defaultValue={refId(plan.encounterId)} className={inputCls}>
            <option value="">Not linked</option>
            {options.encounters.map((encounter) => (
              <option key={encounter._id} value={encounter._id}>
                {encounter.chiefComplaint || 'Encounter'} · {day(encounter.openedAt)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <DiagnosisPicker
        options={options}
        primaryId={plan.primaryDiagnosisId || ''}
        problemIds={ids(plan.problemIds)}
        diagnosisIds={ids(plan.encounterDiagnosisIds)}
      />
      <button type="submit" disabled={busy} className={btnPrimary}>
        Save plan
      </button>
    </form>
  );
}

function GoalList({
  plan,
  editable,
  busy,
  patientId,
  onRun,
}: {
  plan: CarePlan;
  editable: boolean;
  busy: boolean;
  patientId: string;
  onRun: (action: () => Promise<void>) => Promise<void>;
}) {
  const goals = plan.goals || [];
  const api = clinicalApi.carePlans(patientId);

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    try {
      await onRun(async () => {
        await api.addGoal(plan._id, {
          description: fd.get('description'),
          targetValue: fd.get('targetValue') || undefined,
          targetDate: fd.get('targetDate'),
          status: fd.get('status'),
        });
        form.reset();
      });
    } catch {
      // The plan panel shows the error.
    }
  }

  return (
    <section className="mb-6">
      <h3 className="text-sm font-medium text-gray-900 mb-2">Goals</h3>
      {goals.length === 0 ? (
        <p className="text-sm text-gray-500 mb-3">No goals yet.</p>
      ) : (
        <ul className="space-y-2 mb-3">
          {goals.map((goal) => (
            <li key={goal._id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className={goal.overdue ? 'text-amber-800' : 'text-gray-900'}>
                {goal.description}
                {goal.targetValue ? ` · ${goal.targetValue}` : ''} · {day(goal.targetDate)}
              </span>
              {goal.overdue && <span className="text-xs font-medium text-amber-700">Overdue</span>}
              {editable && GOAL_NEXT[goal.status].length > 0 ? (
                <select
                  className={inputCls}
                  style={{ width: 'auto' }}
                  value={goal.status}
                  disabled={busy}
                  onChange={(event) =>
                    onRun(() =>
                      api.updateGoal(plan._id, goal._id, { status: event.target.value }).then(() => undefined)
                    ).catch(() => undefined)
                  }
                >
                  {statusChoices(
                    goal.status,
                    GOAL_NEXT[goal.status],
                    [
                      { value: 'not_started' as const, label: 'Not Started' },
                      { value: 'in_progress' as const, label: 'In Progress' },
                      { value: 'achieved' as const, label: 'Achieved' },
                      { value: 'cancelled' as const, label: 'Cancelled' },
                    ]
                  ).map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              ) : (
                <StatusBadge value={goal.status} />
              )}
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <form onSubmit={add} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input name="description" required placeholder="Goal" className={inputCls} />
          <input name="targetValue" placeholder="Target value" className={inputCls} />
          <input name="targetDate" type="date" required className={inputCls} />
          <div className="flex gap-2">
            <select name="status" defaultValue="not_started" className={inputCls}>
              <option value="not_started">Not Started</option>
              <option value="in_progress">In Progress</option>
              <option value="achieved">Achieved</option>
            </select>
            <button type="submit" disabled={busy} className={btnGhost}>
              Add
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function InterventionList({
  plan,
  editable,
  busy,
  patientId,
  onRun,
}: {
  plan: CarePlan;
  editable: boolean;
  busy: boolean;
  patientId: string;
  onRun: (action: () => Promise<void>) => Promise<void>;
}) {
  const items = plan.interventions || [];
  const api = clinicalApi.carePlans(patientId);

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    try {
      await onRun(async () => {
        await api.addIntervention(plan._id, {
          description: fd.get('description'),
          assignedRole: fd.get('assignedRole'),
          dueDate: fd.get('dueDate'),
          status: fd.get('status'),
        });
        form.reset();
      });
    } catch {
      // The plan panel shows the error.
    }
  }

  return (
    <section className="mb-6">
      <h3 className="text-sm font-medium text-gray-900 mb-2">Interventions</h3>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500 mb-3">No interventions yet.</p>
      ) : (
        <ul className="space-y-2 mb-3">
          {items.map((item) => (
            <li key={item._id} className="flex flex-wrap items-center gap-2 text-sm">
              <span>
                {item.description} · {ROLES.find((role) => role.value === item.assignedRole)?.label || item.assignedRole} ·{' '}
                {day(item.dueDate)}
              </span>
              {item.overdue && <span className="text-xs font-medium text-amber-700">Overdue</span>}
              {editable && INTERVENTION_NEXT[item.status].length > 0 ? (
                <select
                  className={inputCls}
                  style={{ width: 'auto' }}
                  value={item.status}
                  disabled={busy}
                  onChange={(event) =>
                    onRun(() =>
                      api
                        .updateIntervention(plan._id, item._id, { status: event.target.value })
                        .then(() => undefined)
                    ).catch(() => undefined)
                  }
                >
                  {statusChoices(
                    item.status,
                    INTERVENTION_NEXT[item.status],
                    [
                      { value: 'planned' as const, label: 'Planned' },
                      { value: 'active' as const, label: 'Active' },
                      { value: 'completed' as const, label: 'Completed' },
                      { value: 'cancelled' as const, label: 'Cancelled' },
                    ]
                  ).map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {choice.label}
                    </option>
                  ))}
                </select>
              ) : (
                <StatusBadge value={item.status} />
              )}
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <form onSubmit={add} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input name="description" required placeholder="Intervention" className={inputCls} />
          <select name="assignedRole" defaultValue="nurse" className={inputCls}>
            {ROLES.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
          <input name="dueDate" type="date" required className={inputCls} />
          <div className="flex gap-2">
            <select name="status" defaultValue="planned" className={inputCls}>
              <option value="planned">Planned</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
            <button type="submit" disabled={busy} className={btnGhost}>
              Add
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function RelatedChart({ plan }: { plan: CarePlan }) {
  const medications = plan.relatedMedications || [];
  const orders = plan.relatedOrders || [];
  const results = plan.recentResults || [];
  return (
    <section className="mb-2">
      <h3 className="text-sm font-medium text-gray-900 mb-1">Related chart</h3>
      <p className="text-xs text-gray-500 mb-3">
        Medications, orders, and results are read-only links from the same problem, diagnosis, or encounter.
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div>
          <h4 className="text-xs font-medium text-gray-600 mb-2">Medications</h4>
          {medications.length === 0 ? (
            <p className="text-sm text-gray-500">None linked.</p>
          ) : (
            <ul className="space-y-2">
              {medications.map((item) => (
                <li key={item._id} className="text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span>{item.name}</span>
                    <StatusBadge value={item.status} />
                  </div>
                  <div className="text-gray-600">
                    {[item.dose, item.frequency].filter(Boolean).join(' · ') || '—'}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h4 className="text-xs font-medium text-gray-600 mb-2">Orders</h4>
          {orders.length === 0 ? (
            <p className="text-sm text-gray-500">None linked.</p>
          ) : (
            <ul className="space-y-2">
              {orders.map((item) => (
                <li key={item._id} className="text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span>{item.orderName}</span>
                    <StatusBadge value={item.status} />
                  </div>
                  <div className="text-gray-600">
                    {item.orderType} · {item.priority}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h4 className="text-xs font-medium text-gray-600 mb-2">Recent results</h4>
          {results.length === 0 ? (
            <p className="text-sm text-gray-500">None linked.</p>
          ) : (
            <ul className="space-y-2">
              {results.map((item) => (
                <li key={item._id} className="text-sm">
                  <div>
                    {item.resultType}: {item.value}
                    {item.unit ? ` ${item.unit}` : ''}
                  </div>
                  <div className="text-gray-600">
                    {item.orderName} · {day(item.resultDate)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function ProgressList({
  plan,
  canWrite,
  busy,
  onAdd,
}: {
  plan: CarePlan;
  canWrite: boolean;
  busy: boolean;
  onAdd: (note: string) => Promise<void>;
}) {
  const notes = plan.progress || [];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const note = String(new FormData(form).get('note') || '');
    try {
      await onAdd(note);
      form.reset();
    } catch {
      // The plan panel shows the error.
    }
  }

  return (
    <section className="mt-6">
      <h3 className="text-sm font-medium text-gray-900 mb-2">Progress</h3>
      {notes.length === 0 ? (
        <p className="text-sm text-gray-500 mb-3">No progress notes yet.</p>
      ) : (
        <ol className="space-y-3 mb-4">
          {notes.map((note, index) => (
            <li key={note._id || `${note.at}-${index}`} className="text-sm">
              <div className="text-xs text-gray-500">
                {providerName(note.authorId)} · {formatEncounterWhen(note.at)}
              </div>
              <p className="text-gray-800 whitespace-pre-wrap mt-1">{note.note}</p>
            </li>
          ))}
        </ol>
      )}
      {canWrite && (
        <form onSubmit={submit}>
          <textarea name="note" required rows={3} placeholder="Progress note" className={inputCls} />
          <button type="submit" disabled={busy} className={`${btnPrimary} mt-3`}>
            Add progress note
          </button>
        </form>
      )}
    </section>
  );
}
