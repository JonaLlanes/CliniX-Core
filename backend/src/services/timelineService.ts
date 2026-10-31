import {
  Vital,
  Condition,
  Medication,
  Encounter,
  CarePlan,
  CarePlanGoal,
  CarePlanIntervention,
  Task,
  ClinicalNote,
  Allergy,
  Appointment,
  Visit,
  EncounterDiagnosis,
  Order,
  OrderResult,
  Referral,
  MonitoringProgram,
  MonitoringMetric,
  Recall,
} from '../models/index.js';
import { notDeleted } from '../utils/pagination.js';
import { ENCOUNTER_STATUSES } from '../types/encounters.js';
import { medicationTimelinePoints } from './medicationService.js';
import { timelinePointsForOrders } from './orderService.js';
import { timelinePointsForCarePlans } from './carePlanService.js';
import { timelinePointsForReferrals } from './referralService.js';
import { timelinePointsForMonitoring } from './monitoringService.js';

export type TimelineEvent = {
  kind: string;
  at: Date;
  ref: unknown;
};

export async function buildPatientTimeline(patientId: string): Promise<TimelineEvent[]> {
  const pid = patientId;
  const [vitals, encounters, medications, conditions, notes, tasks, carePlans, careGoals, careInterventions, allergies, appointments, visits, diagnoses, orders, orderResults, referrals, monitoringPrograms, monitoringMetrics, recalls] =
    await Promise.all([
      Vital.find({ patientId: pid, ...notDeleted }).lean(),
      Encounter.find({ patientId: pid, status: { $in: ENCOUNTER_STATUSES }, ...notDeleted }).lean(),
      Medication.find({ patientId: pid, ...notDeleted }).lean(),
      Condition.find({ patientId: pid, ...notDeleted }).lean(),
      ClinicalNote.find({ patientId: pid, ...notDeleted }).lean(),
      Task.find({ patientId: pid, ...notDeleted }).lean(),
      CarePlan.find({ patientId: pid, ...notDeleted })
        .select('title startDate createdAt completedDate')
        .lean(),
      CarePlanGoal.find({ patientId: pid, ...notDeleted })
        .select('carePlanId description createdAt status achievedAt')
        .lean(),
      CarePlanIntervention.find({ patientId: pid, ...notDeleted })
        .select('carePlanId description createdAt')
        .lean(),
      Allergy.find({ patientId: pid, ...notDeleted }).lean(),
      Appointment.find({ patientId: pid, ...notDeleted }).lean(),
      Visit.find({ patientId: pid, ...notDeleted }).lean(),
      EncounterDiagnosis.find({ patientId: pid, ...notDeleted }).lean(),
      Order.find({ patientId: pid, ...notDeleted })
        .select('orderType orderName priority orderedAt scheduledAt collectedAt completedAt')
        .lean(),
      OrderResult.find({ patientId: pid, ...notDeleted })
        .select('orderId resultType value unit status resultDate')
        .lean(),
      Referral.find({ patientId: pid, ...notDeleted })
        .select(
          'referralType specialty specialistName priority createdAt sentAt acceptedAt scheduledAt appointmentDate outcomeReceivedDate completedAt'
        )
        .lean(),
      MonitoringProgram.find({ patientId: pid, ...notDeleted })
        .select('programType name enrolledDate completedDate createdAt')
        .lean(),
      MonitoringMetric.find({ patientId: pid, ...notDeleted })
        .select('programId metricType label value unit recordedAt')
        .lean(),
      Recall.find({ patientId: pid, ...notDeleted })
        .select('reason dueDate createdAt completedAt')
        .lean(),
    ]);

  const events: TimelineEvent[] = [];
  for (const v of vitals) events.push({ kind: 'vital', at: v.effectiveAt, ref: v });
  for (const e of encounters) {
    events.push({ kind: 'encounter', at: e.openedAt || e.createdAt, ref: e });
    for (const item of e.timeline || []) {
      if (item.event === 'documentation') {
        events.push({
          kind: 'documentation',
          at: item.at,
          ref: { encounterId: e._id, note: item.note, actorId: item.actorId },
        });
      }
    }
  }
  for (const m of medications) {
    for (const point of medicationTimelinePoints(m)) {
      events.push({
        kind: 'medication',
        at: point.at,
        ref: { ...m, activity: point.action, label: point.label, detail: point.detail },
      });
    }
  }
  for (const c of conditions) {
    events.push({ kind: 'condition', at: c.onsetDate || c.createdAt, ref: c });
  }
  for (const dx of diagnoses) {
    events.push({ kind: 'diagnosis', at: dx.recordedAt, ref: { ...dx, activity: 'recorded' } });
    if (dx.promotedAt) {
      events.push({ kind: 'diagnosis', at: dx.promotedAt, ref: { ...dx, activity: 'promoted' } });
    }
  }
  for (const n of notes) events.push({ kind: 'note', at: n.createdAt, ref: n });
  for (const t of tasks) events.push({ kind: 'task', at: t.dueDate || t.createdAt, ref: t });
  for (const point of timelinePointsForCarePlans(carePlans, careGoals, careInterventions)) {
    events.push({
      kind: 'care_plan',
      at: point.at,
      ref: {
        activity: point.action,
        label: point.label,
        detail: point.detail,
        carePlanId: point.carePlanId,
      },
    });
  }
  for (const a of allergies) events.push({ kind: 'allergy', at: a.recordedDate || a.createdAt, ref: a });
  for (const appt of appointments) events.push({ kind: 'appointment', at: appt.startTime, ref: appt });
  for (const visit of visits) {
    events.push({ kind: 'visit', at: visit.arrivalAt || visit.createdAt, ref: visit });
  }
  for (const point of timelinePointsForOrders(orders, orderResults)) {
    events.push({
      kind: 'order',
      at: point.at,
      ref: { activity: point.action, label: point.label, detail: point.detail },
    });
  }
  for (const point of timelinePointsForReferrals(referrals)) {
    events.push({
      kind: 'referral',
      at: point.at,
      ref: { activity: point.action, label: point.label, detail: point.detail },
    });
  }
  for (const point of timelinePointsForMonitoring(monitoringPrograms, monitoringMetrics, recalls)) {
    events.push({
      kind: 'monitoring',
      at: point.at,
      ref: { activity: point.action, label: point.label, detail: point.detail },
    });
  }

  events.sort((a, b) => b.at.getTime() - a.at.getTime());
  return events;
}
