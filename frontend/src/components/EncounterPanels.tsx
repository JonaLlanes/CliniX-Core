import { FormEvent, useEffect, useState, type ReactNode } from 'react';
import {
  authApi,
  encountersApi,
  visitsApi,
  type CareTeamMember,
  type DisplayTimelineEvent,
  type Encounter,
  type EncounterSummary as EncounterSummaryData,
  type PatientVisit,
} from '../api/client';
import { StatusBadge } from './StatusBadge';
import { typeLabel } from './appointmentDisplay';
import EncounterTimeline from './EncounterTimeline';
import { DiagnosisPanel } from './DiagnosisPanel';
import { MedicationSummary } from './MedicationPanel';
import Panel, { EmptyState } from './Panel';
import {
  LAUNCH_VISIT_STATUSES,
  formatEncounterWhen,
  providerId,
  providerName,
} from './encounterDisplay';
import { chartRecordId, focusedRecordClass, watchChartRecord, type ChartRecordFocus } from './chart/recordFocus';

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm';
const labelCls = 'block text-xs font-medium text-gray-600 mb-1';
const btnPrimary =
  'px-4 py-2 bg-clinical-teal text-white rounded-lg text-sm hover:bg-clinical-teal-dark disabled:opacity-50';
const btnGhost = 'px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50';

function messageOf(err: unknown) {
  return err instanceof Error ? err.message : 'Request failed';
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm text-gray-900 mt-0.5">{children}</div>
    </div>
  );
}

function useClinicians(enabled: boolean) {
  const [clinicians, setClinicians] = useState<CareTeamMember[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    authApi
      .directory()
      .then((res) => {
        if (!cancelled) setClinicians(res.data.filter((person) => person.role === 'clinician'));
      })
      .catch((err) => {
        if (!cancelled) setError(messageOf(err));
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { clinicians, error };
}

function ProviderSelect({
  id,
  label,
  value,
  clinicians,
  allowEmpty,
  emptyLabel,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  clinicians: CareTeamMember[];
  allowEmpty?: boolean;
  emptyLabel?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className={labelCls} htmlFor={id}>
        {label}
      </label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={inputCls} required={!allowEmpty}>
        {allowEmpty && <option value="">{emptyLabel || 'None'}</option>}
        {!allowEmpty && <option value="">Select a clinician</option>}
        {clinicians.map((person) => (
          <option key={person._id} value={person._id}>
            {person.displayName}
          </option>
        ))}
      </select>
    </div>
  );
}

export function EncounterLaunch({
  patientId,
  visitId,
  appointmentId,
  clinicLocation,
  appointmentType,
  defaultAttendingId,
  onCreated,
}: {
  patientId: string;
  visitId: string;
  appointmentId: string;
  clinicLocation: string;
  appointmentType: string;
  defaultAttendingId: string;
  onCreated: (encounter: Encounter) => void | Promise<void>;
}) {
  const { clinicians, error: directoryError } = useClinicians(true);
  const [complaint, setComplaint] = useState('');
  const [reason, setReason] = useState('');
  const [attendingId, setAttendingId] = useState(defaultAttendingId);
  const [supervisingId, setSupervisingId] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAttendingId(defaultAttendingId);
  }, [defaultAttendingId]);

  const supervisingOptions = clinicians.filter((person) => person._id !== attendingId);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const created = await encountersApi.create(patientId, {
        patientId,
        visitId,
        appointmentId,
        clinicLocation,
        appointmentType,
        attendingProviderId: attendingId,
        supervisingProviderId: supervisingId || undefined,
        chiefComplaint: complaint.trim(),
        reasonForVisit: reason.trim(),
      });
      await onCreated(created);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <p className="text-sm text-gray-600">
        {typeLabel(appointmentType)} · {clinicLocation}. The visit moves to in progress when the encounter opens.
      </p>
      {(error || directoryError) && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error || directoryError}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="md:col-span-2">
          <label className={labelCls} htmlFor={`complaint-${visitId}`}>
            Chief complaint
          </label>
          <input
            id={`complaint-${visitId}`}
            value={complaint}
            onChange={(event) => setComplaint(event.target.value)}
            className={inputCls}
            required
            maxLength={500}
          />
        </div>
        <div className="md:col-span-2">
          <label className={labelCls} htmlFor={`reason-${visitId}`}>
            Reason for visit
          </label>
          <textarea
            id={`reason-${visitId}`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className={inputCls}
            rows={2}
            required
            maxLength={1000}
          />
        </div>
        <ProviderSelect
          id={`attending-${visitId}`}
          label="Attending provider"
          value={attendingId}
          clinicians={clinicians}
          onChange={(value) => {
            setAttendingId(value);
            if (value === supervisingId) setSupervisingId('');
          }}
        />
        <ProviderSelect
          id={`supervising-${visitId}`}
          label="Supervising provider (optional)"
          value={supervisingId}
          clinicians={supervisingOptions}
          allowEmpty
          onChange={setSupervisingId}
        />
      </div>
      <button type="submit" className={btnPrimary} disabled={saving || !attendingId}>
        {saving ? 'Opening encounter...' : 'Start encounter'}
      </button>
    </form>
  );
}

export function EncounterSummary({
  patientId,
  refreshKey = 0,
  canManage,
  onOpen,
}: {
  patientId: string;
  refreshKey?: number;
  canManage: boolean;
  onOpen?: () => void;
}) {
  const [summary, setSummary] = useState<EncounterSummaryData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    encountersApi
      .summary(patientId)
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
  }, [patientId, refreshKey]);

  const canStart = canManage && summary?.visitId && !summary.encounterId;
  const showAction = Boolean(onOpen && summary && (summary.encounterId || canStart));

  return (
    <Panel
      title="Encounter summary"
      subtitle="Provider, complaint, status, room, and start time for the current encounter"
    >
      {error && (
        <div className="mb-3 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">{error}</div>
      )}
      {!summary ? (
        <p className="text-sm text-gray-500">Loading encounter...</p>
      ) : !summary.encounterId ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-600">
            {summary.visitId
              ? 'This visit does not have an encounter yet.'
              : 'No encounter on this chart yet.'}
            {summary.visitStatus ? (
              <>
                {' '}
                Visit status <StatusBadge value={summary.visitStatus} />
                {summary.room ? ` · ${summary.room}` : ''}
              </>
            ) : null}
          </p>
          {showAction && (
            <button type="button" className={btnPrimary} onClick={onOpen}>
              Start encounter
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Field label="Provider">{summary.provider || '—'}</Field>
            <Field label="Complaint">{summary.chiefComplaint || '—'}</Field>
            <Field label="Status">
              <StatusBadge value={summary.status} />
            </Field>
            <Field label="Room">{summary.room || '—'}</Field>
            <Field label="Start time">{formatEncounterWhen(summary.openedAt)}</Field>
          </div>
          {showAction && (
            <button type="button" className={btnGhost} onClick={onOpen}>
              View encounter
            </button>
          )}
        </div>
      )}
    </Panel>
  );
}

