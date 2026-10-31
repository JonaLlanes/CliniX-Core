import { Types } from 'mongoose';
import { Allergy } from '../models/Allergy.js';
import { Condition } from '../models/Condition.js';
import { Encounter } from '../models/Encounter.js';
import { Medication, type IMedication } from '../models/Medication.js';
import { User } from '../models/User.js';
import { HttpError } from '../middleware/error.js';
import { notDeleted } from '../utils/pagination.js';
import { CLINIC_TIME_ZONE } from '../utils/clinicTime.js';
import {
  MEDICATION_STATUSES,
  MEDICATION_TIMELINE_LABELS,
  type AllergyWarning,
  type MedicationEventAction,
  type MedicationStatus,
} from '../types/medications.js';

const PERSON = 'displayName role';
const ACTOR_ROLES = new Set(['clinician', 'pharmacist', 'admin']);

const POPULATE = [
  { path: 'prescribedBy', select: PERSON },
  { path: 'prescriberId', select: PERSON },
  { path: 'conditionId', select: 'display code status' },
  { path: 'encounterId', select: 'chiefComplaint openedAt status' },
  { path: 'events.clinicianId', select: PERSON },
  { path: 'allergyAcknowledgments.clinicianId', select: PERSON },
];

/**
 * Local chart check only. Compares the medication name with active allergies
 * and a short list of class names already used on this chart.
 */
const DRUG_CLASSES: { label: string; terms: string[] }[] = [
  {
    label: 'penicillin',
    terms: ['penicillin', 'amoxicillin', 'ampicillin', 'cloxacillin', 'flucloxacillin', 'piperacillin'],
  },
  {
    label: 'sulfa',
    terms: ['sulfa', 'sulfamethoxazole', 'sulfasalazine', 'sulfadiazine', 'sulfonamide'],
  },
  {
    label: 'ace inhibitor',
    terms: [
      'ace inhibitor',
      'lisinopril',
      'ramipril',
      'enalapril',
      'perindopril',
      'captopril',
      'quinapril',
      'benazepril',
      'fosinopril',
      'trandolapril',
      'cilazapril',
    ],
  },
  {
    label: 'angiotensin receptor blocker',
    terms: ['losartan', 'valsartan', 'candesartan', 'irbesartan', 'telmisartan', 'olmesartan'],
  },
  {
    label: 'nsaid',
    terms: ['nsaid', 'ibuprofen', 'naproxen', 'diclofenac', 'celecoxib', 'ketorolac', 'indomethacin'],
  },
  {
    label: 'statin',
    terms: ['statin', 'atorvastatin', 'rosuvastatin', 'simvastatin', 'pravastatin'],
  },
  {
    label: 'opioid',
    terms: ['opioid', 'morphine', 'hydromorphone', 'oxycodone', 'codeine', 'fentanyl', 'tramadol'],
  },
];

const FIELD_LABELS: Record<string, string> = {
  din: 'DIN',
  genericName: 'Generic name',
  brandName: 'Brand name',
  strength: 'Strength',
  dosage: 'Dosage',
  route: 'Route',
  frequency: 'Frequency',
  indication: 'Indication',
  startDate: 'Start date',
  prescribedBy: 'Prescriber',
  encounterId: 'Encounter',
  conditionId: 'Related diagnosis',
};

export type MedicationWrite = {
  encounterId?: string | null;
  conditionId?: string | null;
  din?: string | null;
  genericName?: string;
  brandName?: string | null;
  strength?: string | null;
  dosage?: string;
  route?: string;
  frequency?: string;
  indication?: string | null;
  startDate?: Date;
  prescribedBy?: string;
  reason?: string;
  date?: Date;
  allergyAcknowledgment?: { acknowledged: true };
};

export type MedicationActionInput = {
  reason: string;
  date: Date;
  clinicianId?: string;
};

export type MedicationTimelinePoint = {
  action: MedicationEventAction;
  label: string;
  at: Date;
  detail: string;
  reason?: string;
  clinicianId?: unknown;
};

