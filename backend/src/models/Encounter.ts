import mongoose, { Schema, Document, Types } from 'mongoose';
import {
  APPOINTMENT_TYPES,
  CLINIC_LOCATIONS,
  type AppointmentType,
  type ClinicLocation,
} from '../types/appointments.js';
import {
  ENCOUNTER_STATUSES,
  ENCOUNTER_TIMELINE_EVENTS,
  type EncounterStatus,
  type EncounterTimelineEventName,
} from '../types/encounters.js';

export interface IEncounterTimelineEvent {
  event: EncounterTimelineEventName;
  at: Date;
  actorId: Types.ObjectId;
  note?: string;
}

/**
 * Provider-owned clinical encounter for one visit.
 * Diagnoses are stored on EncounterDiagnosis and shown on the encounter timeline.
 * Medications linked to this encounter are shown on the same timeline.
 * Local orders linked to this encounter are shown on the same timeline.
 * Care plans linked to this encounter are shown on the same timeline.
 * A documentation module is still separate.
 * A `documentation` timeline event is reserved for that module.
 */
export interface IEncounter extends Document {
  patientId: Types.ObjectId;
  visitId: Types.ObjectId;
  appointmentId: Types.ObjectId;
  attendingProviderId: Types.ObjectId;
  supervisingProviderId?: Types.ObjectId | null;
  clinicLocation: ClinicLocation;
  appointmentType: AppointmentType;
  chiefComplaint: string;
  reasonForVisit: string;
  status: EncounterStatus;
  isCurrent: boolean;
  createdBy: Types.ObjectId;
  signedBy?: Types.ObjectId | null;
  signedAt?: Date | null;
  openedAt: Date;
  amendsEncounterId?: Types.ObjectId | null;
  timeline: IEncounterTimelineEvent[];
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const timelineSchema = new Schema<IEncounterTimelineEvent>(
  {
    event: { type: String, enum: ENCOUNTER_TIMELINE_EVENTS, required: true },
    at: { type: Date, required: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    note: { type: String, trim: true },
  },
  { _id: false }
);

const encounterSchema = new Schema<IEncounter>(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    visitId: { type: Schema.Types.ObjectId, ref: 'Visit', required: true },
    appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment', required: true, index: true },
    attendingProviderId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    supervisingProviderId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    clinicLocation: { type: String, enum: CLINIC_LOCATIONS, required: true },
    appointmentType: { type: String, enum: APPOINTMENT_TYPES, required: true },
    chiefComplaint: { type: String, required: true, trim: true, maxlength: 500 },
    reasonForVisit: { type: String, required: true, trim: true, maxlength: 1000 },
    status: { type: String, enum: ENCOUNTER_STATUSES, required: true, default: 'open' },
    isCurrent: { type: Boolean, required: true, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    signedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    signedAt: { type: Date, default: null },
    openedAt: { type: Date, required: true },
    amendsEncounterId: { type: Schema.Types.ObjectId, ref: 'Encounter', default: null },
    timeline: { type: [timelineSchema], default: [] },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

encounterSchema.index({ patientId: 1, openedAt: -1 });
encounterSchema.index({ isCurrent: 1, status: 1 });
encounterSchema.index({ amendsEncounterId: 1 });
encounterSchema.index(
  { visitId: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null, isCurrent: true } }
);

export const Encounter = mongoose.model<IEncounter>('Encounter', encounterSchema);
