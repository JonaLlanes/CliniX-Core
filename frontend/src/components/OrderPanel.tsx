import { FormEvent, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  clinicalApi,
  encountersApi,
  type CareTeamMember,
  type Condition,
  type Encounter,
  type EncounterDiagnosis,
  type LinkedDiagnosis,
  type LinkedEncounter,
  type LinkedProblem,
  type Order,
  type OrderInput,
  type OrderPriority,
  type OrderResult,
  type OrderStatus,
  type OrderSummary as OrderSummaryData,
  type OrderType,
  type ResultStatus,
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
const btnDanger = 'text-sm text-red-700 hover:underline disabled:opacity-50';

const ORDER_TYPES: { value: OrderType; label: string }[] = [
  { value: 'laboratory', label: 'Laboratory' },
  { value: 'diagnostic_imaging', label: 'Diagnostic Imaging' },
  { value: 'procedure', label: 'Procedure' },
];

const PRIORITIES: { value: OrderPriority; label: string }[] = [
  { value: 'routine', label: 'Routine' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'stat', label: 'Stat' },
];

const RESULT_STATUSES: { value: ResultStatus; label: string }[] = [
  { value: 'preliminary', label: 'Preliminary' },
  { value: 'final', label: 'Final' },
  { value: 'corrected', label: 'Corrected' },
];

const PRIORITY_RANK: Record<OrderPriority, number> = { stat: 0, urgent: 1, routine: 2 };

type Section = 'active' | 'completed' | 'results';
type StatusAction = 'ordered' | 'scheduled' | 'collected' | 'completed';

type Draft = {
  encounterId: string;
  diagnosisId: string;
  conditionId: string;
  orderedBy: string;
  orderType: OrderType;
  orderName: string;
  priority: OrderPriority;
  clinicalReason: string;
  instructions: string;
};

type ResultDraft = {
  resultType: string;
  value: string;
  unit: string;
  referenceRange: string;
  resultDate: string;
  interpretation: string;
  status: ResultStatus;
};

type Pending =
  | { kind: 'status'; order: Order; status: StatusAction }
  | { kind: 'cancel'; order: Order }
  | { kind: 'result'; order: Order };

const STATUS_COPY: Record<StatusAction, { title: string; submit: string; hint: string }> = {
  ordered: {
    title: 'Place order',
    submit: 'Place order',
    hint: 'Placing the order records it on the chart timeline.',
  },
  scheduled: {
    title: 'Schedule order',
    submit: 'Schedule',
    hint: 'Record when this order was scheduled.',
  },
  collected: {
    title: 'Record collection',
    submit: 'Mark collected',
    hint: 'For a laboratory order this is the specimen collection time.',
  },
  completed: {
    title: 'Complete order',
    submit: 'Complete order',
    hint: 'Complete the order after a result is on the chart.',
  },
};

function messageOf(err: unknown) {
  return err instanceof Error ? err.message : 'Request failed';
}

function nowInput() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function emptyDraft(orderedBy = ''): Draft {
  return {
    encounterId: '',
    diagnosisId: '',
    conditionId: '',
    orderedBy,
    orderType: 'laboratory',
    orderName: '',
    priority: 'routine',
    clinicalReason: '',
    instructions: '',
  };
}

function emptyResult(): ResultDraft {
  return {
    resultType: '',
    value: '',
    unit: '',
    referenceRange: '',
    resultDate: nowInput(),
    interpretation: '',
    status: 'final',
  };
}

function refId(value: unknown) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && '_id' in value) return String((value as { _id: unknown })._id);
  return '';
}

function diagnosisText(value?: LinkedDiagnosis | string | null) {
  if (!value || typeof value === 'string') return value ? 'Linked diagnosis' : '—';
  return [value.code, value.description].filter(Boolean).join(' · ') || 'Linked diagnosis';
}

function encounterText(value?: LinkedEncounter | string | null) {
  if (!value || typeof value === 'string') return value ? 'Linked encounter' : '—';
  const when = value.openedAt ? formatEncounterWhen(value.openedAt) : '';
  return [value.chiefComplaint, when].filter(Boolean).join(' · ') || 'Linked encounter';
}

