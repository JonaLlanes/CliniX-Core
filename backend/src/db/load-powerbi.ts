/**
 * Replace the local Core database with the Power BI population.
 * Refuses any host other than localhost.
 */
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDb, disconnectDb } from '../config/db.js';
import { config } from '../config/env.js';
import {
  User,
  Patient,
  Condition,
  Vital,
  Medication,
  Encounter,
  EncounterDiagnosis,
  CarePlan,
  CarePlanGoal,
  CarePlanIntervention,
  Task,
  ClinicalNote,
  Allergy,
  AuditEvent,
  Appointment,
  Visit,
} from '../models/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXPORT_DIR =
  process.env.CLINIX_EXPORT_DIR ||
  path.resolve(__dirname, '../../../../CliniX PowerBI/app-export/core');

const CANONICAL = [
  { email: 'admin@clinix.local', password: 'Admin123!', role: 'admin', displayName: 'Alex Reyes' },
  { email: 'doctor@clinix.local', password: 'Doctor123!', role: 'clinician', displayName: 'Dr. Maya Smith' },
  { email: 'nurse@clinix.local', password: 'Nurse123!', role: 'nurse', displayName: 'Nurse Joel Johnson' },
  { email: 'caregiver@clinix.local', password: 'Caregiver123!', role: 'caregiver', displayName: 'Carla Mendoza' },
  { email: 'pharmacist@clinix.local', password: 'Pharm123!', role: 'pharmacist', displayName: 'Priya Shah' },
  { email: 'insight@clinix.local', password: 'Insight123!', role: 'insight_service', displayName: 'CliniX Insight Service' },
  { email: 'r.okafor@clinix.local', password: 'Doctor123!', role: 'clinician', displayName: 'Dr. Rita Okafor' },
];

function assertLocal(uri: string) {
  const normalized = uri.replace(/^mongodb\+srv:\/\//, 'https://').replace(/^mongodb:\/\//, 'http://');
  const host = new URL(normalized).hostname;
  if (host !== 'localhost' && host !== '127.0.0.1') {
    throw new Error(`Refusing to replace data on ${host}. This loader only runs against local MongoDB.`);
  }
  console.log(`Loading Core data into local MongoDB (${host}).`);
}

function atNoon(day: string) {
  return new Date(`${day}T12:00:00.000Z`);
}

async function eachBatch(fileName: string, size: number, onBatch: (rows: any[]) => Promise<void>) {
  const filePath = path.join(EXPORT_DIR, fileName);
  if (!fs.existsSync(filePath)) throw new Error(`Missing ${filePath}. Run export_for_apps.py first.`);
  const lines = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });
  let batch: any[] = [];
  let count = 0;
  for await (const line of lines) {
    if (!line) continue;
    batch.push(JSON.parse(line));
    if (batch.length >= size) {
      await onBatch(batch);
      count += batch.length;
      batch = [];
      if (count % 50000 === 0) console.log(`  ${fileName}: ${count.toLocaleString()}`);
    }
  }
  if (batch.length) {
    await onBatch(batch);
    count += batch.length;
  }
  console.log(`  ${fileName}: ${count.toLocaleString()}`);
}

