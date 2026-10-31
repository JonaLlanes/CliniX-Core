import mongoose, { Schema, Document, Types } from 'mongoose';

// FHIR: Task
export interface ITask extends Document {
  patientId: Types.ObjectId;
  carePlanId?: Types.ObjectId;
  title: string;
  assigneeRole: 'clinician' | 'nurse' | 'caregiver' | 'pharmacist';
  assigneeUserId?: Types.ObjectId;
  status: 'pending' | 'in_progress' | 'completed';
  dueDate?: Date;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new Schema<ITask>(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    carePlanId: { type: Schema.Types.ObjectId, ref: 'CarePlan' },
    title: { type: String, required: true, trim: true },
    assigneeRole: {
      type: String,
      enum: ['clinician', 'nurse', 'caregiver', 'pharmacist'],
      required: true,
    },
    assigneeUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed'],
      required: true,
    },
    dueDate: Date,
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

taskSchema.index({ patientId: 1, status: 1 });

export const Task = mongoose.model<ITask>('Task', taskSchema);
