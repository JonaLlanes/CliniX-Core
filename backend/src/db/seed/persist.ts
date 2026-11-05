import mongoose, { type Model } from 'mongoose';
import {
  Allergy,
  Appointment,
  AuditEvent,
  CarePlan,
  CarePlanGoal,
  CarePlanIntervention,
  ClinicalNote,
  Condition,
  Encounter,
  EncounterDiagnosis,
  Medication,
  MonitoringMetric,
  MonitoringProgram,
  Order,
  OrderResult,
  Patient,
  Recall,
  Referral,
  ReferralDocument,
  ReferralOutcome,
  Task,
  User,
  Visit,
  Vital,
} from '../../models/index.js';
import type { World } from './world.js';

function compact<T extends Record<string, unknown>>(doc: T) {
  return Object.fromEntries(Object.entries(doc).filter(([, value]) => value !== undefined));
}

let writeDocuments = true;

async function put(model: Model<unknown>, docs: Record<string, unknown>[], label: string) {
  const size = 200;
  for (let index = 0; index < docs.length; index += size) {
    const slice = docs.slice(index, index + size);
    const instances = slice.map((doc) => new model(doc));
    for (const instance of instances) {
      try {
        await instance.validate();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`${label} failed validation: ${message}`);
      }
    }
    if (!writeDocuments) continue;
    const payload = instances.map((instance) => instance.toObject({ depopulate: true, versionKey: false }));
    await model.collection.insertMany(payload, { ordered: true });
  }
  console.log(`  ${label}: ${docs.length.toLocaleString()}${writeDocuments ? '' : ' valid'}`);
}

export async function clearCollections() {
  await Promise.all([
    User.deleteMany({}),
    Patient.deleteMany({}),
    Condition.deleteMany({}),
    Vital.deleteMany({}),
    Medication.deleteMany({}),
    Encounter.deleteMany({}),
    EncounterDiagnosis.deleteMany({}),
    CarePlan.deleteMany({}),
    CarePlanGoal.deleteMany({}),
    CarePlanIntervention.deleteMany({}),
    Task.deleteMany({}),
    ClinicalNote.deleteMany({}),
    Allergy.deleteMany({}),
    AuditEvent.deleteMany({}),
    Appointment.deleteMany({}),
    Visit.deleteMany({}),
    Order.deleteMany({}),
    OrderResult.deleteMany({}),
    Referral.deleteMany({}),
    ReferralDocument.deleteMany({}),
    ReferralOutcome.deleteMany({}),
    MonitoringProgram.deleteMany({}),
    MonitoringMetric.deleteMany({}),
    Recall.deleteMany({}),
    mongoose.connection.collection('seedmeta').deleteMany({}),
  ]);
}

/** Written only after every collection has been inserted. A partial seed does not set this. */
export async function demoSeedIsComplete() {
  const marker = await mongoose.connection.collection('seedmeta').findOne({ _id: 'demo' });
  return marker?.complete === true;
}

