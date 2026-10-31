import mongoose, { Schema, Document, Types } from 'mongoose';
import {
  CARE_PLAN_INTERVENTION_STATUSES,
  CARE_PLAN_ROLES,
  type CarePlanInterventionStatus,
  type CarePlanRole,
} from '../types/carePlans.js';

/** Work assigned on a longitudinal care plan. */
export interface ICarePlanIntervention extends Document {
  carePlanId: Types.ObjectId;
  patientId: Types.ObjectId;
  description: string;
  assignedRole: CarePlanRole;
  dueDate: Date;
  status: CarePlanInterventionStatus;
  completedAt?: Date | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const carePlanInterventionSchema = new Schema<ICarePlanIntervention>(
  {
    carePlanId: { type: Schema.Types.ObjectId, ref: 'CarePlan', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    description: { type: String, required: true, trim: true, maxlength: 1000 },
    assignedRole: { type: String, enum: CARE_PLAN_ROLES, required: true },
    dueDate: { type: Date, required: true },
    status: { type: String, enum: CARE_PLAN_INTERVENTION_STATUSES, required: true },
    completedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

carePlanInterventionSchema.index({ carePlanId: 1, dueDate: 1 });
carePlanInterventionSchema.index({ patientId: 1, dueDate: 1 });

export const CarePlanIntervention = mongoose.model<ICarePlanIntervention>(
  'CarePlanIntervention',
  carePlanInterventionSchema
);
