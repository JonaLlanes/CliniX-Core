import { Types } from 'mongoose';
import { Appointment, type IAppointment } from '../models/Appointment.js';
import { Visit, type IVisit } from '../models/Visit.js';
import { HttpError } from '../middleware/error.js';
import { notDeleted } from '../utils/pagination.js';
import { clinicDayRange } from '../utils/clinicTime.js';
import {
  APPOINTMENT_TRANSITIONS,
  CANCELLABLE_STATUSES,
  type AppointmentStatus,
} from '../types/appointments.js';
import {
  CHECK_IN_QUEUE,
  CLOSED_STATUSES,
  EXAM_ROOMS,
  FLOOR_STATUSES,
  PROVIDER_WAITING,
  ROOMABLE_STATUSES,
  VISIT_TRANSITIONS,
  appointmentStatusForVisit,
  roomsFor,
  type VisitStatus,
  type VisitStatusInput,
  type VisitTimelineEventName,
} from '../types/visits.js';
import { ENCOUNTER_SOURCE_VISIT_STATUSES } from '../types/encounters.js';
import { assertBookableProvider, getAppointment } from './appointmentService.js';

const PATIENT_FIELDS =
  'givenName familyName preferredName mrn birthDate sex genderIdentity language contact address provincialHealth';
const PROVIDER_FIELDS = 'displayName role';

export type VisitChange = {
  visit: IVisit;
  appointment: IAppointment;
  appointmentBefore: Record<string, unknown>;
  visitBefore: Record<string, unknown> | null;
  created: boolean;
  appointmentChanged: boolean;
};

type BoardRow = {
  appointment: IAppointment;
  visit: IVisit | null;
};

function snapshot(doc: { toObject: () => object }) {
  return doc.toObject() as unknown as Record<string, unknown>;
}

function isDuplicate(err: unknown) {
  return Boolean(err && typeof err === 'object' && 'code' in err && (err as { code: number }).code === 11000);
}

function statusLabel(status: string) {
  return status.replaceAll('_', ' ');
}

function pushTimeline(
  visit: IVisit,
  event: VisitTimelineEventName,
  actorId: string,
  extra?: { examRoom?: string | null; note?: string }
) {
  visit.timeline.push({
    event,
    at: new Date(),
    actorId: new Types.ObjectId(actorId),
    examRoom: extra?.examRoom || undefined,
    note: extra?.note || undefined,
  });
}

async function applyAppointmentStatus(
  appointment: IAppointment,
  visitStatus: VisitStatus,
  reason?: string
) {
  const target = appointmentStatusForVisit(visitStatus);
  if (appointment.status === target) return false;
  if (target === 'cancelled') {
    if (!CANCELLABLE_STATUSES.includes(appointment.status)) {
      throw new HttpError(400, 'This appointment can no longer be cancelled');
    }
    appointment.status = 'cancelled';
    if (reason) appointment.cancelReason = reason;
    await appointment.save();
    return true;
  }
  const allowed = APPOINTMENT_TRANSITIONS[appointment.status];
  if (!allowed.includes(target)) {
    throw new HttpError(
      400,
      `Cannot change appointment from ${statusLabel(appointment.status)} to ${statusLabel(target)}`
    );
  }
  appointment.status = target;
  await appointment.save();
  return true;
}

function changeResult(
  visit: IVisit,
  appointment: IAppointment,
  appointmentBefore: Record<string, unknown>,
  visitBefore: Record<string, unknown> | null,
  created: boolean,
  appointmentChanged: boolean
): VisitChange {
  return { visit, appointment, appointmentBefore, visitBefore, created, appointmentChanged };
}

