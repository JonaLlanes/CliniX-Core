/**
 * One-off migration: add Canadian patient registration fields to existing charts.
 *
 * Usage (from repo root):
 *   npm run migrate:canadian --workspace=backend
 *
 * Idempotent: skips documents that already have structured address / provincialHealth.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDb } from '../config/db.js';
import { Patient } from '../models/Patient.js';

const SAMPLE_HEALTH: Record<
  string,
  { province: 'ON' | 'BC' | 'AB' | 'QC'; healthCardNumber: string; versionCode?: string }
> = {
  'MRN-1001': { province: 'ON', healthCardNumber: '1234567890', versionCode: 'AB' },
  'MRN-1002': { province: 'ON', healthCardNumber: '2345678901', versionCode: 'CD' },
  'MRN-1003': { province: 'BC', healthCardNumber: '9876543210' },
  'MRN-1004': { province: 'AB', healthCardNumber: '123456789' },
  'MRN-1005': { province: 'ON', healthCardNumber: '3456789012', versionCode: 'EF' },
  'MRN-1006': { province: 'QC', healthCardNumber: 'OKOR83091801' },
  'MRN-1007': { province: 'ON', healthCardNumber: '4567890123', versionCode: 'GH' },
  'MRN-1008': { province: 'ON', healthCardNumber: '5678901234', versionCode: 'IJ' },
};

/** Best-effort parse of legacy free-text "street, city" into structured address. */
function parseLegacyAddress(raw?: string) {
  if (!raw?.trim()) return undefined;
  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return undefined;
  if (parts.length === 1) {
    return { street: parts[0], country: 'CA' as const };
  }
  return {
    street: parts.slice(0, -1).join(', '),
    city: parts[parts.length - 1],
    country: 'CA' as const,
  };
}

async function migrate() {
  await connectDb();
  const patients = await Patient.find({ deletedAt: null });
  let updated = 0;

  for (const patient of patients) {
    const set: Record<string, unknown> = {};

    if (!patient.language) set.language = 'en';
    if (!patient.genderIdentity) set.genderIdentity = 'unknown';

    if (!patient.address?.street && !patient.address?.city) {
      const parsed = parseLegacyAddress(patient.contact?.address);
      if (parsed) set.address = { ...parsed, ...(patient.address || {}) };
    } else if (patient.address && !patient.address.country) {
      set['address.country'] = 'CA';
    }

    const sample = SAMPLE_HEALTH[patient.mrn];
    if (sample && !patient.provincialHealth?.healthCardNumber) {
      set.provincialHealth = sample;
    }

    if (!patient.emergencyContact?.name && patient.mrn === 'MRN-1001') {
      set.emergencyContact = {
        name: 'Linh Nguyen',
        relationship: 'spouse',
        phone: '555-0199',
        phoneSecondary: '555-0198',
      };
      set.substituteDecisionMaker = {
        name: 'Linh Nguyen',
        relationship: 'spouse',
        phone: '555-0199',
      };
    }

    if (Object.keys(set).length === 0) continue;

    await Patient.updateOne({ _id: patient._id }, { $set: set });
    updated += 1;
  }

  // Ensure indexes for health-card lookup (including unique compound).
  await Patient.syncIndexes();

  console.log(`Canadian registration migration complete. Updated ${updated} of ${patients.length} patients.`);
  await mongoose.disconnect();
}

migrate().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
