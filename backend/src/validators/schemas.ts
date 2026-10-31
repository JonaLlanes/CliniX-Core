import { z } from 'zod';
import { ROLES } from '../types/roles.js';
import {
  APPOINTMENT_STATUSES,
  APPOINTMENT_TYPES,
  CLINIC_LOCATIONS,
} from '../types/appointments.js';
import { ENCOUNTER_STATUSES, ENCOUNTER_STATUS_INPUTS } from '../types/encounters.js';
import {
  DIAGNOSIS_TYPES,
  ICD10CA_PATTERN,
  PROBLEM_CODE_SYSTEMS,
  PROBLEM_SEVERITIES,
  PROBLEM_STATUSES,
  PROMOTION_TARGETS,
} from '../types/diagnoses.js';
import {
  ORDER_PRIORITIES,
  ORDER_STATUS_INPUTS,
  ORDER_TYPES,
  RESULT_STATUSES,
} from '../types/orders.js';
import {
  REFERRAL_DOCUMENT_TYPES,
  REFERRAL_PRIORITIES,
  REFERRAL_STATUS_INPUTS,
  REFERRAL_TYPES,
} from '../types/referrals.js';
import {
  CARE_PLAN_GOAL_STATUSES,
  CARE_PLAN_INTERVENTION_STATUSES,
  CARE_PLAN_ROLES,
  CARE_PLAN_STATUSES,
} from '../types/carePlans.js';
import {
  METRIC_SOURCES,
  METRIC_TYPES,
  PROGRAM_STATUSES,
  PROGRAM_TYPES,
  RECALL_STATUS_INPUTS,
} from '../types/monitoring.js';
import { VISIT_STATUS_INPUTS } from '../types/visits.js';
import { zonedDateTime } from '../utils/clinicTime.js';
import {
  addressSchema,
  GENDER_IDENTITIES,
  LANGUAGES,
  personContactSchema,
  provincialHealthSchema,
  SEX_AT_BIRTH,
} from './canadianHealthCard.js';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().min(1),
  role: z.enum(ROLES),
});

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Expected an id');

const emptyToUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === null || v === '' ? undefined : v), schema.optional());

export const patientSchema = z.object({
  mrn: z.string().min(1),
  /** Legal given name */
  givenName: z.string().min(1),
  /** Legal family name */
  familyName: z.string().min(1),
  preferredName: z.string().trim().optional().or(z.literal('')),
  birthDate: z.coerce.date(),
  language: z.enum(LANGUAGES).optional().default('en'),
  /** Sex assigned at birth */
  sex: z.enum(SEX_AT_BIRTH),
  genderIdentity: z.enum(GENDER_IDENTITIES).optional().default('unknown'),
  contact: z
    .object({
      phone: z.string().optional(),
      email: z.string().email().optional().or(z.literal('')),
      address: z.string().optional(),
    })
    .optional(),
  address: emptyToUndefined(addressSchema),
  provincialHealth: emptyToUndefined(provincialHealthSchema),
  emergencyContact: emptyToUndefined(personContactSchema),
  substituteDecisionMaker: emptyToUndefined(personContactSchema),
  identifiers: z
    .object({
      insuranceMemberId: z.string().optional(),
      nationalId: z.string().optional(),
    })
    .optional(),
  careTeam: z.array(objectId).optional(),
});

export const patientUpdateSchema = patientSchema.partial();

export const conditionSchema = z
  .object({
    display: z.string().trim().min(1),
    status: z.enum(PROBLEM_STATUSES),
    severity: z.enum(PROBLEM_SEVERITIES).default('unknown'),
    onsetDate: z.coerce.date().optional(),
    resolvedDate: z.coerce.date().optional(),
    clinicianOwner: emptyToUndefined(objectId),
    codeSystem: z.enum(PROBLEM_CODE_SYSTEMS).optional(),
    code: z.string().trim().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.resolvedDate && value.status !== 'resolved') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Resolved date applies only to resolved problems',
        path: ['resolvedDate'],
      });
    }
    if (value.onsetDate && value.resolvedDate && value.resolvedDate < value.onsetDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Resolved date cannot be before onset',
        path: ['resolvedDate'],
      });
    }
  });

const icd10ca = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .refine((value) => ICD10CA_PATTERN.test(value), { message: 'Enter an ICD-10-CA code' });

