import mongoose, { Schema, Document, Types } from 'mongoose';
import {
  CANADIAN_PROVINCES,
  GENDER_IDENTITIES,
  LANGUAGES,
  SEX_AT_BIRTH,
} from '../validators/canadianHealthCard.js';

export interface IAddress {
  street?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  country?: string;
}

export interface IProvincialHealth {
  province: string;
  healthCardNumber: string;
  versionCode?: string;
}

export interface IPersonContact {
  name: string;
  relationship?: string;
  phone?: string;
  phoneSecondary?: string;
}

// FHIR: Patient — Canadian registration demographics
export interface IPatient extends Document {
  mrn: string;
  /** Legal given name */
  givenName: string;
  /** Legal family name */
  familyName: string;
  preferredName?: string;
  birthDate: Date;
  /** Preferred spoken / written language */
  language?: (typeof LANGUAGES)[number] | string;
  /** Sex assigned at birth */
  sex: (typeof SEX_AT_BIRTH)[number];
  genderIdentity?: (typeof GENDER_IDENTITIES)[number] | string;
  contact: {
    phone?: string;
    email?: string;
    /** Legacy free-text address; prefer structured `address` */
    address?: string;
  };
  address?: IAddress;
  provincialHealth?: IProvincialHealth;
  emergencyContact?: IPersonContact;
  substituteDecisionMaker?: IPersonContact;
  identifiers?: {
    insuranceMemberId?: string;
    nationalId?: string;
  };
  careTeam: Types.ObjectId[];
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const addressSchema = new Schema<IAddress>(
  {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    province: { type: String, enum: [...CANADIAN_PROVINCES, ''], trim: true },
    postalCode: { type: String, trim: true, uppercase: true },
    country: { type: String, trim: true, default: 'CA' },
  },
  { _id: false }
);

const provincialHealthSchema = new Schema<IProvincialHealth>(
  {
    province: { type: String, enum: CANADIAN_PROVINCES, required: true },
    healthCardNumber: { type: String, required: true, trim: true, uppercase: true },
    versionCode: { type: String, trim: true, uppercase: true },
  },
  { _id: false }
);

const personContactSchema = new Schema<IPersonContact>(
  {
    name: { type: String, required: true, trim: true },
    relationship: { type: String, trim: true },
    phone: { type: String, trim: true },
    phoneSecondary: { type: String, trim: true },
  },
  { _id: false }
);

const patientSchema = new Schema<IPatient>(
  {
    mrn: { type: String, required: true, unique: true, trim: true },
    givenName: { type: String, required: true, trim: true },
    familyName: { type: String, required: true, trim: true },
    preferredName: { type: String, trim: true },
    birthDate: { type: Date, required: true },
    language: { type: String, enum: LANGUAGES, default: 'en' },
    sex: { type: String, enum: SEX_AT_BIRTH, required: true },
    genderIdentity: { type: String, enum: GENDER_IDENTITIES, default: 'unknown' },
    contact: {
      phone: String,
      email: String,
      address: String,
    },
    address: { type: addressSchema },
    provincialHealth: { type: provincialHealthSchema },
    emergencyContact: { type: personContactSchema },
    substituteDecisionMaker: { type: personContactSchema },
    identifiers: {
      insuranceMemberId: String,
      nationalId: String,
    },
    careTeam: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

patientSchema.index(
  { givenName: 'text', familyName: 'text', preferredName: 'text' },
  // Clinical `language` is en | fr | other. MongoDB would otherwise read that
  // field as the text-index language and reject "other".
  { default_language: 'english', language_override: 'textIndexLanguage' }
);
patientSchema.index({ careTeam: 1 });
patientSchema.index({ deletedAt: 1 });
patientSchema.index({ birthDate: 1 });
patientSchema.index({ 'provincialHealth.healthCardNumber': 1 });
patientSchema.index(
  { 'provincialHealth.province': 1, 'provincialHealth.healthCardNumber': 1 },
  { unique: true, partialFilterExpression: { 'provincialHealth.healthCardNumber': { $type: 'string' } } }
);

export const Patient = mongoose.model<IPatient>('Patient', patientSchema);
export type PatientId = Types.ObjectId;
