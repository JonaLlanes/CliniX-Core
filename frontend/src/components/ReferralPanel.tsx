import { FormEvent, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  clinicalApi,
  encountersApi,
  type CarePlan,
  type Condition,
  type Encounter,
  type EncounterDiagnosis,
  type LinkedCarePlan,
  type LinkedDiagnosis,
  type LinkedEncounter,
  type LinkedProblem,
  type Referral,
  type ReferralDocumentType,
  type ReferralInput,
  type ReferralPriority,
  type ReferralStatus,
  type ReferralSummary as ReferralSummaryData,
  type ReferralType,
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

const REFERRAL_TYPES: { value: ReferralType; label: string }[] = [
  { value: 'specialist', label: 'Specialist' },
  { value: 'allied_health', label: 'Allied Health' },
  { value: 'community_service', label: 'Community Service' },
];

const PRIORITIES: { value: ReferralPriority; label: string }[] = [
  { value: 'routine', label: 'Routine' },
  { value: 'urgent', label: 'Urgent' },
];

const DOCUMENT_TYPES: { value: ReferralDocumentType; label: string }[] = [
  { value: 'referral_letter', label: 'Referral letter' },
  { value: 'consultation_note', label: 'Consultation note' },
  { value: 'external_report', label: 'External report' },
];

type Section = 'active' | 'completed' | 'follow_up';
type StatusAction = 'sent' | 'accepted' | 'scheduled' | 'completed' | 'closed';

type Draft = {
  encounterId: string;
  diagnosisId: string;
  conditionId: string;
  carePlanId: string;
  referralType: ReferralType;
  specialty: string;
  specialistName: string;
  organization: string;
  reasonForReferral: string;
  priority: ReferralPriority;
  referralDate: string;
};

type OutcomeDraft = {
  recommendations: string;
  consultationSummary: string;
  nextSteps: string;
  recordedAt: string;
  followUpRequired: boolean;
};

type DocumentDraft = {
  documentType: ReferralDocumentType;
  title: string;
  description: string;
  recordedAt: string;
};

type FollowUpDraft = {
  followUpRequired: boolean;
  appointmentDate: string;
};

type Pending =
  | { kind: 'status'; referral: Referral; status: StatusAction }
  | { kind: 'cancel'; referral: Referral }
  | { kind: 'outcome'; referral: Referral }
  | { kind: 'document'; referral: Referral }
  | { kind: 'followUp'; referral: Referral };

const STATUS_COPY: Record<StatusAction, { title: string; submit: string; hint: string }> = {
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

function messageOf(err: unknown) {
  return err instanceof Error ? err.message : 'Request failed';
}

function nowInput() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function toInput(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function emptyDraft(): Draft {
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

function emptyOutcome(referral?: Referral): OutcomeDraft {
  return {
    recommendations: referral?.currentOutcome?.recommendations || '',
    consultationSummary: referral?.currentOutcome?.consultationSummary || '',
    nextSteps: referral?.currentOutcome?.nextSteps || '',
    recordedAt: nowInput(),
    followUpRequired: referral?.followUpRequired || false,
  };
}

function emptyDocument(): DocumentDraft {
  return {
    documentType: 'referral_letter',
    title: '',
    description: '',
    recordedAt: nowInput(),
  };
}

function emptyFollowUp(referral?: Referral): FollowUpDraft {
  return {
    followUpRequired: referral?.followUpRequired || false,
    appointmentDate: toInput(referral?.appointmentDate),
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

function carePlanText(value?: LinkedCarePlan | string | null) {
  if (!value || typeof value === 'string') return '';
  return value.title || 'Linked care plan';
}

function byPriority(a: Referral, b: Referral) {
  const rank = (a.priority === 'urgent' ? 0 : 1) - (b.priority === 'urgent' ? 0 : 1);
  if (rank) return rank;
  return new Date(b.referralDate).getTime() - new Date(a.referralDate).getTime();
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      {children}
    </label>
  );
}

function ReferralCard({
  referral,
  canWrite,
  onAction,
  focused = false,
}: {
  referral: Referral;
  canWrite: boolean;
  onAction: (pending: Pending) => void;
  focused?: boolean;
}) {
  const problem = problemText(referral.conditionId);
  const carePlan = carePlanText(referral.carePlanId);
  const links = referral.linkedDiagnoses || [];
  const olderOutcomes = (referral.outcomes || []).slice(0, -1).reverse();
  const canOutcome = ['accepted', 'scheduled', 'completed', 'closed'].includes(referral.status);
  const canDocument = referral.status !== 'cancelled';
  const canFollowUp = ['sent', 'accepted', 'scheduled', 'completed'].includes(referral.status);
  const canCancel = ['draft', 'sent', 'accepted', 'scheduled'].includes(referral.status);
  const hasAppointment = referral.status === 'scheduled' || referral.status === 'completed' || !!referral.appointmentDate;

  return (
    <li id={chartRecordId('referral', referral._id)} className={`py-4 ${focusedRecordClass(focused)}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-medium text-gray-900">{referral.specialistName}</div>
          <div className="text-sm text-gray-600">{referral.specialty}</div>
          <div className="mt-1 flex flex-wrap gap-2">
            <StatusBadge value={referral.referralType} />
            <StatusBadge value={referral.priority} />
            <StatusBadge value={referral.status} />
            {referral.followUpRequired && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                Follow-up required
              </span>
            )}
          </div>
        </div>
        <div className="text-xs text-gray-500">
          {formatEncounterWhen(referral.referralDate)}
          {referral.createdBy ? ` · ${providerName(referral.createdBy)}` : ''}
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-xs text-gray-500">Specialist</dt>
          <dd className="text-gray-800">{referral.specialistName}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Specialty</dt>
          <dd className="text-gray-800">{referral.specialty}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Status</dt>
          <dd className="text-gray-800">
            <StatusBadge value={referral.status} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Diagnosis</dt>
          <dd className="text-gray-800">{diagnosisText(referral.diagnosisId)}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Encounter</dt>
          <dd className="text-gray-800">{encounterText(referral.encounterId)}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Organization</dt>
          <dd className="text-gray-800">{referral.organization}</dd>
        </div>
        {problem && (
          <div>
            <dt className="text-xs text-gray-500">Active problem</dt>
            <dd className="text-gray-800">{problem}</dd>
          </div>
        )}
        {carePlan && (
          <div>
            <dt className="text-xs text-gray-500">Care plan</dt>
            <dd className="text-gray-800">{carePlan}</dd>
          </div>
        )}
        <div className="md:col-span-2">
          <dt className="text-xs text-gray-500">Reason for referral</dt>
          <dd className="text-gray-800">{referral.reasonForReferral}</dd>
        </div>
        {referral.appointmentDate && (
          <div>
            <dt className="text-xs text-gray-500">Appointment</dt>
            <dd className="text-gray-800">{formatEncounterWhen(referral.appointmentDate)}</dd>
          </div>
        )}
        {referral.outcomeReceivedDate && (
          <div>
            <dt className="text-xs text-gray-500">Consultation received</dt>
            <dd className="text-gray-800">{formatEncounterWhen(referral.outcomeReceivedDate)}</dd>
          </div>
        )}
      </dl>
      {links.length > 0 && (
        <div className="mt-3">
          <div className="text-xs text-gray-500">Linked diagnoses</div>
          <ul className="mt-1 space-y-1 text-sm text-gray-800">
            {links.map((link) => (
              <li key={`${link.kind}-${link.text}`}>
                <span className="text-gray-500">{link.label}: </span>
                {link.text}
              </li>
            ))}
          </ul>
        </div>
      )}
      {referral.currentOutcome && (
        <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-800 space-y-1">
          <div className="text-xs text-gray-500">
            Outcome · version {referral.currentOutcome.version}
            {referral.currentOutcome.authorId ? ` · ${providerName(referral.currentOutcome.authorId)}` : ''}
          </div>
          <p>
            <span className="text-gray-500">Recommendations. </span>
            {referral.currentOutcome.recommendations}
          </p>
          <p>
            <span className="text-gray-500">Consultation. </span>
            {referral.currentOutcome.consultationSummary}
          </p>
          <p>
            <span className="text-gray-500">Next steps. </span>
            {referral.currentOutcome.nextSteps}
          </p>
        </div>
      )}
      {olderOutcomes.length > 0 && (
        <details className="mt-2">
          <summary className="text-sm text-clinical-teal cursor-pointer">Earlier outcome revisions</summary>
          <ol className="mt-2 space-y-2">
            {olderOutcomes.map((outcome) => (
              <li key={outcome._id} className="text-sm text-gray-700">
                <div className="text-xs text-gray-500">
                  Version {outcome.version} · {formatEncounterWhen(outcome.recordedAt)}
                  {outcome.authorId ? ` · ${providerName(outcome.authorId)}` : ''}
                </div>
                <p>{outcome.recommendations}</p>
                <p>{outcome.consultationSummary}</p>
                <p>{outcome.nextSteps}</p>
              </li>
            ))}
          </ol>
        </details>
      )}
      {!!referral.documents?.length && (
        <ul className="mt-3 space-y-2">
          {referral.documents.map((document) => (
            <li key={document._id} className="text-sm text-gray-700">
              <span className="mr-2">
                <StatusBadge value={document.documentType} />
              </span>
              <span className="font-medium text-gray-900">{document.title}</span>
              {' · '}
              {formatEncounterWhen(document.recordedAt)}
              {document.recordedBy ? ` · ${providerName(document.recordedBy)}` : ''}
              {document.description ? ` · ${document.description}` : ''}
            </li>
          ))}
        </ul>
      )}
      {!!referral.statusHistory?.length && (
        <ol className="mt-3 space-y-1">
          {referral.statusHistory.map((event) => (
            <li
              key={event._id || `${event.status}-${event.at}`}
              className="flex flex-wrap items-center gap-2 text-xs text-gray-600"
            >
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
          {referral.status === 'draft' && (
            <button type="button" className={btnText} onClick={() => onAction({ kind: 'status', referral, status: 'sent' })}>
              Send referral
            </button>
          )}
          {referral.status === 'sent' && (
            <button
              type="button"
              className={btnText}
              onClick={() => onAction({ kind: 'status', referral, status: 'accepted' })}
            >
              Mark accepted
            </button>
          )}
          {referral.status === 'accepted' && (
            <button
              type="button"
              className={btnText}
              onClick={() => onAction({ kind: 'status', referral, status: 'scheduled' })}
            >
              Schedule appointment
            </button>
          )}
          {canOutcome && (
            <button type="button" className={btnText} onClick={() => onAction({ kind: 'outcome', referral })}>
              {referral.currentOutcome ? 'Update outcome' : 'Record outcome'}
            </button>
          )}
          {referral.status === 'scheduled' && referral.currentOutcome && (
            <button
              type="button"
              className={btnText}
              onClick={() => onAction({ kind: 'status', referral, status: 'completed' })}
            >
              Complete referral
            </button>
          )}
          {referral.status === 'completed' && !referral.followUpRequired && (
            <button type="button" className={btnText} onClick={() => onAction({ kind: 'status', referral, status: 'closed' })}>
              Close referral
            </button>
          )}
          {canDocument && (
            <button type="button" className={btnText} onClick={() => onAction({ kind: 'document', referral })}>
              Add document
            </button>
          )}
          {canFollowUp && (
            <button type="button" className={btnText} onClick={() => onAction({ kind: 'followUp', referral })}>
              {hasAppointment ? 'Follow-up' : 'Mark follow-up'}
            </button>
          )}
          {canCancel && (
            <button type="button" className={btnDanger} onClick={() => onAction({ kind: 'cancel', referral })}>
              Cancel referral
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function ReferralGroup({
  title,
  subtitle,
  referrals,
  canWrite,
  empty,
  onAction,
  focusId = '',
}: {
  title: string;
  subtitle: string;
  referrals: Referral[];
  canWrite: boolean;
  empty: string;
  onAction: (pending: Pending) => void;
  focusId?: string;
}) {
  return (
    <Panel title={title} subtitle={subtitle}>
      {referrals.length === 0 ? (
        <EmptyState text={empty} />
      ) : (
        <ul className="divide-y divide-gray-100">
          {referrals.map((referral) => (
            <ReferralCard
              key={referral._id}
              referral={referral}
              canWrite={canWrite}
              onAction={onAction}
              focused={referral._id === focusId}
            />
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function ReferralPanel({
  patientId,
  canWrite,
  focusToken = 0,
  recordFocus = null,
}: {
  patientId: string;
  canWrite: boolean;
  focusToken?: number;
  recordFocus?: ChartRecordFocus | null;
}) {
  const [section, setSection] = useState<Section>('active');
  const [active, setActive] = useState<Referral[]>([]);
  const [closed, setClosed] = useState<Referral[]>([]);
  const [followUp, setFollowUp] = useState<Referral[]>([]);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [diagnoses, setDiagnoses] = useState<EncounterDiagnosis[]>([]);
  const [problems, setProblems] = useState<Condition[]>([]);
  const [carePlans, setCarePlans] = useState<CarePlan[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [pending, setPending] = useState<Pending | null>(null);
  const [actionAt, setActionAt] = useState(nowInput());
  const [actionNote, setActionNote] = useState('');
  const [appointmentDate, setAppointmentDate] = useState(nowInput());
  const [outcomeDraft, setOutcomeDraft] = useState<OutcomeDraft>(emptyOutcome());
  const [documentDraft, setDocumentDraft] = useState<DocumentDraft>(emptyDocument());
  const [followDraft, setFollowDraft] = useState<FollowUpDraft>(emptyFollowUp());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const intent = useRef<'draft' | 'sent'>('sent');

  const encounterDiagnoses = diagnoses.filter((item) => refId(item.encounterId) === draft.encounterId);
  const openPlans = carePlans.filter((plan) => plan.status !== 'cancelled');

  async function load() {
    const [activePage, closedPage, followPage, encounterPage, diagnosisPage, problemPage, planPage] =
      await Promise.all([
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
      if (current.specialistName || current.reasonForReferral || current.encounterId) return current;
      const encounterId = encounterPage.data.length === 1 ? encounterPage.data[0]._id : '';
      return { ...emptyDraft(), encounterId };
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
    if (!focusToken || recordFocus?.tab === 'referrals') return;
    setSection('active');
  }, [focusToken, recordFocus]);

  const referralFocusToken = recordFocus?.tab === 'referrals' ? recordFocus.token : 0;
  const referralFocusId = recordFocus?.tab === 'referrals' ? recordFocus.recordId : '';
  const seenReferralFocus = useRef(0);
  useEffect(() => {
    if (!referralFocusToken || !referralFocusId || loading) return;
    if (seenReferralFocus.current === referralFocusToken) return;
    const referral = [...active, ...closed, ...followUp].find((item) => item._id === referralFocusId);
    if (!referral && active.length === 0 && closed.length === 0) return;
    seenReferralFocus.current = referralFocusToken;
    if (referral) {
      setSection(referral.status === 'completed' || referral.status === 'closed' || referral.status === 'cancelled' ? 'completed' : 'active');
    }
    return watchChartRecord('referral', referralFocusId);
  }, [referralFocusToken, referralFocusId, loading, active, closed, followUp]);

  useEffect(() => {
    if (!focusToken || loading || section !== 'active' || recordFocus?.tab === 'referrals') return;
    document.getElementById('chart-new-referral')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [focusToken, loading, section, recordFocus]);

  function openAction(next: Pending) {
    setPending(next);
    setActionAt(nowInput());
    setActionNote('');
    setAppointmentDate(toInput(next.referral.appointmentDate) || nowInput());
    setOutcomeDraft(next.kind === 'outcome' ? emptyOutcome(next.referral) : emptyOutcome());
    setDocumentDraft(emptyDocument());
    setFollowDraft(next.kind === 'followUp' ? emptyFollowUp(next.referral) : emptyFollowUp());
    setError('');
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const body: ReferralInput = {
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
      const api = clinicalApi.referrals(patientId);
      if (pending.kind === 'status') {
        await api.setStatus(pending.referral._id, {
          status: pending.status,
          at: actionAt,
          note: actionNote.trim() || undefined,
          appointmentDate: pending.status === 'scheduled' ? appointmentDate : undefined,
        });
      } else if (pending.kind === 'cancel') {
        await api.cancel(pending.referral._id, { reason: actionNote.trim(), at: actionAt });
      } else if (pending.kind === 'outcome') {
        await api.addOutcome(pending.referral._id, {
          recommendations: outcomeDraft.recommendations.trim(),
          consultationSummary: outcomeDraft.consultationSummary.trim(),
          nextSteps: outcomeDraft.nextSteps.trim(),
          recordedAt: outcomeDraft.recordedAt,
          followUpRequired: outcomeDraft.followUpRequired,
        });
      } else if (pending.kind === 'document') {
        await api.addDocument(pending.referral._id, {
          documentType: documentDraft.documentType,
          title: documentDraft.title.trim(),
          description: documentDraft.description.trim() || undefined,
          recordedAt: documentDraft.recordedAt,
        });
      } else {
        await api.setFollowUp(pending.referral._id, {
          followUpRequired: followDraft.followUpRequired,
          appointmentDate: followDraft.appointmentDate || undefined,
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

  const completed = closed.filter((referral) => referral.status === 'completed' || referral.status === 'closed');
  const cancelled = closed.filter((referral) => referral.status === 'cancelled');
  const seen = new Set<string>();
  const activity = [...active, ...closed, ...followUp]
    .filter((referral) => {
      if (seen.has(referral._id)) return false;
      seen.add(referral._id);
      return true;
    })
    .flatMap((referral) => referral.timeline || [])
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const tabs: { id: Section; label: string }[] = [
    { id: 'active', label: 'Active Referrals' },
    { id: 'completed', label: 'Completed Referrals' },
    { id: 'follow_up', label: 'Follow-Up Required' },
  ];

  const showAppointmentOnFollowUp =
    pending?.kind === 'followUp' &&
    (pending.referral.status === 'scheduled' ||
      pending.referral.status === 'completed' ||
      !!pending.referral.appointmentDate);

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
        <form id="chart-new-referral" onSubmit={onCreate} className="scroll-mt-64 bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <div>
            <h2 className="font-semibold text-gray-900">New referral</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Internal referral tracking for this chart. Nothing is sent outside the clinic.
            </p>
          </div>
          {encounters.length === 0 ? (
            <p className="text-sm text-gray-600">Open an encounter before creating a referral.</p>
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
                  Record a diagnosis on this encounter before creating a referral.
                </p>
              )}
              <Field label="Active problem">
                <select
                  value={draft.conditionId}
                  onChange={(event) => setDraft((current) => ({ ...current, conditionId: event.target.value }))}
                  className={inputCls}
                >
                  <option value="">No active problem</option>
                  {problems.map((problem) => (
                    <option key={problem._id} value={problem._id}>
                      {problem.display}
                      {problem.code ? ` · ${problem.code}` : ''}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Care plan">
                <select
                  value={draft.carePlanId}
                  onChange={(event) => setDraft((current) => ({ ...current, carePlanId: event.target.value }))}
                  className={inputCls}
                >
                  <option value="">No care plan</option>
                  {openPlans.map((plan) => (
                    <option key={plan._id} value={plan._id}>
                      {plan.title} · {plan.status}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Referral type">
                <select
                  value={draft.referralType}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, referralType: event.target.value as ReferralType }))
                  }
                  className={inputCls}
                  required
                >
                  {REFERRAL_TYPES.map((type) => (
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
                    setDraft((current) => ({ ...current, priority: event.target.value as ReferralPriority }))
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
              <Field label="Specialty">
                <input
                  value={draft.specialty}
                  onChange={(event) => setDraft((current) => ({ ...current, specialty: event.target.value }))}
                  className={inputCls}
                  required
                  maxLength={120}
                />
              </Field>
              <Field label="Specialist">
                <input
                  value={draft.specialistName}
                  onChange={(event) => setDraft((current) => ({ ...current, specialistName: event.target.value }))}
                  className={inputCls}
                  required
                  maxLength={200}
                />
              </Field>
              <Field label="Organization">
                <input
                  value={draft.organization}
                  onChange={(event) => setDraft((current) => ({ ...current, organization: event.target.value }))}
                  className={inputCls}
                  required
                  maxLength={200}
                />
              </Field>
              <Field label="Referral date">
                <input
                  type="datetime-local"
                  value={draft.referralDate}
                  onChange={(event) => setDraft((current) => ({ ...current, referralDate: event.target.value }))}
                  className={inputCls}
                  required
                />
              </Field>
              <div className="md:col-span-2">
                <Field label="Reason for referral">
                  <textarea
                    value={draft.reasonForReferral}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, reasonForReferral: event.target.value }))
                    }
                    className={inputCls}
                    rows={3}
                    required
                    maxLength={2000}
                  />
                </Field>
              </div>
              <div className="md:col-span-2 flex flex-wrap gap-2">
                <button
                  type="submit"
                  className={btnPrimary}
                  disabled={saving || !draft.diagnosisId}
                  onClick={() => {
                    intent.current = 'sent';
                  }}
                >
                  {saving ? 'Saving...' : 'Send referral'}
                </button>
                <button
                  type="submit"
                  className={btnGhost}
                  disabled={saving || !draft.diagnosisId}
                  onClick={() => {
                    intent.current = 'draft';
                  }}
                >
                  Save draft
                </button>
              </div>
            </div>
          )}
        </form>
      )}

      {pending && (
        <form onSubmit={onPending} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <div>
            <h3 className="font-semibold text-gray-900">
              {pending.kind === 'cancel'
                ? 'Cancel referral'
                : pending.kind === 'outcome'
                  ? pending.referral.currentOutcome
                    ? 'Update outcome'
                    : 'Record outcome'
                  : pending.kind === 'document'
                    ? 'Add document'
                    : pending.kind === 'followUp'
                      ? 'Follow-up'
                      : STATUS_COPY[pending.status].title}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {pending.referral.specialistName} · {pending.referral.specialty}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {pending.kind === 'cancel'
                ? 'Cancellation stays on the referral history.'
                : pending.kind === 'outcome'
                  ? 'A new revision is saved. Earlier recommendations stay on the chart.'
                  : pending.kind === 'document'
                    ? 'This stores the document record only. The file can be attached later.'
                    : pending.kind === 'followUp'
                      ? 'Follow-up stays on the chart until it is cleared and the referral is closed.'
                      : STATUS_COPY[pending.status].hint}
            </p>
          </div>
          {pending.kind === 'outcome' ? (
            <div className="grid grid-cols-1 gap-4">
              <Field label="Specialist recommendations">
                <textarea
                  value={outcomeDraft.recommendations}
                  onChange={(event) =>
                    setOutcomeDraft((current) => ({ ...current, recommendations: event.target.value }))
                  }
                  className={inputCls}
                  rows={3}
                  required
                  maxLength={4000}
                />
              </Field>
              <Field label="Consultation summary">
                <textarea
                  value={outcomeDraft.consultationSummary}
                  onChange={(event) =>
                    setOutcomeDraft((current) => ({ ...current, consultationSummary: event.target.value }))
                  }
                  className={inputCls}
                  rows={3}
                  required
                  maxLength={4000}
                />
              </Field>
              <Field label="Next steps">
                <textarea
                  value={outcomeDraft.nextSteps}
                  onChange={(event) => setOutcomeDraft((current) => ({ ...current, nextSteps: event.target.value }))}
                  className={inputCls}
                  rows={3}
                  required
                  maxLength={4000}
                />
              </Field>
              <Field label="Outcome date">
                <input
                  type="datetime-local"
                  value={outcomeDraft.recordedAt}
                  onChange={(event) => setOutcomeDraft((current) => ({ ...current, recordedAt: event.target.value }))}
                  className={inputCls}
                  required
                />
              </Field>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={outcomeDraft.followUpRequired}
                  onChange={(event) =>
                    setOutcomeDraft((current) => ({ ...current, followUpRequired: event.target.checked }))
                  }
                />
                Follow-up required
              </label>
            </div>
          ) : pending.kind === 'document' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Document type">
                <select
                  value={documentDraft.documentType}
                  onChange={(event) =>
                    setDocumentDraft((current) => ({
                      ...current,
                      documentType: event.target.value as ReferralDocumentType,
                    }))
                  }
                  className={inputCls}
                  required
                >
                  {DOCUMENT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Recorded">
                <input
                  type="datetime-local"
                  value={documentDraft.recordedAt}
                  onChange={(event) => setDocumentDraft((current) => ({ ...current, recordedAt: event.target.value }))}
                  className={inputCls}
                  required
                />
              </Field>
              <div className="md:col-span-2">
                <Field label="Title">
                  <input
                    value={documentDraft.title}
                    onChange={(event) => setDocumentDraft((current) => ({ ...current, title: event.target.value }))}
                    className={inputCls}
                    required
                    maxLength={200}
                  />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="Description">
                  <textarea
                    value={documentDraft.description}
                    onChange={(event) =>
                      setDocumentDraft((current) => ({ ...current, description: event.target.value }))
                    }
                    className={inputCls}
                    rows={2}
                    maxLength={2000}
                  />
                </Field>
              </div>
            </div>
          ) : pending.kind === 'followUp' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700 md:col-span-2">
                <input
                  type="checkbox"
                  checked={followDraft.followUpRequired}
                  onChange={(event) =>
                    setFollowDraft((current) => ({ ...current, followUpRequired: event.target.checked }))
                  }
                />
                Follow-up required
              </label>
              {showAppointmentOnFollowUp && (
                <Field label="Appointment date">
                  <input
                    type="datetime-local"
                    value={followDraft.appointmentDate}
                    onChange={(event) =>
                      setFollowDraft((current) => ({ ...current, appointmentDate: event.target.value }))
                    }
                    className={inputCls}
                  />
                </Field>
              )}
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
              {pending.kind === 'status' && pending.status === 'scheduled' && (
                <Field label="Appointment date">
                  <input
                    type="datetime-local"
                    value={appointmentDate}
                    onChange={(event) => setAppointmentDate(event.target.value)}
                    className={inputCls}
                    required
                  />
                </Field>
              )}
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
                  ? 'Cancel referral'
                  : pending.kind === 'outcome'
                    ? 'Save outcome'
                    : pending.kind === 'document'
                      ? 'Save document'
                      : pending.kind === 'followUp'
                        ? 'Save follow-up'
                        : STATUS_COPY[pending.status].submit}
            </button>
            <button type="button" className={btnGhost} onClick={() => setPending(null)}>
              Close
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading referrals...</p>
      ) : (
        <>
          {section === 'active' && (
            <ReferralGroup
              title="Active Referrals"
              subtitle="Draft, sent, accepted, and scheduled referrals"
              referrals={active}
              canWrite={canWrite}
              empty="No active referrals."
              onAction={openAction}
              focusId={referralFocusId}
            />
          )}
          {section === 'completed' && (
            <div className="space-y-6">
              <ReferralGroup
                title="Completed Referrals"
                subtitle="Completed and closed referrals"
                referrals={completed}
                canWrite={canWrite}
                empty="No completed referrals."
                onAction={openAction}
                focusId={referralFocusId}
              />
              <ReferralGroup
                title="Cancelled referrals"
                subtitle="Cancelled referrals remain on the chart"
                referrals={cancelled}
                canWrite={canWrite}
                empty="No cancelled referrals."
                onAction={openAction}
                focusId={referralFocusId}
              />
            </div>
          )}
          {section === 'follow_up' && (
            <ReferralGroup
              title="Follow-Up Required"
              subtitle="Referrals that still need a clinic follow-up"
              referrals={followUp}
              canWrite={canWrite}
              empty="No referrals need follow-up."
              onAction={openAction}
              focusId={referralFocusId}
            />
          )}
          <Panel
            title="Referral activity"
            subtitle="Created, sent, accepted, scheduled, consultation, and completed events"
          >
            {activity.length === 0 ? (
              <EmptyState text="Referral activity appears here after a referral is created." />
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

export function ReferralSummary({
  patientId,
  onOpen,
}: {
  patientId: string;
  onOpen?: () => void;
}) {
  const [summary, setSummary] = useState<ReferralSummaryData | null>(null);
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
        if (!cancelled) setError(messageOf(err));
      });
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  return (
    <Panel title="Referrals" subtitle="Active specialist, allied health, and community referrals">
      {error && (
        <div className="mb-3 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">{error}</div>
      )}
      {!summary ? (
        <p className="text-sm text-gray-500">Loading referrals...</p>
      ) : summary.active.length === 0 ? (
        <p className="text-sm text-gray-500">No active referrals.</p>
      ) : (
        <ul className="space-y-3">
          {summary.active.map((referral) => (
            <li key={referral._id} className="text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-gray-900">{referral.specialistName}</span>
                <span className="text-gray-600">{referral.specialty}</span>
                <StatusBadge value={referral.status} />
                <StatusBadge value={referral.priority} />
              </div>
              <div className="text-gray-600 mt-0.5">
                {diagnosisText(referral.diagnosisId)} · {encounterText(referral.encounterId)}
              </div>
            </li>
          ))}
        </ul>
      )}
      {summary && summary.counts.followUp > 0 && (
        <p className="text-sm text-amber-800 mt-3">
          {summary.counts.followUp} {summary.counts.followUp === 1 ? 'referral needs' : 'referrals need'} follow-up.
        </p>
      )}
      {onOpen && (
        <button type="button" className={`${btnText} mt-4`} onClick={onOpen}>
          Open referrals
        </button>
      )}
    </Panel>
  );
}
