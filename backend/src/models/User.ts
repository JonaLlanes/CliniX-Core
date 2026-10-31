import mongoose, { Schema, Document } from 'mongoose';
import type { Role } from '../types/roles.js';
import { ROLES } from '../types/roles.js';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  displayName: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    displayName: { type: String, required: true, trim: true },
    role: { type: String, enum: ROLES, required: true },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', userSchema);
