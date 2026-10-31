import { Types } from 'mongoose';
import { Appointment, type IAppointment } from '../models/Appointment.js';
import { Patient } from '../models/Patient.js';
import { User } from '../models/User.js';
import { HttpError } from '../middleware/error.js';
import { notDeleted, paginated } from '../utils/pagination.js';
import { clinicDayRange, formatClinicRange } from '../utils/clinicTime.js';
import {
  APPOINTMENT_HOLDING_STATUSES,
  APPOINTMENT_TRANSITIONS,
  CANCELLABLE_STATUSES,
  RESCHEDULABLE_STATUSES,
  type AppointmentStatus,
  type AppointmentType,
  type ClinicLocation,
} from '../types/appointments.js';

const PATIENT_FIELDS = 'givenName familyName preferredName mrn';
const PROVIDER_FIELDS = 'displayName role';

export type AppointmentInput = {
  patientId: string;
  providerId: string;
  clinicLocation: ClinicLocation;
  appointmentType: AppointmentType;
  startTime: Date;
  endTime: Date;
  status?: 'booked' | 'confirmed';
};

type ConflictKind = 'provider' | 'patient';

async function populateAppointment(doc: IAppointment) {
  await doc.populate([
    { path: 'patientId', select: PATIENT_FIELDS },
    { path: 'providerId', select: PROVIDER_FIELDS },
  ]);
  return doc;
}

function displayPatient(value: unknown) {
  if (!value || typeof value !== 'object') return 'patient';
  const person = value as { givenName?: string; familyName?: string; preferredName?: string };
  if (!person.familyName && !person.givenName) return 'patient';
  const preferred =
    person.preferredName && person.preferredName !== person.givenName
      ? ` (${person.preferredName})`
      : '';
  return `${person.familyName}, ${person.givenName}${preferred}`;
}

function displayProvider(value: unknown) {
  if (!value || typeof value !== 'object') return 'provider';
  const provider = value as { displayName?: string };
  return provider.displayName || 'provider';
}

export async function assertBookableProvider(providerId: string) {
  if (!Types.ObjectId.isValid(providerId)) {
    throw new HttpError(400, 'Expected an id');
  }
  const provider = await User.findById(providerId).select('displayName role');
  if (!provider) throw new HttpError(404, 'Provider not found');
  if (provider.role !== 'clinician' && provider.role !== 'nurse') {
    throw new HttpError(400, 'Provider must be a clinician or nurse');
  }
  return provider;
}

export async function assertActivePatient(patientId: string) {
  if (!Types.ObjectId.isValid(patientId)) {
    throw new HttpError(400, 'Expected an id');
  }
  const patient = await Patient.findOne({ _id: patientId, ...notDeleted });
  if (!patient) throw new HttpError(404, 'Patient not found');
  return patient;
}

export async function assertNoConflict(input: {
  patientId: string;
  providerId: string;
  startTime: Date;
  endTime: Date;
  excludeId?: string;
}) {
  const window = {
    ...notDeleted,
    status: { $in: APPOINTMENT_HOLDING_STATUSES },
    startTime: { $lt: input.endTime },
    endTime: { $gt: input.startTime },
    ...(input.excludeId ? { _id: { $ne: input.excludeId } } : {}),
  };

  const [providerHits, patientHits] = await Promise.all([
    Appointment.find({ ...window, providerId: input.providerId })
      .populate('patientId', PATIENT_FIELDS)
      .populate('providerId', PROVIDER_FIELDS),
    Appointment.find({ ...window, patientId: input.patientId })
      .populate('patientId', PATIENT_FIELDS)
      .populate('providerId', PROVIDER_FIELDS),
  ]);

  const merged = new Map<string, { doc: IAppointment; kinds: ConflictKind[] }>();
  const add = (doc: IAppointment, kind: ConflictKind) => {
    const id = String(doc._id);
    const existing = merged.get(id);
    if (existing) {
      if (!existing.kinds.includes(kind)) existing.kinds.push(kind);
      return;
    }
    merged.set(id, { doc, kinds: [kind] });
  };
  providerHits.forEach((doc) => add(doc, 'provider'));
  patientHits.forEach((doc) => add(doc, 'patient'));

  if (merged.size === 0) return;

  const details = [...merged.values()].map(({ doc, kinds }) => {
    const who =
      kinds.includes('provider') && kinds.includes('patient')
        ? 'Provider and patient'
        : kinds.includes('provider')
          ? 'Provider'
          : 'Patient';
    return {
      path: kinds.join(','),
      message: `${who} already booked: ${displayPatient(doc.patientId)} with ${displayProvider(doc.providerId)}, ${formatClinicRange(doc.startTime, doc.endTime)}`,
    };
  });

  throw new HttpError(409, 'This time conflicts with an existing appointment', details);
}

