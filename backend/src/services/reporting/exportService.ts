import type { PipelineStage } from 'mongoose';
import type { Response } from 'express';
import { Appointment } from '../../models/Appointment.js';
import { Order } from '../../models/Order.js';
import { Patient } from '../../models/Patient.js';
import { Recall } from '../../models/Recall.js';
import { Referral } from '../../models/Referral.js';
import { User } from '../../models/User.js';
import { CLINIC_TIME_ZONE } from '../../utils/clinicTime.js';
import { cohortCsvRows } from './cohortService.js';
import type { ReportRange } from './range.js';

const PATIENT_PROJECT = { $project: { mrn: 1, givenName: 1, familyName: 1, preferredName: 1 } };

interface NamedPatient {
  mrn?: string;
  givenName?: string;
  familyName?: string;
  preferredName?: string;
}

export interface CsvExport {
  filename: string;
  headers: string[];
  rows: AsyncIterable<unknown[]>;
}

export async function openExport(kind: string, range: ReportRange): Promise<CsvExport | null> {
  const filename = `${kind}-${range.fromDate}_${range.toDate}.csv`;
  if (kind === 'appointments') {
    return { filename, headers: APPOINTMENT_HEADERS, rows: appointmentRows(range) };
  }
  if (kind === 'referrals') {
    return { filename, headers: REFERRAL_HEADERS, rows: referralRows(range) };
  }
  if (kind === 'orders') {
    return { filename, headers: ORDER_HEADERS, rows: orderRows(range) };
  }
  if (kind === 'recalls') {
    return { filename, headers: RECALL_HEADERS, rows: recallRows(range) };
  }
  if (kind === 'cohorts') {
    return { filename, headers: COHORT_HEADERS, rows: cohortRows(range) };
  }
  return null;
}

export async function sendCsv(res: Response, exp: CsvExport) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${exp.filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.write(`\uFEFF${csvLine(exp.headers)}\n`);
  for await (const row of exp.rows) {
    res.write(`${csvLine(row)}\n`);
  }
  res.end();
}

const APPOINTMENT_HEADERS = [
  'Patient MRN',
  'Patient',
  'Provider',
  'Location',
  'Type',
  'Status',
  'Start',
  'End',
  'Cancel reason',
];

async function* appointmentRows(range: ReportRange) {
  const cursor = Appointment.aggregate(appointmentPipeline(range)).cursor();
  for await (const row of cursor) {
    const patient = row.patient as NamedPatient | undefined;
    yield [
      patient?.mrn ?? '',
      personName(patient),
      row.providerName ?? '',
      row.clinicLocation ?? '',
      labelize(row.appointmentType),
      labelize(row.status),
      formatWhen(row.startTime),
      formatWhen(row.endTime),
      row.cancelReason ?? '',
    ];
  }
}

function appointmentPipeline(range: ReportRange): PipelineStage[] {
  return [
    { $match: { deletedAt: null, startTime: { $gte: range.from, $lt: range.to } } },
    { $sort: { startTime: 1 } },
    lookupPatient('patientId'),
    {
      $lookup: {
        from: User.collection.name,
        localField: 'providerId',
        foreignField: '_id',
        pipeline: [{ $project: { displayName: 1 } }],
        as: 'provider',
      },
    },
    {
      $project: {
        status: 1,
        appointmentType: 1,
        clinicLocation: 1,
        startTime: 1,
        endTime: 1,
        cancelReason: 1,
        patient: { $arrayElemAt: ['$patient', 0] },
        providerName: { $arrayElemAt: ['$provider.displayName', 0] },
      },
    },
  ] as PipelineStage[];
}

const REFERRAL_HEADERS = [
  'Patient MRN',
  'Patient',
  'Referral date',
  'Status',
  'Type',
  'Specialty',
  'Specialist',
  'Organization',
  'Priority',
  'Follow-up required',
  'Completed at',
  'Cancelled at',
];

async function* referralRows(range: ReportRange) {
  const cursor = Referral.aggregate([
    {
      $match: {
        deletedAt: null,
        $or: [
          { referralDate: { $gte: range.from, $lt: range.to } },
          { completedAt: { $gte: range.from, $lt: range.to } },
          { cancelledAt: { $gte: range.from, $lt: range.to } },
          {
            followUpRequired: true,
            status: { $nin: ['cancelled', 'closed', 'draft'] },
          },
        ],
      },
    },
    { $sort: { referralDate: 1 } },
    lookupPatient('patientId'),
    {
      $project: {
        referralDate: 1,
        status: 1,
        referralType: 1,
        specialty: 1,
        specialistName: 1,
        organization: 1,
        priority: 1,
        followUpRequired: 1,
        completedAt: 1,
        cancelledAt: 1,
        patient: { $arrayElemAt: ['$patient', 0] },
      },
    },
  ] as PipelineStage[]).cursor();

  for await (const row of cursor) {
    const patient = row.patient as NamedPatient | undefined;
    yield [
      patient?.mrn ?? '',
      personName(patient),
      formatWhen(row.referralDate),
      labelize(row.status),
      labelize(row.referralType),
      row.specialty ?? '',
      row.specialistName ?? '',
      row.organization ?? '',
      labelize(row.priority),
      row.followUpRequired ? 'Yes' : 'No',
      formatWhen(row.completedAt),
      formatWhen(row.cancelledAt),
    ];
  }
}

