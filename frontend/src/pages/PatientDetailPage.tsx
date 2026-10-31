import { FormEvent, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  appointmentsApi,
  clinicalApi,
  authApi,
  patientsApi,
  visitsApi,
  type Allergy,
  type CareTeamMember,
  type ClinicalNote,
  type Condition,
  type EncounterDiagnosis,
  type Medication,
  type Patient,
  type Task,
  type Vital,
} from '../api/client';
import { useAuth } from '../context/AuthContext';
import Panel, { EmptyState } from '../components/Panel';
import { ErrorNotice } from '../components/feedback';
import StatCard from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import ActiveVisitBanner from '../components/ActiveVisitBanner';
import ChartHeader, { type ChartQuickAction } from '../components/chart/ChartHeader';
import ChartNav from '../components/chart/ChartNav';
import ChartSafety from '../components/chart/ChartSafety';
import ChartSkeleton from '../components/chart/ChartSkeleton';
import ChartSnapshot from '../components/chart/ChartSnapshot';
import { rememberChart } from '../components/dashboard/recentCharts';
import {
  activeAllergies,
  activeConditions,
  isChartTab,
  lastVisitIso,
  type ChartSnapshotData,
  type ChartTab,
} from '../components/chart/chartDisplay';
import { EncounterChart, EncounterSummary } from '../components/EncounterPanels';
import ProblemList from '../components/ProblemList';
import { MedicationPanel, MedicationSummary } from '../components/MedicationPanel';
import { OrderPanel, OrderSummary } from '../components/OrderPanel';
import { ReferralPanel, ReferralSummary } from '../components/ReferralPanel';
import { CarePlanPanel, CarePlanSummary } from '../components/CarePlanPanel';
import { MonitoringPanel, MonitoringSummary } from '../components/MonitoringPanel';
import { canManageEncounters } from '../components/encounterDisplay';
import AuditHistory from '../components/AuditHistory';
import CareTeamPanel from '../components/CareTeamPanel';
import AppointmentHistory from '../components/AppointmentHistory';
import PatientTimeline from '../components/chart/PatientTimeline';
import { chartRecordId, focusedRecordClass, watchChartRecord, type ChartRecordFocus } from '../components/chart/recordFocus';
import type { TimelineEvent } from '../components/chart/timelineModel';
import {
  CANADIAN_PROVINCES,
  GENDER_IDENTITIES,
  LANGUAGES,
  RELATIONSHIPS,
  SEX_AT_BIRTH,
  formatAddress,
  patientPayloadFromForm,
} from '../components/canadianRegistration';

type Tab = ChartTab;

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm';
const labelCls = 'block text-xs font-medium text-gray-600 mb-1';
const btnPrimary =
  'px-4 py-2 bg-clinical-teal text-white rounded-lg text-sm hover:bg-clinical-teal-dark';
const btnGhost = 'px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50';

function dateInput(value?: string) {
  return value ? value.slice(0, 10) : '';
}