export async function createAppointment(input: AppointmentInput) {
  await assertActivePatient(input.patientId);
  await assertBookableProvider(input.providerId);
  await assertNoConflict(input);
  const doc = await Appointment.create({
    patientId: input.patientId,
    providerId: input.providerId,
    clinicLocation: input.clinicLocation,
    appointmentType: input.appointmentType,
    startTime: input.startTime,
    endTime: input.endTime,
    status: input.status ?? 'booked',
  });
  return doc;
}

export async function getAppointment(id: string) {
  if (!Types.ObjectId.isValid(id)) throw new HttpError(400, 'Expected an id');
  const doc = await Appointment.findOne({ _id: id, ...notDeleted });
  if (!doc) throw new HttpError(404, 'Appointment not found');
  return doc;
}

export async function listAppointments(
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  skip: number,
  sort: Record<string, 1 | -1> = { startTime: -1 }
) {
  const query = { ...notDeleted, ...filter };
  const [data, total] = await Promise.all([
    Appointment.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('patientId', PATIENT_FIELDS)
      .populate('providerId', PROVIDER_FIELDS),
    Appointment.countDocuments(query),
  ]);
  return paginated(data, total, page, limit);
}

export async function listProviderDay(
  providerId: string,
  date: string,
  patientIds: Types.ObjectId[] | null
) {
  await assertBookableProvider(providerId);
  const range = clinicDayRange(date);
  if (!range) throw new HttpError(400, 'date must be YYYY-MM-DD');
  const filter: Record<string, unknown> = {
    ...notDeleted,
    providerId,
    startTime: { $gte: range.start, $lt: range.end },
  };
  if (patientIds) filter.patientId = { $in: patientIds };
  return Appointment.find(filter)
    .sort({ startTime: 1 })
    .populate('patientId', PATIENT_FIELDS)
    .populate('providerId', PROVIDER_FIELDS);
}

export async function listBookableProviders() {
  return User.find({ role: { $in: ['clinician', 'nurse'] } })
    .select('displayName role')
    .sort({ displayName: 1 });
}

export async function updateAppointment(
  doc: IAppointment,
  patch: {
    status?: AppointmentStatus;
    clinicLocation?: ClinicLocation;
    appointmentType?: AppointmentType;
  }
) {
  if (patch.status && patch.status !== doc.status) {
    if (patch.status === 'cancelled') {
      throw new HttpError(400, 'Use cancel to cancel an appointment');
    }
    const allowed = APPOINTMENT_TRANSITIONS[doc.status];
    if (!allowed.includes(patch.status)) {
      throw new HttpError(
        400,
        `Cannot change status from ${doc.status.replace('_', ' ')} to ${patch.status.replace('_', ' ')}`
      );
    }
    doc.status = patch.status;
  }
  if (patch.clinicLocation) doc.clinicLocation = patch.clinicLocation;
  if (patch.appointmentType) doc.appointmentType = patch.appointmentType;
  await doc.save();
  return doc;
}

export async function rescheduleAppointment(
  doc: IAppointment,
  startTime: Date,
  endTime: Date
) {
  if (!RESCHEDULABLE_STATUSES.includes(doc.status)) {
    throw new HttpError(400, 'Only booked, confirmed, or no-show appointments can be rescheduled');
  }
  await assertNoConflict({
    patientId: String(doc.patientId),
    providerId: String(doc.providerId),
    startTime,
    endTime,
    excludeId: String(doc._id),
  });
  doc.startTime = startTime;
  doc.endTime = endTime;
  if (doc.status === 'no_show') doc.status = 'booked';
  await doc.save();
  return doc;
}

export async function cancelAppointment(doc: IAppointment, reason?: string) {
  if (!CANCELLABLE_STATUSES.includes(doc.status)) {
    throw new HttpError(400, 'Only booked, confirmed, or arrived appointments can be cancelled');
  }
  doc.status = 'cancelled';
  doc.cancelReason = reason || undefined;
  await doc.save();
  return doc;
}

export { populateAppointment };
