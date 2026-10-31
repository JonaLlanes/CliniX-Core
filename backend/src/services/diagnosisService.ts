import { Types } from 'mongoose';
import { Condition, type ICondition } from '../models/Condition.js';
import { Encounter } from '../models/Encounter.js';
import { EncounterDiagnosis, type IEncounterDiagnosis } from '../models/EncounterDiagnosis.js';
import { User } from '../models/User.js';
import { HttpError } from '../middleware/error.js';
import { notDeleted } from '../utils/pagination.js';
import { LOCKED_ENCOUNTER_STATUSES } from '../types/encounters.js';
import {
  DIAGNOSIS_AUDIT_EVENTS,
  ICD10CA_PATTERN,
  type DiagnosisType,
  type ProblemSeverity,
  type ProblemStatus,
  type PromotionTarget,
} from '../types/diagnoses.js';

const PERSON = 'displayName role';

export type DiagnosisWrite = {
  code?: string;
  description?: string;
  diagnosisType?: DiagnosisType;
  primaryDiagnosis?: boolean;
};

export type PromoteDiagnosisInput = {
  target: PromotionTarget;
  problemId?: string;
  severity?: ProblemSeverity;
  onsetDate?: Date;
  resolvedDate?: Date;
  status?: ProblemStatus;
  clinicianOwner?: string;
  display?: string;
};

type AuditEntry = {
  action: 'create' | 'update' | 'delete';
  event?: string;
  before?: unknown;
  after?: unknown;
};

function snapshot(doc: { toObject(): object }) {
  return doc.toObject() as unknown as Record<string, unknown>;
}

function isDuplicate(err: unknown) {
  return Boolean(err && typeof err === 'object' && 'code' in err && (err as { code: number }).code === 11000);
}

async function assertClinicianOwner(ownerId: string) {
  if (!Types.ObjectId.isValid(ownerId)) throw new HttpError(400, 'Expected an id');
  const owner = await User.findById(ownerId).select(PERSON);
  if (!owner) throw new HttpError(404, 'Clinician owner not found');
  if (owner.role !== 'clinician') throw new HttpError(400, 'Clinician owner must be a clinician');
  return owner;
}

async function resolveOwner(explicit: string | undefined, recordedBy: string) {
  if (explicit) return assertClinicianOwner(explicit);
  if (!Types.ObjectId.isValid(recordedBy)) throw new HttpError(400, 'Choose a clinician owner');
  const recorder = await User.findById(recordedBy).select(PERSON);
  if (recorder?.role === 'clinician') return recorder;
  throw new HttpError(400, 'Choose a clinician owner');
}

export async function prepareProblemWrite(
  body: Record<string, unknown>,
  current?: { status?: string; resolvedDate?: Date | null; onsetDate?: Date | null }
) {
  if (typeof body.clinicianOwner === 'string') {
    const owner = await assertClinicianOwner(body.clinicianOwner);
    body.clinicianOwner = owner._id;
  }
  if (body.codeSystem === 'ICD-10-CA' && typeof body.code === 'string' && body.code.trim()) {
    const code = body.code.trim().toUpperCase();
    if (!ICD10CA_PATTERN.test(code)) throw new HttpError(400, 'Enter an ICD-10-CA code');
    body.code = code;
  }

  const status = typeof body.status === 'string' ? body.status : current?.status;
  if (status === 'resolved') {
    if (body.resolvedDate == null && !current?.resolvedDate) body.resolvedDate = new Date();
  } else if (typeof body.status === 'string') {
    body.resolvedDate = null;
  }

  const onset =
    body.onsetDate instanceof Date ? body.onsetDate : current?.onsetDate ? new Date(current.onsetDate) : undefined;
  const resolved =
    body.resolvedDate instanceof Date
      ? body.resolvedDate
      : status === 'resolved' && current?.resolvedDate
        ? new Date(current.resolvedDate)
        : undefined;
  if (status === 'resolved' && onset && resolved && resolved.getTime() < onset.getTime()) {
    throw new HttpError(400, 'Resolved date cannot be before onset');
  }
}