const measurementRanges = {
  systolicBp: [60, 250] as const,
  diastolicBp: [30, 150] as const,
  heartRate: [20, 250] as const,
  respiratoryRate: [4, 60] as const,
  temperatureC: [30, 45] as const,
  spo2: [50, 100] as const,
  weightKg: [1, 500] as const,
  heightCm: [30, 280] as const,
};

function optionalRange(min: number, max: number) {
  return z.number().min(min).max(max).optional();
}

export const vitalSchema = z
  .object({
    effectiveAt: z.coerce.date(),
    source: z.enum(['clinic', 'home', 'device', 'caregiver']),
    measurements: z.object({
      systolicBp: optionalRange(...measurementRanges.systolicBp),
      diastolicBp: optionalRange(...measurementRanges.diastolicBp),
      heartRate: optionalRange(...measurementRanges.heartRate),
      respiratoryRate: optionalRange(...measurementRanges.respiratoryRate),
      temperatureC: optionalRange(...measurementRanges.temperatureC),
      spo2: optionalRange(...measurementRanges.spo2),
      weightKg: optionalRange(...measurementRanges.weightKg),
      heightCm: optionalRange(...measurementRanges.heightCm),
    }),
  })
  .refine(
    (v) => Object.values(v.measurements).some((x) => x !== undefined),
    { message: 'At least one measurement is required', path: ['measurements'] }
  )
  .refine((v) => v.effectiveAt.getTime() <= Date.now() + 60_000, {
    message: 'effectiveAt cannot be in the future',
    path: ['effectiveAt'],
  });

function clinicDateInput(value: unknown) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return zonedDateTime(year, month, day, 12, 0);
  }
  return value;
}

const clinicDate = z.preprocess(clinicDateInput, z.coerce.date());

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (value == null || (typeof value === 'string' && value.trim() === '') ? undefined : value),
    z.string().trim().min(1).max(max).optional()
  );

const clearableText = (max: number) =>
  z.preprocess(
    (value) => (value === '' ? null : value),
    z.union([z.string().trim().min(1).max(max), z.null()]).optional()
  );

const din = z.preprocess(
  (value) => (value === '' || value == null ? undefined : value),
  z.string().trim().regex(/^\d{8}$/, 'DIN must be 8 digits').optional()
);

const clearableDin = z.preprocess(
  (value) => (value === '' ? null : value),
  z.union([z.string().trim().regex(/^\d{8}$/, 'DIN must be 8 digits'), z.null()]).optional()
);

const clearableId = z.preprocess(
  (value) => (value === '' ? null : value),
  z.union([objectId, z.null()]).optional()
);

const allergyAcknowledgmentSchema = z
  .object({
    acknowledged: z.literal(true),
  })
  .optional();

const medicationFields = {
  encounterId: emptyToUndefined(objectId),
  conditionId: emptyToUndefined(objectId),
  din,
  genericName: z.string().trim().min(1).max(200),
  brandName: optionalText(200),
  strength: optionalText(80),
  dosage: z.string().trim().min(1).max(120),
  route: z.string().trim().min(1).max(80),
  frequency: z.string().trim().min(1).max(120),
  indication: optionalText(500),
  startDate: clinicDate,
  prescribedBy: objectId,
};

export const medicationCreateSchema = z.object({
  ...medicationFields,
  allergyAcknowledgment: allergyAcknowledgmentSchema,
});

export const medicationCheckSchema = z.object({
  genericName: z.string().trim().min(1).max(200),
  brandName: optionalText(200),
  din,
});

const medicationChangeKeys = [
  'encounterId',
  'conditionId',
  'din',
  'genericName',
  'brandName',
  'strength',
  'dosage',
  'route',
  'frequency',
  'indication',
  'startDate',
  'prescribedBy',
] as const;

export const medicationUpdateSchema = z
  .object({
    encounterId: clearableId,
    conditionId: clearableId,
    din: clearableDin,
    genericName: z.string().trim().min(1).max(200).optional(),
    brandName: clearableText(200),
    strength: clearableText(80),
    dosage: z.string().trim().min(1).max(120).optional(),
    route: z.string().trim().min(1).max(80).optional(),
    frequency: z.string().trim().min(1).max(120).optional(),
    indication: clearableText(500),
    startDate: clinicDate.optional(),
    prescribedBy: objectId.optional(),
    reason: z.string().trim().min(1, 'Reason is required').max(500),
    date: clinicDate.optional(),
    allergyAcknowledgment: allergyAcknowledgmentSchema,
  })
  .refine((value) => medicationChangeKeys.some((key) => value[key] !== undefined), {
    message: 'No medication changes submitted',
  });

