import { faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import type { Role } from '../../types/roles.js';
import { boardNow, Calendar, clinicDays, clinicToday, type ClinicDay } from './calendar.js';
import { FSAS, POSTAL_REST, RELATIONSHIPS, STREETS } from './catalog.js';
import { SHOWCASE } from './personas.js';
import { makeRng, type Rng } from './rng.js';
import { STAFF_SEEDS, type HomeSite } from './staff.js';

export const DAY_MS = 24 * 60 * 60 * 1000;

export type Site = HomeSite;
export type Location = Site | 'Virtual';
export type AppointmentType = 'new_patient' | 'follow_up' | 'consultation' | 'procedure' | 'telehealth';
export type AppointmentStatus = 'booked' | 'confirmed' | 'arrived' | 'no_show' | 'cancelled' | 'completed';
export type VisitStatus =
  | 'arrived'
  | 'waiting'
  | 'roomed'
  | 'in_progress'
  | 'completed'
  | 'no_show'
  | 'cancelled';
export type Cohorts = { htn: boolean; dm: boolean; copd: boolean; hf: boolean; ckd: boolean };

export type StaffMember = {
  _id: Types.ObjectId;
  email: string;
  password: string;
  passwordHash: string;
  displayName: string;
  role: Role;
  site: Site | 'Virtual';
  francophone: boolean;
  createdAt: Date;
  updatedAt: Date;
  _profileUpdated: boolean;
};

export type PersonContact = {
  name: string;
  relationship: string;
  phone: string;
  phoneSecondary?: string;
};

export type PatientDraft = {
  _id: Types.ObjectId;
  mrn: string;
  givenName: string;
  familyName: string;
  preferredName?: string;
  birthDate: Date;
  age: number;
  language: 'en' | 'fr' | 'other';
  sex: 'female' | 'male' | 'other' | 'unknown';
  genderIdentity: 'female' | 'male' | 'non-binary' | 'two-spirit' | 'other' | 'prefer-not-to-say' | 'unknown';
  phone: string;
  email: string;
  street: string;
  city: string;
  province: 'ON' | 'BC' | 'AB' | 'QC';
  postalCode: string;
  hcn: string;
  versionCode?: string;
  emergency: PersonContact;
  sdm?: PersonContact;
  insurance?: string;
  nationalId?: string;
  homeSite: Site;
  outOfProvince: boolean;
  clinicianId: Types.ObjectId;
  nurseId: Types.ObjectId;
  pharmacistId?: Types.ObjectId;
  caregiverId?: Types.ObjectId;
  careTeam: Types.ObjectId[];
  cohorts: Cohorts;
  heightCm: number;
  weightKg: number;
  showcase: boolean;
  forcedProblemCodes: string[];
  forcedAllergies: string[];
  createdAt: Date;
  updatedAt: Date;
  _registeredKey: string;
};

export type TimelineEvent = {
  event: 'arrived' | 'waiting' | 'roomed' | 'in_progress' | 'completed';
  at: Date;
  actorId: Types.ObjectId;
  examRoom?: string;
  note?: string;
};

export type AppointmentDraft = {
  _id: Types.ObjectId;
  patientId: Types.ObjectId;
  providerId: Types.ObjectId;
  clinicLocation: Location;
  appointmentType: AppointmentType;
  startTime: Date;
  endTime: Date;
  status: AppointmentStatus;
  cancelReason?: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  _anchor: 'new' | 'follow' | null;
  _patientIndex: number;
  _kind: string;
};

export type VisitDraft = {
  _id: Types.ObjectId;
  appointmentId: Types.ObjectId;
  patientId: Types.ObjectId;
  providerId: Types.ObjectId;
  status: VisitStatus;
  arrivalAt?: Date;
  roomedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  examRoom?: string | null;
  demographicsVerified: boolean;
  healthCardVerified: boolean;
  note?: string;
  cancelReason?: string;
  timeline: TimelineEvent[];
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  _anchor: 'new' | 'follow' | null;
  _patientIndex: number;
  _location: Location;
};

export type ConditionDraft = {
  _id: Types.ObjectId;
  patientId: Types.ObjectId;
  display: string;
  status: 'active' | 'inactive' | 'resolved';
  severity: 'mild' | 'moderate' | 'severe' | 'unknown';
  onsetDate: Date;
  resolvedDate: Date | null;
  clinicianOwner: Types.ObjectId;
  codeSystem: 'ICD-10-CA' | 'SNOMED';
  code: string;
  encounterCode: string;
  sourceDiagnosisId: Types.ObjectId | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  _patientIndex: number;
  _primary: boolean;
};

export type DiagnosisDraft = {
  _id: Types.ObjectId;
  encounterId: Types.ObjectId;
  patientId: Types.ObjectId;
  code: string;
  description: string;
  diagnosisType: 'working' | 'final' | 'encounter';
  primaryDiagnosis: boolean;
  recordedBy: Types.ObjectId;
  recordedAt: Date;
  promotedProblemId: Types.ObjectId | null;
  promotion: 'active_problem' | 'existing_problem' | null;
  promotedAt: Date | null;
  promotedBy: Types.ObjectId | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type EncounterDraft = {
  _id: Types.ObjectId;
  patientId: Types.ObjectId;
  visitId: Types.ObjectId;
  appointmentId: Types.ObjectId;
  attendingProviderId: Types.ObjectId;
  supervisingProviderId: Types.ObjectId | null;
  clinicLocation: Location;
  appointmentType: AppointmentType;
  chiefComplaint: string;
  reasonForVisit: string;
  status: 'open' | 'in_progress' | 'awaiting_signature' | 'signed' | 'amended';
  isCurrent: boolean;
  createdBy: Types.ObjectId;
  signedBy: Types.ObjectId | null;
  signedAt: Date | null;
  openedAt: Date;
  amendsEncounterId: Types.ObjectId | null;
  timeline: { event: 'opened' | 'in_progress' | 'awaiting_signature' | 'signed' | 'amended'; at: Date; actorId: Types.ObjectId; note?: string }[];
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  _patientIndex: number;
  _anchor: boolean;
  _primaryCode: string;
};

export type MedicationDraft = {
  _id: Types.ObjectId;
  patientId: Types.ObjectId;
  encounterId: Types.ObjectId | null;
  conditionId: Types.ObjectId | null;
  din?: string;
  genericName: string;
  brandName: string;
  strength: string;
  dosage: string;
  route: string;
  frequency: string;
  indication?: string;
  startDate: Date;
  endDate: Date | null;
  prescribedBy: Types.ObjectId;
  status: 'active' | 'on-hold' | 'completed' | 'discontinued';
  events: {
    action: 'started' | 'changed' | 'held' | 'resumed' | 'discontinued' | 'completed';
    at: Date;
    clinicianId: Types.ObjectId;
    reason?: string;
    summary?: string;
  }[];
  allergyAcknowledgments: {
    at: Date;
    clinicianId: Types.ObjectId;
    warnings: {
      allergyId: Types.ObjectId;
      substance: string;
      reaction: string;
      severity: string;
      matchedOn: string;
    }[];
  }[];
  adherenceNotes?: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  _patientIndex: number;
};

export type AllergyDraft = {
  _id: Types.ObjectId;
  patientId: Types.ObjectId;
  substance: string;
  reaction: string;
  severity: 'mild' | 'moderate' | 'severe';
  status: 'active' | 'inactive';
  recordedDate: Date;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  _patientIndex: number;
  _allergyClass?: string;
};

export type CarePlanDraft = {
  _id: Types.ObjectId;
  patientId: Types.ObjectId;
  primaryDiagnosisId: Types.ObjectId | null;
  primaryDiagnosisKind: 'problem' | null;
  problemIds: Types.ObjectId[];
  encounterDiagnosisIds: Types.ObjectId[];
  encounterId: Types.ObjectId | null;
  title: string;
  description: string;
  status: 'draft' | 'active' | 'on_hold' | 'completed' | 'cancelled';
  startDate: Date;
  targetDate: Date | null;
  completedDate: Date | null;
  ownerClinicianId: Types.ObjectId;
  progress: { authorId: Types.ObjectId; at: Date; note: string }[];
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  _patientIndex: number;
  _primary: boolean;
};

export type GoalDraft = {
  _id: Types.ObjectId;
  carePlanId: Types.ObjectId;
  patientId: Types.ObjectId;
  description: string;
  targetValue: string | null;
  targetDate: Date;
  status: 'not_started' | 'in_progress' | 'achieved' | 'cancelled';
  achievedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type InterventionDraft = {
  _id: Types.ObjectId;
  carePlanId: Types.ObjectId;
  patientId: Types.ObjectId;
  description: string;
  assignedRole: 'clinician' | 'nurse' | 'caregiver' | 'pharmacist';
  dueDate: Date;
  status: 'planned' | 'active' | 'completed' | 'cancelled';
  completedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TaskDraft = {
  _id: Types.ObjectId;
  patientId: Types.ObjectId;
  carePlanId?: Types.ObjectId;
  title: string;
  assigneeRole: 'clinician' | 'nurse' | 'caregiver' | 'pharmacist';
  assigneeUserId?: Types.ObjectId;
  status: 'pending' | 'in_progress' | 'completed';
  dueDate?: Date;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  _patientIndex: number;
};

export type NoteDraft = {
  _id: Types.ObjectId;
  patientId: Types.ObjectId;
  encounterId?: Types.ObjectId;
  authorId: Types.ObjectId;
  body: string;
  version: number;
  rootId: Types.ObjectId;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  _patientIndex: number;
  _anchor: boolean;
  _extra: boolean;
};

export type VitalDraft = {
  _id: Types.ObjectId;
  patientId: Types.ObjectId;
  effectiveAt: Date;
  source: 'clinic' | 'home' | 'device' | 'caregiver';
  measurements: {
    systolicBp?: number;
    diastolicBp?: number;
    heartRate?: number;
    respiratoryRate?: number;
    temperatureC?: number;
    spo2?: number;
    weightKg?: number;
    heightCm?: number;
  };
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  _patientIndex: number;
  _previousSystolic?: number;
};

export type AuditDraft = {
  userId: Types.ObjectId;
  role: Role;
  action: 'create' | 'update' | 'delete';
  resourceType: string;
  resourceId: Types.ObjectId;
  patientId?: Types.ObjectId;
  before: unknown;
  after: unknown;
  event?: string;
  timestamp: Date;
};

export type World = {
  rng: Rng;
  now: Date;
  today: ClinicDay;
  days: ClinicDay[];
  calendar: Calendar;
  staff: StaffMember[];
  patients: PatientDraft[];
  appointments: AppointmentDraft[];
  visits: VisitDraft[];
  conditions: ConditionDraft[];
  diagnoses: DiagnosisDraft[];
  encounters: EncounterDraft[];
  medications: MedicationDraft[];
  allergies: AllergyDraft[];
  carePlans: CarePlanDraft[];
  goals: GoalDraft[];
  interventions: InterventionDraft[];
  tasks: TaskDraft[];
  notes: NoteDraft[];
  vitals: VitalDraft[];
  audits: AuditDraft[];
};

const FR_GIVEN = ['Amélie', 'Camille', 'Chloé', 'Élise', 'Manon', 'Nathalie', 'Sophie', 'Claire', 'Lucie', 'Jeanne', 'Antoine', 'Benoît', 'Étienne', 'Guillaume', 'Hugo', 'Julien', 'Laurent', 'Mathieu', 'Nicolas', 'Olivier'];
const FR_FAMILY = ['Tremblay', 'Gagnon', 'Roy', 'Côté', 'Bouchard', 'Gauthier', 'Morin', 'Lavoie', 'Fortin', 'Gagné', 'Pelletier', 'Bélanger', 'Lévesque', 'Bergeron', 'Leblanc', 'Paquette', 'Girard', 'Simard'];

const SITE_PLAN: { site: Site; count: number }[] = [
  { site: 'Toronto Main', count: 230 },
  { site: 'North York', count: 135 },
  { site: 'Mississauga', count: 135 },
];

export function oid() {
  return new Types.ObjectId();
}

export function sid(id: Types.ObjectId) {
  return String(id);
}

function slug(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '') || 'patient';
}

function ageOn(birth: Date, day: ClinicDay) {
  let age = day.y - birth.getUTCFullYear();
  const month = day.m - (birth.getUTCMonth() + 1);
  if (month < 0 || (month === 0 && day.d < birth.getUTCDate())) age -= 1;
  return Math.max(0, age);
}

function postal(rng: Rng, city: string) {
  const fsas = FSAS[city] ?? FSAS.Toronto!;
  const fsa = rng.pick(fsas);
  const letter = POSTAL_REST[rng.int(0, POSTAL_REST.length - 1)];
  return `${fsa} ${rng.int(0, 9)}${letter}${rng.int(0, 9)}`;
}

function luhnDigit(base9: string) {
  let sum = 0;
  for (let index = 0; index < base9.length; index += 1) {
    let digit = Number(base9[base9.length - 1 - index]);
    if (index % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return String((10 - (sum % 10)) % 10);
}

function uniqueHcn(rng: Rng, province: PatientDraft['province'], family: string, used: Set<string>) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    let number = '';
    if (province === 'ON') {
      let base = '';
      for (let i = 0; i < 9; i += 1) base += rng.int(0, 9);
      number = `${base}${luhnDigit(base)}`;
    } else if (province === 'QC') {
      const letters = family.toUpperCase().replace(/[^A-Z]/g, '');
      const prefix = `${letters}XXXX`.slice(0, 4);
      let digits = '';
      for (let i = 0; i < 8; i += 1) digits += rng.int(0, 9);
      number = `${prefix}${digits}`;
    } else if (province === 'AB') {
      for (let i = 0; i < 9; i += 1) number += rng.int(0, 9);
    } else {
      for (let i = 0; i < 10; i += 1) number += rng.int(0, 9);
    }
    const key = `${province}:${number}`;
    if (used.has(key) || /^0+$/.test(number)) continue;
    used.add(key);
    return number;
  }
  throw new Error(`could not assign a ${province} health card`);
}

function phone(rng: Rng, city: string, used: Set<string>) {
  const area = city === 'Mississauga' ? rng.pick(['905', '289']) : city === 'Montreal' ? '514' : city === 'Vancouver' ? '604' : city === 'Calgary' ? '403' : rng.pick(['416', '647']);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const value = `(${area}) 555-${rng.int(2000, 8999)}`;
    if (!used.has(value)) {
      used.add(value);
      return value;
    }
  }
  const value = `(${area}) 555-${rng.int(2000, 8999)}`;
  used.add(value);
  return value;
}

function sampleAge(rng: Rng) {
  const roll = rng.rand();
  if (roll < 0.08) return rng.int(1, 17);
  if (roll < 0.3) return rng.int(18, 39);
  if (roll < 0.68) return rng.int(40, 64);
  if (roll < 0.92) return rng.int(65, 79);
  return rng.int(80, 96);
}

function bodySize(age: number, sex: PatientDraft['sex'], rng: Rng) {
  if (age < 12) {
    return {
      heightCm: Math.round((75 + age * 6.2) * 10) / 10,
      weightKg: Math.round((8 + age * 2.3) * 10) / 10,
    };
  }
  const heightCm = sex === 'male' ? rng.int(163, 193) : sex === 'female' ? rng.int(150, 178) : rng.int(155, 185);
  const bmi = age < 18 ? rng.int(17, 26) : rng.int(20, 36);
  const weightKg = Math.round(bmi * (heightCm / 100) ** 2 * 10) / 10;
  return { heightCm, weightKg: Math.min(180, Math.max(30, weightKg)) };
}

function cohortsFor(age: number, rng: Rng): Cohorts {
  const cohorts: Cohorts = { htn: false, dm: false, copd: false, hf: false, ckd: false };
  if (age < 18) {
    cohorts.dm = rng.chance(0.012);
    return cohorts;
  }
  if (age >= 40) cohorts.htn = rng.chance(age >= 65 ? 0.46 : 0.28);
  if (age >= 30) cohorts.dm = rng.chance(age >= 55 ? 0.2 : 0.07);
  if (age >= 45) cohorts.copd = rng.chance(age >= 65 ? 0.11 : 0.035);
  if (cohorts.dm && rng.chance(0.55)) cohorts.htn = true;
  if (cohorts.htn && age >= 60 && rng.chance(0.16)) cohorts.ckd = true;
  else if (age >= 55 && rng.chance(0.06)) cohorts.ckd = true;
  if ((cohorts.htn || cohorts.dm) && age >= 65 && rng.chance(0.07)) cohorts.hf = true;
  else if (age >= 70 && rng.chance(0.03)) cohorts.hf = true;
  return cohorts;
}

function peopleAt(staff: StaffMember[], role: Role, site: Site) {
  return staff.filter((person) => person.role === role && (person.site === site || (site === 'Toronto Main' && person.site === 'Virtual' && role === 'clinician')));
}

export async function buildStaff(now: Date) {
  const passwords = [...new Set(STAFF_SEEDS.map((person) => person.password))];
  const hashes = new Map<string, string>();
  for (const password of passwords) hashes.set(password, await bcrypt.hash(password, 10));
  return STAFF_SEEDS.map((person, index): StaffMember => {
    const createdAt = new Date(now.getTime() - (1400 - index * 18) * DAY_MS);
    const profileUpdated = index >= 3 && index < 23;
    return {
      _id: oid(),
      email: person.email,
      password: person.password,
      passwordHash: hashes.get(person.password)!,
      displayName: person.displayName,
      role: person.role,
      site: person.site,
      francophone: Boolean(person.francophone),
      createdAt,
      updatedAt: profileUpdated ? new Date(createdAt.getTime() + 40 * DAY_MS) : createdAt,
      _profileUpdated: profileUpdated,
    };
  });
}

export function buildPatients(rng: Rng, staff: StaffMember[], today: ClinicDay) {
  faker.seed(20261030);
  const byEmail = new Map(staff.map((person) => [person.email, person]));
  const requireStaff = (email: string) => {
    const person = byEmail.get(email);
    if (!person) throw new Error(`missing staff ${email}`);
    return person;
  };
  const cursors: Record<Site, { clinician: number; nurse: number; pharmacist: number; caregiver: number }> = {
    'Toronto Main': { clinician: 0, nurse: 0, pharmacist: 0, caregiver: 0 },
    'North York': { clinician: 0, nurse: 0, pharmacist: 0, caregiver: 0 },
    Mississauga: { clinician: 0, nurse: 0, pharmacist: 0, caregiver: 0 },
  };
  const nextPerson = (site: Site, role: Role, key: keyof (typeof cursors)[Site]) => {
    const list = peopleAt(staff, role, site).filter((person) => person.site !== 'Virtual' || role === 'clinician');
    const pool = role === 'clinician' ? peopleAt(staff, 'clinician', site) : list.filter((person) => person.site === site);
    if (pool.length === 0) throw new Error(`no ${role} at ${site}`);
    const person = pool[cursors[site][key] % pool.length]!;
    cursors[site][key] += 1;
    return person;
  };

  const usedCards = new Set(SHOWCASE.map((person) => `${person.province}:${person.hcn}`));
  const usedEmails = new Set(SHOWCASE.map((person) => person.email));
  const usedPhones = new Set<string>();
  const patients: PatientDraft[] = [];

  const pushShowcase = (index: number) => {
    const persona = SHOWCASE[index]!;
    const clinician = requireStaff(persona.clinicianEmail);
    const nurse = requireStaff(persona.nurseEmail);
    const extras = persona.extraCareTeam.map((email) => requireStaff(email)._id);
    const birthDate = new Date(`${persona.birthDate}T12:00:00.000Z`);
    const careTeam = [clinician._id, nurse._id, ...extras.filter((id) => String(id) !== String(clinician._id) && String(id) !== String(nurse._id))];
    const size = bodySize(ageOn(birthDate, today), persona.sex, rng);
    patients.push({
      _id: oid(),
      mrn: persona.mrn,
      givenName: persona.givenName,
      familyName: persona.familyName,
      preferredName: persona.preferredName,
      birthDate,
      age: ageOn(birthDate, today),
      language: persona.language,
      sex: persona.sex,
      genderIdentity: persona.genderIdentity,
      phone: persona.phone,
      email: persona.email,
      street: persona.street,
      city: persona.city,
      province: persona.province,
      postalCode: persona.postalCode,
      hcn: persona.hcn,
      versionCode: persona.versionCode,
      emergency: persona.emergency,
      sdm: persona.sdm,
      insurance: persona.insurance,
      nationalId: persona.nationalId,
      homeSite: persona.homeSite,
      outOfProvince: persona.province !== 'ON',
      clinicianId: clinician._id,
      nurseId: nurse._id,
      pharmacistId: careTeam.find((id) => staff.find((person) => String(person._id) === String(id))?.role === 'pharmacist'),
      caregiverId: careTeam.find((id) => staff.find((person) => String(person._id) === String(id))?.role === 'caregiver'),
      careTeam,
      cohorts: {
        htn: Boolean(persona.cohorts.htn),
        dm: Boolean(persona.cohorts.dm),
        copd: Boolean(persona.cohorts.copd),
        hf: Boolean(persona.cohorts.hf),
        ckd: Boolean(persona.cohorts.ckd),
      },
      heightCm: size.heightCm,
      weightKg: size.weightKg,
      showcase: true,
      forcedProblemCodes: persona.problemCodes,
      forcedAllergies: persona.allergySubstances,
      createdAt: new Date(0),
      updatedAt: new Date(0),
      _registeredKey: '',
    });
  };

  for (let index = 0; index < SHOWCASE.length; index += 1) pushShowcase(index);

  const generatedSites: Site[] = [];
  for (const plan of SITE_PLAN) {
    const already = patients.filter((patient) => patient.homeSite === plan.site).length;
    for (let count = already; count < plan.count; count += 1) generatedSites.push(plan.site);
  }
  if (patients.length + generatedSites.length !== 500) {
    throw new Error(`expected 500 patients, planned ${patients.length + generatedSites.length}`);
  }

  let qcLeft = 12;
  let bcLeft = 5;
  let abLeft = 5;
  for (const site of generatedSites) {
    const languageRoll = rng.rand();
    const language = languageRoll < 0.84 ? 'en' : languageRoll < 0.96 ? 'fr' : 'other';
    const sexRoll = rng.rand();
    const sex: PatientDraft['sex'] = sexRoll < 0.51 ? 'female' : sexRoll < 0.985 ? 'male' : sexRoll < 0.993 ? 'other' : 'unknown';
    let genderIdentity: PatientDraft['genderIdentity'] = sex === 'female' || sex === 'male' ? sex : 'unknown';
    if (sex === 'female' || sex === 'male') {
      const genderRoll = rng.rand();
      if (genderRoll >= 0.99) genderIdentity = 'prefer-not-to-say';
      else if (genderRoll >= 0.975) genderIdentity = 'two-spirit';
      else if (genderRoll >= 0.955) genderIdentity = 'non-binary';
      else if (genderRoll >= 0.94) genderIdentity = 'other';
    } else {
      genderIdentity = rng.pick(['non-binary', 'other', 'prefer-not-to-say', 'unknown']);
    }
    const givenName = language === 'fr'
      ? rng.pick(FR_GIVEN)
      : faker.person.firstName(sex === 'female' || sex === 'male' ? sex : undefined);
    const familyName = language === 'fr' ? rng.pick(FR_FAMILY) : faker.person.lastName();
    let city = site === 'North York' ? 'North York' : site === 'Mississauga' ? 'Mississauga' : 'Toronto';
    let province: PatientDraft['province'] = 'ON';
    if (site === 'Toronto Main' && qcLeft > 0 && rng.chance(0.08)) {
      province = 'QC';
      city = 'Montreal';
      qcLeft -= 1;
    } else if (site === 'Toronto Main' && bcLeft > 0 && rng.chance(0.04)) {
      province = 'BC';
      city = 'Vancouver';
      bcLeft -= 1;
    } else if (site === 'Toronto Main' && abLeft > 0 && rng.chance(0.04)) {
      province = 'AB';
      city = 'Calgary';
      abLeft -= 1;
    }
    const age = sampleAge(rng);
    const birthYear = today.y - age;
    const birthDate = new Date(Date.UTC(birthYear, rng.int(0, 11), rng.int(1, 28), 12));
    const sized = bodySize(ageOn(birthDate, today), sex, rng);
    const clinician = nextPerson(site, 'clinician', 'clinician');
    const nurse = nextPerson(site, 'nurse', 'nurse');
    const cohorts = cohortsFor(ageOn(birthDate, today), rng);
    const careTeam = [clinician._id, nurse._id];
    let pharmacistId: Types.ObjectId | undefined;
    let caregiverId: Types.ObjectId | undefined;
    const pharmacists = peopleAt(staff, 'pharmacist', site).filter((person) => person.site === site);
    const caregivers = peopleAt(staff, 'caregiver', site).filter((person) => person.site === site);
    if (pharmacists.length && (cohorts.htn || cohorts.dm || cohorts.hf || rng.chance(0.22))) {
      const pharmacist = pharmacists[cursors[site].pharmacist % pharmacists.length]!;
      cursors[site].pharmacist += 1;
      pharmacistId = pharmacist._id;
      careTeam.push(pharmacist._id);
    }
    if (caregivers.length && ageOn(birthDate, today) >= 75 && rng.chance(0.55)) {
      const caregiver = caregivers[cursors[site].caregiver % caregivers.length]!;
      cursors[site].caregiver += 1;
      caregiverId = caregiver._id;
      careTeam.push(caregiver._id);
    }
    const emailBase = `${slug(givenName)}.${slug(familyName)}`;
    let email = `${emailBase}@example.com`;
    let suffix = 2;
    while (usedEmails.has(email)) {
      email = `${emailBase}${suffix}@example.com`;
      suffix += 1;
    }
    usedEmails.add(email);
    const emergencyName = `${faker.person.firstName()} ${faker.person.lastName()}`;
    const patientPhone = phone(rng, city, usedPhones);
    const preferred = rng.chance(0.16) ? faker.person.firstName(sex === 'female' || sex === 'male' ? sex : undefined) : undefined;
    patients.push({
      _id: oid(),
      mrn: `MRN-${1000 + patients.length + 1}`,
      givenName,
      familyName,
      preferredName: preferred && preferred !== givenName ? preferred : undefined,
      birthDate,
      age: ageOn(birthDate, today),
      language,
      sex,
      genderIdentity,
      phone: patientPhone,
      email,
      street: `${rng.int(1, 240)} ${rng.pick(STREETS)}`,
      city,
      province,
      postalCode: postal(rng, city),
      hcn: uniqueHcn(rng, province, familyName, usedCards),
      versionCode: province === 'ON' ? `${String.fromCharCode(65 + rng.int(0, 25))}${String.fromCharCode(65 + rng.int(0, 25))}` : undefined,
      emergency: {
        name: emergencyName,
        relationship: rng.pick(RELATIONSHIPS),
        phone: phone(rng, city, usedPhones),
      },
      sdm: ageOn(birthDate, today) >= 80 && rng.chance(0.7)
        ? { name: emergencyName, relationship: 'child', phone: phone(rng, city, usedPhones) }
        : undefined,
      insurance: rng.chance(0.62) ? `INS-${rng.int(10000, 99999)}` : undefined,
      homeSite: site,
      outOfProvince: province !== 'ON',
      clinicianId: clinician._id,
      nurseId: nurse._id,
      pharmacistId,
      caregiverId,
      careTeam,
      cohorts,
      heightCm: sized.heightCm,
      weightKg: sized.weightKg,
      showcase: false,
      forcedProblemCodes: [],
      forcedAllergies: [],
      createdAt: new Date(0),
      updatedAt: new Date(0),
      _registeredKey: '',
    });
  }

  if (patients.length !== 500) throw new Error(`built ${patients.length} patients`);
  return patients;
}

export function createWorld(): Promise<World> {
  const rng = makeRng(20261030);
  const now = boardNow();
  const today = clinicToday(now);
  const days = clinicDays(today, 36, 28);
  return buildStaff(now).then((staff) => ({
    rng,
    now,
    today,
    days,
    calendar: new Calendar(),
    staff,
    patients: buildPatients(rng, staff, today),
    appointments: [],
    visits: [],
    conditions: [],
    diagnoses: [],
    encounters: [],
    medications: [],
    allergies: [],
    carePlans: [],
    goals: [],
    interventions: [],
    tasks: [],
    notes: [],
    vitals: [],
    audits: [],
  }));
}

export function staffNamed(world: World, email: string) {
  const person = world.staff.find((item) => item.email === email);
  if (!person) throw new Error(`missing ${email}`);
  return person;
}

export function cliniciansAt(world: World, site: Site) {
  return world.staff.filter((person) => person.role === 'clinician' && (person.site === site || (site === 'Toronto Main' && person.site === 'Virtual')));
}

export function nursesAt(world: World, site: Site) {
  return world.staff.filter((person) => person.role === 'nurse' && person.site === site);
}

export function roleAt(world: World, role: Role, site: Site) {
  return world.staff.filter((person) => person.role === role && person.site === site);
}
