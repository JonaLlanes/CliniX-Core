import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ApiError,
  clinicalApi,
  encountersApi,
  type AllergyWarning,
  type CareTeamMember,
  type Condition,
  type Encounter,
  type Medication,
  type MedicationActionInput,
  type MedicationInput,
  type MedicationTimelinePoint,
} from '../api/client';
import Panel, { EmptyState } from './Panel';
import { StatusBadge } from './StatusBadge';
import { formatEncounterWhen, providerName } from './encounterDisplay';

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm';
const labelCls = 'block text-xs font-medium text-gray-600 mb-1';
const btnPrimary =
  'px-4 py-2 bg-clinical-teal text-white rounded-lg text-sm hover:bg-clinical-teal-dark disabled:opacity-50';
const btnGhost = 'px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50';
const btnText = 'text-sm text-clinical-teal hover:underline disabled:opacity-50';

const ROUTES = [
  'oral',
  'sublingual',
  'inhalation',
  'intranasal',
  'topical',
  'transdermal',
  'ophthalmic',
  'otic',
  'rectal',
  'subcutaneous',
  'intramuscular',
  'intravenous',
];

type ActionName = 'hold' | 'resume' | 'discontinue' | 'complete';

const ACTIONS: Record<ActionName, { title: string; submit: string }> = {
  hold: { title: 'Hold medication', submit: 'Hold medication' },
  resume: { title: 'Resume medication', submit: 'Resume medication' },
  discontinue: { title: 'Discontinue medication', submit: 'Discontinue medication' },
  complete: { title: 'Complete course', submit: 'Complete course' },
};

type Draft = {
  genericName: string;
  brandName: string;
  din: string;
  strength: string;
  dosage: string;
  route: string;
  frequency: string;
  indication: string;
  startDate: string;
  prescribedBy: string;
  encounterId: string;
  conditionId: string;
  reason: string;
  date: string;
};

function messageOf(err: unknown) {
  return err instanceof Error ? err.message : 'Request failed';
}

function warningsOf(err: unknown) {
  return err instanceof ApiError && err.warnings?.length ? err.warnings : null;
}

function todayInput() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function dateInput(value?: string | null) {
  return value ? value.slice(0, 10) : '';
}

function refId(value?: string | { _id: string } | null) {
  if (!value) return '';
  return typeof value === 'string' ? value : value._id;
}

function drugKey(draft: Pick<Draft, 'genericName' | 'brandName' | 'din'>) {
  return `${draft.genericName.trim().toLowerCase()}|${draft.brandName.trim().toLowerCase()}|${draft.din.trim()}`;
}

function emptyDraft(prescribedBy = ''): Draft {
  return {
    genericName: '',
    brandName: '',
    din: '',
    strength: '',
    dosage: '',
    route: 'oral',
    frequency: '',
    indication: '',
    startDate: todayInput(),
    prescribedBy,
    encounterId: '',
    conditionId: '',
    reason: '',
    date: todayInput(),
  };
}

function draftFrom(medication: Medication): Draft {
  return {
    genericName: medication.genericName || medication.name || '',
    brandName: medication.brandName || '',
    din: medication.din || '',
    strength: medication.strength || '',
    dosage: medication.dosage || medication.dose || '',
    route: medication.route || 'oral',
    frequency: medication.frequency || '',
    indication: medication.indication || '',
    startDate: dateInput(medication.startDate),
    prescribedBy: refId(medication.prescribedBy),
    encounterId: refId(medication.encounterId),
    conditionId: refId(medication.conditionId),
    reason: '',
    date: todayInput(),
  };
}

function medicationTitle(medication: { genericName?: string; brandName?: string; name?: string }) {
  const generic = medication.genericName || medication.name || 'Medication';
  return medication.brandName ? `${generic} (${medication.brandName})` : generic;
}

function regimen(medication: Medication) {
  return [medication.strength, medication.dosage || medication.dose, medication.route, medication.frequency]
    .filter(Boolean)
    .join(' · ');
}

