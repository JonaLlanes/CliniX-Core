import mongoose, { Schema, Document, Types } from 'mongoose';
import {
  VISIT_STATUSES,
  VISIT_TIMELINE_EVENTS,
  type VisitStatus,
  type VisitTimelineEventName,
} from '../types/visits.js';

export interface IVisitTimelineEvent {
  event: VisitTimelineEventName;
  at: Date;
  actorId: Types.ObjectId;
  examRoom?: string;
  note?: string;
}

// Operational visit. Clinical documentation stays on Encounter and is not created here.
export interface IVisit extends Document {
  appointmentId: Types.ObjectId;
  patientId: Types.ObjectId;
  providerId: Types.ObjectId;
  status: VisitStatus;
  arrivalAt?: Date;
  roomedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  examRoom?: string | null;
  demographicsVerified: boolean;
  healthCardVerified: boolean;
  note?: string;
  cancelReason?: string;
  timeline: IVisitTimelineEvent[];
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const timelineSchema = new Schema<IVisitTimelineEvent>(
  {
    event: { type: String, enum: VISIT_TIMELINE_EVENTS, required: true },
    at: { type: Date, required: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    examRoom: { type: String, trim: true },
    note: { type: String, trim: true },
  },
  { _id: false }
);

const visitSchema = new Schema<IVisit>(
  {
    appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment', required: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, enum: VISIT_STATUSES, required: true, default: 'arrived' },
    arrivalAt: { type: Date },
    roomedAt: { type: Date },
    startedAt: { type: Date },
    completedAt: { type: Date },
    examRoom: { type: String, trim: true, default: null },
    demographicsVerified: { type: Boolean, required: true, default: false },
    healthCardVerified: { type: Boolean, required: true, default: false },
    note: { type: String, trim: true },
    cancelReason: { type: String, trim: true },
    timeline: { type: [timelineSchema], default: [] },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

visitSchema.index(
  { appointmentId: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } }
);
visitSchema.index({ status: 1, arrivalAt: 1 });
visitSchema.index({ arrivalAt: 1 });
visitSchema.index({ providerId: 1, status: 1, arrivalAt: 1 });
visitSchema.index({ patientId: 1, createdAt: -1 });

export const Visit = mongoose.model<IVisit>('Visit', visitSchema);
