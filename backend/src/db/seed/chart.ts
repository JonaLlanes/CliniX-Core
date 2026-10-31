import { Types } from 'mongoose';
import { complaintFor, fitsProblem, MEDICATIONS, PROBLEMS, type MedTemplate, type ProblemTemplate } from './catalog.js';
import { TASK_TITLES } from './catalog.js';
import { allocateExact, clamp } from './rng.js';
import { ICD10CA_PATTERN } from '../../types/diagnoses.js';
import {
  cliniciansAt,
  DAY_MS,
  oid,
  roleAt,
  type AllergyDraft,
  type CarePlanDraft,
  type ConditionDraft,
  type DiagnosisDraft,
  type EncounterDraft,
  type GoalDraft,
  type InterventionDraft,
  type MedicationDraft,
  type NoteDraft,
  type PatientDraft,
  type TaskDraft,
  type VisitDraft,
  type VitalDraft,
  type World,
} from './world.js';

const COHORT_CODE = {
  htn: 'I10',
  dm: 'E11.9',
  copd: 'J44.9',
  hf: 'I50.9',
  ckd: 'N18.3',
} as const;

function byCode(code: string) {
  const found = PROBLEMS.find((problem) => problem.code === code);
  if (!found) throw new Error(`missing problem template ${code}`);
  return found;
}

function ensureCount(counts: number[], index: number, needed: number, min: number) {
  if ((counts[index] ?? 0) >= needed) return;
  let deficit = needed - (counts[index] ?? 0);
  counts[index] = needed;
  while (deficit > 0) {
    let donor = -1;
    for (let cursor = 0; cursor < counts.length; cursor += 1) {
      if (cursor === index || (counts[cursor] ?? 0) <= min) continue;
      if (donor < 0 || (counts[cursor] ?? 0) > (counts[donor] ?? 0)) donor = cursor;
    }
    if (donor < 0) throw new Error('not enough room for required chart rows');
    counts[donor] = (counts[donor] ?? 0) - 1;
    deficit -= 1;
  }
}

function chartWeight(patient: PatientDraft) {
  const cohorts = Number(patient.cohorts.htn) + Number(patient.cohorts.dm) + Number(patient.cohorts.copd) + Number(patient.cohorts.hf) + Number(patient.cohorts.ckd);
  let weight = 0.8 + cohorts * 0.55;
  if (patient.showcase) weight += patient.mrn === 'MRN-1001' ? 2.4 : 1.3;
  if (patient.age >= 65) weight += 0.4;
  if (patient.age < 18) weight *= 0.45;
  return weight;
}

function between(world: World, start: Date, end: Date) {
  const from = start.getTime();
  const to = Math.min(end.getTime(), world.now.getTime() - 60 * 1000);
  if (to <= from) return new Date(from);
  return new Date(from + world.rng.rand() * (to - from));
}

function severityFor(world: World, problem: ProblemTemplate, patient: PatientDraft) {
  if (patient.mrn === 'MRN-1006' && problem.code === 'E11.9') return 'severe' as const;
  if (problem.cohort === 'hf' && world.rng.chance(0.45)) return 'severe' as const;
  const roll = world.rng.rand();
  if (roll < 0.08) return 'unknown' as const;
  if (roll < 0.42) return 'mild' as const;
  if (roll < 0.8) return 'moderate' as const;
  return 'severe' as const;
}

