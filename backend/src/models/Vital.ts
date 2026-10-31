import mongoose, { Schema, Document, Types } from 'mongoose';

// FHIR: Observation
export type VitalSource = 'clinic' | 'home' | 'device' | 'caregiver';

export interface IVitalMeasurements {
  systolicBp?: number;
  diastolicBp?: number;
  heartRate?: number;
  respiratoryRate?: number;
  temperatureC?: number;
  spo2?: number;
  weightKg?: number;
  heightCm?: number;
}

export interface IVital extends Document {
  patientId: Types.ObjectId;
  effectiveAt: Date;
  source: VitalSource;
  measurements: IVitalMeasurements;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const vitalSchema = new Schema<IVital>(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    effectiveAt: { type: Date, required: true },
    source: {
      type: String,
      enum: ['clinic', 'home', 'device', 'caregiver'],
      required: true,
    },
    measurements: {
      systolicBp: Number,
      diastolicBp: Number,
      heartRate: Number,
      respiratoryRate: Number,
      temperatureC: Number,
      spo2: Number,
      weightKg: Number,
      heightCm: Number,
    },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

vitalSchema.index({ patientId: 1, effectiveAt: -1 });

export const Vital = mongoose.model<IVital>('Vital', vitalSchema);
