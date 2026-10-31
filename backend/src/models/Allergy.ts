import mongoose, { Schema, Document, Types } from 'mongoose';

export type AllergySeverity = 'mild' | 'moderate' | 'severe';
export type AllergyStatus = 'active' | 'inactive';

export interface IAllergy extends Document {
  patientId: Types.ObjectId;
  substance: string;
  reaction: string;
  severity: AllergySeverity;
  status: AllergyStatus;
  recordedDate: Date;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const allergySchema = new Schema<IAllergy>(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    substance: { type: String, required: true, trim: true },
    reaction: { type: String, required: true, trim: true },
    severity: {
      type: String,
      enum: ['mild', 'moderate', 'severe'],
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      required: true,
    },
    recordedDate: { type: Date, required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

allergySchema.index({ patientId: 1, status: 1 });

export const Allergy = mongoose.model<IAllergy>('Allergy', allergySchema);