function buildConditions(world: World) {
  const counts = allocateExact(world.patients.length, 5000, 4, 22, (index) => chartWeight(world.patients[index]!));
  world.patients.forEach((patient, index) => {
    const required = patient.forcedProblemCodes.length;
    const cohortCodes = (Object.keys(COHORT_CODE) as (keyof typeof COHORT_CODE)[])
      .filter((key) => patient.cohorts[key])
      .map((key) => (key === 'dm' && patient.age < 25 ? 'E10.9' : COHORT_CODE[key]));
    ensureCount(counts, index, Math.max(4, required + cohortCodes.filter((code) => !patient.forcedProblemCodes.includes(code)).length), 4);
  });

  world.patients.forEach((patient, index) => {
    const target = counts[index] ?? 4;
    const chosen: ProblemTemplate[] = [];
    const used = new Set<string>();
    const add = (problem: ProblemTemplate | undefined) => {
      if (!problem || used.has(problem.code) || !fitsProblem(problem, patient.age, patient.sex)) return false;
      chosen.push(problem);
      used.add(problem.code);
      return true;
    };
    for (const code of patient.forcedProblemCodes) add(byCode(code));
    for (const key of Object.keys(COHORT_CODE) as (keyof typeof COHORT_CODE)[]) {
      if (!patient.cohorts[key]) continue;
      add(byCode(key === 'dm' && patient.age < 25 ? 'E10.9' : COHORT_CODE[key]));
    }
    const pool = PROBLEMS.filter((problem) => fitsProblem(problem, patient.age, patient.sex) && !used.has(problem.code));
    let guard = 0;
    while (chosen.length < target && pool.length > 0 && guard < 80) {
      guard += 1;
      const weights = pool.map((problem) => problem.weight);
      const total = weights.reduce((sum, weight) => sum + weight, 0);
      let roll = world.rng.rand() * total;
      let pickAt = 0;
      for (let cursor = 0; cursor < pool.length; cursor += 1) {
        roll -= weights[cursor] ?? 0;
        if (roll <= 0) {
          pickAt = cursor;
          break;
        }
      }
      const [picked] = pool.splice(pickAt, 1);
      if (picked) add(picked);
    }
    if (!chosen.some((problem) => problem.system === 'ICD-10-CA')) {
      const fallback = PROBLEMS.find((problem) => problem.system === 'ICD-10-CA' && fitsProblem(problem, patient.age, patient.sex) && !used.has(problem.code));
      if (fallback) add(fallback);
    }
    if (chosen.length < 4 || !chosen.some((problem) => problem.system === 'ICD-10-CA')) {
      throw new Error(`${patient.mrn} has ${chosen.length} problems and no usable ICD-10-CA code`);
    }
    while (chosen.length > target) chosen.pop();
    counts[index] = chosen.length;

    chosen.forEach((problem, problemIndex) => {
      const chronic = problem.chronic && problem.code !== 'J44.1' && problem.code !== 'J30.1';
      let status: ConditionDraft['status'] = chronic
        ? world.rng.chance(0.86) ? 'active' : world.rng.chance(0.5) ? 'inactive' : 'resolved'
        : world.rng.chance(0.72) ? 'resolved' : world.rng.chance(0.55) ? 'inactive' : 'active';
      if (problem.code === 'J30.1') status = 'resolved';
      if (problemIndex === 0 && patient.forcedProblemCodes.includes(problem.code) && problem.code !== 'J30.1') status = 'active';
      const onsetDate = between(
        world,
        new Date(Math.max(patient.birthDate.getTime() + 400 * DAY_MS, world.now.getTime() - 8 * 365 * DAY_MS)),
        new Date(world.now.getTime() - 20 * DAY_MS)
      );
      const resolvedDate = status === 'resolved'
        ? between(world, new Date(onsetDate.getTime() + 10 * DAY_MS), world.now)
        : null;
      const recorded = new Date(Math.max(onsetDate.getTime(), patient.createdAt.getTime()));
      world.conditions.push({
        _id: oid(),
        patientId: patient._id,
        display: problem.display,
        status,
        severity: severityFor(world, problem, patient),
        onsetDate,
        resolvedDate,
        clinicianOwner: patient.clinicianId,
        codeSystem: problem.system,
        code: problem.code,
        encounterCode: problem.encounterCode ?? problem.code,
        sourceDiagnosisId: null,
        deletedAt: null,
        createdAt: recorded,
        updatedAt: resolvedDate ?? recorded,
        _patientIndex: index,
        _primary: problemIndex === 0,
      });
    });
  });

  const deficit = 5000 - world.conditions.length;
  if (deficit !== 0) {
    const donors = world.patients
      .map((patient, index) => ({ index, room: 22 - world.conditions.filter((condition) => condition._patientIndex === index).length }))
      .filter((row) => row.room > 0)
      .sort((a, b) => b.room - a.room);
    let left = deficit;
    if (left < 0) throw new Error(`built ${world.conditions.length} conditions`);
    for (const donor of donors) {
      if (left <= 0) break;
      const patient = world.patients[donor.index]!;
      const used = new Set(world.conditions.filter((condition) => condition._patientIndex === donor.index).map((condition) => condition.code));
      const extra = PROBLEMS.find((problem) => !used.has(problem.code) && fitsProblem(problem, patient.age, patient.sex));
      if (!extra) continue;
      const onsetDate = between(world, patient.createdAt, world.now);
      world.conditions.push({
        _id: oid(),
        patientId: patient._id,
        display: extra.display,
        status: 'resolved',
        severity: 'mild',
        onsetDate,
        resolvedDate: between(world, new Date(onsetDate.getTime() + 7 * DAY_MS), world.now),
        clinicianOwner: patient.clinicianId,
        codeSystem: extra.system,
        code: extra.code,
        encounterCode: extra.encounterCode ?? extra.code,
        sourceDiagnosisId: null,
        deletedAt: null,
        createdAt: onsetDate,
        updatedAt: onsetDate,
        _patientIndex: donor.index,
        _primary: false,
      });
      left -= 1;
    }
    if (world.conditions.length !== 5000) throw new Error(`expected 5000 conditions, built ${world.conditions.length}`);
  }
}

function appointmentFor(world: World, visit: VisitDraft) {
  return world.appointments.find((appointment) => String(appointment._id) === String(visit.appointmentId));
}

function conditionsFor(world: World, index: number) {
  return world.conditions.filter((condition) => condition._patientIndex === index && !condition.deletedAt);
}