function problemText(value?: LinkedProblem | string | null) {
  if (!value || typeof value === 'string') return '';
  return [value.display, value.code].filter(Boolean).join(' · ');
}

function resultValue(result: { value: string; unit?: string | null }) {
  return [result.value, result.unit].filter(Boolean).join(' ');
}

function byPriority(a: Order, b: Order) {
  const rank = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (rank) return rank;
  const aTime = new Date(a.orderedAt || a.createdAt || 0).getTime();
  const bTime = new Date(b.orderedAt || b.createdAt || 0).getTime();
  return bTime - aTime;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      {children}
    </label>
  );
}

function OrderCard({
  order,
  canWrite,
  onAction,
  focused = false,
}: {
  order: Order;
  canWrite: boolean;
  onAction: (pending: Pending) => void;
  focused?: boolean;
}) {
  const problem = problemText(order.conditionId);
  const collectLabel = order.orderType === 'laboratory' ? 'Mark specimen collected' : 'Mark collected';
  return (
    <li id={chartRecordId('order', order._id)} className={`py-4 ${focusedRecordClass(focused)}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-medium text-gray-900">{order.orderName}</div>
          <div className="mt-1 flex flex-wrap gap-2">
            <StatusBadge value={order.orderType} />
            <StatusBadge value={order.priority} />
            <StatusBadge value={order.status} />
          </div>
        </div>
        <div className="text-xs text-gray-500">
          {order.orderedAt ? `Ordered ${formatEncounterWhen(order.orderedAt)}` : 'Not placed yet'}
          {order.orderedBy ? ` · ${providerName(order.orderedBy)}` : ''}
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-xs text-gray-500">Diagnosis</dt>
          <dd className="text-gray-800">{diagnosisText(order.diagnosisId)}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Encounter</dt>
          <dd className="text-gray-800">{encounterText(order.encounterId)}</dd>
        </div>
        {problem && (
          <div>
            <dt className="text-xs text-gray-500">Problem list</dt>
            <dd className="text-gray-800">{problem}</dd>
          </div>
        )}
        <div className={problem ? '' : 'md:col-span-2'}>
          <dt className="text-xs text-gray-500">Clinical reason</dt>
          <dd className="text-gray-800">{order.clinicalReason}</dd>
        </div>
      </dl>
      {order.instructions && (
        <p className="text-sm text-gray-600 mt-2">Instructions: {order.instructions}</p>
      )}
      {!!order.results?.length && (
        <ul className="mt-3 space-y-2">
          {order.results.map((result) => (
            <li key={result._id} className="text-sm text-gray-700">
              <span className="mr-2">
                <StatusBadge value={result.status} />
              </span>
              {result.resultType}: {resultValue(result)}
              {result.referenceRange ? ` (range ${result.referenceRange})` : ''}
              {' · '}
              {formatEncounterWhen(result.resultDate)}
              {result.interpretation ? ` · ${result.interpretation}` : ''}
            </li>
          ))}
        </ul>
      )}
      {!!order.statusHistory?.length && (
        <ol className="mt-3 space-y-1">
          {order.statusHistory.map((event) => (
            <li key={event._id || `${event.status}-${event.at}`} className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
              <StatusBadge value={event.status} />
              <span>{formatEncounterWhen(event.at)}</span>
              <span>{providerName(event.actorId)}</span>
              {event.note && <span>{event.note}</span>}
            </li>
          ))}
        </ol>
      )}
      {canWrite && (
        <div className="mt-3 flex flex-wrap gap-3">
          {order.status === 'draft' && (
            <button type="button" className={btnText} onClick={() => onAction({ kind: 'status', order, status: 'ordered' })}>
              Place order
            </button>
          )}
          {order.status === 'ordered' && (
            <button type="button" className={btnText} onClick={() => onAction({ kind: 'status', order, status: 'scheduled' })}>
              Schedule
            </button>
          )}
          {(order.status === 'ordered' || order.status === 'scheduled') && (
            <button type="button" className={btnText} onClick={() => onAction({ kind: 'status', order, status: 'collected' })}>
              {collectLabel}
            </button>
          )}
          {(['ordered', 'scheduled', 'collected', 'resulted', 'completed'] as OrderStatus[]).includes(order.status) && (
            <button type="button" className={btnText} onClick={() => onAction({ kind: 'result', order })}>
              {order.status === 'resulted' || order.status === 'completed' ? 'Add result' : 'Enter result'}
            </button>
          )}
          {order.status === 'resulted' && (
            <button type="button" className={btnText} onClick={() => onAction({ kind: 'status', order, status: 'completed' })}>
              Complete order
            </button>
          )}
          {order.status !== 'completed' && order.status !== 'cancelled' && (
            <button type="button" className={btnDanger} onClick={() => onAction({ kind: 'cancel', order })}>
              Cancel order
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function OrderGroup({
  title,
  subtitle,
  orders,
  canWrite,
  empty,
  onAction,
  focusId = '',
}: {
  title: string;
  subtitle: string;
  orders: Order[];
  canWrite: boolean;
  empty: string;
  onAction: (pending: Pending) => void;
  focusId?: string;
}) {
  return (
    <Panel title={title} subtitle={subtitle}>
      {orders.length === 0 ? (
        <EmptyState text={empty} />
      ) : (
        <ul className="divide-y divide-gray-100">
          {orders.map((order) => (
            <OrderCard
              key={order._id}
              order={order}
              canWrite={canWrite}
              onAction={onAction}
              focused={order._id === focusId}
            />
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function OrderPanel({
  patientId,
  canWrite,
  actorId,
  focusToken = 0,
  recordFocus = null,
}: {
  patientId: string;
  canWrite: boolean;
  actorId?: string;
  focusToken?: number;
  recordFocus?: ChartRecordFocus | null;
}) {
  const [section, setSection] = useState<Section>('active');
  const [active, setActive] = useState<Order[]>([]);
  const [closed, setClosed] = useState<Order[]>([]);
  const [results, setResults] = useState<OrderResult[]>([]);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [diagnoses, setDiagnoses] = useState<EncounterDiagnosis[]>([]);
  const [problems, setProblems] = useState<Condition[]>([]);
  const [clinicians, setClinicians] = useState<CareTeamMember[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [pending, setPending] = useState<Pending | null>(null);
  const [actionAt, setActionAt] = useState(nowInput());
  const [actionNote, setActionNote] = useState('');
  const [resultDraft, setResultDraft] = useState<ResultDraft>(emptyResult());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const intent = useRef<'draft' | 'ordered'>('ordered');

  const encounterDiagnoses = diagnoses.filter((item) => refId(item.encounterId) === draft.encounterId);

  async function load() {
    const [activePage, closedPage, resultPage, encounterPage, diagnosisPage, problemPage, people] = await Promise.all([
      clinicalApi.orders(patientId).list('?view=active&limit=100'),
      clinicalApi.orders(patientId).list('?view=completed&limit=100'),
      clinicalApi.orders(patientId).results('?limit=100'),
      encountersApi.list(patientId),
      clinicalApi.diagnoses(patientId).list('?limit=100'),
      clinicalApi.conditions(patientId).list('?limit=100'),
      clinicalApi.orders(patientId).clinicians(),
    ]);
    setActive([...activePage.data].sort(byPriority));
    setClosed([...closedPage.data].sort(byPriority));
    setResults(resultPage.data);
    setEncounters(encounterPage.data);
    setDiagnoses(diagnosisPage.data);
    setProblems(problemPage.data);
    setClinicians(people.data);
    setDraft((current) => {
      if (current.orderName || current.encounterId || current.clinicalReason) return current;
      const orderedBy = people.data.some((person) => person._id === actorId) ? actorId || '' : current.orderedBy;
      const encounterId = encounterPage.data.length === 1 ? encounterPage.data[0]._id : '';
      return { ...emptyDraft(orderedBy), encounterId };
    });
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

  useEffect(() => {
    if (!focusToken || recordFocus?.tab === 'orders') return;
    setSection('active');
  }, [focusToken, recordFocus]);

  const orderFocusToken = recordFocus?.tab === 'orders' ? recordFocus.token : 0;
  const orderFocusId = recordFocus?.tab === 'orders' ? recordFocus.recordId : '';
  const seenOrderFocus = useRef(0);
  useEffect(() => {
    if (!orderFocusToken || !orderFocusId || loading) return;
    if (seenOrderFocus.current === orderFocusToken) return;
    const order = [...active, ...closed].find((item) => item._id === orderFocusId);
    if (!order && active.length === 0 && closed.length === 0) return;
    seenOrderFocus.current = orderFocusToken;
    if (order) setSection(order.status === 'completed' || order.status === 'cancelled' ? 'completed' : 'active');
    return watchChartRecord('order', orderFocusId);
  }, [orderFocusToken, orderFocusId, loading, active, closed]);

  useEffect(() => {
    if (!focusToken || loading || section !== 'active' || recordFocus?.tab === 'orders') return;
    document.getElementById('chart-new-order')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [focusToken, loading, section, recordFocus]);

  function openAction(next: Pending) {
    setPending(next);
    setActionAt(nowInput());
    setActionNote('');
    setResultDraft(emptyResult());
    setError('');
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const body: OrderInput = {
      encounterId: draft.encounterId,
      diagnosisId: draft.diagnosisId,
      conditionId: draft.conditionId || null,
      orderedBy: draft.orderedBy,
      orderType: draft.orderType,
      orderName: draft.orderName.trim(),
      priority: draft.priority,
      clinicalReason: draft.clinicalReason.trim(),
      instructions: draft.instructions.trim() || undefined,
      status: intent.current,
    };
    try {
      await clinicalApi.orders(patientId).create(body);
      const orderedBy = draft.orderedBy;
      const encounterId = draft.encounterId;
      setDraft({ ...emptyDraft(orderedBy), encounterId });
      await load();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSaving(false);
    }
  }

  async function onPending(event: FormEvent) {
    event.preventDefault();
    if (!pending) return;
    setSaving(true);
    setError('');
    try {
      const api = clinicalApi.orders(patientId);
      if (pending.kind === 'status') {
        await api.setStatus(pending.order._id, {
          status: pending.status,
          at: actionAt,
          note: actionNote.trim() || undefined,
        });
      } else if (pending.kind === 'cancel') {
        await api.cancel(pending.order._id, { reason: actionNote.trim(), at: actionAt });
      } else {
        await api.addResult(pending.order._id, {
          resultType: resultDraft.resultType.trim(),
          value: resultDraft.value.trim(),
          unit: resultDraft.unit.trim() || undefined,
          referenceRange: resultDraft.referenceRange.trim() || undefined,
          resultDate: resultDraft.resultDate,
          interpretation: resultDraft.interpretation.trim() || undefined,
          status: resultDraft.status,
        });
      }
      setPending(null);
      await load();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSaving(false);
    }
  }

  const completed = closed.filter((order) => order.status === 'completed');
  const cancelled = closed.filter((order) => order.status === 'cancelled');
  const activity = [...active, ...closed]
    .flatMap((order) => order.timeline || [])
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const tabs: { id: Section; label: string }[] = [
    { id: 'active', label: 'Active Orders' },
    { id: 'completed', label: 'Completed Orders' },
    { id: 'results', label: 'Results' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1 border-b border-gray-200" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={section === tab.id}
            onClick={() => setSection(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              section === tab.id
                ? 'border-clinical-teal text-clinical-teal'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {section === 'active' && canWrite && (
        <form id="chart-new-order" onSubmit={onCreate} className="scroll-mt-64 bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <div>
            <h2 className="font-semibold text-gray-900">New order</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Local laboratory, imaging, and procedure orders for this chart.
            </p>
          </div>
          {encounters.length === 0 ? (
            <p className="text-sm text-gray-600">Open an encounter before placing an order.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Encounter">
                <select
                  value={draft.encounterId}
                  onChange={(event) => {
                    const encounterId = event.target.value;
                    setDraft((current) => ({
                      ...current,
                      encounterId,
                      diagnosisId: diagnoses.some(
                        (item) => refId(item.encounterId) === encounterId && item._id === current.diagnosisId
                      )
                        ? current.diagnosisId
                        : '',
                    }));
                  }}
                  className={inputCls}
                  required
                >
                  <option value="">Select an encounter</option>
                  {encounters.map((encounter) => (
                    <option key={encounter._id} value={encounter._id}>
                      {encounter.chiefComplaint} · {formatEncounterWhen(encounter.openedAt)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Encounter diagnosis">
                <select
                  value={draft.diagnosisId}
                  onChange={(event) => setDraft((current) => ({ ...current, diagnosisId: event.target.value }))}
                  className={inputCls}
                  required
                  disabled={!draft.encounterId}
                >
                  <option value="">Select a diagnosis</option>
                  {encounterDiagnoses.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.code} · {item.description}
                      {item.primaryDiagnosis ? ' · Primary' : ''}
                    </option>
                  ))}
                </select>
              </Field>
              {draft.encounterId && encounterDiagnoses.length === 0 && (
                <p className="md:col-span-2 text-sm text-gray-600">
                  Record a diagnosis on this encounter before placing an order.
                </p>
              )}
              <Field label="Problem list item">
                <select
                  value={draft.conditionId}
                  onChange={(event) => setDraft((current) => ({ ...current, conditionId: event.target.value }))}
                  className={inputCls}
                >
                  <option value="">No problem list item</option>
                  {problems.map((problem) => (
                    <option key={problem._id} value={problem._id}>
                      {problem.display}
                      {problem.code ? ` · ${problem.code}` : ''} · {problem.status}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Ordered by">
                <select
                  value={draft.orderedBy}
                  onChange={(event) => setDraft((current) => ({ ...current, orderedBy: event.target.value }))}
                  className={inputCls}
                  required
                >
                  <option value="">Select a clinician</option>
                  {clinicians.map((person) => (
                    <option key={person._id} value={person._id}>
                      {person.displayName}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Order type">
                <select
                  value={draft.orderType}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, orderType: event.target.value as OrderType }))
                  }
                  className={inputCls}
                  required
                >
                  {ORDER_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Priority">
                <select
                  value={draft.priority}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, priority: event.target.value as OrderPriority }))
                  }
                  className={inputCls}
                  required
                >
                  {PRIORITIES.map((priority) => (
                    <option key={priority.value} value={priority.value}>
                      {priority.label}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="md:col-span-2">
                <Field label="Order name">
                  <input
                    value={draft.orderName}
                    onChange={(event) => setDraft((current) => ({ ...current, orderName: event.target.value }))}
                    className={inputCls}
                    required
                    maxLength={200}
                  />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="Clinical reason">
                  <textarea
                    value={draft.clinicalReason}
                    onChange={(event) => setDraft((current) => ({ ...current, clinicalReason: event.target.value }))}
                    className={inputCls}
                    rows={2}
                    required
                    maxLength={1000}
                  />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="Instructions">
                  <textarea
                    value={draft.instructions}
                    onChange={(event) => setDraft((current) => ({ ...current, instructions: event.target.value }))}
                    className={inputCls}
                    rows={2}
                    maxLength={2000}
                  />
                </Field>
              </div>
            </div>
          )}
          {encounters.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                className={btnPrimary}
                disabled={saving}
                onClick={() => {
                  intent.current = 'ordered';
                }}
              >
                {saving ? 'Saving...' : 'Place order'}
              </button>
              <button
                type="submit"
                className={btnGhost}
                disabled={saving}
                onClick={() => {
                  intent.current = 'draft';
                }}
              >
                Save draft
              </button>
            </div>
          )}
        </form>
      )}

      {pending && (
        <form onSubmit={onPending} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <div>
            <h3 className="font-semibold text-gray-900">
              {pending.kind === 'cancel'
                ? 'Cancel order'
                : pending.kind === 'result'
                  ? 'Enter result'
                  : STATUS_COPY[pending.status].title}
            </h3>
            <p className="text-sm text-gray-600 mt-1">{pending.order.orderName}</p>
            <p className="text-xs text-gray-500 mt-1">
              {pending.kind === 'cancel'
                ? 'Cancellation stays on the order history.'
                : pending.kind === 'result'
                  ? 'Preliminary, final, and corrected results are kept as separate entries.'
                  : STATUS_COPY[pending.status].hint}
            </p>
          </div>
          {pending.kind === 'result' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Result type">
                <input
                  value={resultDraft.resultType}
                  onChange={(event) => setResultDraft((current) => ({ ...current, resultType: event.target.value }))}
                  className={inputCls}
                  required
                  maxLength={120}
                />
              </Field>
              <Field label="Status">
                <select
                  value={resultDraft.status}
                  onChange={(event) =>
                    setResultDraft((current) => ({ ...current, status: event.target.value as ResultStatus }))
                  }
                  className={inputCls}
                  required
                >
                  {RESULT_STATUSES.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Value">
                <input
                  value={resultDraft.value}
                  onChange={(event) => setResultDraft((current) => ({ ...current, value: event.target.value }))}
                  className={inputCls}
                  required
                  maxLength={500}
                />
              </Field>
              <Field label="Unit">
                <input
                  value={resultDraft.unit}
                  onChange={(event) => setResultDraft((current) => ({ ...current, unit: event.target.value }))}
                  className={inputCls}
                  maxLength={40}
                />
              </Field>
              <Field label="Reference range">
                <input
                  value={resultDraft.referenceRange}
                  onChange={(event) =>
                    setResultDraft((current) => ({ ...current, referenceRange: event.target.value }))
                  }
                  className={inputCls}
                  maxLength={120}
                />
              </Field>
              <Field label="Result date">
                <input
                  type="datetime-local"
                  value={resultDraft.resultDate}
                  onChange={(event) => setResultDraft((current) => ({ ...current, resultDate: event.target.value }))}
                  className={inputCls}
                  required
                />
              </Field>
              <div className="md:col-span-2">
                <Field label="Interpretation">
                  <textarea
                    value={resultDraft.interpretation}
                    onChange={(event) =>
                      setResultDraft((current) => ({ ...current, interpretation: event.target.value }))
                    }
                    className={inputCls}
                    rows={2}
                    maxLength={2000}
                  />
                </Field>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Field label={pending.kind === 'cancel' ? 'Reason' : 'Note'}>
                  <input
                    value={actionNote}
                    onChange={(event) => setActionNote(event.target.value)}
                    className={inputCls}
                    required={pending.kind === 'cancel'}
                    maxLength={500}
                  />
                </Field>
              </div>
              <Field label="Time">
                <input
                  type="datetime-local"
                  value={actionAt}
                  onChange={(event) => setActionAt(event.target.value)}
                  className={inputCls}
                  required
                />
              </Field>
            </div>
          )}
          <div className="flex gap-2">
            <button type="submit" className={btnPrimary} disabled={saving}>
              {saving
                ? 'Saving...'
                : pending.kind === 'cancel'
                  ? 'Cancel order'
                  : pending.kind === 'result'
                    ? 'Save result'
                    : STATUS_COPY[pending.status].submit}
            </button>
            <button type="button" className={btnGhost} onClick={() => setPending(null)}>
              Close
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading orders...</p>
      ) : (
        <>
          {section === 'active' && (
            <OrderGroup
              title="Active Orders"
              subtitle="Draft, ordered, scheduled, collected, and resulted orders"
              orders={active}
              canWrite={canWrite}
              empty="No active orders."
              onAction={openAction}
              focusId={orderFocusId}
            />
          )}
          {section === 'completed' && (
            <div className="space-y-6">
              <OrderGroup
                title="Completed Orders"
                subtitle="Orders that have been completed"
                orders={completed}
                canWrite={canWrite}
                empty="No completed orders."
                onAction={openAction}
                focusId={orderFocusId}
              />
              <OrderGroup
                title="Cancelled orders"
                subtitle="Cancelled orders remain on the chart"
                orders={cancelled}
                canWrite={canWrite}
                empty="No cancelled orders."
                onAction={openAction}
                focusId={orderFocusId}
              />
            </div>
          )}
          {section === 'results' && (
            <Panel title="Results" subtitle="Preliminary, final, and corrected results entered in the clinic">
              {results.length === 0 ? (
                <EmptyState text="No results recorded" hint="Laboratory and imaging results show up here after they are entered." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs font-medium text-gray-500 border-b border-gray-200">
                        <th className="py-2 pr-3">Order</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2 pr-3">Priority</th>
                        <th className="py-2 pr-3">Diagnosis</th>
                        <th className="py-2 pr-3">Encounter</th>
                        <th className="py-2 pr-3">Result</th>
                        <th className="py-2 pr-3">Value</th>
                        <th className="py-2 pr-3">Range</th>
                        <th className="py-2 pr-3">Interpretation</th>
                        <th className="py-2">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((result) => (
                        <tr key={result._id} className="border-b border-gray-100 align-top">
                          <td className="py-3 pr-3">
                            <div className="font-medium text-gray-900">{result.order?.orderName || 'Order'}</div>
                            {result.order && (
                              <div className="mt-1">
                                <StatusBadge value={result.order.orderType} />
                              </div>
                            )}
                          </td>
                          <td className="py-3 pr-3">
                            <StatusBadge value={result.order?.status} />
                          </td>
                          <td className="py-3 pr-3">
                            <StatusBadge value={result.order?.priority} />
                          </td>
                          <td className="py-3 pr-3 text-gray-700">{diagnosisText(result.order?.diagnosisId)}</td>
                          <td className="py-3 pr-3 text-gray-700">{encounterText(result.order?.encounterId)}</td>
                          <td className="py-3 pr-3">
                            <div className="text-gray-900">{result.resultType}</div>
                            <div className="mt-1">
                              <StatusBadge value={result.status} />
                            </div>
                          </td>
                          <td className="py-3 pr-3 text-gray-800">{resultValue(result)}</td>
                          <td className="py-3 pr-3 text-gray-700">{result.referenceRange || '—'}</td>
                          <td className="py-3 pr-3 text-gray-700">{result.interpretation || '—'}</td>
                          <td className="py-3 text-gray-600 whitespace-nowrap">
                            {formatEncounterWhen(result.resultDate)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          )}
          <Panel title="Order activity" subtitle="Placed, scheduled, collected, resulted, and completed events">
            {activity.length === 0 ? (
              <EmptyState text="Order activity appears here after an order is placed." />
            ) : (
              <ol className="space-y-3">
                {activity.map((point, index) => (
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
        </>
      )}
    </div>
  );
}

export function OrderSummary({
  patientId,
  onOpen,
}: {
  patientId: string;
  onOpen?: () => void;
}) {
  const [summary, setSummary] = useState<OrderSummaryData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    clinicalApi
      .orders(patientId)
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
    <Panel title="Orders" subtitle="Active laboratory, imaging, and procedure orders">
      {error && (
        <div className="mb-3 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">{error}</div>
      )}
      {!summary ? (
        <p className="text-sm text-gray-500">Loading orders...</p>
      ) : summary.active.length === 0 ? (
        <p className="text-sm text-gray-500">No active orders.</p>
      ) : (
        <ul className="space-y-3">
          {summary.active.map((order) => (
            <li key={order._id} className="text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-gray-900">{order.orderName}</span>
                <StatusBadge value={order.priority} />
                <StatusBadge value={order.status} />
              </div>
              <div className="text-gray-600 mt-0.5">
                {diagnosisText(order.diagnosisId)} · {encounterText(order.encounterId)}
              </div>
            </li>
          ))}
        </ul>
      )}
      {onOpen && (
        <button type="button" className={`${btnText} mt-4`} onClick={onOpen}>
          Open orders
        </button>
      )}
    </Panel>
  );
}
