import mongoose, { Schema, Document, Types } from 'mongoose';
import { ROLES } from '../types/roles.js';

export type AuditAction = 'create' | 'update' | 'delete';

export interface IAuditEvent extends Document {
  userId: Types.ObjectId;
  role: (typeof ROLES)[number];
  action: AuditAction;
  resourceType: string;
  resourceId: Types.ObjectId;
  patientId?: Types.ObjectId;
  before?: unknown;
  after?: unknown;
  /** Optional lifecycle name, such as encounter_created. */
  event?: string;
  timestamp: Date;
}

const auditEventSchema = new Schema<IAuditEvent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, enum: ROLES, required: true },
    action: { type: String, enum: ['create', 'update', 'delete'], required: true },
    resourceType: { type: String, required: true, trim: true },
    resourceId: { type: Schema.Types.ObjectId, required: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', index: true },
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
    event: { type: String, trim: true },
    timestamp: { type: Date, default: Date.now, required: true },
  },
  { timestamps: false }
);

auditEventSchema.index({ patientId: 1, timestamp: -1 });

export const AuditEvent = mongoose.model<IAuditEvent>('AuditEvent', auditEventSchema);