function makeEncounter(
  world: World,
  visit: VisitDraft,
  status: EncounterDraft['status'],
  anchor: boolean
): EncounterDraft {
  const patient = world.patients[visit._patientIndex]!;
  const appointment = appointmentFor(world, visit);
  if (!appointment) throw new Error(`visit ${String(visit._id)} has no appointment`);
  const provider = world.staff.find((person) => String(person._id) === String(appointment.providerId));
  const attending = provider?.role === 'clinician' ? appointment.providerId : patient.clinicianId;
  const problems = conditionsFor(world, visit._patientIndex);
  const primaryProblem = problems.find((condition) => condition._primary) ?? problems[0];
  if (!primaryProblem) throw new Error(`${patient.mrn} has no problem for an encounter`);
  const code = primaryProblem.encounterCode;
  if (!ICD10CA_PATTERN.test(code)) throw new Error(`bad encounter code ${code}`);
  const openedAt = visit.startedAt ?? visit.roomedAt ?? visit.arrivalAt ?? appointment.startTime;
  const signed = status === 'signed' || status === 'amended';
  const signedAt = signed
    ? new Date(Math.min(world.now.getTime() - 60 * 1000, Math.max(openedAt.getTime() + 15 * 60 * 1000, (visit.completedAt ?? openedAt).getTime())))
    : null;
  const french = patient.language === 'fr';
  const complaint = complaintFor(code, french);
  const complaintText = Array.isArray(complaint) ? world.rng.pick(complaint) : complaint;
  const colleagues = cliniciansAt(world, patient.homeSite).filter((person) => String(person._id) !== String(attending));
  const supervising = signed && colleagues.length > 0 && world.rng.chance(0.06) ? colleagues[0]!._id : null;
  const timeline: EncounterDraft['timeline'] = [{ event: 'opened', at: openedAt, actorId: attending, note: complaintText }];
  if (status !== 'open') timeline.push({ event: 'in_progress', at: new Date(openedAt.getTime() + 5 * 60 * 1000), actorId: attending });
  if (status === 'awaiting_signature' || signed) {
    timeline.push({ event: 'awaiting_signature', at: new Date(openedAt.getTime() + 20 * 60 * 1000), actorId: attending });
  }
  if (signed && signedAt) timeline.push({ event: 'signed', at: signedAt, actorId: attending });
  const encounter: EncounterDraft = {
    _id: oid(),
    patientId: patient._id,
    visitId: visit._id,
    appointmentId: appointment._id,
    attendingProviderId: attending,
    supervisingProviderId: supervising,
    clinicLocation: appointment.clinicLocation,
    appointmentType: appointment.appointmentType,
    chiefComplaint: complaintText.slice(0, 500),
    reasonForVisit: (french
      ? `${complaintText}. Revue du problème ${primaryProblem.display}.`
      : `${complaintText}. Review of ${primaryProblem.display}. Medications and home readings discussed.`
    ).slice(0, 1000),
    status,
    isCurrent: true,
    createdBy: attending,
    signedBy: signed ? attending : null,
    signedAt,
    openedAt,
    amendsEncounterId: null,
    timeline,
    deletedAt: null,
    createdAt: openedAt,
    updatedAt: signedAt ?? openedAt,
    _patientIndex: visit._patientIndex,
    _anchor: anchor,
    _primaryCode: code,
  };
  world.encounters.push(encounter);
  addDiagnosis(world, encounter, primaryProblem, true, signed ? 'final' : status === 'awaiting_signature' ? 'encounter' : 'working');
  if (signed && world.rng.chance(0.3)) {
    const secondary = problems.find((condition) => condition.code !== primaryProblem.code && condition.system === 'ICD-10-CA')
      ?? PROBLEMS.find((problem) => problem.system === 'ICD-10-CA' && problem.code !== code && !problem.chronic);
    if (secondary) {
      const template = 'display' in secondary && 'encounterCode' in secondary
        ? secondary
        : secondary;
      const description = 'display' in template ? template.display : primaryProblem.display;
      const secondaryCode = 'encounterCode' in template ? template.encounterCode : template.code;
      if (ICD10CA_PATTERN.test(secondaryCode) && secondaryCode !== code) {
        world.diagnoses.push({
          _id: oid(),
          encounterId: encounter._id,
          patientId: patient._id,
          code: secondaryCode.slice(0, 8),
          description: description.slice(0, 500),
          diagnosisType: 'encounter',
          primaryDiagnosis: false,
          recordedBy: attending,
          recordedAt: openedAt,
          promotedProblemId: null,
          promotion: null,
          promotedAt: null,
          promotedBy: null,
          deletedAt: null,
          createdAt: openedAt,
          updatedAt: openedAt,
        });
      }
    }
  }
  return encounter;
}

function addDiagnosis(
  world: World,
  encounter: EncounterDraft,
  problem: ConditionDraft,
  primary: boolean,
  diagnosisType: DiagnosisDraft['diagnosisType']
) {
  const diagnosis: DiagnosisDraft = {
    _id: oid(),
    encounterId: encounter._id,
    patientId: encounter.patientId,
    code: problem.encounterCode.slice(0, 8),
    description: problem.display.slice(0, 500),
    diagnosisType,
    primaryDiagnosis: primary,
    recordedBy: encounter.attendingProviderId,
    recordedAt: encounter.openedAt,
    promotedProblemId: null,
    promotion: null,
    promotedAt: null,
    promotedBy: null,
    deletedAt: null,
    createdAt: encounter.openedAt,
    updatedAt: encounter.openedAt,
  };
  if (primary && (encounter.status === 'signed' || encounter.status === 'amended') && !problem.sourceDiagnosisId) {
    diagnosis.promotedProblemId = problem._id;
    diagnosis.promotion = 'existing_problem';
    diagnosis.promotedAt = encounter.signedAt ?? encounter.openedAt;
    diagnosis.promotedBy = encounter.attendingProviderId;
    problem.sourceDiagnosisId = diagnosis._id;
  }
  world.diagnoses.push(diagnosis);
}

function buildEncounters(world: World) {
  const otherQueues = world.patients.map(() => [] as VisitDraft[]);
  const anchors: VisitDraft[] = [];
  for (const visit of world.visits) {
    if (visit.status !== 'completed') continue;
    if (visit._anchor === 'new') anchors.push(visit);
    else otherQueues[visit._patientIndex]!.push(visit);
  }
  if (anchors.length !== 500) throw new Error(`expected 500 registration visits, found ${anchors.length}`);
  const selected: { visit: VisitDraft; anchor: boolean }[] = anchors.map((visit) => ({ visit, anchor: true }));
  let added = 0;
  while (added < 3396) {
    let progressed = false;
    for (const queue of otherQueues) {
      const next = queue.shift();
      if (!next) continue;
      selected.push({ visit: next, anchor: false });
      added += 1;
      progressed = true;
      if (added >= 3396) break;
    }
    if (!progressed) break;
  }
  if (added !== 3396) throw new Error(`only found ${added} follow-up visits for encounters`);
  const signed = selected.map((item) => makeEncounter(world, item.visit, 'signed', item.anchor));
  const amendable = signed.filter((encounter) => !encounter._anchor);
  for (let index = 0; index < 80; index += 1) {
    const original = amendable[index];
    if (!original?.signedAt) throw new Error('cannot amend an unsigned encounter');
    const amendedAt = new Date(Math.min(world.now.getTime() - 60 * 1000, original.signedAt.getTime() + 2 * DAY_MS));
    original.status = 'amended';
    original.isCurrent = false;
    original.updatedAt = amendedAt;
    original.timeline = [...original.timeline, { event: 'amended', at: amendedAt, actorId: original.attendingProviderId, note: 'Addendum filed' }];
    const replacement: EncounterDraft = {
      ...original,
      _id: oid(),
      status: 'signed',
      isCurrent: true,
      amendsEncounterId: original._id,
      openedAt: amendedAt,
      signedAt: new Date(amendedAt.getTime() + 30 * 60 * 1000),
      signedBy: original.attendingProviderId,
      createdAt: amendedAt,
      updatedAt: new Date(amendedAt.getTime() + 30 * 60 * 1000),
      timeline: [
        { event: 'opened', at: amendedAt, actorId: original.attendingProviderId, note: 'Amendment' },
        { event: 'signed', at: new Date(amendedAt.getTime() + 30 * 60 * 1000), actorId: original.attendingProviderId },
      ],
      chiefComplaint: original.chiefComplaint,
      _anchor: false,
    };
    world.encounters.push(replacement);
    const problem = conditionsFor(world, original._patientIndex).find((condition) => condition.encounterCode === original._primaryCode);
    if (problem) addDiagnosis(world, replacement, problem, true, 'final');
  }
  const floor = {
    waiting: world.visits.filter((visit) => visit.status === 'waiting'),
    roomed: world.visits.filter((visit) => visit.status === 'roomed'),
    in_progress: world.visits.filter((visit) => visit.status === 'in_progress'),
  };
  for (const visit of floor.waiting.slice(0, 8)) makeEncounter(world, visit, 'open', false);
  for (const visit of floor.roomed.slice(0, 8)) makeEncounter(world, visit, 'in_progress', false);
  for (const visit of floor.in_progress.slice(0, 8)) makeEncounter(world, visit, 'awaiting_signature', false);
  if (world.encounters.length !== 4000) throw new Error(`expected 4000 encounters, built ${world.encounters.length}`);
}

