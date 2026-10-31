import { z } from 'zod';

/** Canadian province / territory codes (ISO 3166-2:CA without CA- prefix). */
export const CANADIAN_PROVINCES = [
  'AB',
  'BC',
  'MB',
  'NB',
  'NL',
  'NS',
  'NT',
  'NU',
  'ON',
  'PE',
  'QC',
  'SK',
  'YT',
] as const;

export type CanadianProvince = (typeof CANADIAN_PROVINCES)[number];

export const LANGUAGES = ['en', 'fr', 'other'] as const;

export const GENDER_IDENTITIES = [
  'female',
  'male',
  'non-binary',
  'two-spirit',
  'other',
  'prefer-not-to-say',
  'unknown',
] as const;

export const SEX_AT_BIRTH = ['female', 'male', 'other', 'unknown'] as const;

/** Digits-only length rules for provincial health card numbers. */
const DIGIT_LENGTH: Partial<Record<CanadianProvince, number>> = {
  AB: 9,
  BC: 10,
  MB: 9,
  NB: 9,
  NL: 12,
  NS: 10,
  NT: 8,
  NU: 9,
  ON: 10,
  PE: 8,
  SK: 9,
  YT: 9,
};

const CA_POSTAL =
  /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ ]?\d[ABCEGHJ-NPRSTV-Z]\d$/i;

export function normalizeHealthCardNumber(value: string): string {
  return value.replace(/[\s-]/g, '').toUpperCase();
}

export function normalizePostalCode(value: string): string {
  const compact = value.replace(/\s+/g, '').toUpperCase();
  if (compact.length === 6) return `${compact.slice(0, 3)} ${compact.slice(3)}`;
  return compact;
}

export function validateHealthCardNumber(
  province: CanadianProvince,
  rawNumber: string,
  versionCode?: string
): string | null {
  const number = normalizeHealthCardNumber(rawNumber);

  if (province === 'QC') {
    // RAMQ NAM: 4 letters + 8 digits (e.g. TREA80512345)
    if (!/^[A-Z]{4}\d{8}$/.test(number)) {
      return 'Quebec health card number must be 4 letters followed by 8 digits';
    }
    return null;
  }

  const expected = DIGIT_LENGTH[province];
  if (expected == null) {
    return `Unsupported province: ${province}`;
  }
  if (!new RegExp(`^\\d{${expected}}$`).test(number)) {
    return `${province} health card number must be ${expected} digits`;
  }

  // Ontario version code is two letters when present (reissued cards).
  if (province === 'ON' && versionCode != null && versionCode !== '') {
    if (!/^[A-Za-z]{2}$/.test(versionCode.trim())) {
      return 'Ontario version code must be exactly 2 letters';
    }
  }

  // Version code is Ontario-specific; reject if supplied for other provinces.
  if (province !== 'ON' && versionCode != null && String(versionCode).trim() !== '') {
    return 'Version code applies only to Ontario health cards';
  }

  return null;
}

export const canadianProvinceSchema = z.enum(CANADIAN_PROVINCES);

export const postalCodeSchema = z
  .string()
  .trim()
  .min(1)
  .transform(normalizePostalCode)
  .refine((v) => CA_POSTAL.test(v), {
    message: 'Invalid Canadian postal code (e.g. K1A 0B1)',
  });

export const addressSchema = z.object({
  street: z.string().trim().min(1).optional().or(z.literal('')),
  city: z.string().trim().min(1).optional().or(z.literal('')),
  province: canadianProvinceSchema.optional().or(z.literal('')),
  postalCode: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .transform((v) => (v ? normalizePostalCode(v) : v))
    .refine((v) => !v || CA_POSTAL.test(v), {
      message: 'Invalid Canadian postal code (e.g. K1A 0B1)',
    }),
  country: z.string().trim().default('CA'),
});

export const personContactSchema = z.object({
  name: z.string().trim().min(1),
  relationship: z.string().trim().optional().or(z.literal('')),
  phone: z.string().trim().optional().or(z.literal('')),
  phoneSecondary: z.string().trim().optional().or(z.literal('')),
});

export const provincialHealthSchema = z
  .object({
    province: canadianProvinceSchema,
    healthCardNumber: z.string().trim().min(1),
    versionCode: z.string().trim().optional().or(z.literal('')),
  })
  .superRefine((val, ctx) => {
    const err = validateHealthCardNumber(
      val.province,
      val.healthCardNumber,
      val.versionCode || undefined
    );
    if (err) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: err,
        path: ['healthCardNumber'],
      });
    }
  })
  .transform((val) => ({
    province: val.province,
    healthCardNumber: normalizeHealthCardNumber(val.healthCardNumber),
    versionCode:
      val.province === 'ON' && val.versionCode
        ? val.versionCode.trim().toUpperCase()
        : undefined,
  }));
