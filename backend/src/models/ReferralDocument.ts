import mongoose, { Schema, Document, Types } from 'mongoose';
import { REFERRAL_DOCUMENT_TYPES, type ReferralDocumentType } from '../types/referrals.js';

/**
 * Metadata for a referral letter, consultation note, or external report.
 * The file itself is not stored. A file can be attached to this record later.
 */
export interface IReferralDocument extends Document {
  referralId: Types.ObjectId;
  patientId: Types.ObjectId;
  documentType: ReferralDocumentType;
  title: string;
  description?: string;
  recordedAt: Date;
  recordedBy: Types.ObjectId;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const referralDocumentSchema = new Schema<IReferralDocument>(
  {
    referralId: { type: Schema.Types.ObjectId, ref: 'Referral', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    documentType: { type: String, enum: REFERRAL_DOCUMENT_TYPES, required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000 },
    recordedAt: { type: Date, required: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

referralDocumentSchema.index({ referralId: 1, recordedAt: 1 });
referralDocumentSchema.index({ patientId: 1, recordedAt: -1 });

export const ReferralDocument = mongoose.model<IReferralDocument>(
  'ReferralDocument',
  referralDocumentSchema
);