function soap(patient: PatientDraft, encounter: EncounterDraft | undefined, version: number) {
  const french = patient.language === 'fr';
  const complaint = encounter?.chiefComplaint ?? (french ? 'Note de coordination' : 'Care coordination');
  const addendum = version > 1
    ? french
      ? `\nAddenda v${version} : précision ajoutée au plan, sans changement du motif.`
      : `\nAddendum v${version}: plan clarified. The reason for visit is unchanged.`
    : '';
  if (french) {
    return `Motif : ${complaint}\nS : Le patient se présente pour ${complaint.toLowerCase()}.\nO : Signes vitaux revus. Pas de détresse aiguë.\nA : ${complaint}.\nP : Poursuivre le plan, revoir au prochain rendez-vous.${addendum}`;
  }
  return `Reason for visit: ${complaint}\nS: Patient presents for ${complaint.toLowerCase()}. No new red-flag symptoms reported.\nO: Vitals reviewed. No acute distress.\nA: ${complaint}.\nP: Continue the current plan and review at the next visit.${addendum}`;
}

function buildNotes(world: World) {
  const current = world.encounters.filter((encounter) => encounter.isCurrent);
  for (const encounter of current) {
    const patient = world.patients[encounter._patientIndex]!;
    const createdAt = encounter.signedAt ?? encounter.openedAt;
    const noteId = oid();
    world.notes.push({
      _id: noteId,
      patientId: patient._id,
      encounterId: encounter._id,
      authorId: encounter.attendingProviderId,
      body: soap(patient, encounter, 1),
      version: 1,
      rootId: noteId,
      deletedAt: null,
      createdAt,
      updatedAt: createdAt,
      _patientIndex: encounter._patientIndex,
      _anchor: encounter._anchor,
      _extra: false,
    });
  }
  let extras = 0;
  while (extras < 1280) {
    const patient = world.patients[extras % world.patients.length]!;
    const encounter = world.rng.chance(0.55)
      ? world.encounters.find((item) => item._patientIndex === extras % world.patients.length && item.isCurrent)
      : undefined;
    const createdAt = between(world, patient.createdAt, world.now);
    const noteId = oid();
    world.notes.push({
      _id: noteId,
      patientId: patient._id,
      encounterId: encounter?._id,
      authorId: patient.nurseId,
      body: soap(patient, encounter, 1).replace('Reason for visit:', 'Nursing note:').replace('Motif :', 'Note infirmière :'),
      version: 1,
      rootId: noteId,
      deletedAt: null,
      createdAt,
      updatedAt: createdAt,
      _patientIndex: extras % world.patients.length,
      _anchor: false,
      _extra: true,
    });
    extras += 1;
  }
  const roots = world.notes.filter((note) => note.version === 1 && !note._extra);
  for (let index = 0; index < 2400; index += 1) {
    const root = roots[index % roots.length];
    if (!root) break;
    const patient = world.patients[root._patientIndex]!;
    const previous = world.notes.filter((note) => String(note.rootId) === String(root.rootId)).sort((a, b) => b.version - a.version)[0] ?? root;
    if (previous.version >= 2 && index >= 2000) continue;
    const version = previous.version + 1;
    if (version > 3) continue;
    const createdAt = new Date(Math.min(world.now.getTime() - 60 * 1000, previous.createdAt.getTime() + world.rng.int(1, 14) * DAY_MS));
    if (createdAt.getTime() <= previous.createdAt.getTime()) continue;
    world.notes.push({
      _id: oid(),
      patientId: root.patientId,
      encounterId: root.encounterId,
      authorId: root.authorId,
      body: soap(patient, world.encounters.find((encounter) => String(encounter._id) === String(root.encounterId)), version),
      version,
      rootId: root.rootId,
      deletedAt: null,
      createdAt,
      updatedAt: createdAt,
      _patientIndex: root._patientIndex,
      _anchor: false,
      _extra: false,
    });
  }
  const have = world.notes.length;
  if (have < 8000) {
    const fillerRoot = roots[0];
    if (!fillerRoot) throw new Error('no note root to extend');
    while (world.notes.length < 8000) {
      const patient = world.patients[world.notes.length % world.patients.length]!;
      const createdAt = between(world, patient.createdAt, world.now);
      const noteId = oid();
      world.notes.push({
        _id: noteId,
        patientId: patient._id,
        authorId: patient.nurseId,
        body: soap(patient, undefined, 1),
        version: 1,
        rootId: noteId,
        deletedAt: null,
        createdAt,
        updatedAt: createdAt,
        _patientIndex: world.notes.length % world.patients.length,
        _anchor: false,
        _extra: true,
      });
    }
  }
  if (world.notes.length > 8000) world.notes.length = 8000;
  if (world.notes.length !== 8000) throw new Error(`expected 8000 notes, built ${world.notes.length}`);
}

