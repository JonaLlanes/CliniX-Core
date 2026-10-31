import mongoose, { Schema, Document, Types } from 'mongoose';
import {
  APPOINTMENT_STATUSES,
  APPOINTMENT_TYPES,
  CLINIC_LOCATIONS,
  type AppointmentStatus,
  type AppointmentType,
  type ClinicLocation,
} from '../types/appointments.js';

// FHIR: Appointment
export interface IAppointment extends Document {
  patientId: Types.ObjectId;
  providerId: Types.ObjectId;
  clinicLocation: ClinicLocation;
  appointmentType: AppointmentType;
  startTime: Date;
  endTime: Date;
  status: AppointmentStatus;
  cancelReason?: string;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const appointmentSchema = new Schema<IAppointment>(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    clinicLocation: { type: String, enum: CLINIC_LOCATIONS, required: true },
    appointmentType: { type: String, enum: APPOINTMENT_TYPES, required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    status: { type: String, enum: APPOINTMENT_STATUSES, required: true, default: 'booked' },
    cancelReason: { type: String, trim: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

appointmentSchema.index({ providerId: 1, startTime: 1 });
appointmentSchema.index({ patientId: 1, startTime: -1 });
appointmentSchema.index({ providerId: 1, status: 1, startTime: 1 });
appointmentSchema.index({ startTime: 1, status: 1 });

export const Appointment = mongoose.model<IAppointment>('Appointment', appointmentSchema);