export function EncounterVisitSection({
  patientId,
  visitId,
  appointmentId,
  clinicLocation,
  appointmentType,
  defaultAttendingId,
  visitStatus,
  canManage,
  onChanged,
}: {
  patientId: string;
  visitId: string;
  appointmentId: string;
  clinicLocation: string;
  appointmentType: string;
  defaultAttendingId: string;
  visitStatus: string;
  canManage: boolean;
  onChanged: () => Promise<void>;
}) {
  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [timeline, setTimeline] = useState<DisplayTimelineEvent[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const launchable = LAUNCH_VISIT_STATUSES.includes(visitStatus);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    encountersApi
      .current(patientId, visitId)
      .then((view) => {
        if (cancelled) return;
        setEncounter(view.encounter);
        setTimeline(view.displayTimeline || []);
        setError('');
        setLoaded(true);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(messageOf(err));
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [patientId, visitId, visitStatus]);

  async function moveToInProgress() {
    if (!encounter) return;
    setSaving(true);
    setError('');
    try {
      const updated = await encountersApi.setStatus(patientId, encounter._id, 'in_progress');
      setEncounter(updated);
      setTimeline(updated.displayTimeline || []);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border-t border-gray-100 pt-4 space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">Encounter</h3>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}
      {!loaded ? (
        <p className="text-sm text-gray-500">Loading encounter...</p>
      ) : encounter ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="Provider">{providerName(encounter.attendingProviderId)}</Field>
            <Field label="Complaint">{encounter.chiefComplaint}</Field>
            <Field label="Status">
              <StatusBadge value={encounter.status} />
            </Field>
            <Field label="Start time">{formatEncounterWhen(encounter.openedAt)}</Field>
          </div>
          {canManage && encounter.status === 'open' && (
            <button type="button" className={btnPrimary} disabled={saving} onClick={() => void moveToInProgress()}>
              {saving ? 'Updating...' : 'Move to in progress'}
            </button>
          )}
          {encounter.status === 'in_progress' && (
            <p className="text-sm text-gray-600">Documentation will move this encounter to awaiting signature.</p>
          )}
          {(encounter.status === 'signed' || encounter.status === 'amended') && (
            <p className="text-sm text-gray-600">This encounter is locked.</p>
          )}
        </div>
      ) : launchable && canManage ? (
        <EncounterLaunch
          key={visitId}
          patientId={patientId}
          visitId={visitId}
          appointmentId={appointmentId}
          clinicLocation={clinicLocation}
          appointmentType={appointmentType}
          defaultAttendingId={defaultAttendingId}
          onCreated={async (created) => {
            setEncounter(created);
            setTimeline(created.displayTimeline || []);
            await onChanged();
          }}
        />
      ) : launchable ? (
        <p className="text-sm text-gray-600">A clinician opens the encounter for this visit.</p>
      ) : (
        <p className="text-sm text-gray-600">An encounter opens after the patient is waiting, roomed, or in progress.</p>
      )}

      {encounter && (
        <DiagnosisPanel
          key={encounter._id}
          patientId={patientId}
          encounterId={encounter._id}
          canManage={canManage}
          locked={encounter.status === 'signed' || encounter.status === 'amended'}
          defaultOwnerId={providerId(encounter.attendingProviderId)}
          onActivity={async () => {
            const view = await encountersApi.current(patientId, visitId);
            setEncounter(view.encounter);
            setTimeline(view.displayTimeline || []);
          }}
        />
      )}

      <MedicationSummary patientId={patientId} />

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Timeline</h3>
        <EncounterTimeline events={timeline} />
      </div>
    </div>
  );
}

function EncounterDetail({
  patientId,
  encounter,
  canManage,
  onUpdated,
  onSelect,
}: {
  patientId: string;
  encounter: Encounter;
  canManage: boolean;
  onUpdated: (encounter: Encounter) => void;
  onSelect: (id: string) => void;
}) {
  const unlocked = encounter.status === 'open' || encounter.status === 'in_progress' || encounter.status === 'awaiting_signature';
  const { clinicians } = useClinicians(canManage && unlocked);
  const [attendingId, setAttendingId] = useState(providerId(encounter.attendingProviderId));
  const [supervisingId, setSupervisingId] = useState(providerId(encounter.supervisingProviderId));
  const [complaint, setComplaint] = useState(encounter.chiefComplaint);
  const [reason, setReason] = useState(encounter.reasonForVisit);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAttendingId(providerId(encounter.attendingProviderId));
    setSupervisingId(providerId(encounter.supervisingProviderId));
    setComplaint(encounter.chiefComplaint);
    setReason(encounter.reasonForVisit);
    setError('');
  }, [encounter]);

  async function run(action: () => Promise<Encounter>) {
    setSaving(true);
    setError('');
    try {
      onUpdated(await action());
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSaving(false);
    }
  }

  const providersChanged =
    attendingId !== providerId(encounter.attendingProviderId) ||
    supervisingId !== providerId(encounter.supervisingProviderId);

  return (
    <div className="mt-4 border border-gray-200 rounded-lg p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-gray-900">Encounter detail</h3>
        <StatusBadge value={encounter.status} />
      </div>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Field label="Provider">{providerName(encounter.attendingProviderId)}</Field>
        <Field label="Complaint">{encounter.chiefComplaint}</Field>
        <Field label="Room">{encounter.room || '—'}</Field>
        <Field label="Start time">{formatEncounterWhen(encounter.openedAt)}</Field>
        <Field label="Location">{encounter.clinicLocation}</Field>
        <Field label="Appointment type">{typeLabel(encounter.appointmentType)}</Field>
        <Field label="Created by">{providerName(encounter.createdBy)}</Field>
        <Field label="Supervising">{providerName(encounter.supervisingProviderId)}</Field>
        <Field label="Signed by">
          {encounter.signedBy ? providerName(encounter.signedBy) : '—'}
          {encounter.signedAt ? ` · ${formatEncounterWhen(encounter.signedAt)}` : ''}
        </Field>
      </div>
      <Field label="Reason for visit">{encounter.reasonForVisit}</Field>
      {encounter.amendsEncounterId && (
        <button type="button" className="text-sm text-clinical-teal hover:underline" onClick={() => onSelect(String(encounter.amendsEncounterId))}>
          View signed encounter
        </button>
      )}
      {encounter.amendmentId && (
        <button type="button" className="text-sm text-clinical-teal hover:underline" onClick={() => onSelect(encounter.amendmentId || '')}>
          View amendment
        </button>
      )}

      {canManage && encounter.status === 'open' && (
        <button
          type="button"
          className={btnPrimary}
          disabled={saving}
          onClick={() => void run(() => encountersApi.setStatus(patientId, encounter._id, 'in_progress'))}
        >
          Move to in progress
        </button>
      )}
      {encounter.status === 'in_progress' && (
        <p className="text-sm text-gray-600">Documentation will move this encounter to awaiting signature.</p>
      )}
      {canManage && encounter.status === 'awaiting_signature' && (
        <button
          type="button"
          className={btnPrimary}
          disabled={saving}
          onClick={() => void run(() => encountersApi.sign(patientId, encounter._id))}
        >
          Sign encounter
        </button>
      )}
      {(encounter.status === 'signed' || encounter.status === 'amended') && (
        <p className="text-sm text-gray-600">This encounter is locked.</p>
      )}

      {canManage && unlocked && (
        <form
          className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end"
          onSubmit={(event) => {
            event.preventDefault();
            void run(() =>
              encountersApi.assignProviders(patientId, encounter._id, {
                attendingProviderId: attendingId,
                supervisingProviderId: supervisingId || null,
              })
            );
          }}
        >
          <ProviderSelect
            id={`edit-attending-${encounter._id}`}
            label="Attending provider"
            value={attendingId}
            clinicians={clinicians}
            onChange={(value) => {
              setAttendingId(value);
              if (value === supervisingId) setSupervisingId('');
            }}
          />
          <ProviderSelect
            id={`edit-supervising-${encounter._id}`}
            label="Supervising provider"
            value={supervisingId}
            clinicians={clinicians.filter((person) => person._id !== attendingId)}
            allowEmpty
            onChange={setSupervisingId}
          />
          <button type="submit" className={btnGhost} disabled={saving || !providersChanged || !attendingId}>
            Save providers
          </button>
        </form>
      )}

      {canManage && encounter.status === 'signed' && encounter.isCurrent && (
        <form
          className="space-y-3 border-t border-gray-100 pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            void run(() =>
              encountersApi.amend(patientId, encounter._id, {
                chiefComplaint: complaint.trim(),
                reasonForVisit: reason.trim(),
                attendingProviderId: attendingId || undefined,
                supervisingProviderId: supervisingId || undefined,
              })
            );
          }}
        >
          <h4 className="text-sm font-semibold text-gray-900">Amendment</h4>
          <p className="text-sm text-gray-600">
            The signed encounter stays locked. This opens a linked amendment on the same visit.
          </p>
          <div>
            <label className={labelCls} htmlFor={`amend-complaint-${encounter._id}`}>
              Chief complaint
            </label>
            <input
              id={`amend-complaint-${encounter._id}`}
              value={complaint}
              onChange={(event) => setComplaint(event.target.value)}
              className={inputCls}
              required
            />
          </div>
          <div>
            <label className={labelCls} htmlFor={`amend-reason-${encounter._id}`}>
              Reason for visit
            </label>
            <textarea
              id={`amend-reason-${encounter._id}`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className={inputCls}
              rows={2}
              required
            />
          </div>
          <button type="submit" className={btnPrimary} disabled={saving}>
            Create amendment
          </button>
        </form>
      )}

      <DiagnosisPanel
        key={encounter._id}
        patientId={patientId}
        encounterId={encounter._id}
        canManage={canManage}
        locked={!unlocked}
        defaultOwnerId={providerId(encounter.attendingProviderId)}
        onActivity={async () => {
          onUpdated(await encountersApi.get(patientId, encounter._id));
        }}
      />

      <MedicationSummary patientId={patientId} />

      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Timeline</h4>
        <EncounterTimeline events={encounter.displayTimeline || []} />
      </div>
    </div>
  );
}

