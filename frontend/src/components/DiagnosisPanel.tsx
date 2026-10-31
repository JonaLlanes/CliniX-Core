import { FormEvent, useEffect, useState } from 'react';
import {
  authApi,
  clinicalApi,
  type CareTeamMember,
  type Condition,
  type DiagnosisType,
  type EncounterDiagnosis,
  type PromoteDiagnosisBody,
} from '../api/client';
import { StatusBadge } from './StatusBadge';
import Panel from './Panel';
import { formatEncounterWhen, providerName } from './encounterDisplay';

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm';
const labelCls = 'block text-xs font-medium text-gray-600 mb-1';
const btnPrimary =
  'px-4 py-2 bg-clinical-teal text-white rounded-lg text-sm hover:bg-clinical-teal-dark disabled:opacity-50';
const btnGhost =
  'px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50';

const DIAGNOSIS_TYPES: DiagnosisType[] = ['working', 'final', 'encounter'];

function messageOf(err: unknown) {
  return err instanceof Error ? err.message : 'Request failed';
}

function dateInput(value?: string | null) {
  return value ? value.slice(0, 10) : '';
}

function encounterMeta(dx: EncounterDiagnosis) {
  if (dx.encounterId && typeof dx.encounterId === 'object') {
    return {
      id: dx.encounterId._id,
      title: dx.encounterId.chiefComplaint || 'Encounter',
      at: dx.encounterId.openedAt,
    };
  }
  return { id: String(dx.encounterId), title: 'Encounter', at: undefined as string | undefined };
}

function problemName(dx: EncounterDiagnosis) {
  if (!dx.promotedProblemId || typeof dx.promotedProblemId === 'string') return '';
  return dx.promotedProblemId.display || '';
}

function defaultOwner(dx: EncounterDiagnosis, fallback?: string) {
  if (dx.recordedBy && typeof dx.recordedBy === 'object' && dx.recordedBy.role === 'clinician') {
    return dx.recordedBy._id;
  }
  return fallback || '';
}

function DiagnosisForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial: EncounterDiagnosis | null;
  onSubmit: (body: {
    code: string;
    description: string;
    diagnosisType: DiagnosisType;
    primaryDiagnosis: boolean;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [code, setCode] = useState(initial?.code || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [diagnosisType, setDiagnosisType] = useState<DiagnosisType>(initial?.diagnosisType || 'working');
  const [primaryDiagnosis, setPrimaryDiagnosis] = useState(initial?.primaryDiagnosis || false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSubmit({
        code: code.trim(),
        description: description.trim(),
        diagnosisType,
        primaryDiagnosis,
      });
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">{error}</div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className={labelCls} htmlFor="dx-code">
            ICD-10-CA code
          </label>
          <input
            id="dx-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className={inputCls}
            placeholder="I10"
            required
            maxLength={8}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="dx-type">
            Diagnosis type
          </label>
          <select
            id="dx-type"
            value={diagnosisType}
            onChange={(event) => setDiagnosisType(event.target.value as DiagnosisType)}
            className={inputCls}
          >
            {DIAGNOSIS_TYPES.map((type) => (
              <option key={type} value={type}>
                {type === 'working' ? 'Working' : type === 'final' ? 'Final' : 'Encounter'}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className={labelCls} htmlFor="dx-description">
            Description
          </label>
          <input
            id="dx-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className={inputCls}
            required
            maxLength={500}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={primaryDiagnosis}
          onChange={(event) => setPrimaryDiagnosis(event.target.checked)}
        />
        Primary diagnosis for this encounter
      </label>
      <div className="flex gap-2">
        <button type="submit" className={btnPrimary} disabled={saving}>
          {saving ? 'Saving...' : initial ? 'Save diagnosis' : 'Record diagnosis'}
        </button>
        {initial && (
          <button type="button" className={btnGhost} onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function PromoteForm({
  diagnosis,
  problems,
  clinicians,
  defaultOwnerId,
  onCancel,
  onPromote,
}: {
  diagnosis: EncounterDiagnosis;
  problems: Condition[];
  clinicians: CareTeamMember[];
  defaultOwnerId?: string;
  onCancel: () => void;
  onPromote: (body: PromoteDiagnosisBody) => Promise<void>;
}) {
  const [target, setTarget] = useState<'active_problem' | 'existing_problem'>('active_problem');
  const [problemId, setProblemId] = useState(problems[0]?._id || '');
  const [severity, setSeverity] = useState('unknown');
  const [status, setStatus] = useState('');
  const [onsetDate, setOnsetDate] = useState(dateInput(diagnosis.recordedAt));
  const [ownerId, setOwnerId] = useState(defaultOwner(diagnosis, defaultOwnerId));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!ownerId) {
      setError('Choose a clinician owner');
      return;
    }
    if (target === 'existing_problem' && !problemId) {
      setError('Choose a problem to update');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onPromote({
        target,
        problemId: target === 'existing_problem' ? problemId : undefined,
        severity: target === 'active_problem' ? severity : undefined,
        onsetDate: target === 'active_problem' ? onsetDate || undefined : undefined,
        status: target === 'existing_problem' && status ? status : undefined,
        clinicianOwner: ownerId,
      });
    } catch (err) {
      setError(messageOf(err));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-3 rounded-lg bg-gray-50 border border-gray-200 p-3">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{error}</div>
      )}
      <div className="flex flex-wrap gap-3 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name={`promote-${diagnosis._id}`}
            checked={target === 'active_problem'}
            onChange={() => setTarget('active_problem')}
          />
          Active problem
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name={`promote-${diagnosis._id}`}
            checked={target === 'existing_problem'}
            onChange={() => setTarget('existing_problem')}
          />
          Update existing problem
        </label>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {target === 'existing_problem' ? (
          <div className="md:col-span-2">
            <label className={labelCls}>Problem</label>
            <select value={problemId} onChange={(event) => setProblemId(event.target.value)} className={inputCls} required>
              <option value="">Select a problem</option>
              {problems.map((problem) => (
                <option key={problem._id} value={problem._id}>
                  {problem.display} ({problem.status})
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Copies ICD-10-CA {diagnosis.code} onto the selected problem.
            </p>
          </div>
        ) : (
          <>
            <div>
              <label className={labelCls}>Severity</label>
              <select value={severity} onChange={(event) => setSeverity(event.target.value)} className={inputCls}>
                <option value="mild">Mild</option>
                <option value="moderate">Moderate</option>
                <option value="severe">Severe</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Onset</label>
              <input
                type="date"
                value={onsetDate}
                onChange={(event) => setOnsetDate(event.target.value)}
                className={inputCls}
              />
            </div>
          </>
        )}
        {target === 'existing_problem' && (
          <div>
            <label className={labelCls}>Status</label>
            <select value={status} onChange={(event) => setStatus(event.target.value)} className={inputCls}>
              <option value="">Keep current status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        )}
        <div>
          <label className={labelCls}>Clinician owner</label>
          <select value={ownerId} onChange={(event) => setOwnerId(event.target.value)} className={inputCls} required>
            <option value="">Select a clinician</option>
            {clinicians.map((person) => (
              <option key={person._id} value={person._id}>
                {person.displayName}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" className={btnPrimary} disabled={saving}>
          {saving ? 'Saving...' : target === 'active_problem' ? 'Add active problem' : 'Update problem'}
        </button>
        <button type="button" className={btnGhost} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function EncounterDiagnosisList({
  patientId,
  diagnoses,
  problems,
  clinicians,
  canManage,
  canEdit,
  defaultOwnerId,
  groupByEncounter,
  onEdit,
  onChanged,
}: {
  patientId: string;
  diagnoses: EncounterDiagnosis[];
  problems: Condition[];
  clinicians: CareTeamMember[];
  canManage: boolean;
  canEdit: boolean;
  defaultOwnerId?: string;
  groupByEncounter?: boolean;
  onEdit?: (diagnosis: EncounterDiagnosis) => void;
  onChanged: () => Promise<void> | void;
}) {
  const [promoteId, setPromoteId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [removingId, setRemovingId] = useState('');

  const ordered = [...diagnoses].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));

  async function promote(diagnosisId: string, body: PromoteDiagnosisBody) {
    await clinicalApi.diagnoses(patientId).promote(diagnosisId, body);
    setPromoteId(null);
    await onChanged();
  }

  async function remove(diagnosis: EncounterDiagnosis) {
    setRemovingId(diagnosis._id);
    setError('');
    try {
      await clinicalApi.diagnoses(patientId).remove(diagnosis._id);
      if (promoteId === diagnosis._id) setPromoteId(null);
      await onChanged();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setRemovingId('');
    }
  }

  function rows(items: EncounterDiagnosis[]) {
    if (items.length === 0) {
      return <p className="text-sm text-gray-500">No encounter diagnoses.</p>;
    }
    return (
      <ul className="divide-y divide-gray-100">
        {items.map((dx) => {
          const promoted = Boolean(dx.promotedProblemId);
          const linked = problemName(dx);
          return (
            <li key={dx._id} className="py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-gray-900">
                    {dx.code} · {dx.description}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                    <StatusBadge value={dx.diagnosisType} />
                    {dx.primaryDiagnosis && (
                      <span className="text-xs font-medium text-clinical-teal">Primary</span>
                    )}
                    <span className="text-gray-500">
                      {formatEncounterWhen(dx.recordedAt)} · {providerName(dx.recordedBy)}
                    </span>
                  </div>
                  {promoted && (
                    <p className="mt-1 text-sm text-gray-600">
                      {dx.promotion === 'active_problem' ? 'Added as an active problem' : 'Problem list updated'}
                      {linked ? `: ${linked}` : ''}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-3 text-sm">
                  {canEdit && onEdit && !promoted && (
                    <button type="button" className="text-clinical-teal hover:underline" onClick={() => onEdit(dx)}>
                      Edit
                    </button>
                  )}
                  {canEdit && !promoted && (
                    <button
                      type="button"
                      className="text-red-700 hover:underline disabled:opacity-50"
                      disabled={removingId === dx._id}
                      onClick={() => void remove(dx)}
                    >
                      {removingId === dx._id ? 'Removing...' : 'Remove'}
                    </button>
                  )}
                  {canManage && !promoted && (
                    <button
                      type="button"
                      className="text-clinical-teal hover:underline"
                      onClick={() => setPromoteId(promoteId === dx._id ? null : dx._id)}
                    >
                      {promoteId === dx._id ? 'Close' : 'Promote'}
                    </button>
                  )}
                </div>
              </div>
              {promoteId === dx._id && (
                <PromoteForm
                  diagnosis={dx}
                  problems={problems}
                  clinicians={clinicians}
                  defaultOwnerId={defaultOwnerId}
                  onCancel={() => setPromoteId(null)}
                  onPromote={(body) => promote(dx._id, body)}
                />
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  if (!groupByEncounter) {
    return (
      <div>
        {error && (
          <div className="mb-3 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">{error}</div>
        )}
        {rows(ordered)}
      </div>
    );
  }

  const groups = new Map<string, { id: string; title: string; at?: string; items: EncounterDiagnosis[] }>();
  for (const dx of ordered) {
    const meta = encounterMeta(dx);
    const group = groups.get(meta.id) || { id: meta.id, title: meta.title, at: meta.at, items: [] };
    group.items.push(dx);
    groups.set(meta.id, group);
  }
  const grouped = [...groups.values()].sort((a, b) => (b.at || '').localeCompare(a.at || ''));

  return (
    <div className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">{error}</div>
      )}
      {grouped.length === 0 ? (
        <p className="text-sm text-gray-500">No encounter diagnoses.</p>
      ) : (
        grouped.map((group) => (
          <section key={group.id}>
            <h3 className="text-sm font-semibold text-gray-900">
              {group.title}
              {group.at ? <span className="ml-2 font-normal text-gray-500">{formatEncounterWhen(group.at)}</span> : null}
            </h3>
            {rows(group.items)}
          </section>
        ))
      )}
    </div>
  );
}

export function DiagnosisPanel({
  patientId,
  encounterId,
  canManage,
  locked,
  defaultOwnerId,
  onActivity,
}: {
  patientId: string;
  encounterId: string;
  canManage: boolean;
  locked: boolean;
  defaultOwnerId?: string;
  onActivity: () => Promise<void>;
}) {
  const [diagnoses, setDiagnoses] = useState<EncounterDiagnosis[]>([]);
  const [problems, setProblems] = useState<Condition[]>([]);
  const [clinicians, setClinicians] = useState<CareTeamMember[]>([]);
  const [editing, setEditing] = useState<EncounterDiagnosis | null>(null);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  async function load() {
    const [dx, problemPage] = await Promise.all([
      clinicalApi.diagnoses(patientId).list(`?encounterId=${encodeURIComponent(encounterId)}&limit=100`),
      clinicalApi.conditions(patientId).list('?limit=100'),
    ]);
    setDiagnoses(dx.data);
    setProblems(problemPage.data);
  }

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    load()
      .then(() => {
        if (!cancelled) setError('');
      })
      .catch((err) => {
        if (!cancelled) setError(messageOf(err));
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, encounterId]);

  useEffect(() => {
    if (!canManage) return;
    let cancelled = false;
    authApi
      .directory()
      .then((res) => {
        if (!cancelled) setClinicians(res.data.filter((person) => person.role === 'clinician'));
      })
      .catch(() => {
        if (!cancelled) setClinicians([]);
      });
    return () => {
      cancelled = true;
    };
  }, [canManage]);

  async function refresh() {
    await load();
    setEditing(null);
    await onActivity();
  }

  const editable = canManage && !locked;

  return (
    <div className="space-y-3 border-t border-gray-100 pt-4">
      <h4 className="text-sm font-semibold text-gray-900">Diagnoses</h4>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">{error}</div>
      )}
      {editable && (
        <DiagnosisForm
          key={editing?._id || 'new'}
          initial={editing}
          onCancel={() => setEditing(null)}
          onSubmit={async (body) => {
            if (editing) await clinicalApi.diagnoses(patientId).update(editing._id, body);
            else await clinicalApi.diagnoses(patientId).create({ ...body, encounterId });
            await refresh();
          }}
        />
      )}
      {locked && (
        <p className="text-sm text-gray-600">
          This encounter is locked. A recorded diagnosis can still be promoted to the problem list.
        </p>
      )}
      {!loaded ? (
        <p className="text-sm text-gray-500">Loading diagnoses...</p>
      ) : (
        <EncounterDiagnosisList
          patientId={patientId}
          diagnoses={diagnoses}
          problems={problems}
          clinicians={clinicians}
          canManage={canManage}
          canEdit={editable}
          defaultOwnerId={defaultOwnerId}
          onEdit={setEditing}
          onChanged={refresh}
        />
      )}
    </div>
  );
}

export function codeLabel(problem: Condition) {
  const text = [problem.codeSystem, problem.code].filter(Boolean).join(' ');
  return text || '—';
}

export function ProblemSections({
  title,
  emptyLabel,
  items,
  canWrite,
  onEdit,
}: {
  title: string;
  emptyLabel: string;
  items: Condition[];
  canWrite: boolean;
  onEdit: (problem: Condition) => void;
}) {
  return (
    <Panel title={title}>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">{emptyLabel}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 border-b border-gray-200">
                <th className="pb-3 pr-3">Problem</th>
                <th className="pb-3 pr-3">Status</th>
                <th className="pb-3 pr-3">Severity</th>
                <th className="pb-3 pr-3">Code</th>
                <th className="pb-3 pr-3">Onset</th>
                <th className="pb-3 pr-3">Resolved</th>
                <th className="pb-3 pr-3">Clinician</th>
                <th className="pb-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((problem) => (
                <tr key={problem._id}>
                  <td className="py-3 pr-3 font-medium">
                    {problem.display}
                    {problem.sourceDiagnosisId && (
                      <div className="text-xs font-normal text-gray-500">From a visit diagnosis</div>
                    )}
                  </td>
                  <td className="py-3 pr-3">
                    <StatusBadge value={problem.status} />
                  </td>
                  <td className="py-3 pr-3">
                    <StatusBadge value={problem.severity} />
                  </td>
                  <td className="py-3 pr-3 text-gray-600">{codeLabel(problem)}</td>
                  <td className="py-3 pr-3 text-gray-600">{dateInput(problem.onsetDate) || '—'}</td>
                  <td className="py-3 pr-3 text-gray-600">{dateInput(problem.resolvedDate) || '—'}</td>
                  <td className="py-3 pr-3 text-gray-600">{providerName(problem.clinicianOwner)}</td>
                  <td className="py-3 text-right">
                    {canWrite && (
                      <button type="button" className="text-clinical-teal hover:underline" onClick={() => onEdit(problem)}>
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
