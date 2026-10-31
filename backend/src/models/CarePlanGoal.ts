import mongoose, { Schema, Document, Types } from 'mongoose';
import { CARE_PLAN_GOAL_STATUSES, type CarePlanGoalStatus } from '../types/carePlans.js';

/** A target tracked on a longitudinal care plan. */
export interface ICarePlanGoal extends Document {
  carePlanId: Types.ObjectId;
  patientId: Types.ObjectId;
  description: string;
  targetValue?: string | null;
  targetDate: Date;
  status: CarePlanGoalStatus;
  achievedAt?: Date | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const carePlanGoalSchema = new Schema<ICarePlanGoal>(
  {
    carePlanId: { type: Schema.Types.ObjectId, ref: 'CarePlan', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    description: { type: String, required: true, trim: true, maxlength: 1000 },
    targetValue: { type: String, trim: true, maxlength: 120, default: null },
    targetDate: { type: Date, required: true },
    status: { type: String, enum: CARE_PLAN_GOAL_STATUSES, required: true },
    achievedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

carePlanGoalSchema.index({ patientId: 1, status: 1, targetDate: 1 });
carePlanGoalSchema.index({ carePlanId: 1, status: 1 });

export const CarePlanGoal = mongoose.model<ICarePlanGoal>('CarePlanGoal', carePlanGoalSchema);