function blank(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function payload(draft: Draft, acknowledged: boolean): MedicationInput {
  return {
    genericName: draft.genericName.trim(),
    brandName: blank(draft.brandName),
    din: blank(draft.din),
    strength: blank(draft.strength),
    dosage: draft.dosage.trim(),
    route: draft.route.trim(),
    frequency: draft.frequency.trim(),
    indication: blank(draft.indication),
    startDate: draft.startDate,
    prescribedBy: draft.prescribedBy,
    encounterId: draft.encounterId || null,
    conditionId: draft.conditionId || null,
    reason: draft.reason.trim() || undefined,
    date: draft.date || undefined,
    allergyAcknowledgment: acknowledged ? { acknowledged: true } : undefined,
  };
}

function AllergyWarningBanner({ warnings }: { warnings: AllergyWarning[] }) {
  if (warnings.length === 0) return null;
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <p className="font-semibold">Allergy warning</p>
      <ul className="mt-2 space-y-1">
        {warnings.map((warning) => (
          <li key={warning.allergyId}>
            <span className="font-medium">{warning.substance}</span>
            {warning.reaction ? ` — ${warning.reaction}` : ''} ({warning.severity}). Matched on {warning.matchedOn}.
          </li>
        ))}
      </ul>
      <p className="mt-2">This does not stop the medication. Acknowledge the warning to continue.</p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

function MedicationForm({
  draft,
  setDraft,
  prescribers,
  encounters,
  conditions,
  warnings,
  editing,
  saving,
  error,
  onSubmit,
  onCancel,
}: {
  draft: Draft;
  setDraft: (draft: Draft) => void;
  prescribers: CareTeamMember[];
  encounters: Encounter[];
  conditions: Condition[];
  warnings: AllergyWarning[];
  editing: boolean;
  saving: boolean;
  error: string;
  onSubmit: (event: FormEvent) => void;
  onCancel?: () => void;
}) {
  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft({ ...draft, [key]: value });
  }

  return (
    <form onSubmit={onSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      <div>
        <h3 className="font-semibold text-gray-900">{editing ? 'Change medication' : 'Start medication'}</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          {editing
            ? 'A change stays on the medication timeline.'
            : 'Record the medication the patient is taking. This does not send a prescription.'}
        </p>
      </div>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">{error}</div>
      )}
      <AllergyWarningBanner warnings={warnings} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="Generic name">
          <input
            value={draft.genericName}
            onChange={(event) => set('genericName', event.target.value)}
            className={inputCls}
            required
          />
        </Field>
        <Field label="Brand name">
          <input value={draft.brandName} onChange={(event) => set('brandName', event.target.value)} className={inputCls} />
        </Field>
        <Field label="DIN">
          <input
            value={draft.din}
            onChange={(event) => set('din', event.target.value)}
            className={inputCls}
            inputMode="numeric"
            pattern="\d{8}"
            maxLength={8}
            placeholder="8 digits"
            title="DIN must be 8 digits"
          />
        </Field>
        <Field label="Strength">
          <input value={draft.strength} onChange={(event) => set('strength', event.target.value)} className={inputCls} placeholder="10 mg" />
        </Field>
        <Field label="Dosage">
          <input value={draft.dosage} onChange={(event) => set('dosage', event.target.value)} className={inputCls} required placeholder="1 tablet" />
        </Field>
        <Field label="Route">
          <input value={draft.route} onChange={(event) => set('route', event.target.value)} className={inputCls} list="medication-routes" required />
          <datalist id="medication-routes">
            {ROUTES.map((route) => (
              <option key={route} value={route} />
            ))}
          </datalist>
        </Field>
        <Field label="Frequency">
          <input
            value={draft.frequency}
            onChange={(event) => set('frequency', event.target.value)}
            className={inputCls}
            required
            placeholder="once daily"
          />
        </Field>
        <Field label="Start date">
          <input type="date" value={draft.startDate} onChange={(event) => set('startDate', event.target.value)} className={inputCls} required />
        </Field>
        <Field label="Prescribed by">
          <select value={draft.prescribedBy} onChange={(event) => set('prescribedBy', event.target.value)} className={inputCls} required>
            <option value="">Select a clinician</option>
            {prescribers.map((person) => (
              <option key={person._id} value={person._id}>
                {person.displayName}
              </option>
            ))}
          </select>
        </Field>
        <div className="md:col-span-3">
          <label className={labelCls}>Indication</label>
          <input value={draft.indication} onChange={(event) => set('indication', event.target.value)} className={inputCls} />
        </div>
        <Field label="Related diagnosis">
          <select value={draft.conditionId} onChange={(event) => set('conditionId', event.target.value)} className={inputCls}>
            <option value="">None</option>
            {conditions.map((condition) => (
              <option key={condition._id} value={condition._id}>
                {condition.display}
                {condition.code ? ` · ${condition.code}` : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Encounter">
          <select value={draft.encounterId} onChange={(event) => set('encounterId', event.target.value)} className={inputCls}>
            <option value="">None</option>
            {encounters.map((encounter) => (
              <option key={encounter._id} value={encounter._id}>
                {dateInput(encounter.openedAt)} · {encounter.chiefComplaint}
              </option>
            ))}
          </select>
        </Field>
        {editing && (
          <>
            <Field label="Change date">
              <input type="date" value={draft.date} onChange={(event) => set('date', event.target.value)} className={inputCls} required />
            </Field>
            <div className="md:col-span-3">
              <label className={labelCls}>Reason for change</label>
              <input value={draft.reason} onChange={(event) => set('reason', event.target.value)} className={inputCls} required />
            </div>
          </>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={btnPrimary} disabled={saving}>
          {saving
            ? 'Saving...'
            : warnings.length
              ? editing
                ? 'Acknowledge and save'
                : 'Acknowledge and start'
              : editing
                ? 'Save changes'
                : 'Start medication'}
        </button>
        {onCancel && (
          <button type="button" className={btnGhost} onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function TimelineList({ points }: { points: MedicationTimelinePoint[] }) {
  if (points.length === 0) return <EmptyState text="No medication events yet." />;
  const ordered = points.slice().sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return (
    <ol className="space-y-3">
      {ordered.map((point, index) => (
        <li key={`${point.action}-${point.at}-${index}`} className="flex gap-3 text-sm">
          <div className="w-36 shrink-0 text-gray-500">{formatEncounterWhen(point.at)}</div>
          <div>
            <div className="font-medium text-gray-900">{point.label}</div>
            {point.detail && <div className="text-gray-600">{point.detail}</div>}
            {providerName(point.clinicianId) !== '—' && (
              <div className="text-xs text-gray-500 mt-0.5">{providerName(point.clinicianId)}</div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function MedicationRow({
  medication,
  canWrite,
  onAction,
  onEdit,
}: {
  medication: Medication;
  canWrite: boolean;
  onAction: (medication: Medication, action: ActionName) => void;
  onEdit: (medication: Medication) => void;
}) {
  const [open, setOpen] = useState(false);
  const diagnosis =
    medication.conditionId && typeof medication.conditionId === 'object' ? medication.conditionId.display : '';
  const current = medication.status === 'active' || medication.status === 'on-hold';

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-medium text-gray-900">{medicationTitle(medication)}</div>
          <div className="text-sm text-gray-600 mt-0.5">
            {medication.din ? `DIN ${medication.din} · ` : ''}
            {regimen(medication)}
          </div>
          {medication.indication && <div className="text-sm text-gray-600 mt-0.5">Indication: {medication.indication}</div>}
          {diagnosis && <div className="text-sm text-gray-600 mt-0.5">Related diagnosis: {diagnosis}</div>}
          {medication.adherenceNotes && <div className="text-xs text-gray-500 mt-1">{medication.adherenceNotes}</div>}
          <div className="text-xs text-gray-500 mt-1">
            Started {dateInput(medication.startDate)}
            {medication.endDate ? ` · Ended ${dateInput(medication.endDate)}` : ''} · Prescribed by{' '}
            {providerName(medication.prescribedBy)}
          </div>
        </div>
        <StatusBadge value={medication.status} />
      </div>
      <div className="mt-3 flex flex-wrap gap-3">
        {canWrite && medication.status === 'active' && (
          <button type="button" className={btnText} onClick={() => onAction(medication, 'hold')}>
            Hold
          </button>
        )}
        {canWrite && medication.status === 'on-hold' && (
          <button type="button" className={btnText} onClick={() => onAction(medication, 'resume')}>
            Resume
          </button>
        )}
        {canWrite && current && (
          <>
            <button type="button" className={btnText} onClick={() => onAction(medication, 'complete')}>
              Complete course
            </button>
            <button type="button" className={btnText} onClick={() => onAction(medication, 'discontinue')}>
              Discontinue
            </button>
          </>
        )}
        {canWrite && (
          <button type="button" className={btnText} onClick={() => onEdit(medication)}>
            Change
          </button>
        )}
        <button type="button" className={btnText} onClick={() => setOpen((value) => !value)}>
          {open ? 'Hide history' : 'History'}
        </button>
      </div>
      {open && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <TimelineList points={medication.timeline || []} />
        </div>
      )}
    </li>
  );
}

function MedicationGroup({
  title,
  subtitle,
  items,
  canWrite,
  onAction,
  onEdit,
}: {
  title: string;
  subtitle: string;
  items: Medication[];
  canWrite: boolean;
  onAction: (medication: Medication, action: ActionName) => void;
  onEdit: (medication: Medication) => void;
}) {
  return (
    <Panel title={title} subtitle={subtitle}>
      {items.length === 0 ? (
        <EmptyState text={`No ${title.toLowerCase()}.`} />
      ) : (
        <ul className="divide-y divide-gray-100">
          {items.map((medication) => (
            <MedicationRow
              key={medication._id}
              medication={medication}
              canWrite={canWrite}
              onAction={onAction}
              onEdit={onEdit}
            />
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function MedicationPanel({
  patientId,
  canWrite,
  actorId,
}: {
  patientId: string;
  canWrite: boolean;
  actorId?: string;
}) {
  const [items, setItems] = useState<Medication[]>([]);
  const [prescribers, setPrescribers] = useState<CareTeamMember[]>([]);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<AllergyWarning[]>([]);
  const [warningKey, setWarningKey] = useState('');
  const [actionTarget, setActionTarget] = useState<{ medication: Medication; action: ActionName } | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [actionDate, setActionDate] = useState(todayInput());
  const [actionClinician, setActionClinician] = useState(actorId || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const actors = useMemo(() => {
    if (!actorId || prescribers.some((person) => person._id === actorId)) return prescribers;
    return [{ _id: actorId, displayName: 'Current user', role: '' }, ...prescribers];
  }, [actorId, prescribers]);

  async function load() {
    const [medicationPage, people, encounterPage, conditionPage] = await Promise.all([
      clinicalApi.medications(patientId).list('?limit=100'),
      clinicalApi.medications(patientId).clinicians(),
      encountersApi.list(patientId),
      clinicalApi.conditions(patientId).list('?limit=100'),
    ]);
    setItems(medicationPage.data);
    setPrescribers(people.data);
    setEncounters(encounterPage.data);
    setConditions(conditionPage.data);
    setDraft((current) =>
      current.prescribedBy ? current : emptyDraft(people.data.some((person) => person._id === actorId) ? actorId : '')
    );
    if (!actionClinician && actorId) setActionClinician(actorId);
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

  function rememberWarnings(next: AllergyWarning[], key: string) {
    setWarnings(next);
    setWarningKey(key);
  }

  function updateDraft(next: Draft) {
    if (drugKey(next) !== drugKey(draft)) rememberWarnings([], '');
    setDraft(next);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const key = drugKey(draft);
    setSaving(true);
    setError('');
    try {
      let acknowledged = warningKey === key && warnings.length > 0;
      if (!acknowledged) {
        const checked = await clinicalApi.medications(patientId).check({
          genericName: draft.genericName.trim(),
          brandName: draft.brandName.trim() || undefined,
          din: draft.din.trim() || undefined,
        });
        if (checked.warnings.length) {
          rememberWarnings(checked.warnings, key);
          return;
        }
      }
      const body = payload(draft, acknowledged);
      if (editingId) await clinicalApi.medications(patientId).update(editingId, body);
      else await clinicalApi.medications(patientId).create(body);
      setEditingId(null);
      rememberWarnings([], '');
      setDraft(emptyDraft(draft.prescribedBy));
      await load();
    } catch (err) {
      const found = warningsOf(err);
      if (found) rememberWarnings(found, key);
      else setError(messageOf(err));
    } finally {
      setSaving(false);
    }
  }

  async function submitAction(event: FormEvent) {
    event.preventDefault();
    if (!actionTarget) return;
    setSaving(true);
    setError('');
    const body: MedicationActionInput = {
      reason: actionReason.trim(),
      date: actionDate,
      clinicianId: actionClinician || undefined,
    };
    try {
      const api = clinicalApi.medications(patientId);
      const id = actionTarget.medication._id;
      if (actionTarget.action === 'hold') await api.hold(id, body);
      if (actionTarget.action === 'resume') await api.resume(id, body);
      if (actionTarget.action === 'discontinue') await api.discontinue(id, body);
      if (actionTarget.action === 'complete') await api.complete(id, body);
      setActionTarget(null);
      setActionReason('');
      await load();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSaving(false);
    }
  }

  const active = items.filter((item) => item.status === 'active');
  const held = items.filter((item) => item.status === 'on-hold');
  const historical = items.filter((item) => item.status === 'completed');
  const discontinued = items.filter((item) => item.status === 'discontinued');
  const timeline = items.flatMap((item) => item.timeline || []);

  return (
    <div className="space-y-6">
      {error && !editingId && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}
      {canWrite && (
        <MedicationForm
          draft={draft}
          setDraft={updateDraft}
          prescribers={prescribers}
          encounters={encounters}
          conditions={conditions}
          warnings={warnings}
          editing={Boolean(editingId)}
          saving={saving}
          error={editingId ? error : ''}
          onSubmit={onSubmit}
          onCancel={
            editingId
              ? () => {
                  setEditingId(null);
                  rememberWarnings([], '');
                  setDraft(emptyDraft(draft.prescribedBy));
                  setError('');
                }
              : undefined
          }
        />
      )}
      {actionTarget && (
        <form onSubmit={submitAction} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <div>
            <h3 className="font-semibold text-gray-900">{ACTIONS[actionTarget.action].title}</h3>
            <p className="text-sm text-gray-600 mt-1">{medicationTitle(actionTarget.medication)}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-3">
              <label className={labelCls}>Reason</label>
              <input value={actionReason} onChange={(event) => setActionReason(event.target.value)} className={inputCls} required />
            </div>
            <Field label="Date">
              <input type="date" value={actionDate} onChange={(event) => setActionDate(event.target.value)} className={inputCls} required />
            </Field>
            <Field label="Clinician">
              <select value={actionClinician} onChange={(event) => setActionClinician(event.target.value)} className={inputCls} required>
                <option value="">Select a clinician</option>
                {actors.map((person) => (
                  <option key={person._id} value={person._id}>
                    {person.displayName}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="flex gap-2">
            <button type="submit" className={btnPrimary} disabled={saving}>
              {saving ? 'Saving...' : ACTIONS[actionTarget.action].submit}
            </button>
            <button type="button" className={btnGhost} onClick={() => setActionTarget(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}
      {loading ? (
        <p className="text-sm text-gray-500">Loading medications...</p>
      ) : (
        <>
          <MedicationGroup
            title="Active medications"
            subtitle="Medications the patient is taking now"
            items={active}
            canWrite={canWrite}
            onAction={(medication, action) => {
              setActionTarget({ medication, action });
              setActionDate(todayInput());
              setActionReason('');
            }}
            onEdit={(medication) => {
              setEditingId(medication._id);
              setDraft(draftFrom(medication));
              rememberWarnings([], '');
            }}
          />
          <MedicationGroup
            title="On hold"
            subtitle="Paused medications that remain on the record"
            items={held}
            canWrite={canWrite}
            onAction={(medication, action) => {
              setActionTarget({ medication, action });
              setActionDate(todayInput());
              setActionReason('');
            }}
            onEdit={(medication) => {
              setEditingId(medication._id);
              setDraft(draftFrom(medication));
              rememberWarnings([], '');
            }}
          />
          <MedicationGroup
            title="Historical medications"
            subtitle="Courses that were completed"
            items={historical}
            canWrite={canWrite}
            onAction={(medication, action) => setActionTarget({ medication, action })}
            onEdit={(medication) => {
              setEditingId(medication._id);
              setDraft(draftFrom(medication));
              rememberWarnings([], '');
            }}
          />
          <MedicationGroup
            title="Discontinued medications"
            subtitle="Stopped medications. The record is kept."
            items={discontinued}
            canWrite={canWrite}
            onAction={(medication, action) => setActionTarget({ medication, action })}
            onEdit={(medication) => {
              setEditingId(medication._id);
              setDraft(draftFrom(medication));
              rememberWarnings([], '');
            }}
          />
          <Panel title="Medication timeline" subtitle="Start, change, hold, resume, and stop events">
            <TimelineList points={timeline} />
          </Panel>
        </>
      )}
    </div>
  );
}

export function MedicationSummary({
  patientId,
  onOpen,
}: {
  patientId: string;
  onOpen?: () => void;
}) {
  const [summary, setSummary] = useState<Awaited<ReturnType<ReturnType<typeof clinicalApi.medications>['summary']>> | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    clinicalApi
      .medications(patientId)
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

  const active = summary?.active.filter((item) => item.status === 'active') || [];
  const held = summary?.active.filter((item) => item.status === 'on-hold') || [];

  return (
    <Panel
      title="Medication summary"
      subtitle="Active medications, recent changes, and related diagnoses"
    >
      {error && (
        <div className="mb-3 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">{error}</div>
      )}
      {!summary ? (
        <p className="text-sm text-gray-500">Loading medications...</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section>
            <h3 className="text-xs font-medium text-gray-500 mb-2">Active medications</h3>
            {active.length === 0 && held.length === 0 ? (
              <p className="text-sm text-gray-500">No active medications.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {active.map((medication) => (
                  <li key={medication._id}>
                    <div className="font-medium text-gray-900">{medicationTitle(medication)}</div>
                    <div className="text-gray-600">{regimen(medication)}</div>
                  </li>
                ))}
                {held.map((medication) => (
                  <li key={medication._id} className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-gray-900">{medicationTitle(medication)}</div>
                      <div className="text-gray-600">{regimen(medication)}</div>
                    </div>
                    <StatusBadge value="on-hold" />
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h3 className="text-xs font-medium text-gray-500 mb-2">Recent changes</h3>
            {summary.recentChanges.length === 0 ? (
              <p className="text-sm text-gray-500">No recent medication changes.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {summary.recentChanges.map((change, index) => (
                  <li key={`${change.medicationId}-${change.at}-${index}`}>
                    <div className="font-medium text-gray-900">{change.label}</div>
                    <div className="text-gray-600">
                      {medicationTitle(change)} · {formatEncounterWhen(change.at)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h3 className="text-xs font-medium text-gray-500 mb-2">Related diagnosis</h3>
            {summary.relatedDiagnoses.length === 0 ? (
              <p className="text-sm text-gray-500">No related diagnosis is linked yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {summary.relatedDiagnoses.map((item) => (
                  <li key={item.medicationId}>
                    <div className="font-medium text-gray-900">{medicationTitle(item)}</div>
                    <div className="text-gray-600">
                      {item.diagnosis?.display}
                      {item.diagnosis?.code ? ` · ${item.diagnosis.code}` : ''}
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
          Open medication record
        </button>
      )}
    </Panel>
  );
}
