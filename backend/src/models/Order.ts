import mongoose, { Schema, Document, Types } from 'mongoose';
import {
  ORDER_PRIORITIES,
  ORDER_STATUSES,
  ORDER_TYPES,
  type OrderPriority,
  type OrderStatus,
  type OrderType,
} from '../types/orders.js';

/**
 * Local laboratory, imaging, and procedure order.
 * Status changes are appended. Orders are cancelled, not hard-deleted.
 * This record stays inside the clinic chart. It does not call an external laboratory
 * or a provincial repository.
 */
export interface IOrderStatusEvent {
  status: OrderStatus;
  at: Date;
  actorId: Types.ObjectId;
  note?: string;
}

export interface IOrder extends Document {
  patientId: Types.ObjectId;
  encounterId: Types.ObjectId;
  diagnosisId: Types.ObjectId;
  conditionId?: Types.ObjectId | null;
  orderedBy: Types.ObjectId;
  orderType: OrderType;
  orderName: string;
  priority: OrderPriority;
  clinicalReason: string;
  instructions?: string;
  orderedAt?: Date | null;
  scheduledAt?: Date | null;
  collectedAt?: Date | null;
  resultedAt?: Date | null;
  completedAt?: Date | null;
  cancelledAt?: Date | null;
  status: OrderStatus;
  statusHistory: IOrderStatusEvent[];
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const statusEventSchema = new Schema<IOrderStatusEvent>(
  {
    status: { type: String, enum: ORDER_STATUSES, required: true },
    at: { type: Date, required: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    note: { type: String, trim: true, maxlength: 500 },
  },
  { _id: true }
);

const orderSchema = new Schema<IOrder>(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    encounterId: { type: Schema.Types.ObjectId, ref: 'Encounter', required: true, index: true },
    diagnosisId: { type: Schema.Types.ObjectId, ref: 'EncounterDiagnosis', required: true, index: true },
    conditionId: { type: Schema.Types.ObjectId, ref: 'Condition', default: null },
    orderedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    orderType: { type: String, enum: ORDER_TYPES, required: true },
    orderName: { type: String, required: true, trim: true, maxlength: 200 },
    priority: { type: String, enum: ORDER_PRIORITIES, required: true },
    clinicalReason: { type: String, required: true, trim: true, maxlength: 1000 },
    instructions: { type: String, trim: true, maxlength: 2000 },
    orderedAt: { type: Date, default: null },
    scheduledAt: { type: Date, default: null },
    collectedAt: { type: Date, default: null },
    resultedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    status: { type: String, enum: ORDER_STATUSES, required: true },
    statusHistory: { type: [statusEventSchema], default: [] },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

orderSchema.index({ patientId: 1, status: 1, createdAt: -1 });
orderSchema.index({ patientId: 1, encounterId: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ completedAt: 1 });
orderSchema.index({ cancelledAt: 1 });

export const Order = mongoose.model<IOrder>('Order', orderSchema);