export const medicationActionSchema = z.object({
  reason: z.string().trim().min(1, 'Reason is required').max(500),
  date: clinicDate,
  clinicianId: emptyToUndefined(objectId),
});

const complaint = z.string().trim().min(1, 'Chief complaint is required').max(500);
const reasonForVisit = z.string().trim().min(1, 'Reason for visit is required').max(1000);

export const encounterCreateSchema = z.object({
  patientId: objectId,
  visitId: objectId,
  appointmentId: objectId,
  attendingProviderId: objectId,
  supervisingProviderId: emptyToUndefined(objectId),
  clinicLocation: z.enum(CLINIC_LOCATIONS),
  appointmentType: z.enum(APPOINTMENT_TYPES),
  chiefComplaint: complaint,
  reasonForVisit,
});

export const encounterStatusSchema = z.object({
  status: z.enum(ENCOUNTER_STATUS_INPUTS),
});

export const encounterProviderSchema = z
  .object({
    attendingProviderId: objectId.optional(),
    supervisingProviderId: z.preprocess(
      (value) => (value === '' ? null : value),
      z.union([objectId, z.null()]).optional()
    ),
  })
  .refine((value) => value.attendingProviderId !== undefined || value.supervisingProviderId !== undefined, {
    message: 'No provider change submitted',
  });

export const encounterAmendSchema = z.object({
  chiefComplaint: complaint,
  reasonForVisit,
  attendingProviderId: objectId.optional(),
  supervisingProviderId: emptyToUndefined(objectId),
});

export const encounterListQuerySchema = z.object({
  visitId: objectId.optional(),
  status: z.enum(ENCOUNTER_STATUSES).optional(),
});

export const encounterVisitQuerySchema = z.object({
  visitId: objectId,
});

const optionalClinicDate = z.preprocess(
  (value) => (value === '' || value == null ? undefined : clinicDateInput(value)),
  z.coerce.date().optional()
);

const clearableClinicDate = z.preprocess(
  (value) => (value === '' || value === null ? null : value === undefined ? undefined : clinicDateInput(value)),
  z.union([z.coerce.date(), z.null()]).optional()
);

export const carePlanCreateSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(4000),
    status: z.enum(['draft', 'active']).default('draft'),
    startDate: clinicDate,
    targetDate: optionalClinicDate,
    encounterId: emptyToUndefined(objectId),
    ownerClinicianId: objectId,
    problemIds: z.array(objectId).max(20).optional().default([]),
    encounterDiagnosisIds: z.array(objectId).max(20).optional().default([]),
    primaryDiagnosisId: emptyToUndefined(objectId),
  })
  .superRefine((value, ctx) => {
    if (value.status === 'active' && !value.primaryDiagnosisId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'An active care plan needs a primary diagnosis',
        path: ['primaryDiagnosisId'],
      });
    }
    if (value.targetDate && value.targetDate < value.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Target date cannot be before the start date',
        path: ['targetDate'],
      });
    }
  });

export const carePlanUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().min(1).max(4000).optional(),
    startDate: clinicDate.optional(),
    targetDate: clearableClinicDate,
    encounterId: clearableId,
    ownerClinicianId: objectId.optional(),
    problemIds: z.array(objectId).max(20).optional(),
    encounterDiagnosisIds: z.array(objectId).max(20).optional(),
    primaryDiagnosisId: clearableId,
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: 'No care plan changes submitted',
  });

export const carePlanStatusSchema = z.object({
  status: z.enum(CARE_PLAN_STATUSES),
  completedDate: optionalClinicDate,
});

export const carePlanGoalCreateSchema = z.object({
  description: z.string().trim().min(1).max(1000),
  targetValue: optionalText(120),
  targetDate: clinicDate,
  status: z.enum(['not_started', 'in_progress', 'achieved']).default('not_started'),
});