export async function checkInVisit(
  input: { appointmentId: string; note?: string },
  actorId: string
): Promise<VisitChange> {
  const appointment = await getAppointment(input.appointmentId);
  if (!['booked', 'confirmed', 'arrived'].includes(appointment.status)) {
    throw new HttpError(400, 'Only booked, confirmed, or arrived appointments can be checked in');
  }
  const appointmentBefore = snapshot(appointment);
  const existing = await Visit.findOne({ appointmentId: appointment._id, ...notDeleted });
  const now = new Date();

  if (existing && !['booked', 'confirmed', 'arrived'].includes(existing.status)) {
    throw new HttpError(409, 'This appointment is already checked in');
  }

  if (
    existing &&
    existing.status === 'arrived' &&
    existing.demographicsVerified &&
    existing.healthCardVerified
  ) {
    const appointmentChanged = await applyAppointmentStatus(appointment, 'arrived');
    return changeResult(existing, appointment, appointmentBefore, snapshot(existing), false, appointmentChanged);
  }

  if (existing) {
    const visitBefore = snapshot(existing);
    existing.demographicsVerified = true;
    existing.healthCardVerified = true;
    if (input.note) existing.note = input.note;
    if (!existing.arrivalAt) existing.arrivalAt = now;
    existing.status = 'arrived';
    if (!existing.timeline.some((event) => event.event === 'arrived')) {
      pushTimeline(existing, 'arrived', actorId, { note: input.note });
    }
    await existing.save();
    const appointmentChanged = await applyAppointmentStatus(appointment, 'arrived');
    return changeResult(existing, appointment, appointmentBefore, visitBefore, false, appointmentChanged);
  }

  let visit: IVisit;
  try {
    visit = await Visit.create({
      appointmentId: appointment._id,
      patientId: appointment.patientId,
      providerId: appointment.providerId,
      status: 'arrived',
      arrivalAt: now,
      demographicsVerified: true,
      healthCardVerified: true,
      note: input.note,
      timeline: [
        {
          event: 'arrived',
          at: now,
          actorId,
          note: input.note,
        },
      ],
    });
  } catch (err) {
    if (!isDuplicate(err)) throw err;
    const winner = await Visit.findOne({ appointmentId: appointment._id, ...notDeleted });
    if (!winner) throw new HttpError(409, 'This appointment is already checked in');
    const appointmentChanged = await applyAppointmentStatus(appointment, winner.status);
    return changeResult(winner, appointment, appointmentBefore, null, false, appointmentChanged);
  }

  const appointmentChanged = await applyAppointmentStatus(appointment, 'arrived');
  return changeResult(visit, appointment, appointmentBefore, null, true, appointmentChanged);
}

export async function assignVisitRoom(
  input: { appointmentId: string; examRoom: string },
  actorId: string
): Promise<VisitChange> {
  const appointment = await getAppointment(input.appointmentId);
  const appointmentBefore = snapshot(appointment);
  const visit = await Visit.findOne({ appointmentId: appointment._id, ...notDeleted });
  if (!visit) throw new HttpError(400, 'Check the patient in before assigning a room');
  if (!ROOMABLE_STATUSES.includes(visit.status)) {
    throw new HttpError(400, 'A room can be assigned after the patient arrives');
  }
  const rooms = roomsFor(appointment.clinicLocation);
  if (!rooms.includes(input.examRoom)) {
    throw new HttpError(400, 'That exam room is not used at this clinic');
  }
  if (visit.examRoom === input.examRoom) {
    throw new HttpError(400, 'Patient is already in that room');
  }

  const visitBefore = snapshot(visit);
  const previousRoom = visit.examRoom;
  const now = new Date();
  visit.examRoom = input.examRoom;
  if (!visit.roomedAt) visit.roomedAt = now;
  if (visit.status === 'arrived' || visit.status === 'waiting') {
    visit.status = 'roomed';
  }
  pushTimeline(visit, 'roomed', actorId, {
    examRoom: input.examRoom,
    note: previousRoom ? `Reassigned from ${previousRoom}` : undefined,
  });
  await visit.save();
  return changeResult(visit, appointment, appointmentBefore, visitBefore, false, false);
}