function buildAllergies(world: World) {
  const counts = allocateExact(world.patients.length, 1000, 0, 5, (index) => {
    const patient = world.patients[index]!;
    return patient.forcedAllergies.length > 0 ? 2.2 : patient.age > 60 ? 1.2 : 0.8;
  });
  world.patients.forEach((patient, index) => ensureCount(counts, index, patient.forcedAllergies.length, 0));
  const catalog = [
    { substance: 'penicillin', reactions: ['rash', 'hives', 'anaphylaxis'], allergyClass: 'penicillin' },
    { substance: 'sulfa', reactions: ['rash', 'fever'], allergyClass: 'sulfa' },
    { substance: 'naproxen', reactions: ['wheeze', 'hives'], allergyClass: 'nsaid' },
    { substance: 'ibuprofen', reactions: ['wheeze', 'angioedema'], allergyClass: 'nsaid' },
    { substance: 'codeine', reactions: ['nausea', 'itching'], allergyClass: 'opioid' },
    { substance: 'ramipril', reactions: ['cough', 'angioedema'], allergyClass: 'ace' },
    { substance: 'atorvastatin', reactions: ['muscle pain'], allergyClass: 'statin' },
    { substance: 'latex', reactions: ['contact rash', 'wheeze'] },
    { substance: 'peanut', reactions: ['hives', 'anaphylaxis'] },
    { substance: 'pollen', reactions: ['sneezing', 'itchy eyes'] },
    { substance: 'iodinated contrast', reactions: ['flushing', 'rash'], allergyClass: 'contrast' },
    { substance: 'shellfish', reactions: ['hives', 'swelling'] },
    { substance: 'erythromycin', reactions: ['nausea', 'rash'] },
    { substance: 'adhesive tape', reactions: ['contact dermatitis'] },
  ];
  world.patients.forEach((patient, index) => {
    const target = counts[index] ?? 0;
    const used = new Set<string>();
    const add = (substance: string) => {
      if (used.has(substance) || world.allergies.filter((allergy) => allergy._patientIndex === index).length >= target) return;
      const template = catalog.find((item) => item.substance === substance) ?? catalog[0]!;
      used.add(template.substance);
      const reaction = world.rng.pick(template.reactions);
      const recordedDate = between(world, patient.createdAt, world.now);
      world.allergies.push({
        _id: oid(),
        patientId: patient._id,
        substance: template.substance,
        reaction,
        severity: reaction === 'anaphylaxis' || reaction === 'angioedema' ? 'severe' : reaction === 'cough' ? 'mild' : world.rng.pick(['mild', 'moderate', 'moderate']),
        status: world.rng.chance(0.82) ? 'active' : 'inactive',
        recordedDate,
        deletedAt: null,
        createdAt: recordedDate,
        updatedAt: recordedDate,
        _patientIndex: index,
        _allergyClass: template.allergyClass,
      });
    };
    for (const substance of patient.forcedAllergies) add(substance);
    while (world.allergies.filter((allergy) => allergy._patientIndex === index).length < target) {
      add(world.rng.pick(catalog).substance);
    }
  });
  if (world.allergies.length !== 1000) throw new Error(`expected 1000 allergies, built ${world.allergies.length}`);
}

function matchingMeds(patientConditions: ConditionDraft[]) {
  const codes = patientConditions.map((condition) => condition.code);
  const matched = MEDICATIONS.filter((med) => med.prefixes.some((prefix) => prefix !== '*' && codes.some((code) => code.startsWith(prefix))));
  const general = MEDICATIONS.filter((med) => med.prefixes.includes('*'));
  return matched.length ? matched : general;
}

function buildMedications(world: World) {
  const counts = allocateExact(world.patients.length, 5000, 2, 18, (index) => chartWeight(world.patients[index]!));
  let acknowledgments = 0;
  world.patients.forEach((patient, index) => {
    const target = counts[index] ?? 2;
    const problems = conditionsFor(world, index);
    const allergies = world.allergies.filter((allergy) => allergy._patientIndex === index && allergy.status === 'active');
    const options = matchingMeds(problems);
    const encounters = world.encounters.filter((encounter) => encounter._patientIndex === index && encounter.isCurrent);
    let made = 0;
    let guard = 0;
    while (made < target && guard < 40) {
      guard += 1;
      const template: MedTemplate = options[made % options.length] ?? MEDICATIONS[0]!;
      const blocked = template.allergyClass
        ? allergies.find((allergy) => allergy._allergyClass === template.allergyClass)
        : undefined;
      const acknowledge = Boolean(blocked && acknowledgments < 40 && world.rng.chance(0.2));
      if (blocked && !acknowledge) {
        const alternative = options.find((med) => med.allergyClass !== template.allergyClass) ?? MEDICATIONS.find((med) => !med.allergyClass);
        if (!alternative) break;
        // fall through with a safe drug by recursing once via continue after swap
        const safe = alternative;
        pushMed(world, patient, index, safe, problems, encounters, undefined);
        made += 1;
        continue;
      }
      pushMed(world, patient, index, template, problems, encounters, acknowledge ? blocked : undefined);
      if (acknowledge) acknowledgments += 1;
      made += 1;
    }
    while (world.medications.filter((med) => med._patientIndex === index).length < target) {
      const safe = MEDICATIONS.find((med) => med.genericName === 'vitamin D')!;
      pushMed(world, patient, index, safe, problems, encounters, undefined);
    }
  });
  if (world.medications.length !== 5000) throw new Error(`expected 5000 medications, built ${world.medications.length}`);
}

