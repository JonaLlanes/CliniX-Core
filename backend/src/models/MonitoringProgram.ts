import mongoose, { Schema, Document, Types } from 'mongoose';
import {
  MONITORING_DIAGNOSIS_KINDS,
  PROGRAM_STATUSES,
  PROGRAM_TYPES,
  type MonitoringDiagnosisKind,
  type ProgramStatus,
  type ProgramType,
} from '../types/monitoring.js';

/**
 * A chronic-disease monitoring enrollment on one chart.
 * Programs are completed, not deleted. Custom programs carry their own name.
 */
export interface IMonitoringProgram extends Document {
  patientId: Types.ObjectId;
  diagnosisId?: Types.ObjectId | null;
  diagnosisKind?: MonitoringDiagnosisKind | null;
  carePlanId?: Types.ObjectId | null;
  programType: ProgramType;
  /** Required for a custom program. Optional nickname otherwise. */
  name?: string | null;
  status: ProgramStatus;
  enrolledDate: Date;
  completedDate?: Date | null;
  ownerClinicianId: Types.ObjectId;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const monitoringProgramSchema = new Schema<IMonitoringProgram>(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    diagnosisId: { type: Schema.Types.ObjectId, default: null },
    diagnosisKind: {
      type: String,
      enum: [...MONITORING_DIAGNOSIS_KINDS, null],
      default: null,
    },
    carePlanId: { type: Schema.Types.ObjectId, ref: 'CarePlan', default: null },
    programType: { type: String, enum: PROGRAM_TYPES, required: true },
    name: { type: String, trim: true, maxlength: 120, default: null },
    status: { type: String, enum: PROGRAM_STATUSES, required: true },
    enrolledDate: { type: Date, required: true },
    completedDate: { type: Date, default: null },
    ownerClinicianId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

monitoringProgramSchema.index({ patientId: 1, status: 1, enrolledDate: -1 });
monitoringProgramSchema.index({ patientId: 1, programType: 1, status: 1 });
monitoringProgramSchema.index({ status: 1, programType: 1 });

export const MonitoringProgram = mongoose.model<IMonitoringProgram>(
  'MonitoringProgram',
  monitoringProgramSchema
);
