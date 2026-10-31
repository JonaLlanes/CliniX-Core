import mongoose, { Schema, Document, Types } from 'mongoose';
import { RESULT_STATUSES, type ResultStatus } from '../types/orders.js';

/**
 * A result entered on a local order.
 * Preliminary, final, and corrected results are separate rows.
 * Results are not overwritten and are not sent to an outside system.
 */
export interface IOrderResult extends Document {
  orderId: Types.ObjectId;
  patientId: Types.ObjectId;
  resultType: string;
  value: string;
  unit?: string;
  referenceRange?: string;
  resultDate: Date;
  interpretation?: string;
  status: ResultStatus;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const orderResultSchema = new Schema<IOrderResult>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    resultType: { type: String, required: true, trim: true, maxlength: 120 },
    value: { type: String, required: true, trim: true, maxlength: 500 },
    unit: { type: String, trim: true, maxlength: 40 },
    referenceRange: { type: String, trim: true, maxlength: 120 },
    resultDate: { type: Date, required: true },
    interpretation: { type: String, trim: true, maxlength: 2000 },
    status: { type: String, enum: RESULT_STATUSES, required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

orderResultSchema.index({ patientId: 1, resultDate: -1 });
orderResultSchema.index({ orderId: 1, resultDate: 1 });

export const OrderResult = mongoose.model<IOrderResult>('OrderResult', orderResultSchema);