function pushMed(
  world: World,
  patient: PatientDraft,
  index: number,
  template: MedTemplate,
  problems: ConditionDraft[],
  encounters: EncounterDraft[],
  allergy?: AllergyDraft
) {
  const linked = problems.find((condition) => template.prefixes.some((prefix) => prefix !== '*' && condition.code.startsWith(prefix)));
  const course = template.genericName === 'amoxicillin' || template.genericName === 'nitrofurantoin';
  const startDate = between(world, new Date(Math.max(patient.createdAt.getTime(), (linked?.onsetDate ?? patient.createdAt).getTime())), world.now);
  let status: MedicationDraft['status'] = course
    ? 'completed'
    : world.rng.chance(0.58) ? 'active' : world.rng.chance(0.45) ? 'discontinued' : world.rng.chance(0.5) ? 'on-hold' : 'completed';
  if (startDate.getTime() > world.now.getTime() - 14 * DAY_MS && status !== 'active') status = 'active';
  const endDate = status === 'active' || status === 'on-hold'
    ? null
    : between(world, new Date(startDate.getTime() + (course ? 7 : 20) * DAY_MS), world.now);
  const prescriber = patient.pharmacistId && world.rng.chance(0.3) ? patient.pharmacistId : patient.clinicianId;
  const encounter = encounters.find((item) => Math.abs(item.openedAt.getTime() - startDate.getTime()) < 21 * DAY_MS);
  const events: MedicationDraft['events'] = [
    { action: 'started', at: startDate, clinicianId: prescriber, summary: `Started ${template.genericName} ${template.strength}` },
  ];
  if (status === 'active' && world.rng.chance(0.18)) {
    events.push({
      action: 'changed',
      at: between(world, new Date(startDate.getTime() + 14 * DAY_MS), world.now),
      clinicianId: prescriber,
      reason: 'Dose titrated after home readings',
      summary: `${template.genericName} dose reviewed`,
    });
  }
  if (status === 'on-hold' && endDate == null) {
    events.push({ action: 'held', at: between(world, startDate, world.now), clinicianId: prescriber, reason: 'Held pending labs' });
  }
  if (status === 'discontinued' && endDate) {
    events.push({ action: 'discontinued', at: endDate, clinicianId: prescriber, reason: 'No longer indicated' });
  }
  if (status === 'completed' && endDate) {
    events.push({ action: 'completed', at: endDate, clinicianId: prescriber, summary: 'Course completed' });
  }
  const createdAt = startDate;
  world.medications.push({
    _id: oid(),
    patientId: patient._id,
    encounterId: encounter?._id ?? null,
    conditionId: linked?._id ?? null,
    din: template.din,
    genericName: template.genericName,
    brandName: template.brandName,
    strength: template.strength,
    dosage: template.dosage,
    route: template.route,
    frequency: template.frequency,
    indication: linked?.display,
    startDate,
    endDate,
    prescribedBy: prescriber,
    status,
    events,
    allergyAcknowledgments: allergy
      ? [{
          at: startDate,
          clinicianId: prescriber,
          warnings: [{
            allergyId: allergy._id,
            substance: allergy.substance,
            reaction: allergy.reaction,
            severity: allergy.severity,
            matchedOn: allergy._allergyClass ?? allergy.substance,
          }],
        }]
      : [],
    adherenceNotes: status === 'active' && world.rng.chance(0.35)
      ? world.rng.pick(['Takes as directed', 'Misses occasional evening doses', 'Uses a blister pack', 'Caregiver sets up the weekly tray'])
      : undefined,
    deletedAt: null,
    createdAt,
    updatedAt: endDate ?? events[events.length - 1]!.at,
    _patientIndex: index,
  });
}

