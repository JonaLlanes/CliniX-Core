import { FormEvent, useState } from 'react';
import {
  clinicalApi,
  type CareTeamMember,
  type Condition,
  type EncounterDiagnosis,
} from '../api/client';
import Panel from './Panel';
import { EncounterDiagnosisList, ProblemSections } from './DiagnosisPanel';
import { providerId } from './encounterDisplay';

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm';
const labelCls = 'block text-xs font-medium text-gray-600 mb-1';
const btnPrimary = 'px-4 py-2 bg-clinical-teal text-white rounded-lg text-sm hover:bg-clinical-teal-dark';
const btnGhost = 'px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50';

function dateInput(value?: string | null) {
  return value ? value.slice(0, 10) : '';
}

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function ProblemForm({
  initial,
  clinicians,
  onSubmit,
  onCancel,
}: {
  initial: Condition | null;
  clinicians: CareTeamMember[];
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}) {
  const [status, setStatus] = useState(initial?.status || 'active');
  const [resolvedDate, setResolvedDate] = useState(dateInput(initial?.resolvedDate) || (initial?.status === 'resolved' ? '' : ''));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const body: Record<string, unknown> = {
      display: fd.get('display'),
      status,
      severity: fd.get('severity'),
      onsetDate: fd.get('onsetDate') || undefined,
      clinicianOwner: fd.get('clinicianOwner') || undefined,
      codeSystem: fd.get('codeSystem') || undefined,
      code: fd.get('code') || undefined,
    };
    if (status === 'resolved') body.resolvedDate = resolvedDate || undefined;
    setSaving(true);
    setError('');
    try {
      await onSubmit(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-lg border border-gray-200 p-6">
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">{error}</div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <label className={labelCls}>Problem</label>
          <input name="display" required defaultValue={initial?.display || ''} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Status</label>
          <select
            value={status}
            onChange={(event) => {
              const next = event.target.value;
              setStatus(next);
              if (next === 'resolved' && !resolvedDate) setResolvedDate(todayInput());
            }}
            className={inputCls}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Severity</label>
          <select name="severity" defaultValue={initial?.severity || 'unknown'} className={inputCls}>
            <option value="mild">Mild</option>
            <option value="moderate">Moderate</option>
            <option value="severe">Severe</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Onset</label>
          <input name="onsetDate" type="date" defaultValue={dateInput(initial?.onsetDate)} className={inputCls} />
        </div>
        {status === 'resolved' && (
          <div>
            <label className={labelCls}>Resolved</label>
            <input
              type="date"
              value={resolvedDate}
              onChange={(event) => setResolvedDate(event.target.value)}
              className={inputCls}
              required
            />
          </div>
        )}
        <div>
          <label className={labelCls}>Clinician owner</label>
          <select
            name="clinicianOwner"
            defaultValue={providerId(initial?.clinicianOwner)}
            className={inputCls}
          >
            <option value="">—</option>
            {clinicians.map((person) => (
              <option key={person._id} value={person._id}>
                {person.displayName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Code system</label>
          <select name="codeSystem" defaultValue={initial?.codeSystem || 'ICD-10-CA'} className={inputCls}>
            <option value="">—</option>
            <option value="ICD-10-CA">ICD-10-CA</option>
            <option value="ICD-10">ICD-10</option>
            <option value="SNOMED">SNOMED</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Code</label>
          <input name="code" defaultValue={initial?.code || ''} className={inputCls} placeholder="I10" />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button type="submit" className={btnPrimary} disabled={saving}>
          {saving ? 'Saving...' : initial ? 'Save problem' : 'Add problem'}
        </button>
        {initial && (
          <button type="button" onClick={onCancel} className={btnGhost}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

export default function ProblemList({
  patientId,
  problems,
  diagnoses,
  clinicians,
  canWriteProblems,
  canManageDiagnoses,
  onChange,
}: {
  patientId: string;
  problems: Condition[];
  diagnoses: EncounterDiagnosis[];
  clinicians: CareTeamMember[];
  canWriteProblems: boolean;
  canManageDiagnoses: boolean;
  onChange: () => Promise<void> | void;
}) {
  const [editing, setEditing] = useState<Condition | null>(null);
  const [formKey, setFormKey] = useState(0);
  const active = problems.filter((problem) => problem.status === 'active');
  const inactive = problems.filter((problem) => problem.status === 'inactive');
  const resolved = problems.filter((problem) => problem.status === 'resolved');

  return (
    <div className="space-y-6">
      {canWriteProblems && (
        <ProblemForm
          key={editing?._id || `new-${formKey}`}
          initial={editing}
          clinicians={clinicians}
          onCancel={() => setEditing(null)}
          onSubmit={async (body) => {
            if (editing) await clinicalApi.conditions(patientId).update(editing._id, body);
            else await clinicalApi.conditions(patientId).create(body);
            setEditing(null);
            setFormKey((value) => value + 1);
            await onChange();
          }}
        />
      )}
      <ProblemSections
        title="Active problems"
        emptyLabel="No active problems."
        items={active}
        canWrite={canWriteProblems}
        onEdit={setEditing}
      />
      <ProblemSections
        title="Resolved problems"
        emptyLabel="No resolved problems."
        items={resolved}
        canWrite={canWriteProblems}
        onEdit={setEditing}
      />
      <ProblemSections
        title="Inactive problems"
        emptyLabel="No inactive problems."
        items={inactive}
        canWrite={canWriteProblems}
        onEdit={setEditing}
      />
      <Panel
        title="Encounter diagnoses"
        subtitle="Visit diagnoses stay on the encounter until they are promoted onto the problem list"
      >
        <EncounterDiagnosisList
          patientId={patientId}
          diagnoses={diagnoses}
          problems={problems}
          clinicians={clinicians}
          canManage={canManageDiagnoses}
          canEdit={false}
          groupByEncounter
          onChanged={onChange}
        />
      </Panel>
    </div>
  );
}
