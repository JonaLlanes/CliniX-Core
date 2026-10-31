import mongoose, { Schema, Document, Types } from 'mongoose';
import {
  MEDICATION_EVENT_ACTIONS,
  MEDICATION_STATUSES,
  type MedicationEventAction,
  type MedicationStatus,
} from '../types/medications.js';

/**
 * Longitudinal medication record.
 * Status changes are appended. Medications are never hard-deleted.
 * Legacy name, dose, and prescriberId stay in sync for earlier chart data.
 */
export interface IMedicationEvent {
  action: MedicationEventAction;
  at: Date;
  clinicianId: Types.ObjectId;
  reason?: string;
  summary?: string;
}

export interface IAllergyAcknowledgmentWarning {
  allergyId: Types.ObjectId;
  substance: string;
  reaction: string;
  severity: string;
  matchedOn: string;
}

export interface IAllergyAcknowledgment {
  at: Date;
  clinicianId: Types.ObjectId;
  warnings: IAllergyAcknowledgmentWarning[];
}

export interface IMedication extends Document {
  patientId: Types.ObjectId;
  encounterId?: Types.ObjectId | null;
  conditionId?: Types.ObjectId | null;
  din?: string;
  genericName: string;
  brandName?: string;
  strength?: string;
  dosage: string;
  route: string;
  frequency: string;
  indication?: string;
  startDate: Date;
  endDate?: Date | null;
  prescribedBy?: Types.ObjectId | null;
  status: MedicationStatus;
  events: IMedicationEvent[];
  allergyAcknowledgments: IAllergyAcknowledgment[];
  /** Legacy display name. Mirrors genericName. */
  name?: string;
  /** Legacy dose text. Mirrors strength and dosage. */
  dose?: string;
  /** Legacy prescriber. Mirrors prescribedBy. */
  prescriberId?: Types.ObjectId | null;
  adherenceNotes?: string;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const eventSchema = new Schema<IMedicationEvent>(
  {
    action: { type: String, enum: MEDICATION_EVENT_ACTIONS, required: true },
    at: { type: Date, required: true },
    clinicianId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, trim: true, maxlength: 500 },
    summary: { type: String, trim: true, maxlength: 1000 },
  },
  { _id: true }
);

const acknowledgmentWarningSchema = new Schema<IAllergyAcknowledgmentWarning>(
  {
    allergyId: { type: Schema.Types.ObjectId, ref: 'Allergy', required: true },
    substance: { type: String, required: true, trim: true },
    reaction: { type: String, trim: true },
    severity: { type: String, trim: true },
    matchedOn: { type: String, trim: true },
  },
  { _id: false }
);

const acknowledgmentSchema = new Schema<IAllergyAcknowledgment>(
  {
    at: { type: Date, required: true },
    clinicianId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    warnings: { type: [acknowledgmentWarningSchema], required: true },
  },
  { _id: true }
);

const medicationSchema = new Schema<IMedication>(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    encounterId: { type: Schema.Types.ObjectId, ref: 'Encounter', default: null },
    conditionId: { type: Schema.Types.ObjectId, ref: 'Condition', default: null },
    din: { type: String, trim: true },
    genericName: { type: String, trim: true },
    brandName: { type: String, trim: true },
    strength: { type: String, trim: true },
    dosage: { type: String, trim: true },
    route: { type: String, required: true, trim: true },
    frequency: { type: String, required: true, trim: true },
    indication: { type: String, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    prescribedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    status: { type: String, enum: MEDICATION_STATUSES, required: true },
    events: { type: [eventSchema], default: [] },
    allergyAcknowledgments: { type: [acknowledgmentSchema], default: [] },
    name: { type: String, trim: true },
    dose: { type: String, trim: true },
    prescriberId: { type: Schema.Types.ObjectId, ref: 'User' },
    adherenceNotes: String,
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

medicationSchema.pre('validate', function syncLegacyFields() {
  if (!this.genericName && this.name) this.genericName = this.name;
  if (!this.dosage && this.dose) this.dosage = this.dose;
  if (!this.prescribedBy && this.prescriberId) this.prescribedBy = this.prescriberId;
  if (typeof this.din === 'string' && this.din.trim() === '') this.din = undefined;
  if (this.din && !/^\d{8}$/.test(this.din)) {
    this.invalidate('din', 'DIN must be 8 digits');
  }
  if (!this.genericName) this.invalidate('genericName', 'Generic name is required');
  if (!this.dosage) this.invalidate('dosage', 'Dosage is required');
  if (this.genericName) this.name = this.genericName;
  if (this.dosage) this.dose = [this.strength, this.dosage].filter(Boolean).join(' · ');
  if (this.prescribedBy) this.prescriberId = this.prescribedBy;
});

medicationSchema.index({ patientId: 1, status: 1 });
medicationSchema.index({ status: 1 });
medicationSchema.index({ patientId: 1, encounterId: 1 });

export const Medication = mongoose.model<IMedication>('Medication', medicationSchema);