function buildCarePlans(world: World) {
  const counts = allocateExact(world.patients.length, 1000, 1, 4, (index) => chartWeight(world.patients[index]!));
  world.patients.forEach((patient, index) => {
    const problems = conditionsFor(world, index);
    const primary = problems.find((condition) => condition._primary) ?? problems[0]!;
    const encounter = world.encounters.find((item) => item._patientIndex === index && item._anchor && item.isCurrent)
      ?? world.encounters.find((item) => item._patientIndex === index && item.isCurrent);
    const target = counts[index] ?? 1;
    for (let planIndex = 0; planIndex < target; planIndex += 1) {
      const problem = problems[planIndex % problems.length] ?? primary;
      const startDate = encounter?.openedAt ?? patient.createdAt;
      const primaryPlan = planIndex === 0;
      let status: CarePlanDraft['status'] = primaryPlan
        ? problem.status === 'active' ? 'active' : 'completed'
        : world.rng.pick(['active', 'active', 'active', 'completed', 'on_hold', 'draft', 'cancelled']);
      if (!primaryPlan && status === 'cancelled' && world.rng.chance(0.5)) status = 'active';
      const targetDate = new Date(startDate.getTime() + 180 * DAY_MS);
      const completedDate = status === 'completed' ? between(world, new Date(startDate.getTime() + 30 * DAY_MS), world.now) : null;
      const planId = oid();
      const title = `${problem.display} care plan`.slice(0, 200);
      world.carePlans.push({
        _id: planId,
        patientId: patient._id,
        primaryDiagnosisId: problem._id,
        primaryDiagnosisKind: 'problem',
        problemIds: [problem._id],
        encounterDiagnosisIds: [],
        encounterId: encounter?._id ?? null,
        title,
        description: patient.language === 'fr'
          ? `Plan de soins pour ${problem.display}. Objectifs revus avec le patient à ${patient.homeSite}.`
          : `Longitudinal plan for ${problem.display} at ${patient.homeSite}. Goals, teaching, and follow-up are tracked with the care team.`,
        status,
        startDate,
        targetDate,
        completedDate,
        ownerClinicianId: patient.clinicianId,
        progress: status === 'active' || status === 'completed'
          ? [{
              authorId: patient.clinicianId,
              at: between(world, startDate, completedDate ?? world.now),
              note: patient.language === 'fr' ? 'Progrès revu en clinique.' : 'Progress reviewed in clinic. Patient agrees with the current goals.',
            }]
          : [],
        deletedAt: null,
        createdAt: startDate,
        updatedAt: completedDate ?? startDate,
        _patientIndex: index,
        _primary: primaryPlan,
      });
      const goalStatus: GoalDraft['status'] = status === 'completed' ? 'achieved' : status === 'cancelled' ? 'cancelled' : status === 'draft' ? 'not_started' : 'in_progress';
      const goals = patient.cohorts.htn
        ? [{ description: 'Home blood pressure at target', target: '<130/80' }, { description: 'Record home blood pressure four days a week', target: '4 days/week' }]
        : patient.cohorts.dm
          ? [{ description: 'A1C at target', target: '<7.0%' }, { description: 'Attend diabetes teaching', target: '1 session' }]
          : [{ description: `Stabilize ${problem.display}`, target: 'next review' }, { description: 'Complete the agreed follow-up', target: '1 visit' }];
      for (const goal of goals) {
        world.goals.push({
          _id: oid(),
          carePlanId: planId,
          patientId: patient._id,
          description: goal.description,
          targetValue: goal.target,
          targetDate,
          status: goalStatus,
          achievedAt: goalStatus === 'achieved' ? completedDate : null,
          deletedAt: null,
          createdAt: startDate,
          updatedAt: completedDate ?? startDate,
        });
      }
      const interventions: { description: string; role: InterventionDraft['assignedRole'] }[] = [
        { description: 'Education: review the condition, warning symptoms, and when to call the clinic', role: 'nurse' },
        { description: problem.cohort ? 'Medication change: review dose and adherence with the prescriber' : 'Follow-up: book the next visit before the patient leaves', role: problem.cohort ? 'pharmacist' : 'clinician' },
      ];
      if (!patient.pharmacistId && interventions[1]?.role === 'pharmacist') interventions[1].role = 'clinician';
      for (const intervention of interventions) {
        const interventionStatus: InterventionDraft['status'] = status === 'completed' ? 'completed' : status === 'cancelled' ? 'cancelled' : status === 'draft' ? 'planned' : 'active';
        world.interventions.push({
          _id: oid(),
          carePlanId: planId,
          patientId: patient._id,
          description: intervention.description,
          assignedRole: intervention.role,
          dueDate: targetDate,
          status: interventionStatus,
          completedAt: interventionStatus === 'completed' ? completedDate : null,
          deletedAt: null,
          createdAt: startDate,
          updatedAt: completedDate ?? startDate,
        });
      }
    }
  });
  if (world.carePlans.length !== 1000) throw new Error(`expected 1000 care plans, built ${world.carePlans.length}`);
}

function buildTasks(world: World) {
  const counts = allocateExact(world.patients.length, 5000, 4, 24, (index) => chartWeight(world.patients[index]!));
  const roles = ['nurse', 'clinician', 'pharmacist', 'caregiver'] as const;
  world.patients.forEach((patient, index) => {
    const plans = world.carePlans.filter((plan) => plan._patientIndex === index && plan._primary);
    const target = counts[index] ?? 4;
    for (let taskIndex = 0; taskIndex < target; taskIndex += 1) {
      const role = roles[taskIndex % roles.length]!;
      const sitePeople = roleAt(world, role, patient.homeSite);
      const assignee = role === 'clinician'
        ? patient.clinicianId
        : role === 'nurse'
          ? patient.nurseId
          : role === 'pharmacist'
            ? patient.pharmacistId ?? sitePeople[0]?._id
            : patient.caregiverId ?? sitePeople[0]?._id;
      const statusRoll = world.rng.rand();
      const status: TaskDraft['status'] = statusRoll < 0.42 ? 'completed' : statusRoll < 0.62 ? 'in_progress' : 'pending';
      const dueDate = status === 'completed'
        ? between(world, patient.createdAt, world.now)
        : status === 'pending' && world.rng.chance(0.28)
          ? new Date(world.now.getTime() - world.rng.int(2, 40) * DAY_MS)
          : new Date(world.now.getTime() + world.rng.int(2, 60) * DAY_MS);
      const createdAt = new Date(Math.min(dueDate.getTime(), world.now.getTime()) - world.rng.int(1, 10) * DAY_MS);
      world.tasks.push({
        _id: oid(),
        patientId: patient._id,
        carePlanId: taskIndex % 10 < 7 ? plans[0]?._id : undefined,
        title: TASK_TITLES[taskIndex % TASK_TITLES.length]!,
        assigneeRole: role,
        assigneeUserId: assignee,
        status,
        dueDate,
        deletedAt: null,
        createdAt: createdAt.getTime() < patient.createdAt.getTime() ? patient.createdAt : createdAt,
        updatedAt: status === 'completed' ? dueDate : createdAt,
        _patientIndex: index,
      });
    }
  });
  if (world.tasks.length !== 5000) throw new Error(`expected 5000 tasks, built ${world.tasks.length}`);
}

function bpFor(world: World, patient: PatientDraft, at: Date) {
  const monthsAgo = (world.now.getTime() - at.getTime()) / (30 * DAY_MS);
  const uncontrolled = patient.cohorts.htn ? world.rng.chance(monthsAgo > 3 ? 0.55 : 0.3) : world.rng.chance(0.05);
  let systolic = uncontrolled ? world.rng.int(142, 178) : world.rng.int(108, 132);
  let diastolic = uncontrolled ? world.rng.int(86, 102) : world.rng.int(66, 82);
  if (patient.cohorts.hf && world.rng.chance(0.06)) {
    systolic = world.rng.int(86, 104);
    diastolic = world.rng.int(52, 64);
  }
  diastolic = clamp(Math.min(diastolic, systolic - 28), 40, 110);
  systolic = clamp(systolic, 86, 190);
  if (diastolic >= systolic) diastolic = systolic - 30;
  return { systolicBp: systolic, diastolicBp: diastolic };
}