export function problemAuditEntries(
  action: 'create' | 'update' | 'delete',
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
): AuditEntry[] {
  if (action === 'delete') return [{ action: 'delete', before, after: null }];

  const entries: AuditEntry[] = [
    { action, event: DIAGNOSIS_AUDIT_EVENTS.problemUpdated, before, after },
  ];
  const beforeStatus = before?.status;
  const afterStatus = after?.status;
  if (afterStatus && beforeStatus !== afterStatus) {
    entries.push({
      action,
      event: DIAGNOSIS_AUDIT_EVENTS.statusChanged,
      before: before ? { status: before.status, resolvedDate: before.resolvedDate ?? null } : null,
      after: { status: after.status, resolvedDate: after?.resolvedDate ?? null },
    });
  }
  return entries;
}

async function getDiagnosis(id: string, patientId: string) {
  if (!Types.ObjectId.isValid(id)) throw new HttpError(400, 'Expected an id');
  const diagnosis = await EncounterDiagnosis.findOne({ _id: id, patientId, ...notDeleted });
  if (!diagnosis) throw new HttpError(404, 'Diagnosis not found');
  return diagnosis;
}

async function getMutableEncounter(id: string, patientId: string) {
  if (!Types.ObjectId.isValid(id)) throw new HttpError(400, 'Expected an id');
  const encounter = await Encounter.findOne({ _id: id, patientId, ...notDeleted });
  if (!encounter) throw new HttpError(404, 'Encounter not found');
  if (LOCKED_ENCOUNTER_STATUSES.includes(encounter.status)) {
    throw new HttpError(409, 'This encounter is locked');
  }
  return encounter;
}

async function clearOtherPrimary(encounterId: Types.ObjectId, exceptId?: Types.ObjectId) {
  await EncounterDiagnosis.updateMany(
    {
      encounterId,
      primaryDiagnosis: true,
      ...notDeleted,
      ...(exceptId ? { _id: { $ne: exceptId } } : {}),
    },
    { $set: { primaryDiagnosis: false } }
  );
}

export async function presentDiagnosis(diagnosis: IEncounterDiagnosis) {
  await diagnosis.populate([
    { path: 'recordedBy', select: PERSON },
    { path: 'promotedBy', select: PERSON },
    { path: 'encounterId', select: 'chiefComplaint openedAt status' },
    { path: 'promotedProblemId', select: 'display status' },
  ]);
  return diagnosis;
}

