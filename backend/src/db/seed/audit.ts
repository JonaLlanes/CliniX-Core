import type { Role } from '../../types/roles.js';
import type { AuditDraft, StaffMember, World } from './world.js';

const TARGET = 40000;

type Row = {
  id: AuditDraft['resourceId'];
  patientId?: AuditDraft['patientId'];
  at: Date;
  actorId: AuditDraft['userId'];
  after: Record<string, unknown>;
  event: string;
};

function clip(value: string, max = 220) {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

function sample<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  const step = items.length / max;
  const picked: T[] = [];
  for (let index = 0; index < max; index += 1) picked.push(items[Math.floor(index * step)]!);
  return picked;
}

function staffById(world: World) {
  return new Map(world.staff.map((person) => [String(person._id), person]));
}

export function buildAudits(world: World) {
  const people = staffById(world);
  const admins = world.staff.filter((person) => person.role === 'admin');
  const adminAt = (index: number) => admins[index % admins.length] ?? world.staff[0]!;
  const actor = (id: AuditDraft['userId']): StaffMember => people.get(String(id)) ?? adminAt(0);

  const audits: AuditDraft[] = [];
  const seen = new Set<string>();

  const add = (draft: AuditDraft) => {
    const key = `${draft.action}:${draft.resourceType}:${String(draft.resourceId)}`;
    if (seen.has(key) || audits.length >= TARGET) return false;
    seen.add(key);
    audits.push(draft);
    return true;
  };

  const asActor = (id: AuditDraft['userId']) => {
    const person = actor(id);
    return { userId: person._id, role: person.role as Role };
  };

  const create = (resourceType: string, row: Row) => {
    const who = asActor(row.actorId);
    add({
      ...who,
      action: 'create',
      resourceType,
      resourceId: row.id,
      patientId: row.patientId,
      before: null,
      after: row.after,
      event: row.event,
      timestamp: row.at,
    });
  };

  const update = (
    resourceType: string,
    row: Row & { before: Record<string, unknown> }
  ) => {
    const who = asActor(row.actorId);
    add({
      ...who,
      action: 'update',
      resourceType,
      resourceId: row.id,
      patientId: row.patientId,
      before: row.before,
      after: row.after,
      event: row.event,
      timestamp: row.at,
    });
  };

  const remove = (resourceType: string, row: Row) => {
    const who = asActor(adminAt(audits.length).userId ? adminAt(audits.length)._id : row.actorId);
    add({
      userId: who.userId,
      role: who.role,
      action: 'delete',
      resourceType,
      resourceId: row.id,
      patientId: row.patientId,
      before: row.after,
      after: null,
      event: 'record_deleted',
      timestamp: row.at,
    });
  };

  for (const person of world.staff) {
    create('User', {
      id: person._id,
      at: person.createdAt,
      actorId: adminAt(0)._id,
      after: { email: person.email, displayName: person.displayName, role: person.role },
      event: 'user_created',
    });
  }
  for (const person of world.staff.filter((item) => item._profileUpdated)) {
    update('User', {
      id: person._id,
      at: person.updatedAt,
      actorId: person._id,
      before: { displayName: person.displayName },
      after: { displayName: person.displayName, profileReviewed: true },
      event: 'profile_updated',
    });
  }

  for (const patient of world.patients) {
    create('Patient', {
      id: patient._id,
      patientId: patient._id,
      at: patient.createdAt,
      actorId: adminAt(world.patients.indexOf(patient))._id,
      after: { mrn: patient.mrn, givenName: patient.givenName, familyName: patient.familyName },
      event: 'patient_registered',
    });
    if (patient.updatedAt.getTime() > patient.createdAt.getTime() + 60 * 1000) {
      update('Patient', {
        id: patient._id,
        patientId: patient._id,
        at: patient.updatedAt,
        actorId: patient.nurseId,
        before: { preferredName: patient.givenName },
        after: { preferredName: patient.preferredName ?? patient.givenName, city: patient.city },
        event: 'patient_updated',
      });
    }
  }

  const anchorAppointments = world.appointments.filter((appointment) => appointment._anchor != null);
  for (const appointment of anchorAppointments) {
    create('Appointment', {
      id: appointment._id,
      patientId: appointment.patientId,
      at: appointment.createdAt,
      actorId: adminAt(appointment._patientIndex)._id,
      after: {
        status: 'booked',
        appointmentType: appointment.appointmentType,
        clinicLocation: appointment.clinicLocation,
        startTime: appointment.startTime,
      },
      event: appointment._anchor === 'new' ? 'appointment_booked' : 'follow_up_booked',
    });
  }

  const statusAppointments = [
    ...world.appointments.filter((appointment) => appointment.status === 'no_show' || appointment.status === 'cancelled'),
    ...sample(
      world.appointments.filter((appointment) => appointment.status === 'completed' || appointment.status === 'arrived' || appointment.status === 'confirmed'),
      5000
    ),
  ];
  for (const appointment of statusAppointments) {
    const nurse = world.patients[appointment._patientIndex]?.nurseId ?? appointment.providerId;
    update('Appointment', {
      id: appointment._id,
      patientId: appointment.patientId,
      at: appointment.updatedAt,
      actorId: appointment.status === 'cancelled' ? adminAt(appointment._patientIndex)._id : nurse,
      before: { status: appointment.status === 'confirmed' ? 'booked' : 'confirmed' },
      after: { status: appointment.status, cancelReason: appointment.cancelReason ?? null },
      event: 'appointment_status_changed',
    });
  }

  for (const visit of world.visits.filter((item) => item._anchor != null)) {
    create('Visit', {
      id: visit._id,
      patientId: visit.patientId,
      at: visit.arrivalAt ?? visit.createdAt,
      actorId: world.patients[visit._patientIndex]?.nurseId ?? visit.providerId,
      after: { status: visit.status, examRoom: visit.examRoom ?? null },
      event: visit._anchor === 'new' ? 'visit_checked_in' : 'follow_up_visit',
    });
  }
  for (const visit of sample(
    world.visits.filter((item) => item.status === 'completed' && item._anchor == null),
    1800
  )) {
    update('Visit', {
      id: visit._id,
      patientId: visit.patientId,
      at: visit.completedAt ?? visit.updatedAt,
      actorId: visit.providerId,
      before: { status: 'in_progress' },
      after: { status: 'completed', completedAt: visit.completedAt ?? null },
      event: 'visit_completed',
    });
  }

  for (const encounter of world.encounters.filter((item) => item._anchor)) {
    create('Encounter', {
      id: encounter._id,
      patientId: encounter.patientId,
      at: encounter.openedAt,
      actorId: encounter.attendingProviderId,
      after: { status: encounter.status, chiefComplaint: clip(encounter.chiefComplaint) },
      event: 'encounter_opened',
    });
  }
  for (const encounter of world.encounters.filter((item) => item.status === 'amended' || item.amendsEncounterId)) {
    update('Encounter', {
      id: encounter._id,
      patientId: encounter.patientId,
      at: encounter.updatedAt,
      actorId: encounter.attendingProviderId,
      before: { status: encounter.amendsEncounterId ? 'amended' : 'signed', isCurrent: !encounter.isCurrent },
      after: { status: encounter.status, isCurrent: encounter.isCurrent },
      event: 'encounter_amended',
    });
  }

  for (const diagnosis of sample(world.diagnoses.filter((item) => item.primaryDiagnosis), 2200)) {
    create('EncounterDiagnosis', {
      id: diagnosis._id,
      patientId: diagnosis.patientId,
      at: diagnosis.recordedAt,
      actorId: diagnosis.recordedBy,
      after: { code: diagnosis.code, description: clip(diagnosis.description, 120), diagnosisType: diagnosis.diagnosisType },
      event: 'diagnosis_created',
    });
  }

  for (const note of world.notes.filter((item) => item._anchor && item.version === 1)) {
    create('ClinicalNote', {
      id: note._id,
      patientId: note.patientId,
      at: note.createdAt,
      actorId: note.authorId,
      after: { version: note.version, body: clip(note.body) },
      event: 'note_created',
    });
  }
  for (const note of sample(
    world.notes.filter((item) => item.version > 1),
    2500
  )) {
    update('ClinicalNote', {
      id: note._id,
      patientId: note.patientId,
      at: note.createdAt,
      actorId: note.authorId,
      before: { version: note.version - 1 },
      after: { version: note.version, body: clip(note.body) },
      event: 'note_revised',
    });
  }

  for (const condition of sample(world.conditions.filter((item) => item._primary), 500)) {
    create('Condition', {
      id: condition._id,
      patientId: condition.patientId,
      at: condition.createdAt,
      actorId: condition.clinicianOwner,
      after: { code: condition.code, display: condition.display, status: condition.status },
      event: 'problem_recorded',
    });
  }
  for (const condition of sample(
    world.conditions.filter((item) => item.status === 'resolved' && item.resolvedDate),
    800
  )) {
    update('Condition', {
      id: condition._id,
      patientId: condition.patientId,
      at: condition.resolvedDate ?? condition.updatedAt,
      actorId: condition.clinicianOwner,
      before: { status: 'active' },
      after: { status: 'resolved', resolvedDate: condition.resolvedDate },
      event: 'problem_resolved',
    });
  }

  for (const allergy of world.allergies) {
    create('Allergy', {
      id: allergy._id,
      patientId: allergy.patientId,
      at: allergy.recordedDate,
      actorId: world.patients[allergy._patientIndex]?.clinicianId ?? adminAt(0)._id,
      after: { substance: allergy.substance, reaction: allergy.reaction, severity: allergy.severity, status: allergy.status },
      event: 'allergy_recorded',
    });
  }

  for (const medication of sample(world.medications, 2500)) {
    create('Medication', {
      id: medication._id,
      patientId: medication.patientId,
      at: medication.startDate,
      actorId: medication.prescribedBy,
      after: { genericName: medication.genericName, strength: medication.strength, status: 'active' },
      event: 'medication_started',
    });
  }
  for (const medication of sample(
    world.medications.filter((item) => item.events.length > 1),
    1200
  )) {
    const last = medication.events[medication.events.length - 1]!;
    update('Medication', {
      id: medication._id,
      patientId: medication.patientId,
      at: last.at,
      actorId: last.clinicianId,
      before: { status: 'active' },
      after: { status: medication.status, action: last.action, reason: last.reason ?? null },
      event: 'medication_changed',
    });
  }

  for (const plan of world.carePlans.filter((item) => item._primary)) {
    create('CarePlan', {
      id: plan._id,
      patientId: plan.patientId,
      at: plan.createdAt,
      actorId: plan.ownerClinicianId,
      after: { title: plan.title, status: plan.status },
      event: 'care_plan_created',
    });
  }
  for (const plan of sample(
    world.carePlans.filter((item) => item.progress.length > 0),
    600
  )) {
    const note = plan.progress[plan.progress.length - 1]!;
    update('CarePlan', {
      id: plan._id,
      patientId: plan.patientId,
      at: note.at,
      actorId: note.authorId,
      before: { progressCount: plan.progress.length - 1 },
      after: { status: plan.status, note: clip(note.note, 180) },
      event: 'care_plan_progress',
    });
  }

  for (const task of sample(world.tasks, 1500)) {
    create('Task', {
      id: task._id,
      patientId: task.patientId,
      at: task.createdAt,
      actorId: task.assigneeUserId ?? world.patients[task._patientIndex]?.clinicianId ?? adminAt(0)._id,
      after: { title: task.title, status: 'pending', assigneeRole: task.assigneeRole },
      event: 'task_created',
    });
  }
  for (const task of sample(
    world.tasks.filter((item) => item.status === 'completed'),
    800
  )) {
    update('Task', {
      id: task._id,
      patientId: task.patientId,
      at: task.updatedAt,
      actorId: task.assigneeUserId ?? world.patients[task._patientIndex]?.nurseId ?? adminAt(0)._id,
      before: { status: 'in_progress' },
      after: { status: 'completed' },
      event: 'task_completed',
    });
  }

  for (const vital of world.vitals.filter((item) => item._previousSystolic != null)) {
    update('Vital', {
      id: vital._id,
      patientId: vital.patientId,
      at: vital.updatedAt,
      actorId: world.patients[vital._patientIndex]?.nurseId ?? adminAt(0)._id,
      before: { systolicBp: vital._previousSystolic },
      after: { systolicBp: vital.measurements.systolicBp ?? null, source: vital.source },
      event: 'vital_corrected',
    });
  }

  const deletedAt = (value: Date | null | undefined) => value ?? world.now;
  for (const appointment of world.appointments.filter((item) => item.deletedAt)) {
    remove('Appointment', {
      id: appointment._id,
      patientId: appointment.patientId,
      at: deletedAt(appointment.deletedAt),
      actorId: adminAt(0)._id,
      after: { status: appointment.status, startTime: appointment.startTime },
      event: 'record_deleted',
    });
  }
  for (const visit of world.visits.filter((item) => item.deletedAt)) {
    remove('Visit', {
      id: visit._id,
      patientId: visit.patientId,
      at: deletedAt(visit.deletedAt),
      actorId: adminAt(1)._id,
      after: { status: visit.status },
      event: 'record_deleted',
    });
  }
  for (const encounter of world.encounters.filter((item) => item.deletedAt)) {
    remove('Encounter', {
      id: encounter._id,
      patientId: encounter.patientId,
      at: deletedAt(encounter.deletedAt),
      actorId: encounter.attendingProviderId,
      after: { status: encounter.status, chiefComplaint: clip(encounter.chiefComplaint, 80) },
      event: 'record_deleted',
    });
  }
  for (const note of world.notes.filter((item) => item.deletedAt)) {
    remove('ClinicalNote', {
      id: note._id,
      patientId: note.patientId,
      at: deletedAt(note.deletedAt),
      actorId: note.authorId,
      after: { version: note.version },
      event: 'record_deleted',
    });
  }
  for (const condition of world.conditions.filter((item) => item.deletedAt)) {
    remove('Condition', {
      id: condition._id,
      patientId: condition.patientId,
      at: deletedAt(condition.deletedAt),
      actorId: condition.clinicianOwner,
      after: { code: condition.code, display: condition.display },
      event: 'record_deleted',
    });
  }
  for (const allergy of world.allergies.filter((item) => item.deletedAt)) {
    remove('Allergy', {
      id: allergy._id,
      patientId: allergy.patientId,
      at: deletedAt(allergy.deletedAt),
      actorId: world.patients[allergy._patientIndex]?.clinicianId ?? adminAt(0)._id,
      after: { substance: allergy.substance, status: allergy.status },
      event: 'record_deleted',
    });
  }
  for (const plan of world.carePlans.filter((item) => item.deletedAt)) {
    remove('CarePlan', {
      id: plan._id,
      patientId: plan.patientId,
      at: deletedAt(plan.deletedAt),
      actorId: plan.ownerClinicianId,
      after: { title: plan.title, status: plan.status },
      event: 'record_deleted',
    });
  }
  for (const goal of world.goals.filter((item) => item.deletedAt)) {
    remove('CarePlanGoal', {
      id: goal._id,
      patientId: goal.patientId,
      at: deletedAt(goal.deletedAt),
      actorId: adminAt(0)._id,
      after: { description: clip(goal.description, 80), status: goal.status },
      event: 'record_deleted',
    });
  }
  for (const intervention of world.interventions.filter((item) => item.deletedAt)) {
    remove('CarePlanIntervention', {
      id: intervention._id,
      patientId: intervention.patientId,
      at: deletedAt(intervention.deletedAt),
      actorId: adminAt(0)._id,
      after: { description: clip(intervention.description, 80), status: intervention.status },
      event: 'record_deleted',
    });
  }
  for (const task of world.tasks.filter((item) => item.deletedAt)) {
    remove('Task', {
      id: task._id,
      patientId: task.patientId,
      at: deletedAt(task.deletedAt),
      actorId: task.assigneeUserId ?? adminAt(0)._id,
      after: { title: task.title, status: task.status },
      event: 'record_deleted',
    });
  }
  for (const vital of world.vitals.filter((item) => item.deletedAt)) {
    remove('Vital', {
      id: vital._id,
      patientId: vital.patientId,
      at: deletedAt(vital.deletedAt),
      actorId: world.patients[vital._patientIndex]?.nurseId ?? adminAt(0)._id,
      after: { source: vital.source, effectiveAt: vital.effectiveAt },
      event: 'record_deleted',
    });
  }

  const pools: { type: string; rows: Row[] }[] = [
    {
      type: 'Appointment',
      rows: world.appointments.filter((item) => item._anchor == null).map((item) => ({
        id: item._id,
        patientId: item.patientId,
        at: item.createdAt,
        actorId: adminAt(item._patientIndex)._id,
        after: { status: 'booked', appointmentType: item.appointmentType, clinicLocation: item.clinicLocation },
        event: 'appointment_booked',
      })),
    },
    {
      type: 'Visit',
      rows: world.visits.filter((item) => item._anchor == null).map((item) => ({
        id: item._id,
        patientId: item.patientId,
        at: item.createdAt,
        actorId: world.patients[item._patientIndex]?.nurseId ?? item.providerId,
        after: { status: item.status },
        event: 'visit_checked_in',
      })),
    },
    {
      type: 'Vital',
      rows: world.vitals.map((item) => ({
        id: item._id,
        patientId: item.patientId,
        at: item.effectiveAt,
        actorId: world.patients[item._patientIndex]?.nurseId ?? adminAt(0)._id,
        after: { source: item.source, systolicBp: item.measurements.systolicBp ?? null },
        event: 'vital_recorded',
      })),
    },
    {
      type: 'ClinicalNote',
      rows: world.notes.filter((item) => !(item._anchor && item.version === 1)).map((item) => ({
        id: item._id,
        patientId: item.patientId,
        at: item.createdAt,
        actorId: item.authorId,
        after: { version: item.version },
        event: 'note_created',
      })),
    },
    {
      type: 'Medication',
      rows: world.medications.map((item) => ({
        id: item._id,
        patientId: item.patientId,
        at: item.startDate,
        actorId: item.prescribedBy,
        after: { genericName: item.genericName, status: item.status },
        event: 'medication_started',
      })),
    },
    {
      type: 'Task',
      rows: world.tasks.map((item) => ({
        id: item._id,
        patientId: item.patientId,
        at: item.createdAt,
        actorId: item.assigneeUserId ?? adminAt(0)._id,
        after: { title: item.title, assigneeRole: item.assigneeRole },
        event: 'task_created',
      })),
    },
    {
      type: 'Condition',
      rows: world.conditions.filter((item) => !item._primary).map((item) => ({
        id: item._id,
        patientId: item.patientId,
        at: item.createdAt,
        actorId: item.clinicianOwner,
        after: { code: item.code, display: item.display, status: item.status },
        event: 'problem_recorded',
      })),
    },
    {
      type: 'Encounter',
      rows: world.encounters.filter((item) => !item._anchor).map((item) => ({
        id: item._id,
        patientId: item.patientId,
        at: item.openedAt,
        actorId: item.attendingProviderId,
        after: { status: item.status, clinicLocation: item.clinicLocation },
        event: 'encounter_opened',
      })),
    },
    {
      type: 'EncounterDiagnosis',
      rows: world.diagnoses.filter((item) => !item.primaryDiagnosis).map((item) => ({
        id: item._id,
        patientId: item.patientId,
        at: item.recordedAt,
        actorId: item.recordedBy,
        after: { code: item.code, diagnosisType: item.diagnosisType },
        event: 'diagnosis_created',
      })),
    },
    {
      type: 'CarePlan',
      rows: world.carePlans.filter((item) => !item._primary).map((item) => ({
        id: item._id,
        patientId: item.patientId,
        at: item.createdAt,
        actorId: item.ownerClinicianId,
        after: { title: item.title, status: item.status },
        event: 'care_plan_created',
      })),
    },
  ];

  while (audits.length < TARGET) {
    let progressed = false;
    for (const pool of pools) {
      if (audits.length >= TARGET) break;
      while (pool.rows.length > 0 && audits.length < TARGET) {
        const row = pool.rows.pop();
        if (!row) break;
        progressed = true;
        if (create(pool.type, row)) break;
      }
    }
    if (!progressed) break;
  }

  if (audits.length !== TARGET) {
    throw new Error(`expected ${TARGET} audit events, built ${audits.length}`);
  }
  const actions = new Set(audits.map((item) => item.action));
  if (!actions.has('create') || !actions.has('update') || !actions.has('delete')) {
    throw new Error(`audit actions missing coverage: ${[...actions].join(', ')}`);
  }
  world.audits = audits;
}