function buildVitals(world: World) {
  const counts = allocateExact(world.patients.length, 15000, 12, 70, (index) => {
    const patient = world.patients[index]!;
    return chartWeight(patient) + (patient.cohorts.htn || patient.cohorts.dm ? 0.4 : 0);
  });
  let corrections = 0;
  world.patients.forEach((patient, index) => {
    const target = counts[index] ?? 12;
    const visits = world.visits.filter((visit) => visit._patientIndex === index && visit.arrivalAt && visit.status !== 'no_show' && visit.status !== 'cancelled');
    const clinicTarget = Math.min(visits.length, Math.max(1, Math.round(target * 0.45)));
    const used = new Set<number>();
    const push = (effectiveAt: Date, source: VitalDraft['source'], full: boolean) => {
      const key = effectiveAt.getTime();
      if (key > world.now.getTime() || used.has(key)) return false;
      used.add(key);
      const bp = bpFor(world, patient, effectiveAt);
      const fever = world.rng.chance(0.03);
      const heartRate = clamp(world.rng.int(patient.cohorts.hf ? 62 : 56, fever ? 118 : 96), 48, 140);
      const measurements: VitalDraft['measurements'] = { ...bp, heartRate };
      if (full || source === 'clinic') {
        measurements.respiratoryRate = clamp(world.rng.int(patient.cohorts.copd ? 16 : 12, patient.cohorts.copd ? 26 : 20), 10, 32);
        measurements.temperatureC = Math.round((fever ? world.rng.int(378, 392) / 10 : 36.2 + world.rng.rand() * 0.8) * 10) / 10;
        measurements.spo2 = patient.cohorts.copd || patient.cohorts.hf
          ? world.rng.chance(0.24) ? world.rng.int(88, 91) : world.rng.int(92, 97)
          : world.rng.int(96, 100);
        measurements.weightKg = Math.round(clamp(patient.weightKg + world.rng.int(-3, 3) + (patient.cohorts.hf ? world.rng.int(-1, 2) : 0), 8, 180) * 10) / 10;
        if (world.rng.chance(0.28)) measurements.heightCm = patient.heightCm;
      }
      const vital: VitalDraft = {
        _id: oid(),
        patientId: patient._id,
        effectiveAt,
        source,
        measurements,
        deletedAt: null,
        createdAt: effectiveAt,
        updatedAt: effectiveAt,
        _patientIndex: index,
      };
      if (corrections < 250 && measurements.systolicBp && world.rng.chance(0.04)) {
        vital._previousSystolic = measurements.systolicBp + world.rng.pick([-4, -2, 2, 4]);
        vital.updatedAt = new Date(effectiveAt.getTime() + 60 * 60 * 1000);
        corrections += 1;
      }
      world.vitals.push(vital);
      return true;
    };
    for (const visit of visits.slice(0, clinicTarget)) {
      const at = visit.startedAt ?? visit.arrivalAt;
      if (at) push(at, 'clinic', true);
    }
    let guard = 0;
    while (world.vitals.filter((vital) => vital._patientIndex === index).length < target && guard < target * 3) {
      guard += 1;
      const at = between(world, patient.createdAt, world.now);
      const source = patient.caregiverId && world.rng.chance(0.18)
        ? 'caregiver'
        : world.rng.chance(0.35) ? 'device' : 'home';
      push(at, source, false);
    }
  });
  while (corrections < 250) {
    const vital = world.vitals.find((item) => item.measurements.systolicBp && item._previousSystolic == null && !item.deletedAt);
    if (!vital?.measurements.systolicBp) break;
    vital._previousSystolic = vital.measurements.systolicBp + 2;
    vital.updatedAt = new Date(vital.effectiveAt.getTime() + 60 * 60 * 1000);
    corrections += 1;
  }
  if (world.vitals.length !== 15000) throw new Error(`expected 15000 vitals, built ${world.vitals.length}`);
}

function stampDelete<T extends { deletedAt: Date | null; updatedAt: Date; createdAt: Date }>(rows: T[], count: number, when: Date) {
  for (const row of rows.slice(0, count)) {
    row.deletedAt = when;
    row.updatedAt = when;
  }
  if (rows.length < count) throw new Error(`not enough rows to soft-delete (${rows.length} < ${count})`);
}

export function buildChart(world: World) {
  buildConditions(world);
  buildEncounters(world);
  buildNotes(world);
  buildAllergies(world);
  buildMedications(world);
  buildCarePlans(world);
  buildTasks(world);
  buildVitals(world);
  const yesterday = new Date(world.now.getTime() - DAY_MS);
  stampDelete(world.appointments.filter((appointment) => appointment._kind === 'cancel_none' && appointment._anchor == null && appointment.startTime < yesterday), 60, yesterday);
  stampDelete(world.visits.filter((visit) => visit.status === 'no_show' && visit._anchor == null && (visit.createdAt ?? world.now) < yesterday), 40, yesterday);
  stampDelete(world.encounters.filter((encounter) => encounter.isCurrent && !encounter._anchor && encounter.status === 'signed' && !encounter.amendsEncounterId), 24, yesterday);
  stampDelete(world.notes.filter((note) => note._extra && note.version === 1), 40, yesterday);
  stampDelete(world.conditions.filter((condition) => !condition._primary), 60, yesterday);
  stampDelete(world.allergies.filter((allergy) => allergy.status === 'inactive').concat(world.allergies.filter((allergy) => allergy.status === 'active')), 30, yesterday);
  const extraPlans = world.carePlans.filter((plan) => !plan._primary);
  stampDelete(extraPlans, 16, yesterday);
  const deletedPlans = new Set(extraPlans.slice(0, 16).map((plan) => String(plan._id)));
  for (const goal of world.goals) if (deletedPlans.has(String(goal.carePlanId))) goal.deletedAt = yesterday;
  for (const intervention of world.interventions) if (deletedPlans.has(String(intervention.carePlanId))) intervention.deletedAt = yesterday;
  stampDelete(world.tasks.filter((task) => task.status !== 'pending'), 50, yesterday);
  stampDelete(world.vitals.filter((vital) => vital._previousSystolic == null), 40, yesterday);
}

void Types;