export const carePlanGoalUpdateSchema = z
  .object({
    description: z.string().trim().min(1).max(1000).optional(),
    targetValue: clearableText(120),
    targetDate: clinicDate.optional(),
    status: z.enum(CARE_PLAN_GOAL_STATUSES).optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: 'No goal changes submitted',
  });

export const carePlanInterventionCreateSchema = z.object({
  description: z.string().trim().min(1).max(1000),
  assignedRole: z.enum(CARE_PLAN_ROLES),
  dueDate: clinicDate,
  status: z.enum(['planned', 'active', 'completed']).default('planned'),
});

export const carePlanInterventionUpdateSchema = z
  .object({
    description: z.string().trim().min(1).max(1000).optional(),
    assignedRole: z.enum(CARE_PLAN_ROLES).optional(),
    dueDate: clinicDate.optional(),
    status: z.enum(CARE_PLAN_INTERVENTION_STATUSES).optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: 'No intervention changes submitted',
  });

export const carePlanProgressSchema = z.object({
  note: z.string().trim().min(1).max(4000),
});

export const taskSchema = z.object({
  title: z.string().min(1),
  carePlanId: z.string().optional(),
  assigneeRole: z.enum(['clinician', 'nurse', 'caregiver', 'pharmacist']),
  assigneeUserId: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'completed']),
  dueDate: z.coerce.date().optional(),
});

export const noteSchema = z.object({
  body: z.string().min(1),
  encounterId: z.string().optional(),
});

export const allergySchema = z.object({
  substance: z.string().min(1),
  reaction: z.string().min(1),
  severity: z.enum(['mild', 'moderate', 'severe']),
  status: z.enum(['active', 'inactive']),
  recordedDate: z.coerce.date(),
});

const appointmentWindow = {
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
};

function withAppointmentDuration<T extends z.ZodTypeAny>(schema: T) {
  return schema
    .refine((value: { endTime: Date; startTime: Date }) => value.endTime.getTime() > value.startTime.getTime(), {
      message: 'endTime must be after startTime',
      path: ['endTime'],
    })
    .refine(
      (value: { endTime: Date; startTime: Date }) =>
        value.endTime.getTime() - value.startTime.getTime() >= 5 * 60 * 1000,
      { message: 'Appointment must be at least 5 minutes', path: ['endTime'] }
    )
    .refine(
      (value: { endTime: Date; startTime: Date }) =>
        value.endTime.getTime() - value.startTime.getTime() <= 8 * 60 * 60 * 1000,
      { message: 'Appointment cannot be longer than 8 hours', path: ['endTime'] }
    );
}

export const appointmentSchema = withAppointmentDuration(
  z.object({
    patientId: objectId,
    providerId: objectId,
    clinicLocation: z.enum(CLINIC_LOCATIONS),
    appointmentType: z.enum(APPOINTMENT_TYPES),
    ...appointmentWindow,
    status: z.enum(['booked', 'confirmed']).optional().default('booked'),
  })
);

export const appointmentPatchSchema = z
  .object({
    clinicLocation: z.enum(CLINIC_LOCATIONS).optional(),
    appointmentType: z.enum(APPOINTMENT_TYPES).optional(),
    status: z.enum(APPOINTMENT_STATUSES).optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: 'No changes submitted',
  });

export const appointmentRescheduleSchema = withAppointmentDuration(z.object(appointmentWindow));

export const appointmentCancelSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const appointmentDayQuerySchema = z.object({
  providerId: objectId,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
});

