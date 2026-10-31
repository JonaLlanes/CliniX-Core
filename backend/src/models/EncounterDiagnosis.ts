import mongoose, { Schema, Document, Types } from 'mongoose';
import {
  DIAGNOSIS_TYPES,
  PROMOTION_TARGETS,
  type DiagnosisType,
  type PromotionTarget,
} from '../types/diagnoses.js';

/**
 * A diagnosis recorded for one encounter.
 * It stays off the longitudinal problem list until a clinician promotes it.
 */
export interface IEncounterDiagnosis extends Document {
  encounterId: Types.ObjectId;
  patientId: Types.ObjectId;
  /** ICD-10-CA code */
  code: string;
  description: string;
  diagnosisType: DiagnosisType;
  primaryDiagnosis: boolean;
  recordedBy: Types.ObjectId;
  recordedAt: Date;
  promotedProblemId?: Types.ObjectId | null;
  promotion?: PromotionTarget | null;
  promotedAt?: Date | null;
  promotedBy?: Types.ObjectId | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const encounterDiagnosisSchema = new Schema<IEncounterDiagnosis>(
  {
    encounterId: { type: Schema.Types.ObjectId, ref: 'Encounter', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 8 },
    description: { type: String, required: true, trim: true, maxlength: 500 },
    diagnosisType: { type: String, enum: DIAGNOSIS_TYPES, required: true },
    primaryDiagnosis: { type: Boolean, required: true, default: false },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recordedAt: { type: Date, required: true },
    promotedProblemId: { type: Schema.Types.ObjectId, ref: 'Condition', default: null },
    promotion: { type: String, enum: PROMOTION_TARGETS },
    promotedAt: { type: Date, default: null },
    promotedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

encounterDiagnosisSchema.index({ patientId: 1, recordedAt: -1 });
encounterDiagnosisSchema.index(
  { encounterId: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null, primaryDiagnosis: true } }
);

export const EncounterDiagnosis = mongoose.model<IEncounterDiagnosis>(
  'EncounterDiagnosis',
  encounterDiagnosisSchema
);
