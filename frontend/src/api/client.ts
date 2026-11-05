/** Hosted split deploys set VITE_API_URL to the API origin, the same way CliniX Insight does. */
export function apiBase() {
  const configured = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, '');
  if (!configured) return '/api/v1';
  if (configured.endsWith('/api/v1')) return configured;
  return `${configured}/api/v1`;
}

const API_BASE = apiBase();

export type Role =
  | 'clinician'
  | 'nurse'
  | 'caregiver'
  | 'admin'
  | 'pharmacist'
  | 'insight_service';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
}

export interface Paginated<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
}

function getToken() {
  return localStorage.getItem('clinix_token');
}

export class ApiError extends Error {
  status: number;
  code?: string;
  warnings?: AllergyWarning[];

  constructor(
    message: string,
    status: number,
    extra?: { code?: string; warnings?: AllergyWarning[] }
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = extra?.code;
    this.warnings = extra?.warnings;
  }
}

function warningList(value: unknown): AllergyWarning[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  return value as AllergyWarning[];
}

type ApiPayload = { error?: string; details?: unknown; code?: string; warnings?: unknown };

function explainFailure(status: number, message: string) {
  const generic =
    !message ||
    message === 'Request failed' ||
    /^(unauthorized|forbidden|not found|internal server error|bad gateway|service unavailable)$/i.test(message);
  if (!generic) return message;
  if (status === 401) return 'Your session expired. Sign in again.';
  if (status === 403) return 'You do not have permission to view or change this.';
  if (status === 404) return 'That record could not be found.';
  if (status >= 500) return 'The clinic service is unavailable. Try again in a moment.';
  return message || 'The request could not be completed.';
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new ApiError('The clinic network could not be reached. Check your connection and try again.', 0);
  }
  const text = await res.text();
  let data: ApiPayload | null = null;
  if (text) {
    try {
      data = JSON.parse(text) as ApiPayload;
    } catch {
      if (text.trimStart().startsWith('<')) {
        throw new ApiError(
          'API not reachable from this site. Set VITE_API_URL to your Render URL (for example https://clinix-core.onrender.com) and redeploy the frontend.',
          res.status
        );
      }
      throw new ApiError('The clinic service returned a response the app could not read.', res.status);
    }
  }
  if (!res.ok) {
    const message = explainFailure(res.status, data?.error || res.statusText || 'Request failed');
    if (res.status === 401 && token && !path.startsWith('/auth/login')) {
      localStorage.removeItem('clinix_token');
      sessionStorage.setItem('clinix_session_notice', 'Your session expired. Sign in again.');
      window.dispatchEvent(new Event('clinix-session-expired'));
    }
    const details = data?.details;
    const detailRecord =
      details && typeof details === 'object' && !Array.isArray(details)
        ? (details as { code?: string; warnings?: unknown })
        : undefined;
    const formatted = formatDetails(details);
    throw new ApiError(formatted ? `${message}: ${formatted}` : message, res.status, {
      code: typeof data?.code === 'string' ? data.code : detailRecord?.code,
      warnings: warningList(data?.warnings) || warningList(detailRecord?.warnings),
    });
  }
  return data as T;
}

function formatDetails(details: unknown) {
  if (!Array.isArray(details)) return '';
  const kinds = new Set(['provider', 'patient', 'provider,patient']);
  return details
    .map((item) => {
      if (typeof item === 'string') return item;
      if (!item || typeof item !== 'object' || !('message' in item)) return '';
      const message = String((item as { message?: unknown }).message ?? '');
      const path =
        'path' in item && (item as { path?: unknown }).path
          ? String((item as { path?: unknown }).path)
          : '';
      if (!message) return '';
      if (path && !kinds.has(path)) return `${path}: ${message}`;
      return message;
    })
    .filter(Boolean)
    .join('; ');
}