export async function setVisitStatus(
  input: { appointmentId: string; status: VisitStatusInput; reason?: string; note?: string },
  actorId: string
): Promise<VisitChange> {
  const appointment = await getAppointment(input.appointmentId);
  const appointmentBefore = snapshot(appointment);
  const existing = await Visit.findOne({ appointmentId: appointment._id, ...notDeleted });

  if (!existing) {
    if (input.status !== 'no_show' && input.status !== 'cancelled') {
      throw new HttpError(400, 'Check the patient in before updating visit status');
    }
    if (input.status === 'no_show' && !['confirmed', 'arrived'].includes(appointment.status)) {
      throw new HttpError(400, 'Only confirmed or arrived appointments can be marked as a no show');
    }
    if (input.status === 'cancelled' && !CANCELLABLE_STATUSES.includes(appointment.status)) {
      throw new HttpError(400, 'Only booked, confirmed, or arrived appointments can be cancelled');
    }
    const visit = new Visit({
      appointmentId: appointment._id,
      patientId: appointment.patientId,
      providerId: appointment.providerId,
      status: input.status,
      demographicsVerified: false,
      healthCardVerified: false,
      cancelReason: input.status === 'cancelled' ? input.reason : undefined,
      note: input.note,
      timeline: [],
    });
    const appointmentChanged = await applyAppointmentStatus(appointment, input.status, input.reason);
    await visit.save();
    return changeResult(visit, appointment, appointmentBefore, null, true, appointmentChanged);
  }

  if (input.status === existing.status) {
    throw new HttpError(400, 'Status is unchanged');
  }
  const allowed = VISIT_TRANSITIONS[existing.status];
  if (!allowed.includes(input.status)) {
    throw new HttpError(
      400,
      `Cannot change status from ${statusLabel(existing.status)} to ${statusLabel(input.status)}`
    );
  }
  if (input.status === 'in_progress' && !existing.examRoom) {
    throw new HttpError(400, 'Assign an exam room before starting the visit');
  }

  const visitBefore = snapshot(existing);
  const previousStatus = existing.status;
  const previousRoom = existing.examRoom;
  const now = new Date();

  if (input.status === 'waiting') {
    if (previousStatus === 'roomed') existing.examRoom = null;
    const note = [
      previousStatus === 'roomed' && previousRoom ? `Returned from ${previousRoom}` : '',
      input.note || '',
    ]
      .filter(Boolean)
      .join('. ');
    pushTimeline(existing, 'waiting', actorId, { note: note || undefined });
  }
  if (input.status === 'in_progress') {
    existing.startedAt = existing.startedAt ?? now;
    pushTimeline(existing, 'in_progress', actorId, {
      examRoom: existing.examRoom,
      note: input.note,
    });
  }
  if (input.status === 'completed') {
    existing.completedAt = now;
    pushTimeline(existing, 'completed', actorId, { note: input.note });
  }
  if (input.status === 'cancelled') {
    existing.cancelReason = input.reason || existing.cancelReason;
  }
  if (input.note) existing.note = input.note;
  existing.status = input.status;
  const appointmentChanged = await applyAppointmentStatus(appointment, input.status, input.reason);
  await existing.save();
  return changeResult(existing, appointment, appointmentBefore, visitBefore, false, appointmentChanged);
}

const LAUNCHABLE_VISIT = new Set<string>(ENCOUNTER_SOURCE_VISIT_STATUSES);

/** Move a waiting or roomed visit to in progress when a provider opens the encounter. */
export async function beginVisitEncounter(visit: IVisit, actorId: string) {
  if (!LAUNCHABLE_VISIT.has(visit.status)) {
    throw new HttpError(400, 'An encounter can start when the visit is waiting, roomed, or in progress');
  }
  const before = snapshot(visit);
  if (visit.status === 'in_progress') {
    return { visit, before, changed: false };
  }
  const now = new Date();
  visit.startedAt = visit.startedAt ?? now;
  visit.status = 'in_progress';
  pushTimeline(visit, 'in_progress', actorId, { examRoom: visit.examRoom });
  await visit.save();
  return { visit, before, changed: true };
}

function rowStatus(row: BoardRow): VisitStatus {
  if (row.visit) return row.visit.status;
  return row.appointment.status as VisitStatus;
}

function timeOf(value?: Date | null) {
  return value ? new Date(value).getTime() : Number.MAX_SAFE_INTEGER;
}

function sortBy(rows: BoardRow[], read: (row: BoardRow) => Date | undefined | null) {
  return [...rows].sort((a, b) => {
    const at = timeOf(read(a) ?? a.appointment.startTime);
    const bt = timeOf(read(b) ?? b.appointment.startTime);
    return at - bt;
  });
}

