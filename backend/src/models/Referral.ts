import mongoose, { Schema, Document, Types } from 'mongoose';
import {
  REFERRAL_PRIORITIES,
  REFERRAL_STATUSES,
  REFERRAL_TYPES,
  type ReferralPriority,
  type ReferralStatus,
  type ReferralType,
} from '../types/referrals.js';

/**
 * Internal referral from this chart to a specialist, allied health provider,
 * or community service. Status changes are appended. Referrals are cancelled,
 * not hard-deleted. This record does not send a fax, eReferral, or provincial message.
 */
export interface IReferralStatusEvent {
  status: ReferralStatus;
  at: Date;
  actorId: Types.ObjectId;
  note?: string;
}

export interface IReferral extends Document {
  patientId: Types.ObjectId;
  encounterId: Types.ObjectId;
  diagnosisId: Types.ObjectId;
  conditionId?: Types.ObjectId | null;
  carePlanId?: Types.ObjectId | null;
  createdBy: Types.ObjectId;
  referralType: ReferralType;
  specialty: string;
  specialistName: string;
  organization: string;
  reasonForReferral: string;
  priority: ReferralPriority;
  referralDate: Date;
  appointmentDate?: Date | null;
  outcomeReceivedDate?: Date | null;
  followUpRequired: boolean;
  sentAt?: Date | null;
  acceptedAt?: Date | null;
  scheduledAt?: Date | null;
  completedAt?: Date | null;
  closedAt?: Date | null;
  cancelledAt?: Date | null;
  status: ReferralStatus;
  statusHistory: IReferralStatusEvent[];
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const statusEventSchema = new Schema<IReferralStatusEvent>(
  {
    status: { type: String, enum: REFERRAL_STATUSES, required: true },
    at: { type: Date, required: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    note: { type: String, trim: true, maxlength: 500 },
  },
  { _id: true }
);

const referralSchema = new Schema<IReferral>(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    encounterId: { type: Schema.Types.ObjectId, ref: 'Encounter', required: true, index: true },
    diagnosisId: { type: Schema.Types.ObjectId, ref: 'EncounterDiagnosis', required: true, index: true },
    conditionId: { type: Schema.Types.ObjectId, ref: 'Condition', default: null },
    carePlanId: { type: Schema.Types.ObjectId, ref: 'CarePlan', default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    referralType: { type: String, enum: REFERRAL_TYPES, required: true },
    specialty: { type: String, required: true, trim: true, maxlength: 120 },
    specialistName: { type: String, required: true, trim: true, maxlength: 200 },
    organization: { type: String, required: true, trim: true, maxlength: 200 },
    reasonForReferral: { type: String, required: true, trim: true, maxlength: 2000 },
    priority: { type: String, enum: REFERRAL_PRIORITIES, required: true },
    referralDate: { type: Date, required: true },
    appointmentDate: { type: Date, default: null },
    outcomeReceivedDate: { type: Date, default: null },
    followUpRequired: { type: Boolean, required: true, default: false },
    sentAt: { type: Date, default: null },
    acceptedAt: { type: Date, default: null },
    scheduledAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    status: { type: String, enum: REFERRAL_STATUSES, required: true },
    statusHistory: { type: [statusEventSchema], default: [] },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

referralSchema.index({ patientId: 1, status: 1, referralDate: -1 });
referralSchema.index({ patientId: 1, encounterId: 1 });
referralSchema.index({ patientId: 1, followUpRequired: 1, status: 1 });
referralSchema.index({ referralDate: 1 });
referralSchema.index({ completedAt: 1 });
referralSchema.index({ cancelledAt: 1 });
referralSchema.index({ followUpRequired: 1, status: 1 });

export const Referral = mongoose.model<IReferral>('Referral', referralSchema);