export const authApi = {
  login: (email: string, password: string) =>
    api<{ token: string; user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: () => api<{ user: AuthUser }>('/auth/me'),
  directory: () => api<{ data: CareTeamMember[] }>('/auth/users'),
};

export interface CareTeamMember {
  _id: string;
  displayName: string;
  email?: string;
  role: string;
}

export type CanadianProvince =
  | 'AB'
  | 'BC'
  | 'MB'
  | 'NB'
  | 'NL'
  | 'NS'
  | 'NT'
  | 'NU'
  | 'ON'
  | 'PE'
  | 'QC'
  | 'SK'
  | 'YT';

export interface PatientAddress {
  street?: string;
  city?: string;
  province?: CanadianProvince | string;
  postalCode?: string;
  country?: string;
}

export interface ProvincialHealth {
  province: CanadianProvince | string;
  healthCardNumber: string;
  versionCode?: string;
}

export interface PersonContact {
  name: string;
  relationship?: string;
  phone?: string;
  phoneSecondary?: string;
}

export interface Patient {
  _id: string;
  mrn: string;
  /** Legal given name */
  givenName: string;
  /** Legal family name */
  familyName: string;
  preferredName?: string;
  birthDate: string;
  language?: string;
  /** Sex assigned at birth */
  sex: string;
  genderIdentity?: string;
  contact?: { phone?: string; email?: string; address?: string };
  address?: PatientAddress;
  provincialHealth?: ProvincialHealth;
  emergencyContact?: PersonContact;
  substituteDecisionMaker?: PersonContact;
  identifiers?: { insuranceMemberId?: string; nationalId?: string };
  careTeam?: Array<CareTeamMember | string>;
  summary?: {
    activeConditions: number;
    activeMedications: number;
    activeOrders?: number;
    activeReferrals?: number;
    followUpReferrals?: number;
    activeMonitoring?: number;
    overdueRecalls?: number;
    latestVital?: Vital;
  };
}

export interface PatientSearchParams {
  q?: string;
  mrn?: string;
  healthCardNumber?: string;
  name?: string;
  birthDate?: string;
  limit?: number;
}
export interface Vital {
  _id: string;
  effectiveAt: string;
  source: string;
  measurements: Record<string, number | undefined>;
}

export interface Condition {
  _id: string;
  display: string;
  status: string;
  severity: string;
  onsetDate?: string;
  resolvedDate?: string | null;
  clinicianOwner?: string | EncounterProvider | null;
  codeSystem?: string;
  code?: string;
  sourceDiagnosisId?: string | null;
}

export type DiagnosisType = 'working' | 'final' | 'encounter';
export type PromotionTarget = 'active_problem' | 'existing_problem';

export interface EncounterDiagnosis {
  _id: string;
  encounterId: string | { _id: string; chiefComplaint?: string; openedAt?: string; status?: EncounterStatus };
  patientId: string;
  code: string;
  description: string;
  diagnosisType: DiagnosisType;
  primaryDiagnosis: boolean;
  recordedBy?: string | EncounterProvider;
  recordedAt: string;
  promotedProblemId?: string | { _id: string; display?: string; status?: string } | null;
  promotion?: PromotionTarget | null;
  promotedAt?: string | null;
  promotedBy?: string | EncounterProvider | null;
}

export interface PromoteDiagnosisBody {
  target: PromotionTarget;
  problemId?: string;
  severity?: string;
  onsetDate?: string;
  status?: string;
  clinicianOwner?: string;
  display?: string;
}

export type MedicationStatus = 'active' | 'on-hold' | 'completed' | 'discontinued';

export type MedicationEventAction =
  | 'started'
  | 'changed'
  | 'held'
  | 'resumed'
  | 'discontinued'
  | 'completed';

export interface AllergyWarning {
  allergyId: string;
  substance: string;
  reaction: string;
  severity: string;
  matchedOn: string;
}

export interface MedicationTimelinePoint {
  action: MedicationEventAction;
  label: string;
  at: string;
  detail: string;
  reason?: string;
  clinicianId?: string | EncounterProvider;
}

export interface Medication {
  _id: string;
  patientId?: string;
  encounterId?: string | { _id: string; chiefComplaint?: string; openedAt?: string; status?: string } | null;
  conditionId?: string | { _id: string; display?: string; code?: string; status?: string } | null;
  din?: string;
  genericName: string;
  brandName?: string;
  strength?: string;
  dosage: string;
  route: string;
  frequency: string;
  indication?: string;
  startDate: string;
  endDate?: string | null;
  prescribedBy?: string | EncounterProvider | null;
  status: MedicationStatus | string;
  adherenceNotes?: string;
  /** Legacy fields kept on older chart rows. */
  name?: string;
  dose?: string;
  timeline?: MedicationTimelinePoint[];
}

export interface MedicationSummary {
  active: Medication[];
  recentChanges: Array<
    MedicationTimelinePoint & {
      medicationId: string;
      genericName: string;
      brandName?: string;
      status: MedicationStatus;
    }
  >;
  relatedDiagnoses: Array<{
    medicationId: string;
    genericName: string;
    brandName?: string;
    diagnosis: { _id?: string; display: string; code?: string; status?: string } | null;
  }>;
}

export interface MedicationInput {
  encounterId?: string | null;
  conditionId?: string | null;
  din?: string | null;
  genericName: string;
  brandName?: string | null;
  strength?: string | null;
  dosage: string;
  route: string;
  frequency: string;
  indication?: string | null;
  startDate: string;
  prescribedBy: string;
  reason?: string;
  date?: string;
  allergyAcknowledgment?: { acknowledged: true };
}

export interface MedicationActionInput {
  reason: string;
  date: string;
  clinicianId?: string;
}

export type OrderType = 'laboratory' | 'diagnostic_imaging' | 'procedure';
export type OrderPriority = 'routine' | 'urgent' | 'stat';
export type OrderStatus =
  | 'draft'
  | 'ordered'
  | 'scheduled'
  | 'collected'
  | 'resulted'
  | 'completed'
  | 'cancelled';
export type ResultStatus = 'preliminary' | 'final' | 'corrected';

export interface LinkedDiagnosis {
  _id: string;
  code?: string;
  description?: string;
  diagnosisType?: string;
  primaryDiagnosis?: boolean;
}

export interface LinkedEncounter {
  _id: string;
  chiefComplaint?: string;
  openedAt?: string;
  status?: string;
}

export interface LinkedProblem {
  _id: string;
  display?: string;
  code?: string;
  status?: string;
}

export interface OrderStatusEvent {
  _id?: string;
  status: OrderStatus;
  at: string;
  actorId?: string | EncounterProvider;
  note?: string;
}

export interface OrderTimelinePoint {
  action: 'placed' | 'scheduled' | 'collected' | 'result_received' | 'completed';
  label: string;
  at: string;
  detail: string;
}

export interface OrderResult {
  _id: string;
  orderId: string;
  resultType: string;
  value: string;
  unit?: string;
  referenceRange?: string;
  resultDate: string;
  interpretation?: string;
  status: ResultStatus;
  order?: {
    _id: string;
    orderName: string;
    orderType: OrderType;
    priority: OrderPriority;
    status: OrderStatus;
    diagnosisId?: LinkedDiagnosis | string | null;
    encounterId?: LinkedEncounter | string | null;
  } | null;
}

export interface Order {
  _id: string;
  encounterId: LinkedEncounter | string;
  diagnosisId: LinkedDiagnosis | string;
  conditionId?: LinkedProblem | string | null;
  orderedBy?: EncounterProvider | string | null;
  orderType: OrderType;
  orderName: string;
  priority: OrderPriority;
  clinicalReason: string;
  instructions?: string;
  orderedAt?: string | null;
  scheduledAt?: string | null;
  collectedAt?: string | null;
  resultedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  status: OrderStatus;
  statusHistory?: OrderStatusEvent[];
  results?: OrderResult[];
  timeline?: OrderTimelinePoint[];
  createdAt?: string;
}

export interface OrderSummary {
  active: Order[];
  counts: { active: number; completed: number; cancelled: number };
}

export interface OrderInput {
  encounterId: string;
  diagnosisId: string;
  conditionId?: string | null;
  orderedBy: string;
  orderType: OrderType;
  orderName: string;
  priority: OrderPriority;
  clinicalReason: string;
  instructions?: string;
  status: 'draft' | 'ordered';
}

export interface OrderStatusInput {
  status: 'ordered' | 'scheduled' | 'collected' | 'completed';
  at?: string;
  note?: string;
}

export interface OrderCancelInput {
  reason: string;
  at?: string;
}

export interface OrderResultInput {
  resultType: string;
  value: string;
  unit?: string;
  referenceRange?: string;
  resultDate: string;
  interpretation?: string;
  status: ResultStatus;
}

export type ReferralType = 'specialist' | 'allied_health' | 'community_service';
export type ReferralPriority = 'routine' | 'urgent';
export type ReferralStatus =
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'scheduled'
  | 'completed'
  | 'closed'
  | 'cancelled';
export type ReferralDocumentType = 'referral_letter' | 'consultation_note' | 'external_report';

export interface LinkedCarePlan {
  _id: string;
  title?: string;
  status?: string;
}

export interface ReferralStatusEvent {
  _id?: string;
  status: ReferralStatus;
  at: string;
  actorId?: string | EncounterProvider;
  note?: string;
}

export interface ReferralTimelinePoint {
  action:
    | 'created'
    | 'sent'
    | 'accepted'
    | 'appointment_scheduled'
    | 'consultation_received'
    | 'completed';
  label: string;
  at: string;
  detail: string;
}

export interface ReferralDocumentMeta {
  _id: string;
  documentType: ReferralDocumentType;
  title: string;
  description?: string;
  recordedAt: string;
  recordedBy?: string | EncounterProvider;
}

export interface ReferralOutcome {
  _id: string;
  version: number;
  recommendations: string;
  consultationSummary: string;
  nextSteps: string;
  recordedAt: string;
  authorId?: string | EncounterProvider;
  createdAt?: string;
}

export interface ReferralLink {
  kind: 'encounter' | 'problem' | 'care_plan';
  label: string;
  text: string;
}

export interface Referral {
  _id: string;
  encounterId: LinkedEncounter | string;
  diagnosisId: LinkedDiagnosis | string;
  conditionId?: LinkedProblem | string | null;
  carePlanId?: LinkedCarePlan | string | null;
  createdBy?: EncounterProvider | string | null;
  referralType: ReferralType;
  specialty: string;
  specialistName: string;
  organization: string;
  reasonForReferral: string;
  priority: ReferralPriority;
  referralDate: string;
  appointmentDate?: string | null;
  outcomeReceivedDate?: string | null;
  followUpRequired: boolean;
  status: ReferralStatus;
  statusHistory?: ReferralStatusEvent[];
  documents?: ReferralDocumentMeta[];
  outcomes?: ReferralOutcome[];
  currentOutcome?: ReferralOutcome | null;
  linkedDiagnoses?: ReferralLink[];
  timeline?: ReferralTimelinePoint[];
  createdAt?: string;
}

export interface ReferralSummary {
  active: Referral[];
  followUp: Referral[];
  counts: { active: number; completed: number; closed: number; cancelled: number; followUp: number };
}

export interface ReferralInput {
  encounterId: string;
  diagnosisId: string;
  conditionId?: string | null;
  carePlanId?: string | null;
  referralType: ReferralType;
  specialty: string;
  specialistName: string;
  organization: string;
  reasonForReferral: string;
  priority: ReferralPriority;
  referralDate: string;
  status: 'draft' | 'sent';
}

export interface ReferralStatusInput {
  status: 'sent' | 'accepted' | 'scheduled' | 'completed' | 'closed';
  at?: string;
  appointmentDate?: string;
  note?: string;
}

export interface ReferralCancelInput {
  reason: string;
  at?: string;
}

export interface ReferralOutcomeInput {
  recommendations: string;
  consultationSummary: string;
  nextSteps: string;
  recordedAt?: string;
  followUpRequired?: boolean;
}

export interface ReferralDocumentInput {
  documentType: ReferralDocumentType;
  title: string;
  description?: string;
  recordedAt?: string;
}

export interface ReferralFollowUpInput {
  followUpRequired: boolean;
  appointmentDate?: string;
}

export type EncounterStatus = 'open' | 'in_progress' | 'awaiting_signature' | 'signed' | 'amended';

export interface EncounterProvider {
  _id: string;
  displayName?: string;
  role?: string;
}

export interface DisplayTimelineEvent {
  kind: string;
  label: string;
  at: string;
  detail?: string;
}

export interface Encounter {
  _id: string;
  patientId: string;
  visitId: string;
  appointmentId: string;
  attendingProviderId: string | EncounterProvider;
  supervisingProviderId?: string | EncounterProvider | null;
  clinicLocation: string;
  appointmentType: string;
  chiefComplaint: string;
  reasonForVisit: string;
  status: EncounterStatus;
  isCurrent: boolean;
  createdBy?: string | EncounterProvider;
  signedBy?: string | EncounterProvider | null;
  signedAt?: string | null;
  openedAt: string;
  amendsEncounterId?: string | null;
  amendmentId?: string | null;
  room?: string | null;
  displayTimeline?: DisplayTimelineEvent[];
}

export interface EncounterSummary {
  encounterId: string | null;
  provider: string | null;
  chiefComplaint: string | null;
  status: EncounterStatus | null;
  room: string | null;
  openedAt: string | null;
  visitId: string | null;
  visitStatus: string | null;
}

export interface EncounterCurrent {
  encounter: Encounter | null;
  displayTimeline: DisplayTimelineEvent[];
}

export type AppointmentStatus =
  | 'booked'
  | 'confirmed'
  | 'arrived'
  | 'no_show'
  | 'cancelled'
  | 'completed';

export type AppointmentType =
  | 'new_patient'
  | 'follow_up'
  | 'consultation'
  | 'procedure'
  | 'telehealth';

export type ClinicLocation = 'Toronto Main' | 'North York' | 'Mississauga' | 'Virtual';

export interface AppointmentPerson {
  _id: string;
  givenName: string;
  familyName: string;
  preferredName?: string;
  mrn: string;
}

export interface AppointmentProvider {
  _id: string;
  displayName: string;
  role: string;
}

export interface Appointment {
  _id: string;
  patientId: string | AppointmentPerson;
  providerId: string | AppointmentProvider;
  clinicLocation: ClinicLocation | string;
  appointmentType: AppointmentType;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  cancelReason?: string;
}

export type VisitStatus =
  | 'booked'
  | 'confirmed'
  | 'arrived'
  | 'waiting'
  | 'roomed'
  | 'in_progress'
  | 'completed'
  | 'no_show'
  | 'cancelled';

export interface VisitTimelineEvent {
  event: 'arrived' | 'waiting' | 'roomed' | 'in_progress' | 'completed';
  at: string;
  actorId?: string | { _id: string; displayName?: string; role?: string };
  examRoom?: string;
  note?: string;
}

export interface Visit {
  _id: string;
  appointmentId: string;
  patientId: string;
  providerId: string;
  status: VisitStatus;
  arrivalAt?: string;
  roomedAt?: string;
  startedAt?: string;
  completedAt?: string;
  examRoom?: string | null;
  demographicsVerified: boolean;
  healthCardVerified: boolean;
  note?: string;
  cancelReason?: string;
  timeline: VisitTimelineEvent[];
}

export interface VisitBoardPatient {
  _id: string;
  givenName: string;
  familyName: string;
  preferredName?: string;
  mrn: string;
  birthDate?: string;
  sex?: string;
  genderIdentity?: string;
  language?: string;
  contact?: { phone?: string; email?: string; address?: string };
  address?: PatientAddress;
  provincialHealth?: ProvincialHealth;
}

export interface VisitBoardAppointment {
  _id: string;
  patientId: VisitBoardPatient;
  providerId: AppointmentProvider;
  clinicLocation: ClinicLocation | string;
  appointmentType: AppointmentType;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  cancelReason?: string;
  createdAt?: string;
}

export interface VisitBoardRow {
  appointment: VisitBoardAppointment;
  visit: Visit | null;
}

export interface VisitBoard {
  date: string;
  examRooms: Record<string, string[]>;
  checkIn: VisitBoardRow[];
  waitingRoom: VisitBoardRow[];
  providerQueue: {
    waiting: VisitBoardRow[];
    roomed: VisitBoardRow[];
    inProgress: VisitBoardRow[];
  };
  closed: VisitBoardRow[];
}

export interface PatientVisit extends Omit<Visit, 'appointmentId' | 'providerId'> {
  appointmentId:
    | string
    | {
        _id: string;
        startTime: string;
        endTime: string;
        appointmentType: string;
        clinicLocation: string;
        status: string;
        cancelReason?: string;
      };
  providerId: string | AppointmentProvider;
}

export type CarePlanStatus = 'draft' | 'active' | 'on_hold' | 'completed' | 'cancelled';
export type CarePlanGoalStatus = 'not_started' | 'in_progress' | 'achieved' | 'cancelled';
export type CarePlanInterventionStatus = 'planned' | 'active' | 'completed' | 'cancelled';
export type CarePlanRole = 'clinician' | 'nurse' | 'caregiver' | 'pharmacist';

export interface CarePlanDiagnosisLink {
  id: string;
  kind: 'problem' | 'encounter';
  label: string;
  code?: string;
  primary: boolean;
}

export interface CarePlanGoal {
  _id: string;
  description: string;
  targetValue?: string | null;
  targetDate: string;
  status: CarePlanGoalStatus;
  achievedAt?: string | null;
  overdue?: boolean;
}

export interface CarePlanIntervention {
  _id: string;
  description: string;
  assignedRole: CarePlanRole;
  dueDate: string;
  status: CarePlanInterventionStatus;
  completedAt?: string | null;
  overdue?: boolean;
}

export interface CarePlanProgress {
  _id?: string;
  at: string;
  note: string;
  authorId?: string | { _id?: string; displayName?: string; role?: string };
}

export interface CarePlanRelatedMedication {
  _id: string;
  name: string;
  dose?: string;
  frequency?: string;
  status: string;
}

export interface CarePlanRelatedOrder {
  _id: string;
  orderName: string;
  orderType: string;
  priority: string;
  status: string;
  orderedAt?: string;
}

export interface CarePlanRelatedResult {
  _id: string;
  orderId: string;
  orderName: string;
  resultType: string;
  value: string;
  unit?: string;
  status: string;
  resultDate: string;
}

export interface CarePlanTimelinePoint {
  action: string;
  label: string;
  at: string;
  detail: string;
}

export interface CarePlan {
  _id: string;
  title: string;
  description?: string;
  status: CarePlanStatus;
  startDate?: string;
  targetDate?: string | null;
  completedDate?: string | null;
  ownerClinicianId?: string | CareTeamMember | null;
  encounterId?: string | LinkedEncounter | null;
  primaryDiagnosisId?: string | null;
  primaryDiagnosisKind?: 'problem' | 'encounter' | null;
  problemIds?: string[];
  encounterDiagnosisIds?: string[];
  linkedDiagnoses?: CarePlanDiagnosisLink[];
  goals?: CarePlanGoal[];
  interventions?: CarePlanIntervention[];
  progress?: CarePlanProgress[];
  relatedMedications?: CarePlanRelatedMedication[];
  relatedOrders?: CarePlanRelatedOrder[];
  recentResults?: CarePlanRelatedResult[];
  timeline?: CarePlanTimelinePoint[];
}

export interface CarePlanSummary {
  active: Array<{
    _id: string;
    title: string;
    status: CarePlanStatus;
    targetDate?: string | null;
    owner?: string | null;
    primaryDiagnosis?: string | null;
  }>;
  onHold: CarePlanSummary['active'];
  overdueGoals: Array<{
    _id: string;
    description: string;
    targetValue?: string | null;
    targetDate: string;
    status: CarePlanGoalStatus;
    carePlanId: string;
    carePlanTitle: string;
  }>;
  upcomingTasks: Array<{
    _id: string;
    title: string;
    status: string;
    dueDate?: string | null;
    assigneeRole: string;
    carePlanId?: string;
    carePlanTitle: string;
  }>;
}

export interface CarePlanOptions {
  clinicians: CareTeamMember[];
  problems: Array<{ _id: string; display: string; code?: string; status: string }>;
  diagnoses: Array<{
    _id: string;
    code: string;
    description: string;
    diagnosisType?: string;
    primaryDiagnosis?: boolean;
    encounterId?: string;
  }>;
  encounters: Array<{ _id: string; chiefComplaint?: string; openedAt?: string; status?: string }>;
}

export type ProgramType = 'hypertension' | 'diabetes' | 'copd' | 'heart_failure' | 'ckd' | 'custom';
export type ProgramStatus = 'active' | 'on_hold' | 'completed';
export type MetricType = 'blood_pressure' | 'weight' | 'bmi' | 'a1c' | 'ldl' | 'egfr' | 'custom';
export type MetricSource = 'clinic' | 'home' | 'device' | 'caregiver';
export type RecallStatus = 'due' | 'scheduled' | 'completed' | 'overdue' | 'cancelled';
export type TrendDirection = 'up' | 'down' | 'stable' | 'unknown';

export interface MonitoringTimelinePoint {
  action: string;
  label: string;
  at: string;
  detail: string;
}

export interface MonitoringMetric {
  _id: string;
  programId: string;
  metricType: MetricType;
  label?: string | null;
  displayLabel: string;
  value: string;
  unit: string;
  recordedAt: string;
  source: MetricSource;
  abnormal: boolean;
}

export interface MonitoringProgram {
  _id: string;
  title: string;
  programType: ProgramType;
  name?: string | null;
  status: ProgramStatus;
  enrolledDate: string;
  completedDate?: string | null;
  ownerClinicianId?: string | CareTeamMember | null;
  owner?: string | null;
  carePlanId?: string | { _id: string; title?: string; status?: string } | null;
  carePlanTitle?: string | null;
  diagnosisId?: string | null;
  diagnosisKind?: 'problem' | 'encounter' | null;
  diagnosisLabel?: string | null;
  recentMetrics?: MonitoringMetric[];
  timeline?: MonitoringTimelinePoint[];
}

export interface MonitoringRecall {
  _id: string;
  reason: string;
  dueDate: string;
  status: RecallStatus;
  assignedProvider?: string | CareTeamMember | null;
  assignedProviderName?: string | null;
  carePlanId?: string | { _id: string; title?: string; status?: string } | null;
  carePlanTitle?: string | null;
  diagnosisId?: string | null;
  diagnosisKind?: 'problem' | 'encounter' | null;
  diagnosisLabel?: string | null;
  completedAt?: string | null;
  timeline?: MonitoringTimelinePoint[];
}

export interface MonitoringDashboard {
  counts: {
    activePrograms: number;
    overdueRecalls: number;
    upcomingRecalls: number;
  };
  activePrograms: Array<{
    _id: string;
    title: string;
    programType: ProgramType;
    status: ProgramStatus;
    enrolledDate: string;
    owner?: string | null;
    diagnosisLabel?: string | null;
    latestMetric?: MonitoringMetric | null;
  }>;
  overdueRecalls: Array<{
    _id: string;
    reason: string;
    dueDate: string;
    status: RecallStatus;
    assignedProvider?: string | null;
    diagnosisLabel?: string | null;
    carePlanTitle?: string | null;
  }>;
  upcomingRecalls: MonitoringDashboard['overdueRecalls'];
  recentAbnormal: Array<MonitoringMetric & { programTitle: string }>;
}

export interface TrendSeries {
  metricType: MetricType;
  label: string;
  unit: string;
  direction: TrendDirection;
  latest: MonitoringMetric | null;
  recent: MonitoringMetric[];
  points: Array<{ value: string; numeric: number | null; recordedAt: string }>;
}

export interface MonitoringTrends {
  bloodPressure: TrendSeries;
  weight: TrendSeries;
  a1c: TrendSeries;
  laboratory: TrendSeries[];
}

export interface MonitoringOptions {
  clinicians: CareTeamMember[];
  problems: Array<{ _id: string; display: string; code?: string; status: string }>;
  diagnoses: Array<{
    _id: string;
    code: string;
    description: string;
    diagnosisType?: string;
    encounterId?: string;
  }>;
  carePlans: Array<{ _id: string; title: string; status: string }>;
}

export interface Task {
  _id: string;
  title: string;
  assigneeRole: string;
  assigneeUserId?: string | { _id: string; displayName?: string };
  status: string;
  dueDate?: string;
  carePlanId?: string;
}

export interface ClinicalNote {
  _id: string;
  body: string;
  version: number;
  rootId?: string;
  encounterId?: string;
  createdAt: string;
  updatedAt: string;
  authorId?: { displayName?: string; role?: string } | string;
}

export interface Allergy {
  _id: string;
  substance: string;
  reaction: string;
  severity: string;
  status: string;
  recordedDate: string;
}

export interface AuditEvent {
  _id: string;
  role: string;
  action: string;
  resourceType: string;
  resourceId: string;
  timestamp: string;
  event?: string;
  before?: unknown;
  after?: unknown;
  userId?: { displayName?: string; email?: string; role?: string } | string;
}

export const patientsApi = {
  list: (params: string | PatientSearchParams = '') => {
    const query = new URLSearchParams();
    query.set('limit', '50');
    if (typeof params === 'string') {
      if (params) query.set('q', params);
    } else {
      if (params.limit != null) query.set('limit', String(params.limit));
      if (params.q) query.set('q', params.q);
      if (params.mrn) query.set('mrn', params.mrn);
      if (params.healthCardNumber) query.set('healthCardNumber', params.healthCardNumber);
      if (params.name) query.set('name', params.name);
      if (params.birthDate) query.set('birthDate', params.birthDate);
    }
    return api<Paginated<Patient>>(`/patients?${query.toString()}`);
  },
  get: (id: string) => api<Patient>(`/patients/${id}`),
  create: (body: Record<string, unknown>) =>
    api<Patient>('/patients', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: Record<string, unknown>) =>
    api<Patient>(`/patients/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
};

export const auditApi = {
  list: (patientId: string) =>
    api<Paginated<AuditEvent>>(`/patients/${patientId}/audit?limit=50`),
};

function nested(patientId: string, resource: string) {
  return {
    list: (qs = '') =>
      api<Paginated<unknown>>(`/patients/${patientId}/${resource}${qs}`),
    create: (body: unknown) =>
      api(`/patients/${patientId}/${resource}`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    update: (resourceId: string, body: unknown) =>
      api(`/patients/${patientId}/${resource}/${resourceId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
  };
}

export const clinicalApi = {
  conditions: (id: string) => nested(id, 'conditions') as {
    list: (qs?: string) => Promise<Paginated<Condition>>;
    create: (body: unknown) => Promise<Condition>;
    update: (resourceId: string, body: unknown) => Promise<Condition>;
  },
  diagnoses: (id: string) => ({
    list: (qs = '') => api<Paginated<EncounterDiagnosis>>(`/patients/${id}/diagnoses${qs}`),
    create: (body: {
      encounterId: string;
      code: string;
      description: string;
      diagnosisType: DiagnosisType;
      primaryDiagnosis: boolean;
    }) =>
      api<EncounterDiagnosis>(`/patients/${id}/diagnoses`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    update: (
      diagnosisId: string,
      body: {
        code?: string;
        description?: string;
        diagnosisType?: DiagnosisType;
        primaryDiagnosis?: boolean;
      }
    ) =>
      api<EncounterDiagnosis>(`/patients/${id}/diagnoses/${diagnosisId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    remove: (diagnosisId: string) =>
      api<{ ok: boolean }>(`/patients/${id}/diagnoses/${diagnosisId}`, { method: 'DELETE' }),
    promote: (diagnosisId: string, body: PromoteDiagnosisBody) =>
      api<{ diagnosis: EncounterDiagnosis; problem: Condition }>(
        `/patients/${id}/diagnoses/${diagnosisId}/promote`,
        { method: 'POST', body: JSON.stringify(body) }
      ),
  }),
  vitals: (id: string) => nested(id, 'vitals') as {
    list: (qs?: string) => Promise<Paginated<Vital>>;
    create: (body: unknown) => Promise<Vital>;
    update: (resourceId: string, body: unknown) => Promise<Vital>;
  },
  medications: (id: string) => ({
    list: (qs = '') => api<Paginated<Medication>>(`/patients/${id}/medications${qs}`),
    summary: () => api<MedicationSummary>(`/patients/${id}/medications/summary`),
    clinicians: () => api<{ data: CareTeamMember[] }>(`/patients/${id}/medications/clinicians`),
    check: (body: { genericName: string; brandName?: string; din?: string }) =>
      api<{ warnings: AllergyWarning[] }>(`/patients/${id}/medications/check`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    create: (body: MedicationInput) =>
      api<Medication>(`/patients/${id}/medications`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    update: (medicationId: string, body: MedicationInput) =>
      api<Medication>(`/patients/${id}/medications/${medicationId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    hold: (medicationId: string, body: MedicationActionInput) =>
      api<Medication>(`/patients/${id}/medications/${medicationId}/hold`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    resume: (medicationId: string, body: MedicationActionInput) =>
      api<Medication>(`/patients/${id}/medications/${medicationId}/resume`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    discontinue: (medicationId: string, body: MedicationActionInput) =>
      api<Medication>(`/patients/${id}/medications/${medicationId}/discontinue`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    complete: (medicationId: string, body: MedicationActionInput) =>
      api<Medication>(`/patients/${id}/medications/${medicationId}/complete`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  }),
  orders: (id: string) => ({
    list: (qs = '') => api<Paginated<Order>>(`/patients/${id}/orders${qs}`),
    summary: () => api<OrderSummary>(`/patients/${id}/orders/summary`),
    clinicians: () => api<{ data: CareTeamMember[] }>(`/patients/${id}/orders/clinicians`),
    results: (qs = '') => api<Paginated<OrderResult>>(`/patients/${id}/orders/results${qs}`),
    create: (body: OrderInput) =>
      api<Order>(`/patients/${id}/orders`, { method: 'POST', body: JSON.stringify(body) }),
    setStatus: (orderId: string, body: OrderStatusInput) =>
      api<Order>(`/patients/${id}/orders/${orderId}/status`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    cancel: (orderId: string, body: OrderCancelInput) =>
      api<Order>(`/patients/${id}/orders/${orderId}/cancel`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    addResult: (orderId: string, body: OrderResultInput) =>
      api<Order>(`/patients/${id}/orders/${orderId}/results`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  }),
  referrals: (id: string) => ({
    list: (qs = '') => api<Paginated<Referral>>(`/patients/${id}/referrals${qs}`),
    summary: () => api<ReferralSummary>(`/patients/${id}/referrals/summary`),
    create: (body: ReferralInput) =>
      api<Referral>(`/patients/${id}/referrals`, { method: 'POST', body: JSON.stringify(body) }),
    setStatus: (referralId: string, body: ReferralStatusInput) =>
      api<Referral>(`/patients/${id}/referrals/${referralId}/status`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    cancel: (referralId: string, body: ReferralCancelInput) =>
      api<Referral>(`/patients/${id}/referrals/${referralId}/cancel`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    addOutcome: (referralId: string, body: ReferralOutcomeInput) =>
      api<Referral>(`/patients/${id}/referrals/${referralId}/outcomes`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    addDocument: (referralId: string, body: ReferralDocumentInput) =>
      api<Referral>(`/patients/${id}/referrals/${referralId}/documents`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    setFollowUp: (referralId: string, body: ReferralFollowUpInput) =>
      api<Referral>(`/patients/${id}/referrals/${referralId}/follow-up`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  }),
  carePlans: (id: string) => ({
    list: (qs = '') => api<Paginated<CarePlan>>(`/patients/${id}/care-plans${qs}`),
    summary: () => api<CarePlanSummary>(`/patients/${id}/care-plans/summary`),
    options: () => api<CarePlanOptions>(`/patients/${id}/care-plans/options`),
    create: (body: Record<string, unknown>) =>
      api<CarePlan>(`/patients/${id}/care-plans`, { method: 'POST', body: JSON.stringify(body) }),
    update: (planId: string, body: Record<string, unknown>) =>
      api<CarePlan>(`/patients/${id}/care-plans/${planId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    setStatus: (planId: string, body: { status: CarePlanStatus; completedDate?: string }) =>
      api<CarePlan>(`/patients/${id}/care-plans/${planId}/status`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    addProgress: (planId: string, body: { note: string }) =>
      api<CarePlan>(`/patients/${id}/care-plans/${planId}/progress`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    addGoal: (planId: string, body: Record<string, unknown>) =>
      api<CarePlan>(`/patients/${id}/care-plans/${planId}/goals`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    updateGoal: (planId: string, goalId: string, body: Record<string, unknown>) =>
      api<CarePlan>(`/patients/${id}/care-plans/${planId}/goals/${goalId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    addIntervention: (planId: string, body: Record<string, unknown>) =>
      api<CarePlan>(`/patients/${id}/care-plans/${planId}/interventions`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    updateIntervention: (planId: string, interventionId: string, body: Record<string, unknown>) =>
      api<CarePlan>(`/patients/${id}/care-plans/${planId}/interventions/${interventionId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
  }),
  monitoring: (id: string) => ({
    dashboard: () => api<MonitoringDashboard>(`/patients/${id}/monitoring/dashboard`),
    trends: () => api<MonitoringTrends>(`/patients/${id}/monitoring/trends`),
    options: () => api<MonitoringOptions>(`/patients/${id}/monitoring/options`),
    programs: (qs = '') => api<Paginated<MonitoringProgram>>(`/patients/${id}/monitoring/programs${qs}`),
    createProgram: (body: Record<string, unknown>) =>
      api<MonitoringProgram>(`/patients/${id}/monitoring/programs`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    updateProgram: (programId: string, body: Record<string, unknown>) =>
      api<MonitoringProgram>(`/patients/${id}/monitoring/programs/${programId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    setProgramStatus: (programId: string, body: { status: ProgramStatus; completedDate?: string }) =>
      api<MonitoringProgram>(`/patients/${id}/monitoring/programs/${programId}/status`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    recordMetric: (programId: string, body: Record<string, unknown>) =>
      api<MonitoringMetric>(`/patients/${id}/monitoring/programs/${programId}/metrics`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    updateMetric: (metricId: string, body: Record<string, unknown>) =>
      api<MonitoringMetric>(`/patients/${id}/monitoring/metrics/${metricId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    recalls: (qs = '') => api<Paginated<MonitoringRecall>>(`/patients/${id}/monitoring/recalls${qs}`),
    createRecall: (body: Record<string, unknown>) =>
      api<MonitoringRecall>(`/patients/${id}/monitoring/recalls`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    updateRecall: (recallId: string, body: Record<string, unknown>) =>
      api<MonitoringRecall>(`/patients/${id}/monitoring/recalls/${recallId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    setRecallStatus: (
      recallId: string,
      body: { status: Exclude<RecallStatus, 'overdue'>; dueDate?: string; note?: string }
    ) =>
      api<MonitoringRecall>(`/patients/${id}/monitoring/recalls/${recallId}/status`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  }),
  tasks: (id: string) => nested(id, 'tasks') as {
    list: (qs?: string) => Promise<Paginated<Task>>;
    create: (body: unknown) => Promise<Task>;
    update: (resourceId: string, body: unknown) => Promise<Task>;
  },
  notes: (id: string) =>
    ({
      ...nested(id, 'notes'),
      revisions: (noteId: string) =>
        api<{ data: ClinicalNote[] }>(`/patients/${id}/notes/${noteId}/revisions`),
    }) as {
      list: (qs?: string) => Promise<Paginated<ClinicalNote>>;
      create: (body: unknown) => Promise<ClinicalNote>;
      update: (resourceId: string, body: unknown) => Promise<ClinicalNote>;
      revisions: (noteId: string) => Promise<{ data: ClinicalNote[] }>;
    },
  allergies: (id: string) => nested(id, 'allergies') as {
    list: (qs?: string) => Promise<Paginated<Allergy>>;
    create: (body: unknown) => Promise<Allergy>;
    update: (resourceId: string, body: unknown) => Promise<Allergy>;
  },
};

export const appointmentsApi = {
  list: (params: {
    patientId?: string;
    providerId?: string;
    status?: AppointmentStatus;
    from?: string;
    to?: string;
    limit?: number;
  } = {}) => {
    const query = new URLSearchParams();
    if (params.patientId) query.set('patientId', params.patientId);
    if (params.providerId) query.set('providerId', params.providerId);
    if (params.status) query.set('status', params.status);
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    query.set('limit', String(params.limit ?? 50));
    return api<Paginated<Appointment>>(`/appointments?${query.toString()}`);
  },
  providers: () =>
    api<{ data: AppointmentProvider[] }>('/appointments/providers'),
  day: (providerId: string, date: string) =>
    api<{ data: Appointment[]; date: string; providerId: string }>(
      `/appointments/day?providerId=${encodeURIComponent(providerId)}&date=${encodeURIComponent(date)}`
    ),
  history: (patientId: string, limit = 50) =>
    api<Paginated<Appointment>>(
      `/patients/${patientId}/appointments?limit=${Math.min(100, Math.max(1, limit))}`
    ),
  create: (body: {
    patientId: string;
    providerId: string;
    clinicLocation: string;
    appointmentType: string;
    startTime: string;
    endTime: string;
    status?: 'booked' | 'confirmed';
  }) => api<Appointment>('/appointments', { method: 'POST', body: JSON.stringify(body) }),
  update: (
    id: string,
    body: { status?: AppointmentStatus; clinicLocation?: string; appointmentType?: string }
  ) => api<Appointment>(`/appointments/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  reschedule: (id: string, body: { startTime: string; endTime: string }) =>
    api<Appointment>(`/appointments/${id}/reschedule`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  cancel: (id: string, reason?: string) =>
    api<Appointment>(`/appointments/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason || undefined }),
    }),
};

export const visitsApi = {
  board: (params: { date: string; providerId?: string; location?: string }) => {
    const query = new URLSearchParams({ date: params.date });
    if (params.providerId) query.set('providerId', params.providerId);
    if (params.location) query.set('location', params.location);
    return api<VisitBoard>(`/visits/board?${query.toString()}`);
  },
  checkIn: (body: {
    appointmentId: string;
    demographicsVerified: boolean;
    healthCardVerified: boolean;
    note?: string;
  }) =>
    api<{ visit: Visit; appointment: VisitBoardAppointment }>('/visits/check-in', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  assignRoom: (body: { appointmentId: string; examRoom: string }) =>
    api<{ visit: Visit; appointment: VisitBoardAppointment }>('/visits/room', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  setStatus: (body: {
    appointmentId: string;
    status: VisitStatus;
    reason?: string;
    note?: string;
  }) =>
    api<{ visit: Visit; appointment: VisitBoardAppointment }>('/visits/status', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  forPatient: (patientId: string) =>
    api<{ data: PatientVisit[] }>(`/patients/${patientId}/visits`),
};

export const encountersApi = {
  list: (patientId: string, limit = 50) =>
    api<Paginated<Encounter>>(
      `/patients/${patientId}/encounters?limit=${Math.min(100, Math.max(1, limit))}`
    ),
  summary: (patientId: string) => api<EncounterSummary>(`/patients/${patientId}/encounters/summary`),
  current: (patientId: string, visitId: string) =>
    api<EncounterCurrent>(
      `/patients/${patientId}/encounters/current?visitId=${encodeURIComponent(visitId)}`
    ),
  get: (patientId: string, id: string) => api<Encounter>(`/patients/${patientId}/encounters/${id}`),
  create: (
    patientId: string,
    body: {
      patientId: string;
      visitId: string;
      appointmentId: string;
      attendingProviderId: string;
      supervisingProviderId?: string;
      clinicLocation: string;
      appointmentType: string;
      chiefComplaint: string;
      reasonForVisit: string;
    }
  ) =>
    api<Encounter>(`/patients/${patientId}/encounters`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  setStatus: (patientId: string, id: string, status: 'in_progress' | 'awaiting_signature') =>
    api<Encounter>(`/patients/${patientId}/encounters/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),
  assignProviders: (
    patientId: string,
    id: string,
    body: { attendingProviderId?: string; supervisingProviderId?: string | null }
  ) =>
    api<Encounter>(`/patients/${patientId}/encounters/${id}/providers`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  sign: (patientId: string, id: string) =>
    api<Encounter>(`/patients/${patientId}/encounters/${id}/sign`, { method: 'POST' }),
  amend: (
    patientId: string,
    id: string,
    body: {
      chiefComplaint: string;
      reasonForVisit: string;
      attendingProviderId?: string;
      supervisingProviderId?: string;
    }
  ) =>
    api<Encounter>(`/patients/${patientId}/encounters/${id}/amend`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};