export const appointmentListQuerySchema = z.object({
  patientId: objectId.optional(),
  providerId: objectId.optional(),
  status: z.enum(APPOINTMENT_STATUSES).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

const optionalNote = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().max(500).optional()
);

export const visitCheckInSchema = z.object({
  appointmentId: objectId,
  demographicsVerified: z.boolean().refine((value) => value, {
    message: 'Demographics must be verified',
  }),
  healthCardVerified: z.boolean().refine((value) => value, {
    message: 'Health card information must be verified',
  }),
  note: optionalNote,
});

export const visitRoomSchema = z.object({
  appointmentId: objectId,
  examRoom: z.string().trim().min(1).max(40),
});

export const visitStatusSchema = z.object({
  appointmentId: objectId,
  status: z.enum(VISIT_STATUS_INPUTS),
  reason: optionalNote,
  note: optionalNote,
});

export const diagnosisCreateSchema = z.object({
  encounterId: objectId,
  code: icd10ca,
  description: z.string().trim().min(1).max(500),
  diagnosisType: z.enum(DIAGNOSIS_TYPES),
  primaryDiagnosis: z.boolean().default(false),
});

export const diagnosisUpdateSchema = z
  .object({
    code: icd10ca.optional(),
    description: z.string().trim().min(1).max(500).optional(),
    diagnosisType: z.enum(DIAGNOSIS_TYPES).optional(),
    primaryDiagnosis: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: 'No diagnosis changes submitted',
  });

export const diagnosisPromoteSchema = z
  .object({
    target: z.enum(PROMOTION_TARGETS),
    problemId: emptyToUndefined(objectId),
    severity: z.enum(PROBLEM_SEVERITIES).optional(),
    onsetDate: z.coerce.date().optional(),
    resolvedDate: z.coerce.date().optional(),
    status: z.enum(PROBLEM_STATUSES).optional(),
    clinicianOwner: emptyToUndefined(objectId),
    display: z.string().trim().min(1).max(500).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.target === 'existing_problem' && !value.problemId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Choose a problem to update',
        path: ['problemId'],
      });
    }
    if (value.target === 'active_problem' && value.problemId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A new problem does not use an existing problem',
        path: ['problemId'],
      });
    }
    if (value.target === 'active_problem' && value.status && value.status !== 'active') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A new problem is added as active',
        path: ['status'],
      });
    }
    if (value.resolvedDate && value.status !== 'resolved') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Resolved date applies only when the problem is resolved',
        path: ['resolvedDate'],
      });
    }
    if (value.onsetDate && value.resolvedDate && value.resolvedDate < value.onsetDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Resolved date cannot be before onset',
        path: ['resolvedDate'],
      });
    }
  });

export const orderCreateSchema = z.object({
  encounterId: objectId,
  diagnosisId: objectId,
  conditionId: emptyToUndefined(objectId),
  orderedBy: objectId,
  orderType: z.enum(ORDER_TYPES),
  orderName: z.string().trim().min(1).max(200),
  priority: z.enum(ORDER_PRIORITIES),
  clinicalReason: z.string().trim().min(1).max(1000),
  instructions: optionalText(2000),
  status: z.enum(['draft', 'ordered']).optional().default('ordered'),
  orderedAt: clinicDate.optional(),
});

export const orderStatusSchema = z.object({
  status: z.enum(ORDER_STATUS_INPUTS),
  at: clinicDate.optional(),
  note: optionalText(500),
});

export const orderCancelSchema = z.object({
  reason: z.string().trim().min(1, 'Reason is required').max(500),
  at: clinicDate.optional(),
});

export const orderResultSchema = z.object({
  resultType: z.string().trim().min(1).max(120),
  value: z.string().trim().min(1).max(500),
  unit: optionalText(40),
  referenceRange: optionalText(120),
  resultDate: clinicDate,
  interpretation: optionalText(2000),
  status: z.enum(RESULT_STATUSES),
});

export const referralCreateSchema = z.object({
  encounterId: objectId,
  diagnosisId: objectId,
  conditionId: emptyToUndefined(objectId),
  carePlanId: emptyToUndefined(objectId),
  referralType: z.enum(REFERRAL_TYPES),
  specialty: z.string().trim().min(1).max(120),
  specialistName: z.string().trim().min(1).max(200),
  organization: z.string().trim().min(1).max(200),
  reasonForReferral: z.string().trim().min(1).max(2000),
  priority: z.enum(REFERRAL_PRIORITIES),
  referralDate: clinicDate,
  status: z.enum(['draft', 'sent']).optional().default('draft'),
});

export const referralStatusSchema = z
  .object({
    status: z.enum(REFERRAL_STATUS_INPUTS),
    at: clinicDate.optional(),
    appointmentDate: clinicDate.optional(),
    note: optionalText(500),
  })
  .superRefine((value, ctx) => {
    if (value.status === 'scheduled' && !value.appointmentDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Appointment date is required',
        path: ['appointmentDate'],
      });
    }
  });

export const referralCancelSchema = z.object({
  reason: z.string().trim().min(1, 'Reason is required').max(500),
  at: clinicDate.optional(),
});

