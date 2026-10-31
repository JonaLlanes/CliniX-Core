import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { appointmentsApi, clinicalApi, authApi, patientsApi, visitsApi, } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Panel, { EmptyState } from '../components/Panel';
import { ErrorNotice } from '../components/feedback';
import StatCard from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import ActiveVisitBanner from '../components/ActiveVisitBanner';
import ChartHeader from '../components/chart/ChartHeader';
import ChartNav from '../components/chart/ChartNav';
import ChartSafety from '../components/chart/ChartSafety';
import ChartSkeleton from '../components/chart/ChartSkeleton';
import ChartSnapshot from '../components/chart/ChartSnapshot';
import { rememberChart } from '../components/dashboard/recentCharts';
import { activeAllergies, activeConditions, isChartTab, lastVisitIso, } from '../components/chart/chartDisplay';
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
import { chartRecordId, focusedRecordClass, watchChartRecord } from '../components/chart/recordFocus';
import { CANADIAN_PROVINCES, GENDER_IDENTITIES, LANGUAGES, RELATIONSHIPS, SEX_AT_BIRTH, formatAddress, patientPayloadFromForm, } from '../components/canadianRegistration';
const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm';
const labelCls = 'block text-xs font-medium text-gray-600 mb-1';
const btnPrimary = 'px-4 py-2 bg-clinical-teal text-white rounded-lg text-sm hover:bg-clinical-teal-dark';
const btnGhost = 'px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50';
function dateInput(value) {
    return value ? value.slice(0, 10) : '';
}
function dateTimeInput(value) {
    if (!value)
        return '';
    const date = new Date(value);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
}
function authorName(author) {
    if (author && typeof author === 'object')
        return author.displayName || '';
    return '';
}
export default function PatientDetailPage() {
    const { id = '' } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user } = useAuth();
    const requestedTab = searchParams.get('tab');
    const tabFromUrl = isChartTab(requestedTab) ? requestedTab : 'overview';
    const [tab, setTab] = useState(tabFromUrl);
    const [routeTab, setRouteTab] = useState({ id, requestedTab });
    if (routeTab.id !== id || routeTab.requestedTab !== requestedTab) {
        setRouteTab({ id, requestedTab });
        setTab(tabFromUrl);
    }
    function selectTab(next) {
        setTab(next);
        const params = new URLSearchParams(searchParams);
        if (next === 'overview')
            params.delete('tab');
        else
            params.set('tab', next);
        setSearchParams(params, { replace: true });
    }
    const [compose, setCompose] = useState(null);
    const [recordFocus, setRecordFocus] = useState(null);
    const [encounterVersion, setEncounterVersion] = useState(0);
    const [patient, setPatient] = useState(null);
    const [snapshot, setSnapshot] = useState(null);
    const [snapshotReady, setSnapshotReady] = useState(false);
    const [allergiesReady, setAllergiesReady] = useState(false);
    const [chromeHeight, setChromeHeight] = useState(148);
    const chromeRef = useRef(null);
    const workspaceRequest = useRef(0);
    const chartRequest = useRef(0);
    const [error, setError] = useState('');
    const [conditions, setConditions] = useState([]);
    const [diagnoses, setDiagnoses] = useState([]);
    const [vitals, setVitals] = useState([]);
    const [medications, setMedications] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [notes, setNotes] = useState([]);
    const [allergies, setAllergies] = useState([]);
    const [directory, setDirectory] = useState([]);
    async function refreshPatient() {
        setPatient(await patientsApi.get(id));
    }
    async function loadWorkspace() {
        const request = ++workspaceRequest.current;
        const [conditionsPage, medicationPage, taskPage, appointmentPage, visitPage, monitor, resultPage] = await Promise.all([
            clinicalApi.conditions(id).list('?limit=100').catch(() => null),
            clinicalApi.medications(id).list('?status=active&limit=100').catch(() => null),
            clinicalApi.tasks(id).list().catch(() => null),
            appointmentsApi.history(id).catch(() => null),
            visitsApi.forPatient(id).catch(() => null),
            clinicalApi.monitoring(id).dashboard().catch(() => null),
            clinicalApi.orders(id).results('?limit=100').catch(() => null),
        ]);
        if (request !== workspaceRequest.current)
            return;
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
    async function loadTab(t) {
        const request = ++chartRequest.current;
        setError('');
        try {
            const nextPatient = await patientsApi.get(id);
            if (request !== chartRequest.current)
                return;
            setPatient(nextPatient);
            const allergyList = (await clinicalApi.allergies(id).list()).data;
            if (request !== chartRequest.current)
                return;
            setAllergies(allergyList);
            setAllergiesReady(true);
            if (t === 'problems' || t === 'overview') {
                const next = (await clinicalApi.conditions(id).list('?limit=100')).data;
                if (request !== chartRequest.current)
                    return;
                setConditions(next);
            }
            if (t === 'problems') {
                const next = (await clinicalApi.diagnoses(id).list('?limit=100')).data;
                if (request !== chartRequest.current)
                    return;
                setDiagnoses(next);
            }
            if (t === 'vitals' || t === 'overview') {
                const next = (await clinicalApi.vitals(id).list('?limit=20')).data;
                if (request !== chartRequest.current)
                    return;
                setVitals(next);
            }
            if (t === 'overview') {
                const next = (await clinicalApi.medications(id).list('?status=active&limit=100')).data;
                if (request !== chartRequest.current)
                    return;
                setMedications(next);
            }
            if (t === 'care') {
                const next = (await clinicalApi.tasks(id).list()).data;
                if (request !== chartRequest.current)
                    return;
                setTasks(next);
            }
            if (t === 'notes') {
                const next = (await clinicalApi.notes(id).list('?limit=100')).data;
                if (request !== chartRequest.current)
                    return;
                setNotes(next);
            }
        }
        catch (err) {
            if (request !== chartRequest.current)
                return;
            setError(err instanceof Error ? err.message : 'Load failed');
        }
        if (request === chartRequest.current)
            void loadWorkspace();
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
        if (!node || typeof ResizeObserver === 'undefined')
            return;
        const observer = new ResizeObserver(() => setChromeHeight(node.offsetHeight));
        observer.observe(node);
        return () => observer.disconnect();
    }, [patient]);
    useEffect(() => {
        loadTab(tab);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, tab]);
    useEffect(() => {
        if (!patient)
            return;
        rememberChart({
            id: patient._id,
            name: `${patient.familyName}, ${patient.givenName}`,
            mrn: patient.mrn,
        });
    }, [patient]);
    useEffect(() => {
        if (!user || !['clinician', 'nurse', 'admin'].includes(user.role))
            return;
        authApi
            .directory()
            .then((res) => setDirectory(res.data))
            .catch(() => setDirectory([]));
    }, [user]);
    function openAction(action) {
        setRecordFocus(null);
        selectTab(action);
        setCompose({ target: action, token: Date.now() });
    }
    function openRecord(event) {
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
        return _jsx(ChartSkeleton, {});
    }
    const latest = patient?.summary?.latestVital || vitals[0];
    const bp = latest?.measurements?.systolicBp != null
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
    return (_jsxs("div", { style: { '--chart-chrome': `${chromeHeight}px` }, children: [patient ? (_jsx("div", { ref: chromeRef, className: "sticky top-16 z-20 -mx-4 max-w-[100vw] border-b border-slate-200 bg-slate-50/95 px-4 py-4 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8", children: _jsx(ChartHeader, { patient: patient, directory: directory, allergyCount: allergyCount, medicationCount: medicationCount, conditionCount: conditionCount, lastVisit: lastVisit, severeAllergy: severeAllergy, countsReady: snapshotReady, canEncounter: canManageEncounters(user?.role), canOrder: canWriteChart, canReferral: canWriteChart, onAction: openAction }) })) : (_jsx(ErrorNotice, { title: "This chart could not be opened", message: error || 'That record could not be found.', onRetry: () => void loadTab(tab) })), patient && (_jsx(ChartNav, { tab: tab, onChange: selectTab, allergyCount: allergyCount, overdueRecalls: snapshot?.overdueRecalls.length ?? patient.summary?.overdueRecalls ?? 0 })), patient && (_jsxs("div", { className: "mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]", children: [_jsxs("div", { id: "chart-panel", tabIndex: -1, className: "order-2 min-w-0 space-y-6 outline-none lg:order-1", children: [_jsx(ChartSafety, { allergies: allergies, allergiesReady: allergiesReady, snapshot: snapshot, ready: snapshotReady, overdueCount: snapshot?.overdueRecalls.length || patient.summary?.overdueRecalls || 0, onOpen: selectTab }), _jsx(ActiveVisitBanner, { patientId: patient._id }), _jsx(EncounterSummary, { patientId: patient._id, refreshKey: encounterVersion, canManage: canManageEncounters(user?.role), onOpen: () => selectTab('encounters') }), error && (_jsx(ErrorNotice, { message: error, onRetry: () => void loadTab(tab) })), tab === 'timeline' && _jsx(PatientTimeline, { patientId: id, onOpen: openRecord }), tab === 'overview' && patient && (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "grid grid-cols-2 lg:grid-cols-3 gap-4", children: [_jsx(StatCard, { label: "Active problems", value: patient.summary?.activeConditions ?? conditions.filter((c) => c.status === 'active').length, tone: "accent" }), _jsx(StatCard, { label: "Active medications", value: patient.summary?.activeMedications ?? medications.length }), _jsx(StatCard, { label: "Active orders", value: patient.summary?.activeOrders ?? 0 }), _jsx(StatCard, { label: "Active referrals", value: patient.summary?.activeReferrals ?? 0, hint: patient.summary?.followUpReferrals
                                                    ? `${patient.summary.followUpReferrals} need follow-up`
                                                    : undefined }), _jsx(StatCard, { label: "Active monitoring", value: patient.summary?.activeMonitoring ?? 0, hint: patient.summary?.overdueRecalls
                                                    ? `${patient.summary.overdueRecalls} overdue recall${patient.summary.overdueRecalls === 1 ? '' : 's'}`
                                                    : undefined, tone: patient.summary?.overdueRecalls ? 'warn' : 'default' }), _jsx(StatCard, { label: "Latest BP", value: bp, hint: latest ? latest.source : undefined })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-6", children: [_jsx(DemographicsPanel, { patient: patient, canWrite: !!user && ['clinician', 'nurse', 'admin'].includes(user.role), onSaved: refreshPatient }), _jsx(CareTeamPanel, { members: patient.careTeam || [], directory: directory, canEdit: !!user && ['clinician', 'nurse', 'admin'].includes(user.role), onSave: async (ids) => {
                                                    const updated = await patientsApi.update(id, { careTeam: ids });
                                                    setPatient((current) => current ? { ...updated, summary: current.summary } : updated);
                                                } })] }), _jsx(Panel, { title: "Active problems", children: _jsxs("ul", { className: "space-y-2 text-sm", children: [conditions
                                                    .filter((c) => c.status === 'active')
                                                    .map((c) => (_jsxs("li", { className: "flex items-center justify-between gap-2", children: [_jsxs("span", { children: [c.display, c.code ? _jsxs("span", { className: "text-gray-500", children: [" \u00B7 ", c.code] }) : null] }), _jsx(StatusBadge, { value: c.severity })] }, c._id))), conditions.filter((c) => c.status === 'active').length === 0 && (_jsx(EmptyState, { text: "No active problems", hint: "Problems recorded on this chart show up here." }))] }) }), _jsx(MedicationSummary, { patientId: id, onOpen: () => selectTab('medications') }), _jsx(OrderSummary, { patientId: id, onOpen: () => selectTab('orders') }), _jsx(ReferralSummary, { patientId: id, onOpen: () => selectTab('referrals') }), _jsx(CarePlanSummary, { patientId: id, onOpen: () => selectTab('care') }), _jsx(MonitoringSummary, { patientId: id, onOpen: () => selectTab('monitoring') })] })), tab === 'problems' && (_jsx(ProblemList, { patientId: id, problems: conditions, diagnoses: diagnoses, clinicians: directory.filter((person) => person.role === 'clinician'), canWriteProblems: !!user && ['clinician', 'nurse', 'admin'].includes(user.role), canManageDiagnoses: canManageEncounters(user?.role), onChange: () => loadTab('problems') })), tab === 'vitals' && (_jsx(VitalsTab, { id: id, items: vitals, onChange: () => loadTab('vitals'), canWrite: !!user && ['clinician', 'nurse', 'caregiver', 'admin'].includes(user.role), role: user?.role })), tab === 'medications' && (_jsx(MedicationPanel, { patientId: id, canWrite: !!user && ['clinician', 'pharmacist', 'admin'].includes(user.role), actorId: user?.id })), tab === 'orders' && (_jsx(OrderPanel, { patientId: id, canWrite: canWriteChart, actorId: user?.id, focusToken: compose?.target === 'orders' ? compose.token : undefined, recordFocus: recordFocus })), tab === 'referrals' && (_jsx(ReferralPanel, { patientId: id, canWrite: canWriteChart, focusToken: compose?.target === 'referrals' ? compose.token : undefined, recordFocus: recordFocus })), tab === 'appointments' && (_jsx(AppointmentHistory, { patientId: id, focusId: recordFocus?.tab === 'appointments' ? recordFocus.recordId : '', focusToken: recordFocus?.tab === 'appointments' ? recordFocus.token : 0 })), tab === 'encounters' && (_jsx(EncounterChart, { patientId: id, canManage: canManageEncounters(user?.role), onChanged: () => setEncounterVersion((version) => version + 1), focusToken: compose?.target === 'encounters' ? compose.token : undefined, recordFocus: recordFocus })), tab === 'notes' && (_jsx(NotesTab, { id: id, items: notes, onChange: () => loadTab('notes'), canWrite: !!user && ['clinician', 'nurse', 'admin'].includes(user.role), focusId: recordFocus?.tab === 'notes' ? recordFocus.recordId : '', focusToken: recordFocus?.tab === 'notes' ? recordFocus.token : 0 })), tab === 'allergies' && (_jsx(AllergiesTab, { id: id, items: allergies, onChange: () => loadTab('allergies'), canWrite: !!user && ['clinician', 'nurse', 'admin'].includes(user.role) })), tab === 'monitoring' && (_jsx(MonitoringPanel, { patientId: id, canWrite: !!user && ['clinician', 'nurse', 'admin'].includes(user.role), canRecord: !!user && ['clinician', 'nurse', 'caregiver', 'admin'].includes(user.role), caregiver: user?.role === 'caregiver', actorId: user?.id, recordFocus: recordFocus })), tab === 'audit' && _jsx(AuditHistory, { patientId: id }), tab === 'care' && (_jsxs("div", { className: "space-y-6", children: [_jsx(CarePlanPanel, { patientId: id, canWrite: !!user && ['clinician', 'nurse', 'admin'].includes(user.role), actorId: user?.id, recordFocus: recordFocus }), _jsx(CareTasks, { id: id, tasks: tasks, onChange: () => loadTab('care'), canWriteTask: !!user &&
                                            ['clinician', 'nurse', 'caregiver', 'pharmacist', 'admin'].includes(user.role), role: user?.role, userId: user?.id })] }))] }), _jsx(ChartSnapshot, { allergies: allergies, snapshot: snapshot, onOpen: selectTab, stickyTop: stickyTop })] }))] }));
}
function DemographicsPanel({ patient, canWrite, onSaved, }) {
    const [editing, setEditing] = useState(false);
    const [error, setError] = useState('');
    const [healthProvince, setHealthProvince] = useState(patient.provincialHealth?.province || 'ON');
    async function onSubmit(e) {
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
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed');
        }
    }
    if (!editing) {
        return (_jsxs(Panel, { title: "Canadian registration", children: [_jsxs("dl", { className: "text-sm space-y-2", children: [_jsx(Row, { label: "Preferred name", value: patient.preferredName }), _jsx(Row, { label: "Language", value: patient.language }), _jsx(Row, { label: "Sex at birth", value: patient.sex }), _jsx(Row, { label: "Gender identity", value: patient.genderIdentity }), _jsx(Row, { label: "Email", value: patient.contact?.email }), _jsx(Row, { label: "Health card", value: patient.provincialHealth
                                ? `${patient.provincialHealth.province} ${patient.provincialHealth.healthCardNumber}${patient.provincialHealth.versionCode
                                    ? ` · ver ${patient.provincialHealth.versionCode}`
                                    : ''}`
                                : undefined }), _jsx(Row, { label: "Address", value: formatAddress(patient.address) || patient.contact?.address }), _jsx(Row, { label: "Emergency", value: patient.emergencyContact
                                ? `${patient.emergencyContact.name}${patient.emergencyContact.relationship
                                    ? ` (${patient.emergencyContact.relationship})`
                                    : ''}${patient.emergencyContact.phone ? ` · ${patient.emergencyContact.phone}` : ''}`
                                : undefined }), _jsx(Row, { label: "SDM", value: patient.substituteDecisionMaker
                                ? `${patient.substituteDecisionMaker.name}${patient.substituteDecisionMaker.relationship
                                    ? ` (${patient.substituteDecisionMaker.relationship})`
                                    : ''}${patient.substituteDecisionMaker.phone
                                    ? ` · ${patient.substituteDecisionMaker.phone}`
                                    : ''}`
                                : undefined }), _jsx(Row, { label: "Insurance", value: patient.identifiers?.insuranceMemberId })] }), canWrite && (_jsx("button", { type: "button", onClick: () => {
                        setHealthProvince(patient.provincialHealth?.province || 'ON');
                        setEditing(true);
                    }, className: `${btnGhost} mt-4`, children: "Edit registration" }))] }));
    }
    return (_jsxs(FormCard, { onSubmit: onSubmit, error: error, children: [_jsx("h3", { className: "font-semibold text-gray-900 mb-4", children: "Edit Canadian registration" }), _jsxs("div", { className: "space-y-5", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Legal given name" }), _jsx("input", { name: "givenName", required: true, defaultValue: patient.givenName, className: inputCls })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Legal family name" }), _jsx("input", { name: "familyName", required: true, defaultValue: patient.familyName, className: inputCls })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Preferred name" }), _jsx("input", { name: "preferredName", defaultValue: patient.preferredName || '', className: inputCls })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Date of birth" }), _jsx("input", { name: "birthDate", type: "date", required: true, defaultValue: dateInput(patient.birthDate), className: inputCls })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Language" }), _jsx("select", { name: "language", defaultValue: patient.language || 'en', className: inputCls, children: LANGUAGES.map((l) => (_jsx("option", { value: l.code, children: l.label }, l.code))) })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Sex at birth" }), _jsx("select", { name: "sex", defaultValue: patient.sex, className: inputCls, children: SEX_AT_BIRTH.map((s) => (_jsx("option", { value: s.code, children: s.label }, s.code))) })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Gender identity" }), _jsx("select", { name: "genderIdentity", defaultValue: patient.genderIdentity || 'unknown', className: inputCls, children: GENDER_IDENTITIES.map((g) => (_jsx("option", { value: g.code, children: g.label }, g.code))) })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Phone" }), _jsx("input", { name: "phone", defaultValue: patient.contact?.phone || '', className: inputCls })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Email" }), _jsx("input", { name: "email", type: "email", defaultValue: patient.contact?.email || '', className: inputCls })] })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs font-semibold text-gray-700 mb-2", children: "Provincial health" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Province" }), _jsx("select", { name: "healthProvince", value: healthProvince, onChange: (e) => setHealthProvince(e.target.value), className: inputCls, children: CANADIAN_PROVINCES.map((p) => (_jsx("option", { value: p.code, children: p.label }, p.code))) })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Health card number" }), _jsx("input", { name: "healthCardNumber", defaultValue: patient.provincialHealth?.healthCardNumber || '', className: inputCls })] }), healthProvince === 'ON' && (_jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Version code" }), _jsx("input", { name: "versionCode", defaultValue: patient.provincialHealth?.versionCode || '', className: inputCls })] }))] })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs font-semibold text-gray-700 mb-2", children: "Address" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { className: "md:col-span-2", children: [_jsx("label", { className: labelCls, children: "Street" }), _jsx("input", { name: "street", defaultValue: patient.address?.street || '', className: inputCls })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "City" }), _jsx("input", { name: "city", defaultValue: patient.address?.city || '', className: inputCls })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Province" }), _jsx("select", { name: "addrProvince", defaultValue: patient.address?.province || 'ON', className: inputCls, children: CANADIAN_PROVINCES.map((p) => (_jsx("option", { value: p.code, children: p.code }, p.code))) })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Postal code" }), _jsx("input", { name: "postalCode", defaultValue: patient.address?.postalCode || '', className: inputCls })] })] })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs font-semibold text-gray-700 mb-2", children: "Emergency contact" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Name" }), _jsx("input", { name: "emergencyName", defaultValue: patient.emergencyContact?.name || '', className: inputCls })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Relationship" }), _jsxs("select", { name: "emergencyRelationship", defaultValue: patient.emergencyContact?.relationship || '', className: inputCls, children: [_jsx("option", { value: "", children: "\u2014" }), RELATIONSHIPS.map((r) => (_jsx("option", { value: r, children: r }, r)))] })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Phone" }), _jsx("input", { name: "emergencyPhone", defaultValue: patient.emergencyContact?.phone || '', className: inputCls })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Secondary phone" }), _jsx("input", { name: "emergencyPhoneSecondary", defaultValue: patient.emergencyContact?.phoneSecondary || '', className: inputCls })] })] })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs font-semibold text-gray-700 mb-2", children: "Substitute decision maker" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Name" }), _jsx("input", { name: "sdmName", defaultValue: patient.substituteDecisionMaker?.name || '', className: inputCls })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Relationship" }), _jsxs("select", { name: "sdmRelationship", defaultValue: patient.substituteDecisionMaker?.relationship || '', className: inputCls, children: [_jsx("option", { value: "", children: "\u2014" }), RELATIONSHIPS.map((r) => (_jsx("option", { value: r, children: r }, r)))] })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Phone" }), _jsx("input", { name: "sdmPhone", defaultValue: patient.substituteDecisionMaker?.phone || '', className: inputCls })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Secondary phone" }), _jsx("input", { name: "sdmPhoneSecondary", defaultValue: patient.substituteDecisionMaker?.phoneSecondary || '', className: inputCls })] })] })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Insurance member id" }), _jsx("input", { name: "insuranceMemberId", defaultValue: patient.identifiers?.insuranceMemberId || '', className: inputCls })] })] }), _jsxs("div", { className: "mt-4 flex gap-2", children: [_jsx("button", { type: "submit", className: btnPrimary, children: "Save changes" }), _jsx("button", { type: "button", onClick: () => setEditing(false), className: btnGhost, children: "Cancel" })] })] }));
}
function Row({ label, value }) {
    return (_jsxs("div", { className: "flex justify-between gap-4", children: [_jsx("dt", { className: "text-gray-500", children: label }), _jsx("dd", { className: "text-right", children: value || '—' })] }));
}
function FormCard({ children, onSubmit, error, }) {
    return (_jsxs("form", { onSubmit: onSubmit, className: "bg-white rounded-lg border border-gray-200 p-6 mb-6", children: [error && (_jsx("div", { className: "mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm", children: error })), children] }));
}
function VitalsTab({ id, items, onChange, canWrite, role, }) {
    const [error, setError] = useState('');
    const [editing, setEditing] = useState(null);
    const sources = role === 'caregiver'
        ? ['home', 'device', 'caregiver']
        : ['clinic', 'home', 'device', 'caregiver'];
    const nowLocal = new Date();
    nowLocal.setMinutes(nowLocal.getMinutes() - nowLocal.getTimezoneOffset());
    const defaultDt = editing ? dateTimeInput(editing.effectiveAt) : nowLocal.toISOString().slice(0, 16);
    async function onSubmit(e) {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const num = (k) => {
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
            if (editing)
                await clinicalApi.vitals(id).update(editing._id, body);
            else
                await clinicalApi.vitals(id).create(body);
            setEditing(null);
            setError('');
            onChange();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed');
        }
    }
    return (_jsxs("div", { children: [canWrite && (_jsxs(FormCard, { onSubmit: onSubmit, error: error, children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Date/time" }), _jsx("input", { name: "effectiveAt", type: "datetime-local", defaultValue: defaultDt, required: true, className: inputCls })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Source" }), _jsx("select", { name: "source", defaultValue: editing?.source || sources[0], className: inputCls, children: sources.map((s) => (_jsx("option", { children: s }, s))) })] }), [
                                ['systolicBp', 'Systolic BP'],
                                ['diastolicBp', 'Diastolic BP'],
                                ['heartRate', 'HR'],
                                ['respiratoryRate', 'RR'],
                                ['temperatureC', 'Temp °C'],
                                ['spo2', 'SpO2'],
                                ['weightKg', 'Weight kg'],
                                ['heightCm', 'Height cm'],
                            ].map(([name, label]) => (_jsxs("div", { children: [_jsx("label", { className: labelCls, children: label }), _jsx("input", { name: name, type: "number", step: "any", defaultValue: editing?.measurements?.[name] ?? '', className: inputCls })] }, name)))] }), _jsxs("div", { className: "mt-4 flex gap-2", children: [_jsx("button", { type: "submit", className: btnPrimary, children: editing ? 'Save changes' : 'Record vitals' }), editing && (_jsx("button", { type: "button", onClick: () => setEditing(null), className: btnGhost, children: "Cancel" }))] })] }, editing?._id || 'new')), _jsx(Panel, { title: "Observations", subtitle: "Trend charts live in CliniX Insight; Core stores validated measurements.", children: items.length === 0 ? (_jsx(EmptyState, { text: "No vitals recorded", hint: "Blood pressure, pulse, and other measurements for this chart show up here." })) : (_jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-xs font-medium text-gray-500 border-b border-gray-200", children: [_jsx("th", { className: "pb-3 pr-3", children: "When" }), _jsx("th", { className: "pb-3 pr-3", children: "Source" }), _jsx("th", { className: "pb-3 pr-3", children: "BP" }), _jsx("th", { className: "pb-3 pr-3", children: "HR" }), _jsx("th", { className: "pb-3 pr-3", children: "SpO2" }), _jsx("th", { className: "pb-3 pr-3", children: "Temp" }), _jsx("th", { className: "pb-3 pr-3", children: "Wt" }), _jsx("th", { className: "pb-3" })] }) }), _jsx("tbody", { className: "divide-y divide-gray-100", children: items.map((v) => (_jsxs("tr", { children: [_jsx("td", { className: "py-3 pr-3", children: new Date(v.effectiveAt).toLocaleString() }), _jsx("td", { className: "py-3 pr-3", children: v.source }), _jsx("td", { className: "py-3 pr-3", children: v.measurements.systolicBp != null
                                            ? `${v.measurements.systolicBp}/${v.measurements.diastolicBp ?? '—'}`
                                            : '—' }), _jsx("td", { className: "py-3 pr-3", children: v.measurements.heartRate ?? '—' }), _jsx("td", { className: "py-3 pr-3", children: v.measurements.spo2 ?? '—' }), _jsx("td", { className: "py-3 pr-3", children: v.measurements.temperatureC ?? '—' }), _jsx("td", { className: "py-3 pr-3", children: v.measurements.weightKg ?? '—' }), _jsx("td", { className: "py-3 text-right", children: canWrite && (role !== 'caregiver' || ['home', 'device', 'caregiver'].includes(v.source)) && (_jsx("button", { type: "button", className: "text-clinical-teal hover:underline", onClick: () => setEditing(v), children: "Edit" })) })] }, v._id))) })] })) })] }));
}
function NotesTab({ id, items, onChange, canWrite, focusId = '', focusToken = 0, }) {
    const [error, setError] = useState('');
    const [editing, setEditing] = useState(null);
    async function onSubmit(e) {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const body = { body: fd.get('body') };
        try {
            if (editing)
                await clinicalApi.notes(id).update(editing._id, body);
            else
                await clinicalApi.notes(id).create(body);
            setEditing(null);
            setError('');
            onChange();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed');
        }
    }
    useEffect(() => {
        if (!focusToken || !focusId)
            return;
        return watchChartRecord('note', focusId);
    }, [focusToken, focusId, items]);
    return (_jsxs("div", { children: [canWrite && (_jsxs(FormCard, { onSubmit: onSubmit, error: error, children: [_jsxs("div", { children: [_jsx("label", { className: labelCls, children: editing ? 'New revision' : 'Note' }), _jsx("textarea", { name: "body", rows: 4, required: true, defaultValue: editing?.body || '', className: inputCls })] }), _jsxs("div", { className: "mt-4 flex gap-2", children: [_jsx("button", { type: "submit", className: btnPrimary, children: editing ? 'Save revision' : 'Add note' }), editing && (_jsx("button", { type: "button", onClick: () => setEditing(null), className: btnGhost, children: "Cancel" }))] })] }, editing?._id || 'new')), _jsx(Panel, { subtitle: "Editing a note keeps every previous version.", children: items.length === 0 ? (_jsx(EmptyState, { text: "No clinical notes", hint: "Notes written on this chart show up here." })) : (_jsx("div", { className: "divide-y divide-gray-100", children: items.map((n) => (_jsxs("article", { id: chartRecordId('note', n._id), className: `py-4 first:pt-0 last:pb-0 ${focusedRecordClass(n._id === focusId)}`, children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { className: "text-xs text-gray-500 mb-2", children: ["Revision ", n.version, authorName(n.authorId) ? ` · ${authorName(n.authorId)}` : '', " \u00B7", ' ', new Date(n.createdAt).toLocaleString()] }), canWrite && (_jsx("button", { type: "button", className: "text-sm text-clinical-teal hover:underline shrink-0", onClick: () => setEditing(n), children: "Revise" }))] }), _jsx("p", { className: "text-sm whitespace-pre-wrap text-gray-800", children: n.body }), _jsx(NoteTimeline, { patientId: id, noteId: n._id })] }, n._id))) })) })] }));
}
function NoteTimeline({ patientId, noteId }) {
    const [open, setOpen] = useState(false);
    const [revisions, setRevisions] = useState(null);
    const [error, setError] = useState('');
    async function toggle() {
        const next = !open;
        setOpen(next);
        if (next && !revisions) {
            try {
                const res = await clinicalApi.notes(patientId).revisions(noteId);
                setRevisions(res.data);
                setError('');
            }
            catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load revisions');
            }
        }
    }
    return (_jsxs("div", { className: "mt-3", children: [_jsx("button", { type: "button", onClick: toggle, className: "text-xs text-clinical-teal hover:underline", children: open ? 'Hide revision timeline' : 'Revision timeline' }), error && _jsx("p", { className: "mt-2 text-xs text-red-700", children: error }), open && revisions && (_jsx("ol", { className: "mt-3 space-y-3 border-l border-gray-200 pl-4", children: revisions.map((revision) => (_jsxs("li", { children: [_jsxs("div", { className: "text-xs text-gray-500", children: ["Revision ", revision.version, authorName(revision.authorId) ? ` · ${authorName(revision.authorId)}` : '', " \u00B7", ' ', new Date(revision.createdAt).toLocaleString()] }), _jsx("p", { className: "text-sm whitespace-pre-wrap text-gray-700 mt-1", children: revision.body })] }, revision._id))) }))] }));
}
function CareTasks({ id, tasks, onChange, canWriteTask, role, userId, }) {
    const [error, setError] = useState('');
    async function onTask(e) {
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
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed');
        }
    }
    function taskEditable(task) {
        if (!canWriteTask)
            return false;
        if (role === 'admin' || role === 'clinician')
            return true;
        const assignee = task.assigneeUserId && typeof task.assigneeUserId === 'object'
            ? task.assigneeUserId._id
            : task.assigneeUserId;
        return task.assigneeRole === role || assignee === userId;
    }
    async function saveTaskStatus(task, status) {
        try {
            await clinicalApi.tasks(id).update(task._id, {
                title: task.title,
                assigneeRole: task.assigneeRole,
                status,
                dueDate: task.dueDate || undefined,
            });
            setError('');
            onChange();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed');
        }
    }
    return (_jsxs("div", { className: "space-y-6", children: [error && (_jsx("div", { className: "bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm", children: error })), _jsxs(Panel, { title: "Tasks", children: [canWriteTask && (_jsxs("form", { onSubmit: onTask, className: "mb-6 pb-6 border-b border-gray-100", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Title" }), _jsx("input", { name: "title", required: true, className: inputCls })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Assignee role" }), _jsxs("select", { name: "assigneeRole", defaultValue: "nurse", className: inputCls, children: [_jsx("option", { children: "clinician" }), _jsx("option", { children: "nurse" }), _jsx("option", { children: "caregiver" }), _jsx("option", { children: "pharmacist" })] })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Due" }), _jsx("input", { name: "dueDate", type: "date", className: inputCls })] })] }), _jsx("button", { type: "submit", className: `${btnPrimary} mt-4`, children: "Add task" })] })), tasks.length === 0 ? (_jsx(EmptyState, { text: "No open tasks", hint: "Care tasks for this chart show up here until they are completed." })) : (_jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-xs font-medium text-gray-500 border-b border-gray-200", children: [_jsx("th", { className: "pb-3 pr-3", children: "Task" }), _jsx("th", { className: "pb-3 pr-3", children: "Role" }), _jsx("th", { className: "pb-3 pr-3", children: "Status" }), _jsx("th", { className: "pb-3", children: "Due" })] }) }), _jsx("tbody", { className: "divide-y divide-gray-100", children: tasks.map((t) => (_jsxs("tr", { children: [_jsx("td", { className: "py-3 pr-3 font-medium", children: t.title }), _jsx("td", { className: "py-3 pr-3 text-gray-600", children: t.assigneeRole }), _jsx("td", { className: "py-3 pr-3", children: taskEditable(t) ? (_jsxs("select", { className: inputCls, value: t.status, onChange: (event) => saveTaskStatus(t, event.target.value), children: [_jsx("option", { value: "pending", children: "pending" }), _jsx("option", { value: "in_progress", children: "in_progress" }), _jsx("option", { value: "completed", children: "completed" })] })) : (_jsx(StatusBadge, { value: t.status })) }), _jsx("td", { className: "py-3 text-gray-600", children: t.dueDate?.slice(0, 10) || '—' })] }, t._id))) })] }))] })] }));
}
function AllergiesTab({ id, items, onChange, canWrite, }) {
    const [error, setError] = useState('');
    const [editing, setEditing] = useState(null);
    const today = new Date().toISOString().slice(0, 10);
    function payload(fd) {
        return {
            substance: fd.get('substance'),
            reaction: fd.get('reaction'),
            severity: fd.get('severity'),
            status: fd.get('status'),
            recordedDate: fd.get('recordedDate'),
        };
    }
    async function onSubmit(e) {
        e.preventDefault();
        const body = payload(new FormData(e.currentTarget));
        try {
            if (editing)
                await clinicalApi.allergies(id).update(editing._id, body);
            else
                await clinicalApi.allergies(id).create(body);
            setEditing(null);
            setError('');
            onChange();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed');
        }
    }
    return (_jsxs("div", { children: [canWrite && (_jsxs(FormCard, { onSubmit: onSubmit, error: error, children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Substance" }), _jsx("input", { name: "substance", required: true, defaultValue: editing?.substance || '', className: inputCls })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Reaction" }), _jsx("input", { name: "reaction", required: true, defaultValue: editing?.reaction || '', className: inputCls })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Severity" }), _jsxs("select", { name: "severity", defaultValue: editing?.severity || 'moderate', className: inputCls, children: [_jsx("option", { children: "mild" }), _jsx("option", { children: "moderate" }), _jsx("option", { children: "severe" })] })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Status" }), _jsxs("select", { name: "status", defaultValue: editing?.status || 'active', className: inputCls, children: [_jsx("option", { children: "active" }), _jsx("option", { children: "inactive" })] })] }), _jsxs("div", { children: [_jsx("label", { className: labelCls, children: "Recorded" }), _jsx("input", { name: "recordedDate", type: "date", required: true, defaultValue: dateInput(editing?.recordedDate) || today, className: inputCls })] })] }), _jsxs("div", { className: "mt-4 flex gap-2", children: [_jsx("button", { type: "submit", className: btnPrimary, children: editing ? 'Save changes' : 'Add allergy' }), editing && (_jsx("button", { type: "button", onClick: () => setEditing(null), className: btnGhost, children: "Cancel" }))] })] }, editing?._id || 'new')), _jsx(Panel, { children: items.length === 0 ? (_jsx(EmptyState, { text: "No allergies recorded", hint: "Active allergies also appear on the safety banner at the top of the chart." })) : (_jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-xs font-medium text-gray-500 border-b border-gray-200", children: [_jsx("th", { className: "pb-3 pr-3", children: "Substance" }), _jsx("th", { className: "pb-3 pr-3", children: "Reaction" }), _jsx("th", { className: "pb-3 pr-3", children: "Severity" }), _jsx("th", { className: "pb-3 pr-3", children: "Status" }), _jsx("th", { className: "pb-3 pr-3", children: "Recorded" }), _jsx("th", { className: "pb-3" })] }) }), _jsx("tbody", { className: "divide-y divide-gray-100", children: items.map((allergy) => (_jsxs("tr", { children: [_jsx("td", { className: "py-3 pr-3 font-medium", children: allergy.substance }), _jsx("td", { className: "py-3 pr-3 text-gray-600", children: allergy.reaction }), _jsx("td", { className: "py-3 pr-3", children: _jsx(StatusBadge, { value: allergy.severity }) }), _jsx("td", { className: "py-3 pr-3", children: _jsx(StatusBadge, { value: allergy.status }) }), _jsx("td", { className: "py-3 pr-3 text-gray-600", children: allergy.recordedDate?.slice(0, 10) }), _jsx("td", { className: "py-3 text-right", children: canWrite && (_jsx("button", { type: "button", className: "text-clinical-teal hover:underline", onClick: () => setEditing(allergy), children: "Edit" })) })] }, allergy._id))) })] })) })] }));
}