async function load() {
  if (!fs.existsSync(EXPORT_DIR)) {
    throw new Error(`Missing ${EXPORT_DIR}. Run export_for_apps.py first.`);
  }
  assertLocal(config.mongoUri);
  await connectDb();

  console.log('Clearing Core collections...');
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
  ]);

  const portfolioHash = await bcrypt.hash('Clinix123!', 10);
  const canonicalDocs = [];
  for (const user of CANONICAL) {
    canonicalDocs.push({
      email: user.email,
      passwordHash: await bcrypt.hash(user.password, 10),
      displayName: user.displayName,
      role: user.role,
    });
  }
  await User.insertMany(canonicalDocs);
  const doctor = await User.findOne({ email: 'doctor@clinix.local' });
  const nurse = await User.findOne({ email: 'nurse@clinix.local' });
  const defaultTeam = [doctor?._id, nurse?._id].filter(Boolean);

  const usersByClinician = new Map<string, any>();
  await eachBatch('users.ndjson', 200, async (rows) => {
    const docs = rows.map((row) => ({
      email: row.email,
      passwordHash: portfolioHash,
      displayName: row.full_name,
      role: row.role,
    }));
    const inserted = await User.insertMany(docs);
    inserted.forEach((doc, index) => usersByClinician.set(rows[index].clinician_id, doc._id));
  });

  const patients = new Map<string, any>();
  await eachBatch('patients.ndjson', 1000, async (rows) => {
    const docs = rows.map((row) => ({
      mrn: row.mrn,
      givenName: row.given_name,
      familyName: row.family_name,
      birthDate: atNoon(row.birth_date),
      sex: row.sex,
      contact: { phone: row.phone, email: row.email, address: row.address },
      identifiers: { insuranceMemberId: row.insurance_member_id },
      careTeam: defaultTeam,
    }));
    const inserted = await Patient.insertMany(docs);
    inserted.forEach((doc, index) => patients.set(rows[index].mrn, doc._id));
  });

  await eachBatch('conditions.ndjson', 2000, async (rows) => {
    await Condition.insertMany(
      rows.map((row) => ({
        patientId: patients.get(row.patient_mrn),
        display: row.display,
        status: row.status,
        severity: row.severity,
        onsetDate: atNoon(row.onset_date),
        codeSystem: row.code_system,
        code: row.code,
      }))
    );
  });

  const carePlans = new Map<number, any>();
  await eachBatch('care_plans.ndjson', 1000, async (rows) => {
    const docs = rows.map((row) => {
      const start = row.start_date ? atNoon(row.start_date) : new Date();
      const owner = usersByClinician.get(row.clinician_id) || doctor?._id;
      const status = ['draft', 'active', 'on_hold', 'completed', 'cancelled'].includes(row.status)
        ? row.status
        : 'active';
      return {
        patientId: patients.get(row.patient_mrn),
        title: row.title,
        description: String(row.description || row.goal_title || row.title || 'Care plan'),
        status,
        startDate: start,
        targetDate: row.target_date ? atNoon(row.target_date) : undefined,
        completedDate: status === 'completed' ? start : undefined,
        ownerClinicianId: owner,
      };
    });
    const inserted = await CarePlan.insertMany(docs);
    const goals: Record<string, unknown>[] = [];
    const interventions: Record<string, unknown>[] = [];
    inserted.forEach((doc, index) => {
      const row = rows[index];
      carePlans.set(row.care_plan_key, doc._id);
      const start = doc.startDate || new Date();
      if (row.goal_title) {
        const goalStatus =
          row.goal_status === 'proposed'
            ? 'not_started'
            : ['not_started', 'in_progress', 'achieved', 'cancelled'].includes(row.goal_status)
              ? row.goal_status
              : 'not_started';
        goals.push({
          carePlanId: doc._id,
          patientId: doc.patientId,
          description: row.goal_title,
          targetValue: row.goal_target || undefined,
          targetDate: row.goal_target_date ? atNoon(row.goal_target_date) : new Date(start.getTime() + 90 * 86400000),
          status: goalStatus,
          achievedAt: goalStatus === 'achieved' ? start : undefined,
        });
      }
      if (row.intervention_description) {
        const interventionStatus =
          row.intervention_status === 'in_progress'
            ? 'active'
            : ['planned', 'active', 'completed', 'cancelled'].includes(row.intervention_status)
              ? row.intervention_status
              : 'planned';
        const assignedRole =
          row.intervention_type === 'medication_change'
            ? 'pharmacist'
            : row.intervention_type === 'lifestyle'
              ? 'caregiver'
              : row.intervention_type === 'education' || row.intervention_type === 'follow_up'
                ? 'nurse'
                : 'clinician';
        interventions.push({
          carePlanId: doc._id,
          patientId: doc.patientId,
          description: row.intervention_description,
          assignedRole,
          dueDate: row.due_date ? atNoon(row.due_date) : new Date(start.getTime() + 30 * 86400000),
          status: interventionStatus,
          completedAt: interventionStatus === 'completed' ? start : undefined,
        });
      }
    });
    if (goals.length) await CarePlanGoal.insertMany(goals);
    if (interventions.length) await CarePlanIntervention.insertMany(interventions);
  });

  await eachBatch('medications.ndjson', 2000, async (rows) => {
    await Medication.insertMany(
      rows.map((row) => ({
        patientId: patients.get(row.patient_mrn),
        prescriberId: usersByClinician.get(row.prescriber_clinician_id) || doctor?._id,
        name: row.name,
        dose: row.dose,
        route: row.route,
        frequency: row.frequency,
        startDate: atNoon(row.start_date),
        endDate: row.end_date ? atNoon(row.end_date) : undefined,
        status: row.status,
      }))
    );
  });

  await eachBatch('vitals.ndjson', 2000, async (rows) => {
    await Vital.insertMany(
      rows.map((row) => ({
        patientId: patients.get(row.patient_mrn),
        effectiveAt: atNoon(row.effective_at),
        source: row.source,
        measurements: row.measurements,
      }))
    );
  });

  const encounters = new Map<number, any>();
  await eachBatch('encounters.ndjson', 2000, async (rows) => {
    const docs = rows.map((row) => {
      const opened = atNoon(row.period_start);
      const signedAt = row.period_end ? atNoon(row.period_end) : opened;
      const providerId = usersByClinician.get(row.clinician_id) || doctor?._id;
      const appointmentType =
        row.type === 'follow_up' ? 'follow_up' : row.type === 'telehealth' ? 'telehealth' : 'consultation';
      const clinicLocation = row.type === 'telehealth' ? 'Virtual' : 'Toronto Main';
      const reason = String(row.summary || 'Historical encounter').slice(0, 1000);
      return {
        patientId: patients.get(row.patient_mrn),
        visitId: new mongoose.Types.ObjectId(),
        appointmentId: new mongoose.Types.ObjectId(),
        attendingProviderId: providerId,
        clinicLocation,
        appointmentType,
        chiefComplaint: reason.slice(0, 500),
        reasonForVisit: reason,
        status: 'signed',
        isCurrent: true,
        createdBy: providerId,
        signedBy: providerId,
        signedAt,
        openedAt: opened,
        timeline: [
          { event: 'opened', at: opened, actorId: providerId, note: reason.slice(0, 500) },
          { event: 'signed', at: signedAt, actorId: providerId },
        ],
      };
    });
    const inserted = await Encounter.insertMany(docs);
    inserted.forEach((doc, index) => encounters.set(rows[index].encounter_key, doc._id));
    const teamOps = docs
      .filter((doc) => doc.patientId && doc.attendingProviderId)
      .map((doc) => ({
        updateOne: {
          filter: { _id: doc.patientId },
          update: { $addToSet: { careTeam: doc.attendingProviderId } },
        },
      }));
    if (teamOps.length) await Patient.bulkWrite(teamOps);
  });

  await eachBatch('notes.ndjson', 2000, async (rows) => {
    await ClinicalNote.insertMany(
      rows.map((row) => {
        const _id = new mongoose.Types.ObjectId();
        return {
          _id,
          rootId: _id,
          patientId: patients.get(row.patient_mrn),
          encounterId: encounters.get(row.encounter_key),
          authorId: usersByClinician.get(row.clinician_id) || doctor?._id,
          body: row.body,
          version: 1,
        };
      })
    );
  });

  await eachBatch('tasks.ndjson', 1000, async (rows) => {
    await Task.insertMany(
      rows.map((row) => ({
        patientId: patients.get(row.patient_mrn),
        carePlanId: carePlans.get(row.care_plan_key),
        title: row.title,
        assigneeRole: row.assignee_role,
        assigneeUserId: usersByClinician.get(row.clinician_id),
        status: row.status,
        dueDate: atNoon(row.due_date),
      }))
    );
    const teamOps = rows
      .map((row) => ({
        patientId: patients.get(row.patient_mrn),
        userId: usersByClinician.get(row.clinician_id),
      }))
      .filter((row) => row.patientId && row.userId)
      .map((row) => ({
        updateOne: {
          filter: { _id: row.patientId },
          update: { $addToSet: { careTeam: row.userId } },
        },
      }));
    if (teamOps.length) await Patient.bulkWrite(teamOps);
  });

  console.log('Core load complete.');
  await disconnectDb();
}

load().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  try {
    await disconnectDb();
  } catch {
    /* already closed */
  }
  process.exit(1);
});