export async function persistWorld(world: World, write = true) {
  writeDocuments = write;
  await put(
    User,
    world.staff.map((person) => ({
      _id: person._id,
      email: person.email,
      passwordHash: person.passwordHash,
      displayName: person.displayName,
      role: person.role,
      createdAt: person.createdAt,
      updatedAt: person.updatedAt,
    })),
    'users'
  );

  await put(
    Patient,
    world.patients.map((patient) =>
      compact({
        _id: patient._id,
        mrn: patient.mrn,
        givenName: patient.givenName,
        familyName: patient.familyName,
        preferredName: patient.preferredName,
        birthDate: patient.birthDate,
        language: patient.language,
        sex: patient.sex,
        genderIdentity: patient.genderIdentity,
        contact: {
          phone: patient.phone,
          email: patient.email,
          address: `${patient.street}, ${patient.city}, ${patient.province} ${patient.postalCode}`,
        },
        address: {
          street: patient.street,
          city: patient.city,
          province: patient.province,
          postalCode: patient.postalCode,
          country: 'CA',
        },
        provincialHealth: compact({
          province: patient.province,
          healthCardNumber: patient.hcn,
          versionCode: patient.versionCode,
        }),
        emergencyContact: patient.emergency,
        substituteDecisionMaker: patient.sdm,
        identifiers: compact({
          insuranceMemberId: patient.insurance,
          nationalId: patient.nationalId,
        }),
        careTeam: patient.careTeam,
        deletedAt: null,
        createdAt: patient.createdAt,
        updatedAt: patient.updatedAt,
      })
    ),
    'patients'
  );

  await put(
    Appointment,
    world.appointments.map((appointment) =>
      compact({
        _id: appointment._id,
        patientId: appointment.patientId,
        providerId: appointment.providerId,
        clinicLocation: appointment.clinicLocation,
        appointmentType: appointment.appointmentType,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        status: appointment.status,
        cancelReason: appointment.cancelReason,
        deletedAt: appointment.deletedAt,
        createdAt: appointment.createdAt,
        updatedAt: appointment.updatedAt,
      })
    ),
    'appointments'
  );

  await put(
    Visit,
    world.visits.map((visit) =>
      compact({
        _id: visit._id,
        appointmentId: visit.appointmentId,
        patientId: visit.patientId,
        providerId: visit.providerId,
        status: visit.status,
        arrivalAt: visit.arrivalAt,
        roomedAt: visit.roomedAt,
        startedAt: visit.startedAt,
        completedAt: visit.completedAt,
        examRoom: visit.examRoom ?? null,
        demographicsVerified: visit.demographicsVerified,
        healthCardVerified: visit.healthCardVerified,
        note: visit.note,
        cancelReason: visit.cancelReason,
        timeline: visit.timeline,
        deletedAt: visit.deletedAt,
        createdAt: visit.createdAt,
        updatedAt: visit.updatedAt,
      })
    ),
    'visits'
  );

  await put(
    Condition,
    world.conditions.map((condition) => ({
      _id: condition._id,
      patientId: condition.patientId,
      display: condition.display,
      status: condition.status,
      severity: condition.severity,
      onsetDate: condition.onsetDate,
      resolvedDate: condition.resolvedDate,
      clinicianOwner: condition.clinicianOwner,
      codeSystem: condition.codeSystem,
      code: condition.code,
      sourceDiagnosisId: condition.sourceDiagnosisId,
      deletedAt: condition.deletedAt,
      createdAt: condition.createdAt,
      updatedAt: condition.updatedAt,
    })),
    'conditions'
  );

  await put(
    Encounter,
    world.encounters.map((encounter) => ({
      _id: encounter._id,
      patientId: encounter.patientId,
      visitId: encounter.visitId,
      appointmentId: encounter.appointmentId,
      attendingProviderId: encounter.attendingProviderId,
      supervisingProviderId: encounter.supervisingProviderId,
      clinicLocation: encounter.clinicLocation,
      appointmentType: encounter.appointmentType,
      chiefComplaint: encounter.chiefComplaint,
      reasonForVisit: encounter.reasonForVisit,
      status: encounter.status,
      isCurrent: encounter.isCurrent,
      createdBy: encounter.createdBy,
      signedBy: encounter.signedBy,
      signedAt: encounter.signedAt,
      openedAt: encounter.openedAt,
      amendsEncounterId: encounter.amendsEncounterId,
      timeline: encounter.timeline,
      deletedAt: encounter.deletedAt,
      createdAt: encounter.createdAt,
      updatedAt: encounter.updatedAt,
    })),
    'encounters'
  );

  await put(
    EncounterDiagnosis,
    world.diagnoses.map((diagnosis) =>
      compact({
        _id: diagnosis._id,
        encounterId: diagnosis.encounterId,
        patientId: diagnosis.patientId,
        code: diagnosis.code,
        description: diagnosis.description,
        diagnosisType: diagnosis.diagnosisType,
        primaryDiagnosis: diagnosis.primaryDiagnosis,
        recordedBy: diagnosis.recordedBy,
        recordedAt: diagnosis.recordedAt,
        promotedProblemId: diagnosis.promotedProblemId,
        promotion: diagnosis.promotion ?? undefined,
        promotedAt: diagnosis.promotedAt,
        promotedBy: diagnosis.promotedBy,
        deletedAt: diagnosis.deletedAt,
        createdAt: diagnosis.createdAt,
        updatedAt: diagnosis.updatedAt,
      })
    ),
    'encounter diagnoses'
  );

  await put(
    ClinicalNote,
    world.notes.map((note) =>
      compact({
        _id: note._id,
        patientId: note.patientId,
        encounterId: note.encounterId,
        authorId: note.authorId,
        body: note.body,
        version: note.version,
        rootId: note.rootId,
        deletedAt: note.deletedAt,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
      })
    ),
    'clinical notes'
  );

  await put(
    Allergy,
    world.allergies.map((allergy) => ({
      _id: allergy._id,
      patientId: allergy.patientId,
      substance: allergy.substance,
      reaction: allergy.reaction,
      severity: allergy.severity,
      status: allergy.status,
      recordedDate: allergy.recordedDate,
      deletedAt: allergy.deletedAt,
      createdAt: allergy.createdAt,
      updatedAt: allergy.updatedAt,
    })),
    'allergies'
  );

  await put(
    Medication,
    world.medications.map((medication) =>
      compact({
        _id: medication._id,
        patientId: medication.patientId,
        encounterId: medication.encounterId,
        conditionId: medication.conditionId,
        din: medication.din,
        genericName: medication.genericName,
        brandName: medication.brandName,
        strength: medication.strength,
        dosage: medication.dosage,
        route: medication.route,
        frequency: medication.frequency,
        indication: medication.indication,
        startDate: medication.startDate,
        endDate: medication.endDate,
        prescribedBy: medication.prescribedBy,
        status: medication.status,
        events: medication.events,
        allergyAcknowledgments: medication.allergyAcknowledgments,
        name: medication.genericName,
        dose: [medication.strength, medication.dosage].filter(Boolean).join(' · '),
        prescriberId: medication.prescribedBy,
        adherenceNotes: medication.adherenceNotes,
        deletedAt: medication.deletedAt,
        createdAt: medication.createdAt,
        updatedAt: medication.updatedAt,
      })
    ),
    'medications'
  );

  await put(
    CarePlan,
    world.carePlans.map((plan) => ({
      _id: plan._id,
      patientId: plan.patientId,
      primaryDiagnosisId: plan.primaryDiagnosisId,
      primaryDiagnosisKind: plan.primaryDiagnosisKind,
      problemIds: plan.problemIds,
      encounterDiagnosisIds: plan.encounterDiagnosisIds,
      encounterId: plan.encounterId,
      title: plan.title,
      description: plan.description,
      status: plan.status,
      startDate: plan.startDate,
      targetDate: plan.targetDate,
      completedDate: plan.completedDate,
      ownerClinicianId: plan.ownerClinicianId,
      progress: plan.progress,
      deletedAt: plan.deletedAt,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    })),
    'care plans'
  );

  await put(
    CarePlanGoal,
    world.goals.map((goal) => ({
      _id: goal._id,
      carePlanId: goal.carePlanId,
      patientId: goal.patientId,
      description: goal.description,
      targetValue: goal.targetValue,
      targetDate: goal.targetDate,
      status: goal.status,
      achievedAt: goal.achievedAt,
      deletedAt: goal.deletedAt,
      createdAt: goal.createdAt,
      updatedAt: goal.updatedAt,
    })),
    'care plan goals'
  );

  await put(
    CarePlanIntervention,
    world.interventions.map((intervention) => ({
      _id: intervention._id,
      carePlanId: intervention.carePlanId,
      patientId: intervention.patientId,
      description: intervention.description,
      assignedRole: intervention.assignedRole,
      dueDate: intervention.dueDate,
      status: intervention.status,
      completedAt: intervention.completedAt,
      deletedAt: intervention.deletedAt,
      createdAt: intervention.createdAt,
      updatedAt: intervention.updatedAt,
    })),
    'care plan interventions'
  );

  await put(
    Task,
    world.tasks.map((task) =>
      compact({
        _id: task._id,
        patientId: task.patientId,
        carePlanId: task.carePlanId,
        title: task.title,
        assigneeRole: task.assigneeRole,
        assigneeUserId: task.assigneeUserId,
        status: task.status,
        dueDate: task.dueDate,
        deletedAt: task.deletedAt,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      })
    ),
    'tasks'
  );

  await put(
    Vital,
    world.vitals.map((vital) => ({
      _id: vital._id,
      patientId: vital.patientId,
      effectiveAt: vital.effectiveAt,
      source: vital.source,
      measurements: vital.measurements,
      deletedAt: vital.deletedAt,
      createdAt: vital.createdAt,
      updatedAt: vital.updatedAt,
    })),
    'vitals'
  );

  await put(
    AuditEvent,
    world.audits.map((audit) =>
      compact({
        userId: audit.userId,
        role: audit.role,
        action: audit.action,
        resourceType: audit.resourceType,
        resourceId: audit.resourceId,
        patientId: audit.patientId,
        before: audit.before,
        after: audit.after,
        event: audit.event,
        timestamp: audit.timestamp,
      })
    ),
    'audit events'
  );

  if (writeDocuments) {
    await mongoose.connection.collection('seedmeta').updateOne(
      { _id: 'demo' },
      { $set: { complete: true, finishedAt: new Date() } },
      { upsert: true }
    );
  }
}