type MedicationSource = {
  genericName?: string;
  brandName?: string;
  name?: string;
  strength?: string;
  dosage?: string;
  dose?: string;
  route?: string;
  frequency?: string;
  indication?: string;
  status?: string;
  startDate?: Date | string;
  endDate?: Date | string | null;
  updatedAt?: Date | string;
  adherenceNotes?: string;
  events?: Array<{
    action: string;
    at: Date | string;
    reason?: string;
    summary?: string;
    clinicianId?: unknown;
  }>;
};

type ConditionRef = {
  _id: unknown;
  display: string;
  code?: string;
  status?: string;
};

function snapshot(doc: { toObject(): object }) {
  return doc.toObject() as Record<string, unknown>;
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function mentions(text: string, term: string) {
  const needle = normalize(term);
  if (needle.length < 4 || !text) return false;
  return text.includes(needle);
}

function classesFor(text: string) {
  return DRUG_CLASSES.filter(
    (group) => mentions(text, group.label) || group.terms.some((term) => mentions(text, term))
  );
}

export function matchAllergyWarnings(
  medication: { genericName?: string | null; brandName?: string | null; din?: string | null },
  allergies: Array<{
    _id: unknown;
    substance: string;
    reaction: string;
    severity: string;
    status?: string;
  }>
): AllergyWarning[] {
  const medText = normalize([medication.genericName, medication.brandName].filter(Boolean).join(' '));
  const medClasses = classesFor(medText);
  const warnings: AllergyWarning[] = [];

  for (const allergy of allergies) {
    if (allergy.status && allergy.status !== 'active') continue;
    const allergyText = normalize(allergy.substance || '');
    if (!allergyText) continue;

    let matchedOn = '';
    if (
      medText.length >= 4 &&
      allergyText.length >= 4 &&
      (medText.includes(allergyText) || allergyText.includes(medText))
    ) {
      matchedOn = allergy.substance;
    } else {
      const shared = classesFor(allergyText).find((group) =>
        medClasses.some((item) => item.label === group.label)
      );
      if (shared) matchedOn = shared.label;
    }
    if (!matchedOn && medication.din && allergyText.replace(/\s/g, '') === medication.din) {
      matchedOn = `DIN ${medication.din}`;
    }
    if (!matchedOn) continue;

    warnings.push({
      allergyId: String(allergy._id),
      substance: allergy.substance,
      reaction: allergy.reaction,
      severity: allergy.severity,
      matchedOn,
    });
  }

  return warnings;
}

function clinicDay(value: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CLINIC_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

function calendarDays(value: Date) {
  const clinic = clinicDay(value);
  const utc = value.toISOString().slice(0, 10);
  return clinic === utc ? [clinic] : [clinic, utc];
}

function isBeforeStart(value: Date, start: Date) {
  const earliest = (days: string[]) => days.slice().sort()[0];
  return earliest(calendarDays(value)) < earliest(calendarDays(start));
}

function assertNotFuture(value: Date, label: string) {
  if (clinicDay(value) > clinicDay(new Date())) {
    throw new HttpError(400, `${label} cannot be in the future`);
  }
}

function assertOnOrAfterStart(value: Date, start: Date, label: string) {
  if (isBeforeStart(value, start)) {
    throw new HttpError(400, `${label} cannot be before the start date`);
  }
}

function regimen(med: MedicationSource) {
  const name = med.genericName || med.name || 'Medication';
  const brand = med.brandName ? ` (${med.brandName})` : '';
  return [name + brand, med.strength, med.dosage || med.dose, med.route, med.frequency]
    .filter(Boolean)
    .join(' · ');
}

function asDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function medicationTimelinePoints(med: MedicationSource): MedicationTimelinePoint[] {
  const events = med.events || [];
  if (events.length) {
    return events.flatMap((event) => {
      const at = asDate(event.at);
      const action = event.action as MedicationEventAction;
      const label = MEDICATION_TIMELINE_LABELS[action];
      if (!at || !label) return [];
      const extra =
        action === 'changed'
          ? [event.summary, event.reason].filter((part, index, all) => part && all.indexOf(part) === index).join(' — ')
          : event.reason || '';
      return [
        {
          action,
          label,
          at,
          detail: [regimen(med), extra].filter(Boolean).join(' — '),
          reason: event.reason,
          clinicianId: event.clinicianId,
        },
      ];
    });
  }

  const points: MedicationTimelinePoint[] = [];
  const started = asDate(med.startDate);
  if (started) {
    points.push({
      action: 'started',
      label: MEDICATION_TIMELINE_LABELS.started,
      at: started,
      detail: regimen(med),
    });
  }
  const ended = asDate(med.endDate);
  if (med.status === 'discontinued' && ended) {
    points.push({
      action: 'discontinued',
      label: MEDICATION_TIMELINE_LABELS.discontinued,
      at: ended,
      detail: regimen(med),
      reason: med.adherenceNotes,
    });
  } else if (med.status === 'completed' && ended) {
    points.push({
      action: 'completed',
      label: MEDICATION_TIMELINE_LABELS.completed,
      at: ended,
      detail: regimen(med),
    });
  } else if (med.status === 'on-hold' && started) {
    points.push({
      action: 'held',
      label: MEDICATION_TIMELINE_LABELS.held,
      at: started,
      detail: regimen(med),
      reason: med.adherenceNotes,
    });
  }
  return points;
}

function applyLegacy(med: IMedication) {
  if (!med.genericName && med.name) med.genericName = med.name;
  if (!med.dosage && med.dose) med.dosage = med.dose;
  if (!med.prescribedBy && med.prescriberId) med.prescribedBy = med.prescriberId;
}

async function hydrate(meds: IMedication[]) {
  for (const med of meds) applyLegacy(med);
  if (meds.length) await Medication.populate(meds, POPULATE);
  return meds;
}

export type PresentedMedication = {
  _id: unknown;
  genericName: string;
  brandName?: string;
  strength?: string;
  dosage?: string;
  dose?: string;
  route?: string;
  frequency?: string;
  indication?: string;
  status?: string;
  conditionId?: unknown;
  name?: string;
  timeline: Array<Omit<MedicationTimelinePoint, 'at'> & { at: string }>;
} & Record<string, unknown>;

export function presentMedication(med: IMedication): PresentedMedication {
  const plain = med.toObject() as Record<string, unknown> & MedicationSource;
  const genericName = plain.genericName || plain.name || '';
  const dosage = plain.dosage || plain.dose || '';
  const presented = {
    ...plain,
    genericName,
    dosage,
    prescribedBy: plain.prescribedBy || plain.prescriberId,
  };
  const timeline = medicationTimelinePoints(presented).map((point) => ({
    ...point,
    at: point.at.toISOString(),
  }));
  return { ...presented, _id: med._id, timeline };
}

async function getMedication(id: string, patientId: string) {
  if (!Types.ObjectId.isValid(id)) throw new HttpError(400, 'Expected an id');
  const medication = await Medication.findOne({ _id: id, patientId, ...notDeleted });
  if (!medication) throw new HttpError(404, 'Medication not found');
  applyLegacy(medication);
  return medication;
}

async function assertPrescriber(prescriberId: string) {
  if (!Types.ObjectId.isValid(prescriberId)) throw new HttpError(400, 'Expected an id');
  const prescriber = await User.findById(prescriberId).select(PERSON);
  if (!prescriber) throw new HttpError(404, 'Prescriber not found');
  if (prescriber.role !== 'clinician') throw new HttpError(400, 'Prescriber must be a clinician');
  return prescriber;
}

async function resolveActor(explicit: string | undefined, fallbackId: string) {
  const id = explicit || fallbackId;
  if (!Types.ObjectId.isValid(id)) throw new HttpError(400, 'Expected an id');
  const actor = await User.findById(id).select(PERSON);
  if (!actor) throw new HttpError(404, 'Clinician not found');
  if (!ACTOR_ROLES.has(actor.role)) throw new HttpError(400, 'Choose a clinician');
  return actor;
}

async function assertEncounter(encounterId: string | null | undefined, patientId: string) {
  if (!encounterId) return null;
  if (!Types.ObjectId.isValid(encounterId)) throw new HttpError(400, 'Expected an id');
  const encounter = await Encounter.findOne({ _id: encounterId, patientId, ...notDeleted }).select('_id');
  if (!encounter) throw new HttpError(404, 'Encounter not found');
  return encounter._id;
}

async function assertCondition(conditionId: string | null | undefined, patientId: string) {
  if (!conditionId) return null;
  if (!Types.ObjectId.isValid(conditionId)) throw new HttpError(400, 'Expected an id');
  const condition = await Condition.findOne({ _id: conditionId, patientId, ...notDeleted }).select('_id');
  if (!condition) throw new HttpError(404, 'Related diagnosis not found');
  return condition._id;
}

export async function findAllergyWarnings(
  patientId: string,
  medication: { genericName?: string | null; brandName?: string | null; din?: string | null }
) {
  const allergies = await Allergy.find({ patientId, status: 'active', ...notDeleted })
    .select('substance reaction severity status')
    .lean();
  return matchAllergyWarnings(medication, allergies);
}

function assertAcknowledged(
  acknowledgment: { acknowledged: true } | undefined,
  warnings: AllergyWarning[]
) {
  if (warnings.length && !acknowledgment?.acknowledged) {
    throw new HttpError(409, 'Review the allergy warning before saving', {
      code: 'allergy_warning',
      warnings,
    });
  }
}

function rememberAcknowledgment(
  medication: IMedication,
  clinicianId: Types.ObjectId,
  warnings: AllergyWarning[],
  at: Date
) {
  if (!warnings.length) return;
  medication.allergyAcknowledgments.push({
    at,
    clinicianId,
    warnings: warnings.map((warning) => ({
      allergyId: new Types.ObjectId(warning.allergyId),
      substance: warning.substance,
      reaction: warning.reaction,
      severity: warning.severity,
      matchedOn: warning.matchedOn,
    })),
  });
}

function clean(key: string, value: unknown) {
  if (value == null || value === '') return '';
  if (key === 'startDate') {
    const date = asDate(value as Date | string | null);
    return date ? String(date.getTime()) : '';
  }
  return String(value);
}

function sameValue(key: string, left: unknown, right: unknown) {
  return clean(key, left) === clean(key, right);
}

function changeSummary(before: Record<string, unknown>, after: IMedication) {
  const parts: string[] = [];
  for (const key of Object.keys(FIELD_LABELS)) {
    const next = after.get(key);
    if (sameValue(key, before[key], next)) continue;
    if (key === 'prescribedBy' || key === 'encounterId' || key === 'conditionId') {
      parts.push(`${FIELD_LABELS[key]} updated`);
      continue;
    }
    const fromDate = key === 'startDate' ? asDate(before[key] as Date | string | null) : null;
    const toDate = key === 'startDate' ? asDate(next as Date | string | null) : null;
    const from = fromDate ? clinicDay(fromDate) : clean(key, before[key]) || '—';
    const to = toDate ? clinicDay(toDate) : clean(key, next) || '—';
    parts.push(`${FIELD_LABELS[key]} ${from} → ${to}`);
  }
  return parts.join('; ');
}

export async function listMedications(
  patientId: string,
  query: { status?: string; encounterId?: string },
  skip: number,
  limit: number
) {
  const filter: Record<string, unknown> = { patientId, ...notDeleted };
  if (query.status) {
    if (!MEDICATION_STATUSES.includes(query.status as MedicationStatus)) {
      throw new HttpError(400, 'Invalid status');
    }
    filter.status = query.status;
  }
  if (query.encounterId) {
    if (!Types.ObjectId.isValid(query.encounterId)) throw new HttpError(400, 'Expected an id');
    filter.encounterId = query.encounterId;
  }
  const [docs, total] = await Promise.all([
    Medication.find(filter).sort({ startDate: -1 }).skip(skip).limit(limit),
    Medication.countDocuments(filter),
  ]);
  await hydrate(docs);
  return { data: docs.map(presentMedication), total };
}

export async function getPresentedMedication(id: string, patientId: string) {
  const medication = await getMedication(id, patientId);
  await hydrate([medication]);
  return presentMedication(medication);
}

async function finish(medication: IMedication, before: Record<string, unknown> | null, warnings: AllergyWarning[]) {
  const after = snapshot(medication);
  await hydrate([medication]);
  return {
    medication: presentMedication(medication),
    before,
    after,
    acknowledgedWarnings: warnings,
  };
}

export async function startMedication(patientId: string, input: MedicationWrite, actorId: string) {
  if (!input.genericName || !input.dosage || !input.route || !input.frequency || !input.startDate || !input.prescribedBy) {
    throw new HttpError(400, 'Medication details are incomplete');
  }
  const prescriber = await assertPrescriber(input.prescribedBy);
  const actor = await resolveActor(undefined, actorId);
  const encounterId = await assertEncounter(input.encounterId, patientId);
  const conditionId = await assertCondition(input.conditionId, patientId);
  assertNotFuture(input.startDate, 'Start date');

  const draft = {
    genericName: input.genericName,
    brandName: input.brandName,
    din: input.din,
  };
  const warnings = await findAllergyWarnings(patientId, draft);
  assertAcknowledged(input.allergyAcknowledgment, warnings);

  const medication = new Medication({
    patientId,
    encounterId,
    conditionId,
    din: input.din,
    genericName: input.genericName,
    brandName: input.brandName,
    strength: input.strength,
    dosage: input.dosage,
    route: input.route,
    frequency: input.frequency,
    indication: input.indication,
    startDate: input.startDate,
    prescribedBy: prescriber._id,
    status: 'active',
    events: [
      {
        action: 'started',
        at: input.startDate,
        clinicianId: actor._id,
        reason: input.indication,
        summary: [input.genericName, input.strength, input.dosage, input.route, input.frequency]
          .filter(Boolean)
          .join(' · '),
      },
    ],
  });
  rememberAcknowledgment(medication, actor._id, warnings, new Date());
  await medication.save();
  return finish(medication, null, warnings);
}

export async function changeMedication(
  id: string,
  patientId: string,
  input: MedicationWrite,
  actorId: string
) {
  const medication = await getMedication(id, patientId);
  const before = snapshot(medication);
  const actor = await resolveActor(undefined, actorId);
  const when = input.date || new Date();
  assertNotFuture(when, 'Date');

  if (input.prescribedBy) medication.prescribedBy = (await assertPrescriber(input.prescribedBy))._id;
  if (input.encounterId !== undefined) medication.encounterId = await assertEncounter(input.encounterId, patientId);
  if (input.conditionId !== undefined) medication.conditionId = await assertCondition(input.conditionId, patientId);
  if (input.din !== undefined) medication.din = input.din || undefined;
  if (input.genericName !== undefined) medication.genericName = input.genericName;
  if (input.brandName !== undefined) medication.brandName = input.brandName || '';
  if (input.strength !== undefined) medication.strength = input.strength || '';
  if (input.dosage !== undefined) medication.dosage = input.dosage;
  if (input.route !== undefined) medication.route = input.route;
  if (input.frequency !== undefined) medication.frequency = input.frequency;
  if (input.indication !== undefined) medication.indication = input.indication || '';
  if (input.startDate) {
    assertNotFuture(input.startDate, 'Start date');
    if (medication.endDate && isBeforeStart(medication.endDate, input.startDate)) {
      throw new HttpError(400, 'Start date cannot be after the end date');
    }
    medication.startDate = input.startDate;
  }
  assertOnOrAfterStart(when, medication.startDate, 'Date');

  const summary = changeSummary(before, medication);
  if (!summary) throw new HttpError(400, 'No medication changes submitted');

  const warnings = await findAllergyWarnings(patientId, {
    genericName: medication.genericName,
    brandName: medication.brandName,
    din: medication.din,
  });
  assertAcknowledged(input.allergyAcknowledgment, warnings);
  rememberAcknowledgment(medication, actor._id, warnings, when);

  medication.events.push({
    action: 'changed',
    at: when,
    clinicianId: actor._id,
    reason: input.reason,
    summary,
  });
  await medication.save();
  return finish(medication, before, warnings);
}

async function transition(
  id: string,
  patientId: string,
  action: 'held' | 'resumed' | 'discontinued' | 'completed',
  input: MedicationActionInput,
  actorId: string
) {
  const medication = await getMedication(id, patientId);
  const before = snapshot(medication);
  const actor = await resolveActor(input.clinicianId, actorId);
  assertNotFuture(input.date, 'Date');
  assertOnOrAfterStart(input.date, medication.startDate, 'Date');

  if (action === 'held' && medication.status !== 'active') {
    throw new HttpError(409, 'Only an active medication can be held');
  }
  if (action === 'resumed' && medication.status !== 'on-hold') {
    throw new HttpError(409, 'Only a held medication can be resumed');
  }
  if ((action === 'discontinued' || action === 'completed') && !['active', 'on-hold'].includes(medication.status)) {
    throw new HttpError(409, 'Only an active or held medication can be closed');
  }

  if (action === 'held') medication.status = 'on-hold';
  if (action === 'resumed') {
    medication.status = 'active';
    medication.endDate = null;
  }
  if (action === 'discontinued') {
    medication.status = 'discontinued';
    medication.endDate = input.date;
  }
  if (action === 'completed') {
    medication.status = 'completed';
    medication.endDate = input.date;
  }

  medication.events.push({
    action,
    at: input.date,
    clinicianId: actor._id,
    reason: input.reason,
  });
  await medication.save();
  return finish(medication, before, []);
}

export function holdMedication(id: string, patientId: string, input: MedicationActionInput, actorId: string) {
  return transition(id, patientId, 'held', input, actorId);
}

export function resumeMedication(id: string, patientId: string, input: MedicationActionInput, actorId: string) {
  return transition(id, patientId, 'resumed', input, actorId);
}

export function discontinueMedication(
  id: string,
  patientId: string,
  input: MedicationActionInput,
  actorId: string
) {
  return transition(id, patientId, 'discontinued', input, actorId);
}

export function completeMedication(id: string, patientId: string, input: MedicationActionInput, actorId: string) {
  return transition(id, patientId, 'completed', input, actorId);
}

function relatedDiagnosis(med: PresentedMedication, conditions: ConditionRef[]) {
  const linked = med.conditionId as { _id?: unknown; display?: string; code?: string; status?: string } | null;
  if (linked && typeof linked === 'object' && linked.display) {
    return {
      _id: linked._id ? String(linked._id) : undefined,
      display: linked.display,
      code: linked.code,
      status: linked.status,
    };
  }
  const indication = String(med.indication || '').trim().toLowerCase();
  if (indication.length < 4) return null;
  const match = conditions.find((condition) => {
    const display = condition.display.trim().toLowerCase();
    return display.length >= 4 && (indication.includes(display) || display.includes(indication));
  });
  if (!match) return null;
  return {
    _id: String(match._id),
    display: match.display,
    code: match.code,
    status: match.status,
  };
}

export async function medicationSummary(patientId: string) {
  const [docs, conditions] = await Promise.all([
    Medication.find({ patientId, ...notDeleted }).sort({ startDate: -1 }),
    Condition.find({ patientId, ...notDeleted }).select('display code status').lean(),
  ]);
  await hydrate(docs);
  const medications = docs.map(presentMedication);
  const current = medications.filter((med) => med.status === 'active' || med.status === 'on-hold');
  const recentChanges = medications
    .flatMap((med) =>
      (med.timeline || [])
        .filter((point) => point.action !== 'started')
        .map((point) => ({
          ...point,
          medicationId: String(med._id),
          genericName: String(med.genericName || ''),
          brandName: med.brandName ? String(med.brandName) : undefined,
          status: med.status as MedicationStatus,
        }))
    )
    .sort((a, b) => new Date(String(b.at)).getTime() - new Date(String(a.at)).getTime())
    .slice(0, 8);

  const relatedDiagnoses = current
    .map((med) => ({
      medicationId: String(med._id),
      genericName: String(med.genericName || ''),
      brandName: med.brandName ? String(med.brandName) : undefined,
      diagnosis: relatedDiagnosis(med, conditions as ConditionRef[]),
    }))
    .filter((item) => item.diagnosis);

  return {
    active: current,
    recentChanges,
    relatedDiagnoses,
  };
}

export async function listPrescribers() {
  return User.find({ role: 'clinician' }).select(PERSON).sort({ displayName: 1 });
}
