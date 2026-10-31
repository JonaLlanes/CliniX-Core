import mongoose, { Schema, Document, Types } from 'mongoose';
import {
  MONITORING_DIAGNOSIS_KINDS,
  RECALL_STATUSES,
  type MonitoringDiagnosisKind,
  type RecallStatus,
} from '../types/monitoring.js';

/**
 * A follow-up recall on the chart, such as a repeat A1C or annual review.
 * Overdue is derived when the due date passes and is not stored.
 * Recalls are cancelled, not deleted.
 */
export interface IRecall extends Document {
  patientId: Types.ObjectId;
  diagnosisId?: Types.ObjectId | null;
  diagnosisKind?: MonitoringDiagnosisKind | null;
  carePlanId?: Types.ObjectId | null;
  reason: string;
  dueDate: Date;
  assignedProvider: Types.ObjectId;
  status: RecallStatus;
  completedAt?: Date | null;
  cancelledAt?: Date | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const recallSchema = new Schema<IRecall>(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    diagnosisId: { type: Schema.Types.ObjectId, default: null },
    diagnosisKind: {
      type: String,
      enum: [...MONITORING_DIAGNOSIS_KINDS, null],
      default: null,
    },
    carePlanId: { type: Schema.Types.ObjectId, ref: 'CarePlan', default: null },
    reason: { type: String, required: true, trim: true, maxlength: 200 },
    dueDate: { type: Date, required: true },
    assignedProvider: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: RECALL_STATUSES, required: true },
    completedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

recallSchema.index({ patientId: 1, status: 1, dueDate: 1 });
recallSchema.index({ status: 1, dueDate: 1 });
recallSchema.index({ completedAt: 1 });

export const Recall = mongoose.model<IRecall>('Recall', recallSchema);
