import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * Specialist outcome for one referral.
 * Each edit inserts a new revision. Earlier recommendations are not overwritten.
 */
export interface IReferralOutcome extends Document {
  referralId: Types.ObjectId;
  patientId: Types.ObjectId;
  authorId: Types.ObjectId;
  recommendations: string;
  consultationSummary: string;
  nextSteps: string;
  recordedAt: Date;
  version: number;
  rootId: Types.ObjectId;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const referralOutcomeSchema = new Schema<IReferralOutcome>(
  {
    referralId: { type: Schema.Types.ObjectId, ref: 'Referral', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recommendations: { type: String, required: true, trim: true, maxlength: 4000 },
    consultationSummary: { type: String, required: true, trim: true, maxlength: 4000 },
    nextSteps: { type: String, required: true, trim: true, maxlength: 4000 },
    recordedAt: { type: Date, required: true },
    version: { type: Number, required: true, default: 1 },
    rootId: { type: Schema.Types.ObjectId, required: true, index: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

referralOutcomeSchema.index({ referralId: 1, version: 1 }, { unique: true });
referralOutcomeSchema.index({ rootId: 1, version: 1 });

referralOutcomeSchema.pre('validate', function (next) {
  if (!this.rootId) this.rootId = this._id;
  next();
});

const LOCKED_FIELDS = [
  'recommendations',
  'consultationSummary',
  'nextSteps',
  'recordedAt',
  'version',
  'rootId',
  'authorId',
  'patientId',
  'referralId',
] as const;

referralOutcomeSchema.pre('save', function (next) {
  if (this.isNew) return next();
  const changed = LOCKED_FIELDS.filter((field) => this.isModified(field));
  if (changed.length > 0) {
    const err = new Error(
      'Referral outcomes are immutable. Save a new revision instead.'
    ) as Error & { status?: number };
    err.status = 400;
    return next(err);
  }
  next();
});

export const ReferralOutcome = mongoose.model<IReferralOutcome>(
  'ReferralOutcome',
  referralOutcomeSchema
);
