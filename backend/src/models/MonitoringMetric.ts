import mongoose, { Schema, Document, Types } from 'mongoose';
import {
  METRIC_SOURCES,
  METRIC_TYPES,
  type MetricSource,
  type MetricType,
} from '../types/monitoring.js';

/**
 * One recorded reading for a monitoring program.
 * Corrections update this row and are written to the audit log.
 * patientId is copied from the program so chart trends do not need a join.
 */
export interface IMonitoringMetric extends Document {
  programId: Types.ObjectId;
  patientId: Types.ObjectId;
  metricType: MetricType;
  /** Required when metricType is custom. */
  label?: string | null;
  value: string;
  unit?: string | null;
  recordedAt: Date;
  source: MetricSource;
  /** Clinician flag for a custom reading. Known types are interpreted from the value. */
  abnormal?: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const monitoringMetricSchema = new Schema<IMonitoringMetric>(
  {
    programId: { type: Schema.Types.ObjectId, ref: 'MonitoringProgram', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    metricType: { type: String, enum: METRIC_TYPES, required: true },
    label: { type: String, trim: true, maxlength: 120, default: null },
    value: { type: String, required: true, trim: true, maxlength: 40 },
    unit: { type: String, trim: true, maxlength: 40, default: null },
    recordedAt: { type: Date, required: true },
    source: { type: String, enum: METRIC_SOURCES, required: true },
    abnormal: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

monitoringMetricSchema.index({ programId: 1, recordedAt: -1 });
monitoringMetricSchema.index({ patientId: 1, metricType: 1, recordedAt: -1 });
monitoringMetricSchema.index({ recordedAt: 1, metricType: 1 });

export const MonitoringMetric = mongoose.model<IMonitoringMetric>(
  'MonitoringMetric',
  monitoringMetricSchema
);