function dateTimeInput(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function authorName(author: ClinicalNote['authorId']) {
  if (author && typeof author === 'object') return author.displayName || '';
  return '';
}

export default function PatientDetailPage() {
  const { id = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const requestedTab = searchParams.get('tab');
  const tabFromUrl: Tab = isChartTab(requestedTab) ? requestedTab : 'overview';
  const [tab, setTab] = useState<Tab>(tabFromUrl);
  const [routeTab, setRouteTab] = useState({ id, requestedTab });
  if (routeTab.id !== id || routeTab.requestedTab !== requestedTab) {
    setRouteTab({ id, requestedTab });
    setTab(tabFromUrl);
  }

  function selectTab(next: Tab) {
    setTab(next);
    const params = new URLSearchParams(searchParams);
    if (next === 'overview') params.delete('tab');
    else params.set('tab', next);
    setSearchParams(params, { replace: true });
  }
  const [compose, setCompose] = useState<{ target: ChartQuickAction; token: number } | null>(null);
  const [recordFocus, setRecordFocus] = useState<ChartRecordFocus | null>(null);
  const [encounterVersion, setEncounterVersion] = useState(0);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [snapshot, setSnapshot] = useState<ChartSnapshotData | null>(null);
  const [snapshotReady, setSnapshotReady] = useState(false);
  const [allergiesReady, setAllergiesReady] = useState(false);
  const [chromeHeight, setChromeHeight] = useState(148);
  const chromeRef = useRef<HTMLDivElement>(null);
  const workspaceRequest = useRef(0);
  const chartRequest = useRef(0);
  const [error, setError] = useState('');
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [diagnoses, setDiagnoses] = useState<EncounterDiagnosis[]>([]);
  const [vitals, setVitals] = useState<Vital[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<ClinicalNote[]>([]);
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [directory, setDirectory] = useState<CareTeamMember[]>([]);

  async function refreshPatient() {
    setPatient(await patientsApi.get(id));
  }

  async function loadWorkspace() {
    const request = ++workspaceRequest.current;
    const [conditionsPage, medicationPage, taskPage, appointmentPage, visitPage, monitor, resultPage] =
      await Promise.all([
        clinicalApi.conditions(id).list('?limit=100').catch(() => null),
        clinicalApi.medications(id).list('?status=active&limit=100').catch(() => null),
        clinicalApi.tasks(id).list().catch(() => null),
        appointmentsApi.history(id).catch(() => null),
        visitsApi.forPatient(id).catch(() => null),
        clinicalApi.monitoring(id).dashboard().catch(() => null),
        clinicalApi.orders(id).results('?limit=100').catch(() => null),
      ]);
    if (request !== workspaceRequest.current) return;
    setSnapshot((current) => ({
      conditions: conditionsPage?.data ?? current?.conditions ?? [],
      medications: medicationPage?.data ?? current?.medications ?? [],
      tasks: taskPage?.data ?? current?.tasks ?? [],
      appointments: appointmentPage?.data ?? current?.appointments ?? [],
      visits: visitPage?.data ?? current?.visits ?? [],
      overdueRecalls: monitor?.overdueRecalls ?? current?.overdueRecalls ?? [],
      abnormalResults: monitor?.recentAbnormal ?? current?.abnormalResults ?? [],
      orderResults: resultPage?.data ?? current?.orderResults ?? [],
    }));
    setSnapshotReady(true);
  }

  async function loadTab(t: Tab) {
    const request = ++chartRequest.current;
    setError('');
    try {
      const nextPatient = await patientsApi.get(id);
      if (request !== chartRequest.current) return;
      setPatient(nextPatient);
      const allergyList = (await clinicalApi.allergies(id).list()).data;
      if (request !== chartRequest.current) return;
      setAllergies(allergyList);
      setAllergiesReady(true);
      if (t === 'problems' || t === 'overview') {
        const next = (await clinicalApi.conditions(id).list('?limit=100')).data;
        if (request !== chartRequest.current) return;
        setConditions(next);
      }
      if (t === 'problems') {
        const next = (await clinicalApi.diagnoses(id).list('?limit=100')).data;
        if (request !== chartRequest.current) return;
        setDiagnoses(next);
      }
      if (t === 'vitals' || t === 'overview') {
        const next = (await clinicalApi.vitals(id).list('?limit=20')).data;
        if (request !== chartRequest.current) return;
        setVitals(next);
      }
      if (t === 'overview') {
        const next = (await clinicalApi.medications(id).list('?status=active&limit=100')).data;
        if (request !== chartRequest.current) return;
        setMedications(next);
      }
      if (t === 'care') {
        const next = (await clinicalApi.tasks(id).list()).data;
        if (request !== chartRequest.current) return;
        setTasks(next);
      }
      if (t === 'notes') {
        const next = (await clinicalApi.notes(id).list('?limit=100')).data;
        if (request !== chartRequest.current) return;
        setNotes(next);
      }
    } catch (err) {
      if (request !== chartRequest.current) return;
      setError(err instanceof Error ? err.message : 'Load failed');
    }
    if (request === chartRequest.current) void loadWorkspace();
  }

  useEffect(() => {
    setSnapshot(null);
    setSnapshotReady(false);
    setAllergies([]);
    setAllergiesReady(false);
    setRecordFocus(null);
    chartRequest.current += 1;
    workspaceRequest.current += 1;
  }, [id]);

  useEffect(() => {
    const node = chromeRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setChromeHeight(node.offsetHeight));
    observer.observe(node);
    return () => observer.disconnect();
  }, [patient]);

  useEffect(() => {
    loadTab(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, tab]);

  useEffect(() => {
    if (!patient) return;
    rememberChart({
      id: patient._id,
      name: `${patient.familyName}, ${patient.givenName}`,
      mrn: patient.mrn,
    });
  }, [patient]);

  useEffect(() => {
    if (!user || !['clinician', 'nurse', 'admin'].includes(user.role)) return;
    authApi
      .directory()
      .then((res) => setDirectory(res.data))
      .catch(() => setDirectory([]));
  }, [user]);

  function openAction(action: ChartQuickAction) {
    setRecordFocus(null);
    selectTab(action);
    setCompose({ target: action, token: Date.now() });
  }

  function openRecord(event: TimelineEvent) {
    setCompose(null);
    selectTab(event.destination);
    if (!event.recordId) {
      setRecordFocus(null);
      return;
    }
    setRecordFocus({
      tab: event.destination,
      recordId: event.recordId,
      token: Date.now(),
      scope: event.scope,
      fallbackId: event.fallbackId,
    });
  }

  if (!patient && !error) {
    return <ChartSkeleton />;
  }

  const latest = patient?.summary?.latestVital || vitals[0];
  const bp =
    latest?.measurements?.systolicBp != null
      ? `${latest.measurements.systolicBp}/${latest.measurements.diastolicBp ?? '—'}`
      : '—';

  const canWriteChart = !!user && ['clinician', 'nurse', 'admin'].includes(user.role);
  const listedAllergies = activeAllergies(allergies);
  const allergyCount = listedAllergies.length;
  const severeAllergy = listedAllergies.some((item) => item.severity === 'severe');
  const conditionCount = snapshot ? activeConditions(snapshot.conditions).length : null;
  const medicationCount = snapshot ? snapshot.medications.length : null;
  const lastVisit = snapshot ? lastVisitIso(snapshot.visits, snapshot.appointments) : null;
  const stickyTop = `calc(4rem + ${chromeHeight}px + 0.75rem)`;

  return (
    <div style={{ '--chart-chrome': `${chromeHeight}px` } as CSSProperties}>
      {patient ? (
        <div
          ref={chromeRef}
          className="sticky top-16 z-20 -mx-4 max-w-[100vw] border-b border-slate-200 bg-slate-50/95 px-4 py-4 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
        >
          <ChartHeader
            patient={patient}
            directory={directory}
            allergyCount={allergyCount}
            medicationCount={medicationCount}
            conditionCount={conditionCount}
            lastVisit={lastVisit}
            severeAllergy={severeAllergy}
            countsReady={snapshotReady}
            canEncounter={canManageEncounters(user?.role)}
            canOrder={canWriteChart}
            canReferral={canWriteChart}
            onAction={openAction}
          />
        </div>
      ) : (
        <ErrorNotice
          title="This chart could not be opened"
          message={error || 'That record could not be found.'}
          onRetry={() => void loadTab(tab)}
        />
      )}

      {patient && (
        <ChartNav
          tab={tab}
          onChange={selectTab}
          allergyCount={allergyCount}
          overdueRecalls={snapshot?.overdueRecalls.length ?? patient.summary?.overdueRecalls ?? 0}
        />
      )}

      {patient && (
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div id="chart-panel" tabIndex={-1} className="order-2 min-w-0 space-y-6 outline-none lg:order-1">
            <ChartSafety
              allergies={allergies}
              allergiesReady={allergiesReady}
              snapshot={snapshot}
              ready={snapshotReady}
              overdueCount={snapshot?.overdueRecalls.length || patient.summary?.overdueRecalls || 0}
              onOpen={selectTab}
            />
            <ActiveVisitBanner patientId={patient._id} />
            <EncounterSummary
              patientId={patient._id}
              refreshKey={encounterVersion}
              canManage={canManageEncounters(user?.role)}
              onOpen={() => selectTab('encounters')}
            />
            {error && (
              <ErrorNotice message={error} onRetry={() => void loadTab(tab)} />
            )}

      {tab === 'timeline' && <PatientTimeline patientId={id} onOpen={openRecord} />}

      {tab === 'overview' && patient && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard
              label="Active problems"
              value={patient.summary?.activeConditions ?? conditions.filter((c) => c.status === 'active').length}
              tone="accent"
            />
            <StatCard
              label="Active medications"
              value={patient.summary?.activeMedications ?? medications.length}
            />
            <StatCard label="Active orders" value={patient.summary?.activeOrders ?? 0} />
            <StatCard
              label="Active referrals"
              value={patient.summary?.activeReferrals ?? 0}
              hint={
                patient.summary?.followUpReferrals
                  ? `${patient.summary.followUpReferrals} need follow-up`
                  : undefined
              }
            />
            <StatCard
              label="Active monitoring"
              value={patient.summary?.activeMonitoring ?? 0}
              hint={
                patient.summary?.overdueRecalls
                  ? `${patient.summary.overdueRecalls} overdue recall${
                      patient.summary.overdueRecalls === 1 ? '' : 's'
                    }`
                  : undefined
              }
              tone={patient.summary?.overdueRecalls ? 'warn' : 'default'}
            />
            <StatCard label="Latest BP" value={bp} hint={latest ? latest.source : undefined} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DemographicsPanel
              patient={patient}
              canWrite={!!user && ['clinician', 'nurse', 'admin'].includes(user.role)}
              onSaved={refreshPatient}
            />
            <CareTeamPanel
              members={patient.careTeam || []}
              directory={directory}
              canEdit={!!user && ['clinician', 'nurse', 'admin'].includes(user.role)}
              onSave={async (ids) => {
                const updated = await patientsApi.update(id, { careTeam: ids });
                setPatient((current) =>
                  current ? { ...updated, summary: current.summary } : updated
                );
              }}
            />
          </div>
          <Panel title="Active problems">
              <ul className="space-y-2 text-sm">
                {conditions
                  .filter((c) => c.status === 'active')
                  .map((c) => (
                    <li key={c._id} className="flex items-center justify-between gap-2">
                      <span>
                        {c.display}
                        {c.code ? <span className="text-gray-500"> · {c.code}</span> : null}
                      </span>
                      <StatusBadge value={c.severity} />
                    </li>
                  ))}
                {conditions.filter((c) => c.status === 'active').length === 0 && (
                  <EmptyState text="No active problems" hint="Problems recorded on this chart show up here." />
                )}
              </ul>
            </Panel>
          <MedicationSummary patientId={id} onOpen={() => selectTab('medications')} />
          <OrderSummary patientId={id} onOpen={() => selectTab('orders')} />
          <ReferralSummary patientId={id} onOpen={() => selectTab('referrals')} />
          <CarePlanSummary patientId={id} onOpen={() => selectTab('care')} />
          <MonitoringSummary patientId={id} onOpen={() => selectTab('monitoring')} />
        </div>
      )}

      {tab === 'problems' && (
        <ProblemList
          patientId={id}
          problems={conditions}
          diagnoses={diagnoses}
          clinicians={directory.filter((person) => person.role === 'clinician')}
          canWriteProblems={!!user && ['clinician', 'nurse', 'admin'].includes(user.role)}
          canManageDiagnoses={canManageEncounters(user?.role)}
          onChange={() => loadTab('problems')}
        />
      )}
      {tab === 'vitals' && (
        <VitalsTab
          id={id}
          items={vitals}
          onChange={() => loadTab('vitals')}
          canWrite={!!user && ['clinician', 'nurse', 'caregiver', 'admin'].includes(user.role)}
          role={user?.role}
        />
      )}
      {tab === 'medications' && (
        <MedicationPanel
          patientId={id}
          canWrite={!!user && ['clinician', 'pharmacist', 'admin'].includes(user.role)}
          actorId={user?.id}
        />
      )}
      {tab === 'orders' && (
        <OrderPanel
          patientId={id}
          canWrite={canWriteChart}
          actorId={user?.id}
          focusToken={compose?.target === 'orders' ? compose.token : undefined}
          recordFocus={recordFocus}
        />
      )}
      {tab === 'referrals' && (
        <ReferralPanel
          patientId={id}
          canWrite={canWriteChart}
          focusToken={compose?.target === 'referrals' ? compose.token : undefined}
          recordFocus={recordFocus}
        />
      )}
      {tab === 'appointments' && (
        <AppointmentHistory
          patientId={id}
          focusId={recordFocus?.tab === 'appointments' ? recordFocus.recordId : ''}
          focusToken={recordFocus?.tab === 'appointments' ? recordFocus.token : 0}
        />
      )}
      {tab === 'encounters' && (
        <EncounterChart
          patientId={id}
          canManage={canManageEncounters(user?.role)}
          onChanged={() => setEncounterVersion((version) => version + 1)}
          focusToken={compose?.target === 'encounters' ? compose.token : undefined}
          recordFocus={recordFocus}
        />
      )}
      {tab === 'notes' && (
        <NotesTab
          id={id}
          items={notes}
          onChange={() => loadTab('notes')}
          canWrite={!!user && ['clinician', 'nurse', 'admin'].includes(user.role)}
          focusId={recordFocus?.tab === 'notes' ? recordFocus.recordId : ''}
          focusToken={recordFocus?.tab === 'notes' ? recordFocus.token : 0}
        />
      )}
      {tab === 'allergies' && (
        <AllergiesTab
          id={id}
          items={allergies}
          onChange={() => loadTab('allergies')}
          canWrite={!!user && ['clinician', 'nurse', 'admin'].includes(user.role)}
        />
      )}
      {tab === 'monitoring' && (
        <MonitoringPanel
          patientId={id}
          canWrite={!!user && ['clinician', 'nurse', 'admin'].includes(user.role)}
          canRecord={!!user && ['clinician', 'nurse', 'caregiver', 'admin'].includes(user.role)}
          caregiver={user?.role === 'caregiver'}
          actorId={user?.id}
          recordFocus={recordFocus}
        />
      )}
      {tab === 'audit' && <AuditHistory patientId={id} />}
      {tab === 'care' && (
        <div className="space-y-6">
          <CarePlanPanel
            patientId={id}
            canWrite={!!user && ['clinician', 'nurse', 'admin'].includes(user.role)}
            actorId={user?.id}
            recordFocus={recordFocus}
          />
          <CareTasks
            id={id}
            tasks={tasks}
            onChange={() => loadTab('care')}
            canWriteTask={
              !!user &&
              ['clinician', 'nurse', 'caregiver', 'pharmacist', 'admin'].includes(user.role)
            }
            role={user?.role}
            userId={user?.id}
          />
        </div>
      )}
          </div>
          <ChartSnapshot
            allergies={allergies}
            snapshot={snapshot}
            onOpen={selectTab}
            stickyTop={stickyTop}
          />
        </div>
      )}
    </div>
  );
}

function DemographicsPanel({
  patient,
  canWrite,
  onSaved,
}: {
  patient: Patient;
  canWrite: boolean;
  onSaved: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [healthProvince, setHealthProvince] = useState(
    patient.provincialHealth?.province || 'ON'
  );

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = patientPayloadFromForm(fd);
    try {
      await patientsApi.update(patient._id, {
        ...payload,
        identifiers: {
          ...payload.identifiers,
          nationalId: patient.identifiers?.nationalId,
        },
      });
      setEditing(false);
      setError('');
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  if (!editing) {
    return (
      <Panel title="Canadian registration">
        <dl className="text-sm space-y-2">
          <Row label="Preferred name" value={patient.preferredName} />
          <Row label="Language" value={patient.language} />
          <Row label="Sex at birth" value={patient.sex} />
          <Row label="Gender identity" value={patient.genderIdentity} />
          <Row label="Email" value={patient.contact?.email} />
          <Row
            label="Health card"
            value={
              patient.provincialHealth
                ? `${patient.provincialHealth.province} ${patient.provincialHealth.healthCardNumber}${
                    patient.provincialHealth.versionCode
                      ? ` · ver ${patient.provincialHealth.versionCode}`
                      : ''
                  }`
                : undefined
            }
          />
          <Row
            label="Address"
            value={formatAddress(patient.address) || patient.contact?.address}
          />
          <Row
            label="Emergency"
            value={
              patient.emergencyContact
                ? `${patient.emergencyContact.name}${
                    patient.emergencyContact.relationship
                      ? ` (${patient.emergencyContact.relationship})`
                      : ''
                  }${patient.emergencyContact.phone ? ` · ${patient.emergencyContact.phone}` : ''}`
                : undefined
            }
          />
          <Row
            label="SDM"
            value={
              patient.substituteDecisionMaker
                ? `${patient.substituteDecisionMaker.name}${
                    patient.substituteDecisionMaker.relationship
                      ? ` (${patient.substituteDecisionMaker.relationship})`
                      : ''
                  }${
                    patient.substituteDecisionMaker.phone
                      ? ` · ${patient.substituteDecisionMaker.phone}`
                      : ''
                  }`
                : undefined
            }
          />
          <Row label="Insurance" value={patient.identifiers?.insuranceMemberId} />
        </dl>
        {canWrite && (
          <button
            type="button"
            onClick={() => {
              setHealthProvince(patient.provincialHealth?.province || 'ON');
              setEditing(true);
            }}
            className={`${btnGhost} mt-4`}
          >
            Edit registration
          </button>
        )}
      </Panel>
    );
  }

  return (
    <FormCard onSubmit={onSubmit} error={error}>
      <h3 className="font-semibold text-gray-900 mb-4">Edit Canadian registration</h3>
      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Legal given name</label>
            <input name="givenName" required defaultValue={patient.givenName} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Legal family name</label>
            <input
              name="familyName"
              required
              defaultValue={patient.familyName}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Preferred name</label>
            <input
              name="preferredName"
              defaultValue={patient.preferredName || ''}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Date of birth</label>
            <input
              name="birthDate"
              type="date"
              required
              defaultValue={dateInput(patient.birthDate)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Language</label>
            <select name="language" defaultValue={patient.language || 'en'} className={inputCls}>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Sex at birth</label>
            <select name="sex" defaultValue={patient.sex} className={inputCls}>
              {SEX_AT_BIRTH.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Gender identity</label>
            <select
              name="genderIdentity"
              defaultValue={patient.genderIdentity || 'unknown'}
              className={inputCls}
            >
              {GENDER_IDENTITIES.map((g) => (
                <option key={g.code} value={g.code}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Phone</label>
            <input name="phone" defaultValue={patient.contact?.phone || ''} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input
              name="email"
              type="email"
              defaultValue={patient.contact?.email || ''}
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-700 mb-2">Provincial health</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Province</label>
              <select
                name="healthProvince"
                value={healthProvince}
                onChange={(e) => setHealthProvince(e.target.value)}
                className={inputCls}
              >
                {CANADIAN_PROVINCES.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Health card number</label>
              <input
                name="healthCardNumber"
                defaultValue={patient.provincialHealth?.healthCardNumber || ''}
                className={inputCls}
              />
            </div>
            {healthProvince === 'ON' && (
              <div>
                <label className={labelCls}>Version code</label>
                <input
                  name="versionCode"
                  defaultValue={patient.provincialHealth?.versionCode || ''}
                  className={inputCls}
                />
              </div>
            )}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-700 mb-2">Address</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className={labelCls}>Street</label>
              <input name="street" defaultValue={patient.address?.street || ''} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>City</label>
              <input name="city" defaultValue={patient.address?.city || ''} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Province</label>
              <select
                name="addrProvince"
                defaultValue={patient.address?.province || 'ON'}
                className={inputCls}
              >
                {CANADIAN_PROVINCES.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.code}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Postal code</label>
              <input
                name="postalCode"
                defaultValue={patient.address?.postalCode || ''}
                className={inputCls}
              />
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-700 mb-2">Emergency contact</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Name</label>
              <input
                name="emergencyName"
                defaultValue={patient.emergencyContact?.name || ''}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Relationship</label>
              <select
                name="emergencyRelationship"
                defaultValue={patient.emergencyContact?.relationship || ''}
                className={inputCls}
              >
                <option value="">—</option>
                {RELATIONSHIPS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input
                name="emergencyPhone"
                defaultValue={patient.emergencyContact?.phone || ''}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Secondary phone</label>
              <input
                name="emergencyPhoneSecondary"
                defaultValue={patient.emergencyContact?.phoneSecondary || ''}
                className={inputCls}
              />
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-700 mb-2">Substitute decision maker</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Name</label>
              <input
                name="sdmName"
                defaultValue={patient.substituteDecisionMaker?.name || ''}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Relationship</label>
              <select
                name="sdmRelationship"
                defaultValue={patient.substituteDecisionMaker?.relationship || ''}
                className={inputCls}
              >
                <option value="">—</option>
                {RELATIONSHIPS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input
                name="sdmPhone"
                defaultValue={patient.substituteDecisionMaker?.phone || ''}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Secondary phone</label>
              <input
                name="sdmPhoneSecondary"
                defaultValue={patient.substituteDecisionMaker?.phoneSecondary || ''}
                className={inputCls}
              />
            </div>
          </div>
        </div>

        <div>
          <label className={labelCls}>Insurance member id</label>
          <input
            name="insuranceMemberId"
            defaultValue={patient.identifiers?.insuranceMemberId || ''}
            className={inputCls}
          />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button type="submit" className={btnPrimary}>
          Save changes
        </button>
        <button type="button" onClick={() => setEditing(false)} className={btnGhost}>
          Cancel
        </button>
      </div>
    </FormCard>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-right">{value || '—'}</dd>
    </div>
  );
}

function FormCard({
  children,
  onSubmit,
  error,
}: {
  children: React.ReactNode;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  error?: string;
}) {
  return (
    <form onSubmit={onSubmit} className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">
          {error}
        </div>
      )}
      {children}
    </form>
  );
}

function VitalsTab({
  id,
  items,
  onChange,
  canWrite,
  role,
}: {
  id: string;
  items: Vital[];
  onChange: () => void;
  canWrite: boolean;
  role?: string;
}) {
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Vital | null>(null);
  const sources =
    role === 'caregiver'
      ? ['home', 'device', 'caregiver']
      : ['clinic', 'home', 'device', 'caregiver'];
  const nowLocal = new Date();
  nowLocal.setMinutes(nowLocal.getMinutes() - nowLocal.getTimezoneOffset());
  const defaultDt = editing ? dateTimeInput(editing.effectiveAt) : nowLocal.toISOString().slice(0, 16);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const num = (k: string) => {
      const v = fd.get(k);
      return v ? Number(v) : undefined;
    };
    const body = {
      effectiveAt: fd.get('effectiveAt'),
      source: fd.get('source'),
      measurements: {
        systolicBp: num('systolicBp'),
        diastolicBp: num('diastolicBp'),
        heartRate: num('heartRate'),
        respiratoryRate: num('respiratoryRate'),
        temperatureC: num('temperatureC'),
        spo2: num('spo2'),
        weightKg: num('weightKg'),
        heightCm: num('heightCm'),
      },
    };
    try {
      if (editing) await clinicalApi.vitals(id).update(editing._id, body);
      else await clinicalApi.vitals(id).create(body);
      setEditing(null);
      setError('');
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <div>
      {canWrite && (
        <FormCard key={editing?._id || 'new'} onSubmit={onSubmit} error={error}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Date/time</label>
              <input
                name="effectiveAt"
                type="datetime-local"
                defaultValue={defaultDt}
                required
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Source</label>
              <select name="source" defaultValue={editing?.source || sources[0]} className={inputCls}>
                {sources.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            {(
              [
                ['systolicBp', 'Systolic BP'],
                ['diastolicBp', 'Diastolic BP'],
                ['heartRate', 'HR'],
                ['respiratoryRate', 'RR'],
                ['temperatureC', 'Temp °C'],
                ['spo2', 'SpO2'],
                ['weightKg', 'Weight kg'],
                ['heightCm', 'Height cm'],
              ] as const
            ).map(([name, label]) => (
              <div key={name}>
                <label className={labelCls}>{label}</label>
                <input
                  name={name}
                  type="number"
                  step="any"
                  defaultValue={editing?.measurements?.[name] ?? ''}
                  className={inputCls}
                />
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" className={btnPrimary}>
              {editing ? 'Save changes' : 'Record vitals'}
            </button>
            {editing && (
              <button type="button" onClick={() => setEditing(null)} className={btnGhost}>
                Cancel
              </button>
            )}
          </div>
        </FormCard>
      )}
      <Panel
        title="Observations"
        subtitle="Trend charts live in CliniX Insight; Core stores validated measurements."
      >
        {items.length === 0 ? (
          <EmptyState text="No vitals recorded" hint="Blood pressure, pulse, and other measurements for this chart show up here." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 border-b border-gray-200">
                <th className="pb-3 pr-3">When</th>
                <th className="pb-3 pr-3">Source</th>
                <th className="pb-3 pr-3">BP</th>
                <th className="pb-3 pr-3">HR</th>
                <th className="pb-3 pr-3">SpO2</th>
                <th className="pb-3 pr-3">Temp</th>
                <th className="pb-3 pr-3">Wt</th>
                <th className="pb-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((v) => (
                <tr key={v._id}>
                  <td className="py-3 pr-3">{new Date(v.effectiveAt).toLocaleString()}</td>
                  <td className="py-3 pr-3">{v.source}</td>
                  <td className="py-3 pr-3">
                    {v.measurements.systolicBp != null
                      ? `${v.measurements.systolicBp}/${v.measurements.diastolicBp ?? '—'}`
                      : '—'}
                  </td>
                  <td className="py-3 pr-3">{v.measurements.heartRate ?? '—'}</td>
                  <td className="py-3 pr-3">{v.measurements.spo2 ?? '—'}</td>
                  <td className="py-3 pr-3">{v.measurements.temperatureC ?? '—'}</td>
                  <td className="py-3 pr-3">{v.measurements.weightKg ?? '—'}</td>
                  <td className="py-3 text-right">
                    {canWrite && (role !== 'caregiver' || ['home', 'device', 'caregiver'].includes(v.source)) && (
                      <button type="button" className="text-clinical-teal hover:underline" onClick={() => setEditing(v)}>
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}

function NotesTab({
  id,
  items,
  onChange,
  canWrite,
  focusId = '',
  focusToken = 0,
}: {
  id: string;
  items: ClinicalNote[];
  onChange: () => void;
  canWrite: boolean;
  focusId?: string;
  focusToken?: number;
}) {
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<ClinicalNote | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = { body: fd.get('body') };
    try {
      if (editing) await clinicalApi.notes(id).update(editing._id, body);
      else await clinicalApi.notes(id).create(body);
      setEditing(null);
      setError('');
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  useEffect(() => {
    if (!focusToken || !focusId) return;
    return watchChartRecord('note', focusId);
  }, [focusToken, focusId, items]);

  return (
    <div>
      {canWrite && (
        <FormCard key={editing?._id || 'new'} onSubmit={onSubmit} error={error}>
          <div>
            <label className={labelCls}>{editing ? 'New revision' : 'Note'}</label>
            <textarea
              name="body"
              rows={4}
              required
              defaultValue={editing?.body || ''}
              className={inputCls}
            />
          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" className={btnPrimary}>
              {editing ? 'Save revision' : 'Add note'}
            </button>
            {editing && (
              <button type="button" onClick={() => setEditing(null)} className={btnGhost}>
                Cancel
              </button>
            )}
          </div>
        </FormCard>
      )}
      <Panel subtitle="Editing a note keeps every previous version.">
        {items.length === 0 ? (
          <EmptyState text="No clinical notes" hint="Notes written on this chart show up here." />
        ) : (
          <div className="divide-y divide-gray-100">
            {items.map((n) => (
              <article
                key={n._id}
                id={chartRecordId('note', n._id)}
                className={`py-4 first:pt-0 last:pb-0 ${focusedRecordClass(n._id === focusId)}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="text-xs text-gray-500 mb-2">
                    Revision {n.version}
                    {authorName(n.authorId) ? ` · ${authorName(n.authorId)}` : ''} ·{' '}
                    {new Date(n.createdAt).toLocaleString()}
                  </div>
                  {canWrite && (
                    <button
                      type="button"
                      className="text-sm text-clinical-teal hover:underline shrink-0"
                      onClick={() => setEditing(n)}
                    >
                      Revise
                    </button>
                  )}
                </div>
                <p className="text-sm whitespace-pre-wrap text-gray-800">{n.body}</p>
                <NoteTimeline patientId={id} noteId={n._id} />
              </article>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function NoteTimeline({ patientId, noteId }: { patientId: string; noteId: string }) {
  const [open, setOpen] = useState(false);
  const [revisions, setRevisions] = useState<ClinicalNote[] | null>(null);
  const [error, setError] = useState('');

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !revisions) {
      try {
        const res = await clinicalApi.notes(patientId).revisions(noteId);
        setRevisions(res.data);
        setError('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load revisions');
      }
    }
  }

  return (
    <div className="mt-3">
      <button type="button" onClick={toggle} className="text-xs text-clinical-teal hover:underline">
        {open ? 'Hide revision timeline' : 'Revision timeline'}
      </button>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
      {open && revisions && (
        <ol className="mt-3 space-y-3 border-l border-gray-200 pl-4">
          {revisions.map((revision) => (
            <li key={revision._id}>
              <div className="text-xs text-gray-500">
                Revision {revision.version}
                {authorName(revision.authorId) ? ` · ${authorName(revision.authorId)}` : ''} ·{' '}
                {new Date(revision.createdAt).toLocaleString()}
              </div>
              <p className="text-sm whitespace-pre-wrap text-gray-700 mt-1">{revision.body}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function CareTasks({
  id,
  tasks,
  onChange,
  canWriteTask,
  role,
  userId,
}: {
  id: string;
  tasks: Task[];
  onChange: () => void;
  canWriteTask: boolean;
  role?: string;
  userId?: string;
}) {
  const [error, setError] = useState('');

  async function onTask(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await clinicalApi.tasks(id).create({
        title: fd.get('title'),
        assigneeRole: fd.get('assigneeRole'),
        status: 'pending',
        dueDate: fd.get('dueDate') || undefined,
      });
      e.currentTarget.reset();
      setError('');
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  function taskEditable(task: Task) {
    if (!canWriteTask) return false;
    if (role === 'admin' || role === 'clinician') return true;
    const assignee =
      task.assigneeUserId && typeof task.assigneeUserId === 'object'
        ? task.assigneeUserId._id
        : task.assigneeUserId;
    return task.assigneeRole === role || assignee === userId;
  }

  async function saveTaskStatus(task: Task, status: string) {
    try {
      await clinicalApi.tasks(id).update(task._id, {
        title: task.title,
        assigneeRole: task.assigneeRole,
        status,
        dueDate: task.dueDate || undefined,
      });
      setError('');
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <Panel title="Tasks">
        {canWriteTask && (
          <form onSubmit={onTask} className="mb-6 pb-6 border-b border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Title</label>
                <input name="title" required className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Assignee role</label>
                <select name="assigneeRole" defaultValue="nurse" className={inputCls}>
                  <option>clinician</option>
                  <option>nurse</option>
                  <option>caregiver</option>
                  <option>pharmacist</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Due</label>
                <input name="dueDate" type="date" className={inputCls} />
              </div>
            </div>
            <button type="submit" className={`${btnPrimary} mt-4`}>
              Add task
            </button>
          </form>
        )}
        {tasks.length === 0 ? (
          <EmptyState text="No open tasks" hint="Care tasks for this chart show up here until they are completed." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 border-b border-gray-200">
                <th className="pb-3 pr-3">Task</th>
                <th className="pb-3 pr-3">Role</th>
                <th className="pb-3 pr-3">Status</th>
                <th className="pb-3">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tasks.map((t) => (
                <tr key={t._id}>
                  <td className="py-3 pr-3 font-medium">{t.title}</td>
                  <td className="py-3 pr-3 text-gray-600">{t.assigneeRole}</td>
                  <td className="py-3 pr-3">
                    {taskEditable(t) ? (
                      <select
                        className={inputCls}
                        value={t.status}
                        onChange={(event) => saveTaskStatus(t, event.target.value)}
                      >
                        <option value="pending">pending</option>
                        <option value="in_progress">in_progress</option>
                        <option value="completed">completed</option>
                      </select>
                    ) : (
                      <StatusBadge value={t.status} />
                    )}
                  </td>
                  <td className="py-3 text-gray-600">{t.dueDate?.slice(0, 10) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}

function AllergiesTab({
  id,
  items,
  onChange,
  canWrite,
}: {
  id: string;
  items: Allergy[];
  onChange: () => void;
  canWrite: boolean;
}) {
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Allergy | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  function payload(fd: FormData) {
    return {
      substance: fd.get('substance'),
      reaction: fd.get('reaction'),
      severity: fd.get('severity'),
      status: fd.get('status'),
      recordedDate: fd.get('recordedDate'),
    };
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = payload(new FormData(e.currentTarget));
    try {
      if (editing) await clinicalApi.allergies(id).update(editing._id, body);
      else await clinicalApi.allergies(id).create(body);
      setEditing(null);
      setError('');
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <div>
      {canWrite && (
        <FormCard key={editing?._id || 'new'} onSubmit={onSubmit} error={error}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Substance</label>
              <input name="substance" required defaultValue={editing?.substance || ''} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Reaction</label>
              <input name="reaction" required defaultValue={editing?.reaction || ''} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Severity</label>
              <select name="severity" defaultValue={editing?.severity || 'moderate'} className={inputCls}>
                <option>mild</option>
                <option>moderate</option>
                <option>severe</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select name="status" defaultValue={editing?.status || 'active'} className={inputCls}>
                <option>active</option>
                <option>inactive</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Recorded</label>
              <input
                name="recordedDate"
                type="date"
                required
                defaultValue={dateInput(editing?.recordedDate) || today}
                className={inputCls}
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" className={btnPrimary}>
              {editing ? 'Save changes' : 'Add allergy'}
            </button>
            {editing && (
              <button type="button" onClick={() => setEditing(null)} className={btnGhost}>
                Cancel
              </button>
            )}
          </div>
        </FormCard>
      )}
      <Panel>
        {items.length === 0 ? (
          <EmptyState text="No allergies recorded" hint="Active allergies also appear on the safety banner at the top of the chart." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 border-b border-gray-200">
                <th className="pb-3 pr-3">Substance</th>
                <th className="pb-3 pr-3">Reaction</th>
                <th className="pb-3 pr-3">Severity</th>
                <th className="pb-3 pr-3">Status</th>
                <th className="pb-3 pr-3">Recorded</th>
                <th className="pb-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((allergy) => (
                <tr key={allergy._id}>
                  <td className="py-3 pr-3 font-medium">{allergy.substance}</td>
                  <td className="py-3 pr-3 text-gray-600">{allergy.reaction}</td>
                  <td className="py-3 pr-3">
                    <StatusBadge value={allergy.severity} />
                  </td>
                  <td className="py-3 pr-3">
                    <StatusBadge value={allergy.status} />
                  </td>
                  <td className="py-3 pr-3 text-gray-600">{allergy.recordedDate?.slice(0, 10)}</td>
                  <td className="py-3 text-right">
                    {canWrite && (
                      <button
                        type="button"
                        className="text-clinical-teal hover:underline"
                        onClick={() => setEditing(allergy)}
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