const ORDER_HEADERS = [
  'Patient MRN',
  'Patient',
  'Order',
  'Type',
  'Priority',
  'Status',
  'Ordered at',
  'Resulted at',
  'Completed at',
  'Cancelled at',
];

async function* orderRows(range: ReportRange) {
  const cursor = Order.aggregate([
    {
      $match: {
        deletedAt: null,
        $or: [
          { orderedAt: { $gte: range.from, $lt: range.to } },
          { completedAt: { $gte: range.from, $lt: range.to } },
          { cancelledAt: { $gte: range.from, $lt: range.to } },
          { status: { $in: ['draft', 'ordered', 'scheduled', 'collected', 'resulted'] } },
        ],
      },
    },
    { $sort: { orderedAt: 1, createdAt: 1 } },
    lookupPatient('patientId'),
    {
      $project: {
        orderName: 1,
        orderType: 1,
        priority: 1,
        status: 1,
        orderedAt: 1,
        resultedAt: 1,
        completedAt: 1,
        cancelledAt: 1,
        patient: { $arrayElemAt: ['$patient', 0] },
      },
    },
  ] as PipelineStage[]).cursor();

  for await (const row of cursor) {
    const patient = row.patient as NamedPatient | undefined;
    yield [
      patient?.mrn ?? '',
      personName(patient),
      row.orderName ?? '',
      labelize(row.orderType),
      labelize(row.priority),
      labelize(row.status),
      formatWhen(row.orderedAt),
      formatWhen(row.resultedAt),
      formatWhen(row.completedAt),
      formatWhen(row.cancelledAt),
    ];
  }
}

const RECALL_HEADERS = [
  'Patient MRN',
  'Patient',
  'Reason',
  'Status',
  'Due',
  'Completed at',
  'Cancelled at',
];

async function* recallRows(range: ReportRange) {
  const cursor = Recall.aggregate([
    {
      $match: {
        deletedAt: null,
        $or: [
          { dueDate: { $gte: range.from, $lt: range.to } },
          { completedAt: { $gte: range.from, $lt: range.to } },
          { cancelledAt: { $gte: range.from, $lt: range.to } },
        ],
      },
    },
    { $sort: { dueDate: 1 } },
    lookupPatient('patientId'),
    {
      $project: {
        reason: 1,
        status: 1,
        dueDate: 1,
        completedAt: 1,
        cancelledAt: 1,
        patient: { $arrayElemAt: ['$patient', 0] },
      },
    },
  ] as PipelineStage[]).cursor();

  for await (const row of cursor) {
    const patient = row.patient as NamedPatient | undefined;
    yield [
      patient?.mrn ?? '',
      personName(patient),
      row.reason ?? '',
      labelize(row.status),
      formatWhen(row.dueDate),
      formatWhen(row.completedAt),
      formatWhen(row.cancelledAt),
    ];
  }
}

const COHORT_HEADERS = [
  'Cohort',
  'Patient MRN',
  'Patient',
  'Active care plans',
  'Overdue recalls',
  'Abnormal readings',
];

async function* cohortRows(range: ReportRange) {
  const rows = await cohortCsvRows(range);
  for (const row of rows) {
    yield [
      row.cohort,
      row.mrn,
      row.name,
      row.activeCarePlans,
      row.overdueRecalls,
      row.abnormalReadings,
    ];
  }
}

function lookupPatient(localField: string): PipelineStage {
  return {
    $lookup: {
      from: Patient.collection.name,
      localField,
      foreignField: '_id',
      pipeline: [PATIENT_PROJECT],
      as: 'patient',
    },
  };
}

function personName(patient?: NamedPatient) {
  if (!patient) return '';
  const preferred =
    patient.preferredName && patient.preferredName !== patient.givenName
      ? ` (${patient.preferredName})`
      : '';
  return `${patient.familyName || ''}, ${patient.givenName || ''}${preferred}`.replace(/^, /, '');
}

function labelize(value: unknown) {
  if (value == null || value === '') return '';
  return String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatWhen(value: unknown) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CLINIC_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${pick('year')}-${pick('month')}-${pick('day')} ${pick('hour')}:${pick('minute')}`;
}

function csvLine(values: unknown[]) {
  return values.map(csvCell).join(',');
}

function csvCell(value: unknown) {
  if (value == null) return '';
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}