export function EncounterChart({
  patientId,
  canManage,
  onChanged,
  focusToken = 0,
  recordFocus = null,
}: {
  patientId: string;
  canManage: boolean;
  onChanged: () => void;
  focusToken?: number;
  recordFocus?: ChartRecordFocus | null;
}) {
  const [items, setItems] = useState<Encounter[]>([]);
  const [visits, setVisits] = useState<PatientVisit[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<Encounter | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadList() {
    const [encounterPage, visitPage] = await Promise.all([
      encountersApi.list(patientId, 100),
      visitsApi.forPatient(patientId),
    ]);
    setItems(encounterPage.data);
    setVisits(visitPage.data);
    return encounterPage.data;
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadList()
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

  const active = visits.find((visit) => LAUNCH_VISIT_STATUSES.includes(visit.status)) || null;
  const activeAppointment = active && typeof active.appointmentId === 'object' ? active.appointmentId : null;
  const activeHasEncounter = Boolean(active && items.some((item) => item.visitId === active._id && item.isCurrent));

  useEffect(() => {
    if (selectedId) return;
    const preferred = active
      ? items.find((item) => item.visitId === active._id && item.isCurrent)
      : items.find((item) => item.isCurrent) || items[0];
    if (preferred) setSelectedId(preferred._id);
  }, [items, active, selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    encountersApi
      .get(patientId, selectedId)
      .then((encounter) => {
        if (!cancelled) setDetail(encounter);
      })
      .catch((err) => {
        if (!cancelled) setError(messageOf(err));
      });
    return () => {
      cancelled = true;
    };
  }, [patientId, selectedId]);

  async function afterChange(encounter: Encounter) {
    await loadList();
    setSelectedId(encounter._id);
    setDetail(encounter);
    onChanged();
  }

  const defaultAttending =
    active && typeof active.providerId === 'object' && active.providerId.role === 'clinician'
      ? active.providerId._id
      : '';

  useEffect(() => {
    if (!focusToken || loading || recordFocus?.tab === 'encounters') return;
    const node = document.getElementById('chart-new-encounter') || document.getElementById('chart-encounter-list');
    node?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [focusToken, loading, activeHasEncounter, recordFocus]);

  const focusTokenForRecord = recordFocus?.tab === 'encounters' ? recordFocus.token : 0;
  const focusRecordId = recordFocus?.tab === 'encounters' ? recordFocus.recordId : '';
  useEffect(() => {
    if (!focusTokenForRecord || !focusRecordId || loading) return;
    setSelectedId(focusRecordId);
    return watchChartRecord('encounter', focusRecordId, 'encounter-detail', focusRecordId);
  }, [focusTokenForRecord, focusRecordId, loading]);

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}
      {canManage && active && activeAppointment && !activeHasEncounter && (
        <div id="chart-new-encounter" className="scroll-mt-64">
        <Panel title="Start encounter" subtitle="Waiting, roomed, and in-progress visits can open an encounter">
          <EncounterLaunch
            key={active._id}
            patientId={patientId}
            visitId={active._id}
            appointmentId={activeAppointment._id}
            clinicLocation={activeAppointment.clinicLocation}
            appointmentType={activeAppointment.appointmentType}
            defaultAttendingId={defaultAttending}
            onCreated={afterChange}
          />
        </Panel>
        </div>
      )}
      <div id="chart-encounter-list" className="scroll-mt-64">
      <Panel title="Encounters">
        {loading ? (
          <p className="text-sm text-gray-500">Loading encounters...</p>
        ) : items.length === 0 ? (
          <EmptyState text="No encounters on this chart" hint="Start an encounter from the chart header when the visit begins." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 border-b border-gray-200">
                  <th className="pb-3 pr-3">Started</th>
                  <th className="pb-3 pr-3">Provider</th>
                  <th className="pb-3 pr-3">Complaint</th>
                  <th className="pb-3 pr-3">Status</th>
                  <th className="pb-3">Room</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr
                    key={item._id}
                    id={chartRecordId('encounter', item._id)}
                    className={`${item._id === selectedId ? 'bg-teal-50' : ''} ${focusedRecordClass(item._id === focusRecordId, 'row')}`.trim()}
                  >
                    <td className="py-3 pr-3 whitespace-nowrap">
                      <button type="button" className="text-left hover:underline" onClick={() => setSelectedId(item._id)}>
                        {formatEncounterWhen(item.openedAt)}
                      </button>
                    </td>
                    <td className="py-3 pr-3">{providerName(item.attendingProviderId)}</td>
                    <td className="py-3 pr-3 text-gray-700">{item.chiefComplaint}</td>
                    <td className="py-3 pr-3">
                      <StatusBadge value={item.status} />
                    </td>
                    <td className="py-3">{item.room || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {detail && (
          <div id={chartRecordId('encounter-detail', detail._id)}>
          <EncounterDetail
            patientId={patientId}
            encounter={detail}
            canManage={canManage}
            onUpdated={(encounter) => void afterChange(encounter)}
            onSelect={setSelectedId}
          />
          </div>
        )}
      </Panel>
      </div>
    </div>
  );
}
