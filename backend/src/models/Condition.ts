import mongoose, { Schema, Document, Types } from 'mongoose';
import {
  PROBLEM_CODE_SYSTEMS,
  PROBLEM_SEVERITIES,
  PROBLEM_STATUSES,
  type ProblemCodeSystem,
  type ProblemSeverity,
  type ProblemStatus,
} from '../types/diagnoses.js';

/**
 * FHIR Condition, stored as the longitudinal problem list.
 * Visit diagnoses live on EncounterDiagnosis until they are promoted here.
 */
export interface ICondition extends Document {
  patientId: Types.ObjectId;
  display: string;
  status: ProblemStatus;
  severity: ProblemSeverity;
  onsetDate?: Date;
  resolvedDate?: Date | null;
  clinicianOwner?: Types.ObjectId | null;
  codeSystem?: ProblemCodeSystem;
  code?: string;
  sourceDiagnosisId?: Types.ObjectId | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const conditionSchema = new Schema<ICondition>(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    display: { type: String, required: true, trim: true },
    status: { type: String, enum: PROBLEM_STATUSES, required: true },
    severity: {
      type: String,
      enum: PROBLEM_SEVERITIES,
      default: 'unknown',
    },
    onsetDate: Date,
    resolvedDate: { type: Date, default: null },
    clinicianOwner: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    codeSystem: { type: String, enum: PROBLEM_CODE_SYSTEMS },
    code: String,
    sourceDiagnosisId: { type: Schema.Types.ObjectId, ref: 'EncounterDiagnosis', default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

conditionSchema.index({ patientId: 1, status: 1 });
conditionSchema.index({ status: 1, code: 1 });

export const Condition = mongoose.model<ICondition>('Condition', conditionSchema);
