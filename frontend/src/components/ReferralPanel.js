import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { clinicalApi, encountersApi, } from '../api/client';
import Panel, { EmptyState } from './Panel';
import { StatusBadge } from './StatusBadge';
import { formatEncounterWhen, providerName } from './encounterDisplay';
import { chartRecordId, focusedRecordClass, watchChartRecord } from './chart/recordFocus';
const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm';
const labelCls = 'block text-xs font-medium text-gray-600 mb-1';
const btnPrimary = 'px-4 py-2 bg-clinical-teal text-white rounded-lg text-sm hover:bg-clinical-teal-dark disabled:opacity-50';
const btnGhost = 'px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50';
const btnText = 'text-sm text-clinical-teal hover:underline disabled:opacity-50';
const btnDanger = 'text-sm text-red-700 hover:underline disabled:opacity-50';
const REFERRAL_TYPES = [
    { value: 'specialist', label: 'Specialist' },
    { value: 'allied_health', label: 'Allied Health' },
    { value: 'community_service', label: 'Community Service' },
];
const PRIORITIES = [
    { value: 'routine', label: 'Routine' },
    { value: 'urgent', label: 'Urgent' },
];
const DOCUMENT_TYPES = [
    { value: 'referral_letter', label: 'Referral letter' },
    { value: 'consultation_note', label: 'Consultation note' },
    { value: 'external_report', label: 'External report' },
];
const STATUS_COPY = {
    sent: {
        title: 'Send referral',
        submit: 'Send referral',
        hint: 'Sending records the referral on the chart timeline.',
    },
    accepted: {
        title: 'Accept referral',
        submit: 'Mark accepted',
        hint: 'Record that the specialist or service accepted the referral.',
    },
    scheduled: {
        title: 'Schedule appointment',
        submit: 'Schedule',
        hint: 'Record the specialist appointment. The appointment date can be in the future.',
    },
    completed: {
        title: 'Complete referral',
        submit: 'Complete referral',
        hint: 'Complete the referral after the consultation outcome is on the chart.',
    },
    closed: {
        title: 'Close referral',
        submit: 'Close referral',
        hint: 'Closing finishes the referral. Clear follow-up first if it is still required.',
    },
};
function messageOf(err) {
    return err instanceof Error ? err.message : 'Request failed';
}
function nowInput() {
    const date = new Date();
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
}
function toInput(value) {
    if (!value)
        return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
        return '';
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
}
function emptyDraft() {
    return {
        encounterId: '',
        diagnosisId: '',
        conditionId: '',
        carePlanId: '',
        referralType: 'specialist',
        specialty: '',
        specialistName: '',
        organization: '',
        reasonForReferral: '',
        priority: 'routine',
        referralDate: nowInput(),
    };
}
function emptyOutcome(referral) {
    return {
        recommendations: referral?.currentOutcome?.recommendations || '',
        consultationSummary: referral?.currentOutcome?.consultationSummary || '',
        nextSteps: referral?.currentOutcome?.nextSteps || '',
        recordedAt: nowInput(),
        followUpRequired: referral?.followUpRequired || false,
    };
}
function emptyDocument() {
    return {
        documentType: 'referral_letter',
        title: '',
        description: '',
        recordedAt: nowInput(),
    };
}
function emptyFollowUp(referral) {
    return {
        followUpRequired: referral?.followUpRequired || false,
        appointmentDate: toInput(referral?.appointmentDate),
    };
}
function refId(value) {
    if (!value)
        return '';
    if (typeof value === 'string')
        return value;
    if (typeof value === 'object' && '_id' in value)
        return String(value._id);
    return '';
}
function diagnosisText(value) {
    if (!value || typeof value === 'string')
        return value ? 'Linked diagnosis' : '—';
    return [value.code, value.description].filter(Boolean).join(' · ') || 'Linked diagnosis';
}
function encounterText(value) {
    if (!value || typeof value === 'string')
        return value ? 'Linked encounter' : '—';
    const when = value.openedAt ? formatEncounterWhen(value.openedAt) : '';
    return [value.chiefComplaint, when].filter(Boolean).join(' · ') || 'Linked encounter';
}
function problemText(value) {
    if (!value || typeof value === 'string')
        return '';
    return [value.display, value.code].filter(Boolean).join(' · ');
}
function carePlanText(value) {
    if (!value || typeof value === 'string')
        return '';
    return value.title || 'Linked care plan';
}
function byPriority(a, b) {
    const rank = (a.priority === 'urgent' ? 0 : 1) - (b.priority === 'urgent' ? 0 : 1);
    if (rank)
        return rank;
    return new Date(b.referralDate).getTime() - new Date(a.referralDate).getTime();
}
function Field({ label, children }) {
    return (_jsxs("label", { className: "block", children: [_jsx("span", { className: labelCls, children: label }), children] }));
}
function ReferralCard({ referral, canWrite, onAction, focused = false, }) {
    const problem = problemText(referral.conditionId);
    const carePlan = carePlanText(referral.carePlanId);
    const links = referral.linkedDiagnoses || [];
    const olderOutcomes = (referral.outcomes || []).slice(0, -1).reverse();
    const canOutcome = ['accepted', 'scheduled', 'completed', 'closed'].includes(referral.status);
    const canDocument = referral.status !== 'cancelled';
    const canFollowUp = ['sent', 'accepted', 'scheduled', 'completed'].includes(referral.status);
    const canCancel = ['draft', 'sent', 'accepted', 'scheduled'].includes(referral.status);
    const hasAppointment = referral.status === 'scheduled' || referral.status === 'completed' || !!referral.appointmentDate;
    return (_jsxs("li", { id: chartRecordId('referral', referral._id), className: `py-4 ${focusedRecordClass(focused)}`, children: [_jsxs("div", { className: "flex flex-wrap items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsx("div", { className: "font-medium text-gray-900", children: referral.specialistName }), _jsx("div", { className: "text-sm text-gray-600", children: referral.specialty }), _jsxs("div", { className: "mt-1 flex flex-wrap gap-2", children: [_jsx(StatusBadge, { value: referral.referralType }), _jsx(StatusBadge, { value: referral.priority }), _jsx(StatusBadge, { value: referral.status }), referral.followUpRequired && (_jsx("span", { className: "px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800", children: "Follow-up required" }))] })] }), _jsxs("div", { className: "text-xs text-gray-500", children: [formatEncounterWhen(referral.referralDate), referral.createdBy ? ` · ${providerName(referral.createdBy)}` : ''] })] }), _jsxs("dl", { className: "mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm", children: [_jsxs("div", { children: [_jsx("dt", { className: "text-xs text-gray-500", children: "Specialist" }), _jsx("dd", { className: "text-gray-800", children: referral.specialistName })] }), _jsxs("div", { children: [_jsx("dt", { className: "text-xs text-gray-500", children: "Specialty" }), _jsx("dd", { className: "text-gray-800", children: referral.specialty })] }), _jsxs("div", { children: [_jsx("dt", { className: "text-xs text-gray-500", children: "Status" }), _jsx("dd", { className: "text-gray-800", children: _jsx(StatusBadge, { value: referral.status }) })] }), _jsxs("div", { children: [_jsx("dt", { className: "text-xs text-gray-500", children: "Diagnosis" }), _jsx("dd", { className: "text-gray-800", children: diagnosisText(referral.diagnosisId) })] }), _jsxs("div", { children: [_jsx("dt", { className: "text-xs text-gray-500", children: "Encounter" }), _jsx("dd", { className: "text-gray-800", children: encounterText(referral.encounterId) })] }), _jsxs("div", { children: [_jsx("dt", { className: "text-xs text-gray-500", children: "Organization" }), _jsx("dd", { className: "text-gray-800", children: referral.organization })] }), problem && (_jsxs("div", { children: [_jsx("dt", { className: "text-xs text-gray-500", children: "Active problem" }), _jsx("dd", { className: "text-gray-800", children: problem })] })), carePlan && (_jsxs("div", { children: [_jsx("dt", { className: "text-xs text-gray-500", children: "Care plan" }), _jsx("dd", { className: "text-gray-800", children: carePlan })] })), _jsxs("div", { className: "md:col-span-2", children: [_jsx("dt", { className: "text-xs text-gray-500", children: "Reason for referral" }), _jsx("dd", { className: "text-gray-800", children: referral.reasonForReferral })] }), referral.appointmentDate && (_jsxs("div", { children: [_jsx("dt", { className: "text-xs text-gray-500", children: "Appointment" }), _jsx("dd", { className: "text-gray-800", children: formatEncounterWhen(referral.appointmentDate) })] })), referral.outcomeReceivedDate && (_jsxs("div", { children: [_jsx("dt", { className: "text-xs text-gray-500", children: "Consultation received" }), _jsx("dd", { className: "text-gray-800", children: formatEncounterWhen(referral.outcomeReceivedDate) })] }))] }), links.length > 0 && (_jsxs("div", { className: "mt-3", children: [_jsx("div", { className: "text-xs text-gray-500", children: "Linked diagnoses" }), _jsx("ul", { className: "mt-1 space-y-1 text-sm text-gray-800", children: links.map((link) => (_jsxs("li", { children: [_jsxs("span", { className: "text-gray-500", children: [link.label, ": "] }), link.text] }, `${link.kind}-${link.text}`))) })] })), referral.currentOutcome && (_jsxs("div", { className: "mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-800 space-y-1", children: [_jsxs("div", { className: "text-xs text-gray-500", children: ["Outcome \u00B7 version ", referral.currentOutcome.version, referral.currentOutcome.authorId ? ` · ${providerName(referral.currentOutcome.authorId)}` : ''] }), _jsxs("p", { children: [_jsx("span", { className: "text-gray-500", children: "Recommendations. " }), referral.currentOutcome.recommendations] }), _jsxs("p", { children: [_jsx("span", { className: "text-gray-500", children: "Consultation. " }), referral.currentOutcome.consultationSummary] }), _jsxs("p", { children: [_jsx("span", { className: "text-gray-500", children: "Next steps. " }), referral.currentOutcome.nextSteps] })] })), olderOutcomes.length > 0 && (_jsxs("details", { className: "mt-2", children: [_jsx("summary", { className: "text-sm text-clinical-teal cursor-pointer", children: "Earlier outcome revisions" }), _jsx("ol", { className: "mt-2 space-y-2", children: olderOutcomes.map((outcome) => (_jsxs("li", { className: "text-sm text-gray-700", children: [_jsxs("div", { className: "text-xs text-gray-500", children: ["Version ", outcome.version, " \u00B7 ", formatEncounterWhen(outcome.recordedAt), outcome.authorId ? ` · ${providerName(outcome.authorId)}` : ''] }), _jsx("p", { children: outcome.recommendations }), _jsx("p", { children: outcome.consultationSummary }), _jsx("p", { children: outcome.nextSteps })] }, outcome._id))) })] })), !!referral.documents?.length && (_jsx("ul", { className: "mt-3 space-y-2", children: referral.documents.map((document) => (_jsxs("li", { className: "text-sm text-gray-700", children: [_jsx("span", { className: "mr-2", children: _jsx(StatusBadge, { value: document.documentType }) }), _jsx("span", { className: "font-medium text-gray-900", children: document.title }), ' · ', formatEncounterWhen(document.recordedAt), document.recordedBy ? ` · ${providerName(document.recordedBy)}` : '', document.description ? ` · ${document.description}` : ''] }, document._id))) })), !!referral.statusHistory?.length && (_jsx("ol", { className: "mt-3 space-y-1", children: referral.statusHistory.map((event) => (_jsxs("li", { className: "flex flex-wrap items-center gap-2 text-xs text-gray-600", children: [_jsx(StatusBadge, { value: event.status }), _jsx("span", { children: formatEncounterWhen(event.at) }), _jsx("span", { children: providerName(event.actorId) }), event.note && _jsx("span", { children: event.note })] }, event._id || `${event.status}-${event.at}`))) })), canWrite && (_jsxs("div", { className: "mt-3 flex flex-wrap gap-3", children: [referral.status === 'draft' && (_jsx("button", { type: "button", className: btnText, onClick: () => onAction({ kind: 'status', referral, status: 'sent' }), children: "Send referral" })), referral.status === 'sent' && (_jsx("button", { type: "button", className: btnText, onClick: () => onAction({ kind: 'status', referral, status: 'accepted' }), children: "Mark accepted" })), referral.status === 'accepted' && (_jsx("button", { type: "button", className: btnText, onClick: () => onAction({ kind: 'status', referral, status: 'scheduled' }), children: "Schedule appointment" })), canOutcome && (_jsx("button", { type: "button", className: btnText, onClick: () => onAction({ kind: 'outcome', referral }), children: referral.currentOutcome ? 'Update outcome' : 'Record outcome' })), referral.status === 'scheduled' && referral.currentOutcome && (_jsx("button", { type: "button", className: btnText, onClick: () => onAction({ kind: 'status', referral, status: 'completed' }), children: "Complete referral" })), referral.status === 'completed' && !referral.followUpRequired && (_jsx("button", { type: "button", className: btnText, onClick: () => onAction({ kind: 'status', referral, status: 'closed' }), children: "Close referral" })), canDocument && (_jsx("button", { type: "button", className: btnText, onClick: () => onAction({ kind: 'document', referral }), children: "Add document" })), canFollowUp && (_jsx("button", { type: "button", className: btnText, onClick: () => onAction({ kind: 'followUp', referral }), children: hasAppointment ? 'Follow-up' : 'Mark follow-up' })), canCancel && (_jsx("button", { type: "button", className: btnDanger, onClick: () => onAction({ kind: 'cancel', referral }), children: "Cancel referral" }))] }))] }));
}
function ReferralGroup({ title, subtitle, referrals, canWrite, empty, onAction, focusId = '', }) {
    return (_jsx(Panel, { title: title, subtitle: subtitle, children: referrals.length === 0 ? (_jsx(EmptyState, { text: empty })) : (_jsx("ul", { className: "divide-y divide-gray-100", children: referrals.map((referral) => (_jsx(ReferralCard, { referral: referral, canWrite: canWrite, onAction: onAction, focused: referral._id === focusId }, referral._id))) })) }));
}
export function ReferralPanel({ patientId, canWrite, focusToken = 0, recordFocus = null, }) {
    const [section, setSection] = useState('active');
    const [active, setActive] = useState([]);
    const [closed, setClosed] = useState([]);
    const [followUp, setFollowUp] = useState([]);
    const [encounters, setEncounters] = useState([]);
    const [diagnoses, setDiagnoses] = useState([]);
    const [problems, setProblems] = useState([]);
    const [carePlans, setCarePlans] = useState([]);
    const [draft, setDraft] = useState(emptyDraft());
    const [pending, setPending] = useState(null);
    const [actionAt, setActionAt] = useState(nowInput());
    const [actionNote, setActionNote] = useState('');
    const [appointmentDate, setAppointmentDate] = useState(nowInput());
    const [outcomeDraft, setOutcomeDraft] = useState(emptyOutcome());
    const [documentDraft, setDocumentDraft] = useState(emptyDocument());
    const [followDraft, setFollowDraft] = useState(emptyFollowUp());
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const intent = useRef('sent');
    const encounterDiagnoses = diagnoses.filter((item) => refId(item.encounterId) === draft.encounterId);
    const openPlans = carePlans.filter((plan) => plan.status !== 'cancelled');
    async function load() {
        const [activePage, closedPage, followPage, encounterPage, diagnosisPage, problemPage, planPage] = await Promise.all([
            clinicalApi.referrals(patientId).list('?view=active&limit=100'),
            clinicalApi.referrals(patientId).list('?view=completed&limit=100'),
            clinicalApi.referrals(patientId).list('?view=follow_up&limit=100'),
            encountersApi.list(patientId),
            clinicalApi.diagnoses(patientId).list('?limit=100'),
            clinicalApi.conditions(patientId).list('?status=active&limit=100'),
            clinicalApi.carePlans(patientId).list('?limit=100'),
        ]);
        setActive([...activePage.data].sort(byPriority));
        setClosed([...closedPage.data].sort(byPriority));
        setFollowUp([...followPage.data].sort(byPriority));
        setEncounters(encounterPage.data);
        setDiagnoses(diagnosisPage.data);
        setProblems(problemPage.data);
        setCarePlans(planPage.data);
        setDraft((current) => {
            if (current.specialistName || current.reasonForReferral || current.encounterId)
                return current;
            const encounterId = encounterPage.data.length === 1 ? encounterPage.data[0]._id : '';
            return { ...emptyDraft(), encounterId };
        });
    }
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        load()
            .then(() => {
            if (!cancelled)
                setError('');
        })
            .catch((err) => {
            if (!cancelled)
                setError(messageOf(err));
        })
            .finally(() => {
            if (!cancelled)
                setLoading(false);
        });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [patientId]);
    useEffect(() => {
        if (!focusToken || recordFocus?.tab === 'referrals')
            return;
        setSection('active');
    }, [focusToken, recordFocus]);
    const referralFocusToken = recordFocus?.tab === 'referrals' ? recordFocus.token : 0;
    const referralFocusId = recordFocus?.tab === 'referrals' ? recordFocus.recordId : '';
    const seenReferralFocus = useRef(0);
    useEffect(() => {
        if (!referralFocusToken || !referralFocusId || loading)
            return;
        if (seenReferralFocus.current === referralFocusToken)
            return;
        const referral = [...active, ...closed, ...followUp].find((item) => item._id === referralFocusId);
        if (!referral && active.length === 0 && closed.length === 0)
            return;
        seenReferralFocus.current = referralFocusToken;
        if (referral) {
            setSection(referral.status === 'completed' || referral.status === 'closed' || referral.status === 'cancelled' ? 'completed' : 'active');
        }
        return watchChartRecord('referral', referralFocusId);
    }, [referralFocusToken, referralFocusId, loading, active, closed, followUp]);
    useEffect(() => {
        if (!focusToken || loading || section !== 'active' || recordFocus?.tab === 'referrals')
            return;
        document.getElementById('chart-new-referral')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, [focusToken, loading, section, recordFocus]);
    function openAction(next) {
        setPending(next);
        setActionAt(nowInput());
        setActionNote('');
        setAppointmentDate(toInput(next.referral.appointmentDate) || nowInput());
        setOutcomeDraft(next.kind === 'outcome' ? emptyOutcome(next.referral) : emptyOutcome());
        setDocumentDraft(emptyDocument());
        setFollowDraft(next.kind === 'followUp' ? emptyFollowUp(next.referral) : emptyFollowUp());
        setError('');
    }
    async function onCreate(event) {
        event.preventDefault();
        setSaving(true);
        setError('');
        const body = {
            encounterId: draft.encounterId,
            diagnosisId: draft.diagnosisId,
            conditionId: draft.conditionId || null,
            carePlanId: draft.carePlanId || null,
            referralType: draft.referralType,
            specialty: draft.specialty.trim(),
            specialistName: draft.specialistName.trim(),
            organization: draft.organization.trim(),
            reasonForReferral: draft.reasonForReferral.trim(),
            priority: draft.priority,
            referralDate: draft.referralDate,
            status: intent.current,
        };
        try {
            await clinicalApi.referrals(patientId).create(body);
            const encounterId = draft.encounterId;
            setDraft({ ...emptyDraft(), encounterId });
            await load();
        }
        catch (err) {
            setError(messageOf(err));
        }
        finally {
            setSaving(false);
        }
    }
    async function onPending(event) {
        event.preventDefault();
        if (!pending)
            return;
        setSaving(true);
        setError('');
        try {
            const api = clinicalApi.referrals(patientId);
            if (pending.kind === 'status') {
                await api.setStatus(pending.referral._id, {
                    status: pending.status,
                    at: actionAt,
                    note: actionNote.trim() || undefined,
                    appointmentDate: pending.status === 'scheduled' ? appointmentDate : undefined,
                });
            }
            else if (pending.kind === 'cancel') {
                await api.cancel(pending.referral._id, { reason: actionNote.trim(), at: actionAt });
            }
            else if (pending.kind === 'outcome') {
                await api.addOutcome(pending.referral._id, {
                    recommendations: outcomeDraft.recommendations.trim(),
                    consultationSummary: outcomeDraft.consultationSummary.trim(),
                    nextSteps: outcomeDraft.nextSteps.trim(),
                    recordedAt: outcomeDraft.recordedAt,
                    followUpRequired: outcomeDraft.followUpRequired,
                });
            }
            else if (pending.kind === 'document') {
                await api.addDocument(pending.referral._id, {
                    documentType: documentDraft.documentType,
                    title: documentDraft.title.trim(),
                    description: documentDraft.description.trim() || undefined,
                    recordedAt: documentDraft.recordedAt,
                });
            }
            else {
                await api.setFollowUp(pending.referral._id, {
                    followUpRequired: followDraft.followUpRequired,
                    appointmentDate: followDraft.appointmentDate || undefined,
                });
            }
            setPending(null);
            await load();
        }
        catch (err) {
            setError(messageOf(err));
        }
        finally {
            setSaving(false);
        }
    }
    const completed = closed.filter((referral) => referral.status === 'completed' || referral.status === 'closed');
    const cancelled = closed.filter((referral) => referral.status === 'cancelled');
    const seen = new Set();
    const activity = [...active, ...closed, ...followUp]
        .filter((referral) => {
        if (seen.has(referral._id))
            return false;
        seen.add(referral._id);
        return true;
    })
        .flatMap((referral) => referral.timeline || [])
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    const tabs = [
        { id: 'active', label: 'Active Referrals' },
        { id: 'completed', label: 'Completed Referrals' },
        { id: 'follow_up', label: 'Follow-Up Required' },
    ];
    const showAppointmentOnFollowUp = pending?.kind === 'followUp' &&
        (pending.referral.status === 'scheduled' ||
            pending.referral.status === 'completed' ||
            !!pending.referral.appointmentDate);
    return (_jsxs("div", { className: "space-y-6", children: [_jsx("div", { className: "flex flex-wrap gap-1 border-b border-gray-200", role: "tablist", children: tabs.map((tab) => (_jsx("button", { type: "button", role: "tab", "aria-selected": section === tab.id, onClick: () => setSection(tab.id), className: `px-4 py-2 text-sm font-medium border-b-2 -mb-px ${section === tab.id
                        ? 'border-clinical-teal text-clinical-teal'
                        : 'border-transparent text-gray-500 hover:text-gray-700'}`, children: tab.label }, tab.id))) }), error && (_jsx("div", { className: "bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm", children: error })), section === 'active' && canWrite && (_jsxs("form", { id: "chart-new-referral", onSubmit: onCreate, className: "scroll-mt-64 bg-white rounded-lg border border-gray-200 p-6 space-y-4", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-semibold text-gray-900", children: "New referral" }), _jsx("p", { className: "text-xs text-gray-500 mt-0.5", children: "Internal referral tracking for this chart. Nothing is sent outside the clinic." })] }), encounters.length === 0 ? (_jsx("p", { className: "text-sm text-gray-600", children: "Open an encounter before creating a referral." })) : (_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsx(Field, { label: "Encounter", children: _jsxs("select", { value: draft.encounterId, onChange: (event) => {
                                        const encounterId = event.target.value;
                                        setDraft((current) => ({
                                            ...current,
                                            encounterId,
                                            diagnosisId: diagnoses.some((item) => refId(item.encounterId) === encounterId && item._id === current.diagnosisId)
                                                ? current.diagnosisId
                                                : '',
                                        }));
                                    }, className: inputCls, required: true, children: [_jsx("option", { value: "", children: "Select an encounter" }), encounters.map((encounter) => (_jsxs("option", { value: encounter._id, children: [encounter.chiefComplaint, " \u00B7 ", formatEncounterWhen(encounter.openedAt)] }, encounter._id)))] }) }), _jsx(Field, { label: "Encounter diagnosis", children: _jsxs("select", { value: draft.diagnosisId, onChange: (event) => setDraft((current) => ({ ...current, diagnosisId: event.target.value })), className: inputCls, required: true, disabled: !draft.encounterId, children: [_jsx("option", { value: "", children: "Select a diagnosis" }), encounterDiagnoses.map((item) => (_jsxs("option", { value: item._id, children: [item.code, " \u00B7 ", item.description, item.primaryDiagnosis ? ' · Primary' : ''] }, item._id)))] }) }), draft.encounterId && encounterDiagnoses.length === 0 && (_jsx("p", { className: "md:col-span-2 text-sm text-gray-600", children: "Record a diagnosis on this encounter before creating a referral." })), _jsx(Field, { label: "Active problem", children: _jsxs("select", { value: draft.conditionId, onChange: (event) => setDraft((current) => ({ ...current, conditionId: event.target.value })), className: inputCls, children: [_jsx("option", { value: "", children: "No active problem" }), problems.map((problem) => (_jsxs("option", { value: problem._id, children: [problem.display, problem.code ? ` · ${problem.code}` : ''] }, problem._id)))] }) }), _jsx(Field, { label: "Care plan", children: _jsxs("select", { value: draft.carePlanId, onChange: (event) => setDraft((current) => ({ ...current, carePlanId: event.target.value })), className: inputCls, children: [_jsx("option", { value: "", children: "No care plan" }), openPlans.map((plan) => (_jsxs("option", { value: plan._id, children: [plan.title, " \u00B7 ", plan.status] }, plan._id)))] }) }), _jsx(Field, { label: "Referral type", children: _jsx("select", { value: draft.referralType, onChange: (event) => setDraft((current) => ({ ...current, referralType: event.target.value })), className: inputCls, required: true, children: REFERRAL_TYPES.map((type) => (_jsx("option", { value: type.value, children: type.label }, type.value))) }) }), _jsx(Field, { label: "Priority", children: _jsx("select", { value: draft.priority, onChange: (event) => setDraft((current) => ({ ...current, priority: event.target.value })), className: inputCls, required: true, children: PRIORITIES.map((priority) => (_jsx("option", { value: priority.value, children: priority.label }, priority.value))) }) }), _jsx(Field, { label: "Specialty", children: _jsx("input", { value: draft.specialty, onChange: (event) => setDraft((current) => ({ ...current, specialty: event.target.value })), className: inputCls, required: true, maxLength: 120 }) }), _jsx(Field, { label: "Specialist", children: _jsx("input", { value: draft.specialistName, onChange: (event) => setDraft((current) => ({ ...current, specialistName: event.target.value })), className: inputCls, required: true, maxLength: 200 }) }), _jsx(Field, { label: "Organization", children: _jsx("input", { value: draft.organization, onChange: (event) => setDraft((current) => ({ ...current, organization: event.target.value })), className: inputCls, required: true, maxLength: 200 }) }), _jsx(Field, { label: "Referral date", children: _jsx("input", { type: "datetime-local", value: draft.referralDate, onChange: (event) => setDraft((current) => ({ ...current, referralDate: event.target.value })), className: inputCls, required: true }) }), _jsx("div", { className: "md:col-span-2", children: _jsx(Field, { label: "Reason for referral", children: _jsx("textarea", { value: draft.reasonForReferral, onChange: (event) => setDraft((current) => ({ ...current, reasonForReferral: event.target.value })), className: inputCls, rows: 3, required: true, maxLength: 2000 }) }) }), _jsxs("div", { className: "md:col-span-2 flex flex-wrap gap-2", children: [_jsx("button", { type: "submit", className: btnPrimary, disabled: saving || !draft.diagnosisId, onClick: () => {
                                            intent.current = 'sent';
                                        }, children: saving ? 'Saving...' : 'Send referral' }), _jsx("button", { type: "submit", className: btnGhost, disabled: saving || !draft.diagnosisId, onClick: () => {
                                            intent.current = 'draft';
                                        }, children: "Save draft" })] })] }))] })), pending && (_jsxs("form", { onSubmit: onPending, className: "bg-white rounded-lg border border-gray-200 p-6 space-y-4", children: [_jsxs("div", { children: [_jsx("h3", { className: "font-semibold text-gray-900", children: pending.kind === 'cancel'
                                    ? 'Cancel referral'
                                    : pending.kind === 'outcome'
                                        ? pending.referral.currentOutcome
                                            ? 'Update outcome'
                                            : 'Record outcome'
                                        : pending.kind === 'document'
                                            ? 'Add document'
                                            : pending.kind === 'followUp'
                                                ? 'Follow-up'
                                                : STATUS_COPY[pending.status].title }), _jsxs("p", { className: "text-sm text-gray-600 mt-1", children: [pending.referral.specialistName, " \u00B7 ", pending.referral.specialty] }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: pending.kind === 'cancel'
                                    ? 'Cancellation stays on the referral history.'
                                    : pending.kind === 'outcome'
                                        ? 'A new revision is saved. Earlier recommendations stay on the chart.'
                                        : pending.kind === 'document'
                                            ? 'This stores the document record only. The file can be attached later.'
                                            : pending.kind === 'followUp'
                                                ? 'Follow-up stays on the chart until it is cleared and the referral is closed.'
                                                : STATUS_COPY[pending.status].hint })] }), pending.kind === 'outcome' ? (_jsxs("div", { className: "grid grid-cols-1 gap-4", children: [_jsx(Field, { label: "Specialist recommendations", children: _jsx("textarea", { value: outcomeDraft.recommendations, onChange: (event) => setOutcomeDraft((current) => ({ ...current, recommendations: event.target.value })), className: inputCls, rows: 3, required: true, maxLength: 4000 }) }), _jsx(Field, { label: "Consultation summary", children: _jsx("textarea", { value: outcomeDraft.consultationSummary, onChange: (event) => setOutcomeDraft((current) => ({ ...current, consultationSummary: event.target.value })), className: inputCls, rows: 3, required: true, maxLength: 4000 }) }), _jsx(Field, { label: "Next steps", children: _jsx("textarea", { value: outcomeDraft.nextSteps, onChange: (event) => setOutcomeDraft((current) => ({ ...current, nextSteps: event.target.value })), className: inputCls, rows: 3, required: true, maxLength: 4000 }) }), _jsx(Field, { label: "Outcome date", children: _jsx("input", { type: "datetime-local", value: outcomeDraft.recordedAt, onChange: (event) => setOutcomeDraft((current) => ({ ...current, recordedAt: event.target.value })), className: inputCls, required: true }) }), _jsxs("label", { className: "flex items-center gap-2 text-sm text-gray-700", children: [_jsx("input", { type: "checkbox", checked: outcomeDraft.followUpRequired, onChange: (event) => setOutcomeDraft((current) => ({ ...current, followUpRequired: event.target.checked })) }), "Follow-up required"] })] })) : pending.kind === 'document' ? (_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsx(Field, { label: "Document type", children: _jsx("select", { value: documentDraft.documentType, onChange: (event) => setDocumentDraft((current) => ({
                                        ...current,
                                        documentType: event.target.value,
                                    })), className: inputCls, required: true, children: DOCUMENT_TYPES.map((type) => (_jsx("option", { value: type.value, children: type.label }, type.value))) }) }), _jsx(Field, { label: "Recorded", children: _jsx("input", { type: "datetime-local", value: documentDraft.recordedAt, onChange: (event) => setDocumentDraft((current) => ({ ...current, recordedAt: event.target.value })), className: inputCls, required: true }) }), _jsx("div", { className: "md:col-span-2", children: _jsx(Field, { label: "Title", children: _jsx("input", { value: documentDraft.title, onChange: (event) => setDocumentDraft((current) => ({ ...current, title: event.target.value })), className: inputCls, required: true, maxLength: 200 }) }) }), _jsx("div", { className: "md:col-span-2", children: _jsx(Field, { label: "Description", children: _jsx("textarea", { value: documentDraft.description, onChange: (event) => setDocumentDraft((current) => ({ ...current, description: event.target.value })), className: inputCls, rows: 2, maxLength: 2000 }) }) })] })) : pending.kind === 'followUp' ? (_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("label", { className: "flex items-center gap-2 text-sm text-gray-700 md:col-span-2", children: [_jsx("input", { type: "checkbox", checked: followDraft.followUpRequired, onChange: (event) => setFollowDraft((current) => ({ ...current, followUpRequired: event.target.checked })) }), "Follow-up required"] }), showAppointmentOnFollowUp && (_jsx(Field, { label: "Appointment date", children: _jsx("input", { type: "datetime-local", value: followDraft.appointmentDate, onChange: (event) => setFollowDraft((current) => ({ ...current, appointmentDate: event.target.value })), className: inputCls }) }))] })) : (_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsx("div", { className: "md:col-span-2", children: _jsx(Field, { label: pending.kind === 'cancel' ? 'Reason' : 'Note', children: _jsx("input", { value: actionNote, onChange: (event) => setActionNote(event.target.value), className: inputCls, required: pending.kind === 'cancel', maxLength: 500 }) }) }), pending.kind === 'status' && pending.status === 'scheduled' && (_jsx(Field, { label: "Appointment date", children: _jsx("input", { type: "datetime-local", value: appointmentDate, onChange: (event) => setAppointmentDate(event.target.value), className: inputCls, required: true }) })), _jsx(Field, { label: "Time", children: _jsx("input", { type: "datetime-local", value: actionAt, onChange: (event) => setActionAt(event.target.value), className: inputCls, required: true }) })] })), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { type: "submit", className: btnPrimary, disabled: saving, children: saving
                                    ? 'Saving...'
                                    : pending.kind === 'cancel'
                                        ? 'Cancel referral'
                                        : pending.kind === 'outcome'
                                            ? 'Save outcome'
                                            : pending.kind === 'document'
                                                ? 'Save document'
                                                : pending.kind === 'followUp'
                                                    ? 'Save follow-up'
                                                    : STATUS_COPY[pending.status].submit }), _jsx("button", { type: "button", className: btnGhost, onClick: () => setPending(null), children: "Close" })] })] })), loading ? (_jsx("p", { className: "text-sm text-gray-500", children: "Loading referrals..." })) : (_jsxs(_Fragment, { children: [section === 'active' && (_jsx(ReferralGroup, { title: "Active Referrals", subtitle: "Draft, sent, accepted, and scheduled referrals", referrals: active, canWrite: canWrite, empty: "No active referrals.", onAction: openAction, focusId: referralFocusId })), section === 'completed' && (_jsxs("div", { className: "space-y-6", children: [_jsx(ReferralGroup, { title: "Completed Referrals", subtitle: "Completed and closed referrals", referrals: completed, canWrite: canWrite, empty: "No completed referrals.", onAction: openAction, focusId: referralFocusId }), _jsx(ReferralGroup, { title: "Cancelled referrals", subtitle: "Cancelled referrals remain on the chart", referrals: cancelled, canWrite: canWrite, empty: "No cancelled referrals.", onAction: openAction, focusId: referralFocusId })] })), section === 'follow_up' && (_jsx(ReferralGroup, { title: "Follow-Up Required", subtitle: "Referrals that still need a clinic follow-up", referrals: followUp, canWrite: canWrite, empty: "No referrals need follow-up.", onAction: openAction, focusId: referralFocusId })), _jsx(Panel, { title: "Referral activity", subtitle: "Created, sent, accepted, scheduled, consultation, and completed events", children: activity.length === 0 ? (_jsx(EmptyState, { text: "Referral activity appears here after a referral is created." })) : (_jsx("ol", { className: "space-y-3", children: activity.map((point, index) => (_jsxs("li", { className: "flex gap-3 text-sm", children: [_jsx("div", { className: "w-36 shrink-0 text-gray-500", children: formatEncounterWhen(point.at) }), _jsxs("div", { children: [_jsx("div", { className: "font-medium text-gray-900", children: point.label }), _jsx("div", { className: "text-gray-600", children: point.detail })] })] }, `${point.action}-${point.at}-${index}`))) })) })] }))] }));
}
export function ReferralSummary({ patientId, onOpen, }) {
    const [summary, setSummary] = useState(null);
    const [error, setError] = useState('');
    useEffect(() => {
        let cancelled = false;
        clinicalApi
            .referrals(patientId)
            .summary()
            .then((data) => {
            if (!cancelled) {
                setSummary(data);
                setError('');
            }
        })
            .catch((err) => {
            if (!cancelled)
                setError(messageOf(err));
        });
        return () => {
            cancelled = true;
        };
    }, [patientId]);
    return (_jsxs(Panel, { title: "Referrals", subtitle: "Active specialist, allied health, and community referrals", children: [error && (_jsx("div", { className: "mb-3 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm", children: error })), !summary ? (_jsx("p", { className: "text-sm text-gray-500", children: "Loading referrals..." })) : summary.active.length === 0 ? (_jsx("p", { className: "text-sm text-gray-500", children: "No active referrals." })) : (_jsx("ul", { className: "space-y-3", children: summary.active.map((referral) => (_jsxs("li", { className: "text-sm", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("span", { className: "font-medium text-gray-900", children: referral.specialistName }), _jsx("span", { className: "text-gray-600", children: referral.specialty }), _jsx(StatusBadge, { value: referral.status }), _jsx(StatusBadge, { value: referral.priority })] }), _jsxs("div", { className: "text-gray-600 mt-0.5", children: [diagnosisText(referral.diagnosisId), " \u00B7 ", encounterText(referral.encounterId)] })] }, referral._id))) })), summary && summary.counts.followUp > 0 && (_jsxs("p", { className: "text-sm text-amber-800 mt-3", children: [summary.counts.followUp, " ", summary.counts.followUp === 1 ? 'referral needs' : 'referrals need', " follow-up."] })), onOpen && (_jsx("button", { type: "button", className: `${btnText} mt-4`, onClick: onOpen, children: "Open referrals" }))] }));
}
