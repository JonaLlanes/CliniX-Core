import mongoose, { Schema, Document, Types } from 'mongoose';
import {
  CARE_PLAN_DIAGNOSIS_KINDS,
  CARE_PLAN_STATUSES,
  type CarePlanDiagnosisKind,
  type CarePlanStatus,
} from '../types/carePlans.js';

/**
 * Longitudinal care plan for chronic and ongoing care.
 * Goals and interventions are stored separately so each change keeps its own history.
 * Progress notes are appended and are not revised.
 */
export interface ICarePlanProgress {
  _id?: Types.ObjectId;
  authorId: Types.ObjectId;
  at: Date;
  note: string;
}

export interface ICarePlan extends Document {
  patientId: Types.ObjectId;
  primaryDiagnosisId?: Types.ObjectId | null;
  primaryDiagnosisKind?: CarePlanDiagnosisKind | null;
  problemIds: Types.ObjectId[];
  encounterDiagnosisIds: Types.ObjectId[];
  encounterId?: Types.ObjectId | null;
  title: string;
  description: string;
  status: CarePlanStatus;
  startDate: Date;
  targetDate?: Date | null;
  completedDate?: Date | null;
  ownerClinicianId: Types.ObjectId;
  progress: ICarePlanProgress[];
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const progressSchema = new Schema<ICarePlanProgress>(
  {
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    at: { type: Date, required: true },
    note: { type: String, required: true, trim: true, maxlength: 4000 },
  },
  { _id: true }
);

const carePlanSchema = new Schema<ICarePlan>(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    primaryDiagnosisId: { type: Schema.Types.ObjectId, default: null },
    primaryDiagnosisKind: {
      type: String,
      enum: [...CARE_PLAN_DIAGNOSIS_KINDS, null],
      default: null,
    },
    problemIds: { type: [{ type: Schema.Types.ObjectId, ref: 'Condition' }], default: [] },
    encounterDiagnosisIds: {
      type: [{ type: Schema.Types.ObjectId, ref: 'EncounterDiagnosis' }],
      default: [],
    },
    encounterId: { type: Schema.Types.ObjectId, ref: 'Encounter', default: null },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, trim: true, maxlength: 4000 },
    status: { type: String, enum: CARE_PLAN_STATUSES, required: true },
    startDate: { type: Date, required: true },
    targetDate: { type: Date, default: null },
    completedDate: { type: Date, default: null },
    ownerClinicianId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    progress: { type: [progressSchema], default: [] },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

carePlanSchema.index({ patientId: 1, status: 1, updatedAt: -1 });
carePlanSchema.index({ status: 1 });
carePlanSchema.index({ patientId: 1, encounterId: 1 });

export const CarePlan = mongoose.model<ICarePlan>('CarePlan', carePlanSchema);