export async function getVisitBoard(input: {
  date: string;
  providerId?: string;
  location?: string;
  patientIds: Types.ObjectId[] | null;
}) {
  if (input.providerId) await assertBookableProvider(input.providerId);
  const range = clinicDayRange(input.date);
  if (!range) throw new HttpError(400, 'date must be YYYY-MM-DD');

  const filter: Record<string, unknown> = {
    ...notDeleted,
    startTime: { $gte: range.start, $lt: range.end },
  };
  if (input.providerId) filter.providerId = input.providerId;
  if (input.location) filter.clinicLocation = input.location;
  if (input.patientIds) filter.patientId = { $in: input.patientIds };

  const appointments = await Appointment.find(filter)
    .sort({ startTime: 1 })
    .populate('patientId', PATIENT_FIELDS)
    .populate('providerId', PROVIDER_FIELDS);

  const visits = await Visit.find({
    appointmentId: { $in: appointments.map((item) => item._id) },
    ...notDeleted,
  }).populate('timeline.actorId', PROVIDER_FIELDS);

  const visitByAppointment = new Map(visits.map((visit) => [String(visit.appointmentId), visit]));
  const rows: BoardRow[] = appointments.map((appointment) => ({
    appointment,
    visit: visitByAppointment.get(String(appointment._id)) ?? null,
  }));

  const checkIn = rows.filter((row) => CHECK_IN_QUEUE.includes(rowStatus(row)));
  const floor = rows.filter((row) => FLOOR_STATUSES.includes(rowStatus(row)));
  const waitingRoom = sortBy(floor, (row) => row.visit?.arrivalAt);
  const closed = rows.filter((row) => CLOSED_STATUSES.includes(rowStatus(row)));

  return {
    date: input.date,
    examRooms: EXAM_ROOMS,
    checkIn,
    waitingRoom,
    providerQueue: {
      waiting: sortBy(
        floor.filter((row) => PROVIDER_WAITING.includes(rowStatus(row))),
        (row) => row.visit?.arrivalAt
      ),
      roomed: sortBy(
        floor.filter((row) => rowStatus(row) === 'roomed'),
        (row) => row.visit?.roomedAt
      ),
      inProgress: sortBy(
        floor.filter((row) => rowStatus(row) === 'in_progress'),
        (row) => row.visit?.startedAt
      ),
    },
    closed,
  };
}

export async function getVisit(id: string) {
  if (!Types.ObjectId.isValid(id)) throw new HttpError(400, 'Expected an id');
  const visit = await Visit.findOne({ _id: id, ...notDeleted });
  if (!visit) throw new HttpError(404, 'Visit not found');
  return visit;
}

export async function listPatientVisits(patientId: string) {
  return Visit.find({ patientId, ...notDeleted })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate('timeline.actorId', PROVIDER_FIELDS)
    .populate('providerId', PROVIDER_FIELDS)
    .populate('appointmentId', 'startTime endTime appointmentType clinicLocation status cancelReason');
}

/** Keep an existing visit aligned when the appointment is changed from the schedule. */
export async function syncVisitWithAppointment(appointment: IAppointment, actorId: string) {
  const visit = await Visit.findOne({ appointmentId: appointment._id, ...notDeleted });
  if (!visit) return null;
  if (visit.status === 'completed' || visit.status === 'cancelled') return null;

  const next = alignedVisitStatus(visit.status, appointment.status);
  if (!next || next === visit.status) return null;

  const visitBefore = snapshot(visit);
  const now = new Date();
  if (next === 'arrived') {
    if (!visit.arrivalAt) visit.arrivalAt = now;
    if (!visit.timeline.some((event) => event.event === 'arrived')) {
      pushTimeline(visit, 'arrived', actorId);
    }
  }
  if (next === 'completed') {
    visit.completedAt = visit.completedAt ?? now;
    if (!visit.timeline.some((event) => event.event === 'completed')) {
      pushTimeline(visit, 'completed', actorId);
    }
  }
  if (next === 'cancelled' && appointment.cancelReason) {
    visit.cancelReason = appointment.cancelReason;
  }
  visit.status = next;
  await visit.save();
  return { visit, visitBefore };
}

function alignedVisitStatus(current: VisitStatus, appointmentStatus: AppointmentStatus): VisitStatus | null {
  if (appointmentStatus === 'cancelled') return 'cancelled';
  if (appointmentStatus === 'completed') return 'completed';
  if (appointmentStatus === 'no_show') return 'no_show';
  if (appointmentStatus === 'booked' || appointmentStatus === 'confirmed') {
    if (current === 'no_show' || current === 'booked' || current === 'confirmed') return appointmentStatus;
    return null;
  }
  if (appointmentStatus === 'arrived' && (current === 'booked' || current === 'confirmed')) {
    return 'arrived';
  }
  return null;
}

export async function presentVisit(visit: IVisit, appointment: IAppointment) {
  await Promise.all([
    visit.populate('timeline.actorId', PROVIDER_FIELDS),
    appointment.populate('patientId', PATIENT_FIELDS),
    appointment.populate('providerId', PROVIDER_FIELDS),
  ]);
  return { visit, appointment };
}

export async function presentVisitOnly(visit: IVisit) {
  await visit.populate([
    { path: 'timeline.actorId', select: PROVIDER_FIELDS },
    { path: 'patientId', select: PATIENT_FIELDS },
    { path: 'providerId', select: PROVIDER_FIELDS },
    {
      path: 'appointmentId',
      select: 'startTime endTime appointmentType clinicLocation status cancelReason',
    },
  ]);
  return visit;
}
