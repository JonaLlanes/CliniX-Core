import { ICD10CA_PATTERN } from '../../types/diagnoses.js';
import { EXAM_ROOMS, appointmentStatusForVisit } from '../../types/visits.js';
import { sid, type World } from './world.js';

function fail(message: string): never {
  throw new Error(message);
}

function expectCount(label: string, actual: number, expected: number) {
  if (actual !== expected) fail(`expected ${expected} ${label}, built ${actual}`);
}

function overlaps(rows: { id: string; start: number; end: number }[]) {
  const sorted = rows.slice().sort((a, b) => a.start - b.start);
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index]!.start < sorted[index - 1]!.end) {
      return `${sorted[index - 1]!.id} overlaps ${sorted[index]!.id}`;
    }
  }
  return null;
}

export function assertWorld(world: World) {
  expectCount('users', world.staff.length, 35);
  expectCount('patients', world.patients.length, 500);
  expectCount('conditions', world.conditions.length, 5000);
  expectCount('vitals', world.vitals.length, 15000);
  expectCount('medications', world.medications.length, 5000);
  expectCount('encounters', world.encounters.length, 4000);
  expectCount('clinical notes', world.notes.length, 8000);
  expectCount('care plans', world.carePlans.length, 1000);
  expectCount('tasks', world.tasks.length, 5000);
  expectCount('allergies', world.allergies.length, 1000);
  expectCount('appointments', world.appointments.length, 8000);
  expectCount('visits', world.visits.length, 7000);
  expectCount('audit events', world.audits.length, 40000);

  const staff = new Set(world.staff.map((person) => sid(person._id)));
  const patients = new Set(world.patients.map((patient) => sid(patient._id)));
  const appointments = new Set(world.appointments.map((item) => sid(item._id)));
  const visits = new Set(world.visits.map((item) => sid(item._id)));
  const conditions = new Set(world.conditions.map((item) => sid(item._id)));
  const encounters = new Set(world.encounters.map((item) => sid(item._id)));
  const diagnoses = new Set(world.diagnoses.map((item) => sid(item._id)));
  const allergies = new Set(world.allergies.map((item) => sid(item._id)));
  const plans = new Set(world.carePlans.map((item) => sid(item._id)));
  const notes = new Set(world.notes.map((item) => sid(item._id)));

  const requireId = (set: Set<string>, id: { toString(): string } | null | undefined, label: string) => {
    if (id && !set.has(String(id))) fail(`${label} references missing ${String(id)}`);
  };

  for (const patient of world.patients) {
    if (!staff.has(sid(patient.clinicianId)) || !staff.has(sid(patient.nurseId))) {
      fail(`${patient.mrn} care team is incomplete`);
    }
    for (const member of patient.careTeam) requireId(staff, member, patient.mrn);
    if (!/^[A-Z]\d[A-Z] \d[A-Z]\d$/.test(patient.postalCode.toUpperCase())) {
      fail(`${patient.mrn} postal code ${patient.postalCode}`);
    }
    if (patient.province === 'ON' && !/^[A-Z]{2}$/.test(patient.versionCode ?? '')) {
      fail(`${patient.mrn} is missing an Ontario version code`);
    }
  }

  const mrns = new Set(world.patients.map((patient) => patient.mrn));
  if (mrns.size !== world.patients.length) fail('duplicate MRNs');
  const cards = new Set(world.patients.map((patient) => `${patient.province}:${patient.hcn}`));
  if (cards.size !== world.patients.length) fail('duplicate health cards');

  const occupying = new Set(['booked', 'confirmed', 'arrived', 'completed']);
  const byProvider = new Map<string, { id: string; start: number; end: number }[]>();
  const byPatient = new Map<string, { id: string; start: number; end: number }[]>();
  const locations = new Set<string>();
  let noShow = 0;
  let cancelled = 0;
  for (const appointment of world.appointments) {
    requireId(patients, appointment.patientId, 'appointment');
    requireId(staff, appointment.providerId, 'appointment');
    const minutes = (appointment.endTime.getTime() - appointment.startTime.getTime()) / 60000;
    if (minutes < 5 || minutes > 8 * 60) fail(`appointment duration ${minutes} minutes`);
    locations.add(appointment.clinicLocation);
    if (appointment.status === 'no_show') noShow += 1;
    if (appointment.status === 'cancelled') cancelled += 1;
    if (appointment.status === 'cancelled' && !appointment.cancelReason) fail('cancelled appointment has no reason');
    if (appointment.deletedAt || !occupying.has(appointment.status)) continue;
    const span = { id: sid(appointment._id), start: appointment.startTime.getTime(), end: appointment.endTime.getTime() };
    const providerKey = sid(appointment.providerId);
    const patientKey = sid(appointment.patientId);
    byProvider.set(providerKey, [...(byProvider.get(providerKey) ?? []), span]);
    byPatient.set(patientKey, [...(byPatient.get(patientKey) ?? []), span]);
  }
  for (const [id, rows] of byProvider) {
    const hit = overlaps(rows);
    if (hit) fail(`provider ${id} double-booked (${hit})`);
  }
  for (const [id, rows] of byPatient) {
    const hit = overlaps(rows);
    if (hit) fail(`patient ${id} double-booked (${hit})`);
  }
  for (const site of ['Toronto Main', 'North York', 'Mississauga', 'Virtual']) {
    if (!locations.has(site)) fail(`no appointments at ${site}`);
  }
  if (noShow < 100) fail(`only ${noShow} no-shows`);
  if (cancelled < 100) fail(`only ${cancelled} cancellations`);

  const visitAppointment = new Set<string>();
  for (const visit of world.visits) {
    requireId(appointments, visit.appointmentId, 'visit');
    requireId(patients, visit.patientId, 'visit');
    requireId(staff, visit.providerId, 'visit');
    const key = sid(visit.appointmentId);
    if (!visit.deletedAt && visitAppointment.has(key)) fail('two active visits share an appointment');
    if (!visit.deletedAt) visitAppointment.add(key);
    const appointment = world.appointments.find((item) => sid(item._id) === key);
    if (appointment && appointmentStatusForVisit(visit.status) !== appointment.status) {
      fail(`visit ${visit.status} does not match appointment ${appointment.status}`);
    }
    if (visit.examRoom && !EXAM_ROOMS[visit._location].includes(visit.examRoom)) {
      fail(`exam room ${visit.examRoom} is not valid at ${visit._location}`);
    }
    let previous = 0;
    for (const event of visit.timeline) {
      const at = event.at.getTime();
      if (at < previous) fail('visit timeline is out of order');
      previous = at;
      requireId(staff, event.actorId, 'visit timeline');
    }
    if (visit.status === 'completed' && visit.timeline.length < 5) fail('completed visit is missing timeline steps');
    if ((visit.status === 'waiting' || visit.status === 'roomed' || visit.status === 'in_progress' || visit.status === 'completed') && !visit.demographicsVerified) {
      fail('checked-in visit is missing demographic verification');
    }
  }

  const currentByVisit = new Map<string, number>();
  for (const encounter of world.encounters) {
    requireId(patients, encounter.patientId, 'encounter');
    requireId(visits, encounter.visitId, 'encounter');
    requireId(appointments, encounter.appointmentId, 'encounter');
    requireId(staff, encounter.attendingProviderId, 'encounter');
    if (!encounter.deletedAt && encounter.isCurrent) {
      const key = sid(encounter.visitId);
      currentByVisit.set(key, (currentByVisit.get(key) ?? 0) + 1);
    }
    if (encounter.chiefComplaint.length > 500 || encounter.reasonForVisit.length > 1000) fail('encounter text is too long');
    if (encounter.signedAt && encounter.signedAt < encounter.openedAt) fail('encounter signed before it opened');
  }
  for (const [visitId, count] of currentByVisit) {
    if (count > 1) fail(`visit ${visitId} has ${count} current encounters`);
  }

  for (const diagnosis of world.diagnoses) {
    requireId(encounters, diagnosis.encounterId, 'diagnosis');
    requireId(patients, diagnosis.patientId, 'diagnosis');
    requireId(staff, diagnosis.recordedBy, 'diagnosis');
    if (diagnosis.promotedProblemId) requireId(conditions, diagnosis.promotedProblemId, 'diagnosis');
    if (!ICD10CA_PATTERN.test(diagnosis.code) || diagnosis.code.length > 8) fail(`diagnosis code ${diagnosis.code}`);
  }
  const primaryByEncounter = new Map<string, number>();
  for (const diagnosis of world.diagnoses) {
    if (!diagnosis.deletedAt && diagnosis.primaryDiagnosis) {
      const key = sid(diagnosis.encounterId);
      primaryByEncounter.set(key, (primaryByEncounter.get(key) ?? 0) + 1);
    }
  }
  for (const [encounterId, count] of primaryByEncounter) {
    if (count > 1) fail(`encounter ${encounterId} has ${count} primary diagnoses`);
  }

  for (const condition of world.conditions) {
    requireId(patients, condition.patientId, 'condition');
    requireId(staff, condition.clinicianOwner, 'condition');
    if (condition.sourceDiagnosisId) requireId(diagnoses, condition.sourceDiagnosisId, 'condition');
    if (condition.codeSystem === 'ICD-10-CA' && !ICD10CA_PATTERN.test(condition.code)) fail(`condition code ${condition.code}`);
  }
  const icd = world.conditions.filter((condition) => condition.codeSystem === 'ICD-10-CA').length;
  if (icd < 4000) fail(`only ${icd} ICD-10-CA conditions`);

  for (const medication of world.medications) {
    requireId(patients, medication.patientId, 'medication');
    requireId(staff, medication.prescribedBy, 'medication');
    if (medication.encounterId) requireId(encounters, medication.encounterId, 'medication');
    if (medication.conditionId) requireId(conditions, medication.conditionId, 'medication');
    if (medication.din && !/^\d{8}$/.test(medication.din)) fail(`DIN ${medication.din}`);
    if (medication.endDate && medication.endDate < medication.startDate) fail('medication ends before it starts');
    for (const warning of medication.allergyAcknowledgments.flatMap((item) => item.warnings)) {
      requireId(allergies, warning.allergyId, 'medication allergy acknowledgment');
    }
  }

  for (const note of world.notes) {
    requireId(patients, note.patientId, 'note');
    requireId(staff, note.authorId, 'note');
    if (note.encounterId) requireId(encounters, note.encounterId, 'note');
    if (!notes.has(sid(note.rootId)) && sid(note.rootId) !== sid(note._id)) {
      const root = world.notes.some((item) => sid(item._id) === sid(note.rootId) || sid(item.rootId) === sid(note.rootId));
      if (!root) fail('note revision has no root');
    }
    if (!note.body.trim()) fail('empty clinical note');
  }

  for (const plan of world.carePlans) {
    requireId(patients, plan.patientId, 'care plan');
    requireId(staff, plan.ownerClinicianId, 'care plan');
    if (plan.encounterId) requireId(encounters, plan.encounterId, 'care plan');
    for (const problemId of plan.problemIds) requireId(conditions, problemId, 'care plan');
    if (plan.title.length > 200 || plan.description.length > 4000) fail('care plan text is too long');
  }
  for (const goal of world.goals) {
    requireId(plans, goal.carePlanId, 'goal');
    requireId(patients, goal.patientId, 'goal');
  }
  for (const intervention of world.interventions) {
    requireId(plans, intervention.carePlanId, 'intervention');
    requireId(patients, intervention.patientId, 'intervention');
  }
  for (const task of world.tasks) {
    requireId(patients, task.patientId, 'task');
    if (task.carePlanId) requireId(plans, task.carePlanId, 'task');
    if (task.assigneeUserId) requireId(staff, task.assigneeUserId, 'task');
  }
  for (const allergy of world.allergies) requireId(patients, allergy.patientId, 'allergy');

  for (const vital of world.vitals) {
    requireId(patients, vital.patientId, 'vital');
    const m = vital.measurements;
    const inRange = (value: number | undefined, min: number, max: number, label: string) => {
      if (value == null) return;
      if (value < min || value > max) fail(`${label} ${value} is outside ${min}-${max}`);
    };
    inRange(m.systolicBp, 70, 220, 'systolic');
    inRange(m.diastolicBp, 40, 130, 'diastolic');
    if (m.systolicBp != null && m.diastolicBp != null && m.diastolicBp >= m.systolicBp) fail('diastolic is not below systolic');
    inRange(m.heartRate, 40, 180, 'heart rate');
    inRange(m.respiratoryRate, 8, 40, 'respiratory rate');
    inRange(m.temperatureC, 34, 42, 'temperature');
    inRange(m.spo2, 70, 100, 'spo2');
    inRange(m.weightKg, 2, 250, 'weight');
    inRange(m.heightCm, 40, 230, 'height');
  }

  for (const patient of world.patients) {
    const index = world.patients.indexOf(patient);
    const registered = world.appointments.find((item) => item._patientIndex === index && item._anchor === 'new' && item.status === 'completed');
    const follow = world.appointments.find((item) => item._patientIndex === index && item._anchor === 'follow' && item.status === 'completed');
    if (!registered || !follow) fail(`${patient.mrn} is missing the registration or follow-up appointment`);
    if (follow.startTime <= registered.endTime) fail(`${patient.mrn} follow-up is not after registration`);
    const registeredVisit = world.visits.find((item) => sid(item.appointmentId) === sid(registered._id) && item.status === 'completed');
    if (!registeredVisit) fail(`${patient.mrn} registration visit is missing`);
    const encounter = world.encounters.find((item) => sid(item.visitId) === sid(registeredVisit._id));
    if (!encounter) fail(`${patient.mrn} registration encounter is missing`);
    const note = world.notes.find((item) => item.encounterId && sid(item.encounterId) === sid(encounter._id));
    if (!note) fail(`${patient.mrn} registration note is missing`);
    const plan = world.carePlans.find((item) => item._patientIndex === index);
    if (!plan) fail(`${patient.mrn} care plan is missing`);
  }

  const oldest = world.appointments.reduce((min, item) => Math.min(min, item.startTime.getTime()), world.now.getTime());
  const newest = world.appointments.reduce((max, item) => Math.max(max, item.startTime.getTime()), 0);
  const spanDays = (world.now.getTime() - oldest) / (24 * 60 * 60 * 1000);
  if (spanDays < 1000) fail(`history only goes back ${Math.round(spanDays)} days`);
  if (newest <= world.now.getTime()) fail('no future appointments');

  const deletedIds = new Set<string>();
  const markDeleted = (type: string, rows: { _id: { toString(): string }; deletedAt: Date | null }[]) => {
    for (const row of rows) if (row.deletedAt) deletedIds.add(`${type}:${String(row._id)}`);
  };
  markDeleted('Appointment', world.appointments);
  markDeleted('Visit', world.visits);
  markDeleted('Encounter', world.encounters);
  markDeleted('ClinicalNote', world.notes);
  markDeleted('Condition', world.conditions);
  markDeleted('Allergy', world.allergies);
  markDeleted('CarePlan', world.carePlans);
  markDeleted('CarePlanGoal', world.goals);
  markDeleted('CarePlanIntervention', world.interventions);
  markDeleted('Task', world.tasks);
  markDeleted('Vital', world.vitals);
  const auditedDeletes = new Set(
    world.audits.filter((item) => item.action === 'delete').map((item) => `${item.resourceType}:${String(item.resourceId)}`)
  );
  for (const key of deletedIds) {
    if (!auditedDeletes.has(key)) fail(`soft-deleted ${key} has no audit event`);
  }

  for (const audit of world.audits) {
    requireId(staff, audit.userId, 'audit');
    if (audit.patientId) requireId(patients, audit.patientId, 'audit');
    if (audit.action === 'create' && audit.before != null) fail('create audit has a before image');
    if (audit.action === 'delete' && audit.after != null) fail('delete audit has an after image');
  }
  const auditActions = new Set(world.audits.map((item) => item.action));
  if (auditActions.size !== 3) fail('audit log is missing an action');

  const earliestDay = world.days[0]?.key ?? '';
  const latestDay = world.days[world.days.length - 1]?.key ?? '';
  console.log(`Clinic calendar ${earliestDay} through ${latestDay} (${world.days.length} open days).`);
  console.log(`No-shows ${noShow.toLocaleString()}, cancellations ${cancelled.toLocaleString()}, history ${Math.round(spanDays)} days.`);
}