export const referralOutcomeSchema = z.object({
  recommendations: z.string().trim().min(1).max(4000),
  consultationSummary: z.string().trim().min(1).max(4000),
  nextSteps: z.string().trim().min(1).max(4000),
  recordedAt: clinicDate.optional(),
  followUpRequired: z.boolean().optional(),
});

export const referralDocumentSchema = z.object({
  documentType: z.enum(REFERRAL_DOCUMENT_TYPES),
  title: z.string().trim().min(1).max(200),
  description: optionalText(2000),
  recordedAt: clinicDate.optional(),
});

export const referralFollowUpSchema = z.object({
  followUpRequired: z.boolean(),
  appointmentDate: clinicDate.optional(),
});

export const monitoringProgramCreateSchema = z
  .object({
    programType: z.enum(PROGRAM_TYPES),
    name: optionalText(120),
    status: z.enum(['active', 'on_hold']).optional().default('active'),
    enrolledDate: clinicDate,
    diagnosisId: emptyToUndefined(objectId),
    carePlanId: emptyToUndefined(objectId),
    ownerClinicianId: objectId,
  })
  .superRefine((value, ctx) => {
    if (value.programType === 'custom' && !value.name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Name the custom monitoring program',
        path: ['name'],
      });
    }
    if (value.enrolledDate.getTime() > Date.now() + 60_000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enrollment date cannot be in the future',
        path: ['enrolledDate'],
      });
    }
  });

export const monitoringProgramUpdateSchema = z
  .object({
    name: clearableText(120),
    diagnosisId: clearableId,
    carePlanId: clearableId,
    ownerClinicianId: objectId.optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: 'No monitoring program changes submitted',
  });

export const monitoringProgramStatusSchema = z.object({
  status: z.enum(PROGRAM_STATUSES),
  completedDate: optionalClinicDate,
});

const recordedAt = z.coerce.date().refine((value) => value.getTime() <= Date.now() + 60_000, {
  message: 'Recorded time cannot be in the future',
});

export const monitoringMetricSchema = z
  .object({
    metricType: z.enum(METRIC_TYPES),
    label: optionalText(120),
    value: z.string().trim().min(1).max(40),
    unit: optionalText(40),
    recordedAt,
    source: z.enum(METRIC_SOURCES),
    abnormal: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.metricType === 'custom' && !value.label) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Name the custom metric',
        path: ['label'],
      });
    }
    if (value.metricType === 'custom' && !value.unit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enter a unit',
        path: ['unit'],
      });
    }
    if (value.metricType === 'blood_pressure' && !/^\d{2,3}\s*\/\s*\d{2,3}$/.test(value.value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enter blood pressure as systolic/diastolic, such as 128/82',
        path: ['value'],
      });
    }
    if (value.metricType !== 'blood_pressure' && value.metricType !== 'custom' && !/^\d+(\.\d+)?$/.test(value.value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enter a number',
        path: ['value'],
      });
    }
  });

export const monitoringMetricUpdateSchema = z
  .object({
    label: clearableText(120),
    value: z.string().trim().min(1).max(40).optional(),
    unit: z.string().trim().min(1).max(40).optional(),
    recordedAt: recordedAt.optional(),
    source: z.enum(METRIC_SOURCES).optional(),
    abnormal: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: 'No metric changes submitted',
  });

export const recallCreateSchema = z.object({
  reason: z.string().trim().min(1).max(200),
  dueDate: clinicDate,
  assignedProvider: objectId,
  status: z.enum(['due', 'scheduled']).optional().default('due'),
  diagnosisId: emptyToUndefined(objectId),
  carePlanId: emptyToUndefined(objectId),
});

export const recallUpdateSchema = z
  .object({
    reason: z.string().trim().min(1).max(200).optional(),
    dueDate: clinicDate.optional(),
    assignedProvider: objectId.optional(),
    diagnosisId: clearableId,
    carePlanId: clearableId,
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: 'No recall changes submitted',
  });

export const recallStatusSchema = z.object({
  status: z.enum(RECALL_STATUS_INPUTS),
  dueDate: optionalClinicDate,
  note: optionalText(500),
});

export const visitBoardQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
  providerId: objectId.optional(),
  location: z.enum(CLINIC_LOCATIONS).optional(),
});