export async function listDiagnoses(
  patientId: string,
  encounterId: string | undefined,
  skip: number,
  limit: number
) {
  if (encounterId && !Types.ObjectId.isValid(encounterId)) throw new HttpError(400, 'Expected an id');
  const filter = {
    patientId,
    ...notDeleted,
    ...(encounterId ? { encounterId } : {}),
  };
  const [data, total] = await Promise.all([
    EncounterDiagnosis.find(filter)
      .sort({ recordedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('recordedBy', PERSON)
      .populate('promotedBy', PERSON)
      .populate('encounterId', 'chiefComplaint openedAt status')
      .populate('promotedProblemId', 'display status'),
    EncounterDiagnosis.countDocuments(filter),
  ]);
  return { data, total };
}

export async function createEncounterDiagnosis(
  patientId: string,
  input: {
    encounterId: string;
    code: string;
    description: string;
    diagnosisType: DiagnosisType;
    primaryDiagnosis: boolean;
  },
  actorId: string
) {
  const encounter = await getMutableEncounter(input.encounterId, patientId);
  if (input.primaryDiagnosis) await clearOtherPrimary(encounter._id);
  try {
    return await EncounterDiagnosis.create({
      encounterId: encounter._id,
      patientId: encounter.patientId,
      code: input.code,
      description: input.description,
      diagnosisType: input.diagnosisType,
      primaryDiagnosis: input.primaryDiagnosis,
      recordedBy: new Types.ObjectId(actorId),
      recordedAt: new Date(),
    });
  } catch (err) {
    if (isDuplicate(err)) throw new HttpError(409, 'This encounter already has a primary diagnosis');
    throw err;
  }
}

export async function updateEncounterDiagnosis(
  id: string,
  patientId: string,
  input: DiagnosisWrite
) {
  const diagnosis = await getDiagnosis(id, patientId);
  if (diagnosis.promotedProblemId) {
    throw new HttpError(409, 'This diagnosis is already on the problem list');
  }
  const encounter = await getMutableEncounter(String(diagnosis.encounterId), patientId);
  const before = snapshot(diagnosis);
  if (input.code) diagnosis.code = input.code;
  if (input.description) diagnosis.description = input.description;
  if (input.diagnosisType) diagnosis.diagnosisType = input.diagnosisType;
  if (input.primaryDiagnosis !== undefined) {
    if (input.primaryDiagnosis) await clearOtherPrimary(encounter._id, diagnosis._id);
    diagnosis.primaryDiagnosis = input.primaryDiagnosis;
  }
  try {
    await diagnosis.save();
  } catch (err) {
    if (isDuplicate(err)) throw new HttpError(409, 'This encounter already has a primary diagnosis');
    throw err;
  }
  return { diagnosis, before };
}

export async function deleteEncounterDiagnosis(id: string, patientId: string) {
  const diagnosis = await getDiagnosis(id, patientId);
  if (diagnosis.promotedProblemId) {
    throw new HttpError(409, 'This diagnosis is already on the problem list');
  }
  await getMutableEncounter(String(diagnosis.encounterId), patientId);
  const before = snapshot(diagnosis);
  diagnosis.primaryDiagnosis = false;
  diagnosis.deletedAt = new Date();
  await diagnosis.save();
  return { diagnosis, before };
}

export async function promoteDiagnosis(
  patientId: string,
  diagnosisId: string,
  input: PromoteDiagnosisInput,
  actorId: string
) {
  const diagnosis = await getDiagnosis(diagnosisId, patientId);
  if (diagnosis.promotedProblemId) {
    throw new HttpError(409, 'This diagnosis is already on the problem list');
  }
  const encounter = await Encounter.findOne({ _id: diagnosis.encounterId, patientId, ...notDeleted });
  if (!encounter) throw new HttpError(404, 'Encounter not found');

  const owner = await resolveOwner(input.clinicianOwner, String(diagnosis.recordedBy));
  const diagnosisBefore = snapshot(diagnosis);
  let problem: ICondition;
  let problemBefore: Record<string, unknown> | null = null;

  if (input.target === 'active_problem') {
    const body: Record<string, unknown> = {
      patientId,
      display: input.display || diagnosis.description,
      status: 'active',
      severity: input.severity || 'unknown',
      onsetDate: input.onsetDate || diagnosis.recordedAt,
      clinicianOwner: owner._id,
      codeSystem: 'ICD-10-CA',
      code: diagnosis.code,
      sourceDiagnosisId: diagnosis._id,
    };
    await prepareProblemWrite(body);
    problem = await Condition.create(body);
  } else {
    if (!input.problemId) throw new HttpError(400, 'Choose a problem to update');
    const existing = await Condition.findOne({ _id: input.problemId, patientId, ...notDeleted });
    if (!existing) throw new HttpError(404, 'Problem not found');
    problemBefore = snapshot(existing);
    const body: Record<string, unknown> = {
      codeSystem: 'ICD-10-CA',
      code: diagnosis.code,
      clinicianOwner: owner._id,
      sourceDiagnosisId: diagnosis._id,
    };
    if (input.display) body.display = input.display;
    if (input.severity) body.severity = input.severity;
    if (input.onsetDate) body.onsetDate = input.onsetDate;
    if (input.status) body.status = input.status;
    if (input.resolvedDate) body.resolvedDate = input.resolvedDate;
    await prepareProblemWrite(body, existing);
    Object.assign(existing, body);
    await existing.save();
    problem = existing;
  }

  diagnosis.promotedProblemId = problem._id;
  diagnosis.promotion = input.target;
  diagnosis.promotedAt = new Date();
  diagnosis.promotedBy = new Types.ObjectId(actorId);
  await diagnosis.save();

  return { diagnosis, diagnosisBefore, problem, problemBefore };
}

export function plainProblem(problem: ICondition) {
  return snapshot(problem);
}
