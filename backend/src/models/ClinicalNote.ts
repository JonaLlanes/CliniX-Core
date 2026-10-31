import mongoose, { Schema, Document, Types } from 'mongoose';

// FHIR: DocumentReference (simplified). Body is immutable; edits insert a new revision.
export interface IClinicalNote extends Document {
  patientId: Types.ObjectId;
  encounterId?: Types.ObjectId;
  authorId: Types.ObjectId;
  body: string;
  version: number;
  rootId: Types.ObjectId;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const clinicalNoteSchema = new Schema<IClinicalNote>(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    encounterId: { type: Schema.Types.ObjectId, ref: 'Encounter' },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true },
    version: { type: Number, required: true, default: 1 },
    rootId: { type: Schema.Types.ObjectId, required: true, index: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

clinicalNoteSchema.index({ rootId: 1, version: -1 });

clinicalNoteSchema.pre('validate', function (next) {
  if (!this.rootId) this.rootId = this._id;
  next();
});

clinicalNoteSchema.pre('insertMany', function (next, docs: Record<string, unknown>[]) {
  if (Array.isArray(docs)) {
    for (const doc of docs) {
      if (!doc._id) doc._id = new mongoose.Types.ObjectId();
      if (!doc.rootId) doc.rootId = doc._id;
      if (doc.version == null) doc.version = 1;
    }
  }
  next();
});

const LOCKED_FIELDS = ['body', 'version', 'rootId', 'authorId', 'patientId', 'encounterId'] as const;

clinicalNoteSchema.pre('save', function (next) {
  if (this.isNew) return next();
  const changed = LOCKED_FIELDS.filter((field) => this.isModified(field));
  if (changed.length > 0) {
    const err = new Error(
      'Clinical notes are immutable. Save a new revision instead.'
    ) as Error & { status?: number };
    err.status = 400;
    return next(err);
  }
  next();
});

export const ClinicalNote = mongoose.model<IClinicalNote>('ClinicalNote', clinicalNoteSchema);
