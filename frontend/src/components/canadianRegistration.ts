export const CANADIAN_PROVINCES = [
  { code: 'AB', label: 'Alberta' },
  { code: 'BC', label: 'British Columbia' },
  { code: 'MB', label: 'Manitoba' },
  { code: 'NB', label: 'New Brunswick' },
  { code: 'NL', label: 'Newfoundland and Labrador' },
  { code: 'NS', label: 'Nova Scotia' },
  { code: 'NT', label: 'Northwest Territories' },
  { code: 'NU', label: 'Nunavut' },
  { code: 'ON', label: 'Ontario' },
  { code: 'PE', label: 'Prince Edward Island' },
  { code: 'QC', label: 'Quebec' },
  { code: 'SK', label: 'Saskatchewan' },
  { code: 'YT', label: 'Yukon' },
] as const;

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'French' },
  { code: 'other', label: 'Other' },
] as const;

export const SEX_AT_BIRTH = [
  { code: 'female', label: 'Female' },
  { code: 'male', label: 'Male' },
  { code: 'other', label: 'Other' },
  { code: 'unknown', label: 'Unknown' },
] as const;

export const GENDER_IDENTITIES = [
  { code: 'female', label: 'Female' },
  { code: 'male', label: 'Male' },
  { code: 'non-binary', label: 'Non-binary' },
  { code: 'two-spirit', label: 'Two-Spirit' },
  { code: 'other', label: 'Other' },
  { code: 'prefer-not-to-say', label: 'Prefer not to say' },
  { code: 'unknown', label: 'Unknown' },
] as const;

export const RELATIONSHIPS = [
  'spouse',
  'partner',
  'parent',
  'child',
  'sibling',
  'friend',
  'guardian',
  'attorney',
  'other',
] as const;

export function formatAddress(address?: {
  street?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  country?: string;
}): string {
  if (!address) return '';
  const line1 = address.street?.trim() || '';
  const line2 = [address.city, address.province, address.postalCode]
    .filter(Boolean)
    .join(', ');
  const country = address.country && address.country !== 'CA' ? address.country : '';
  return [line1, line2, country].filter(Boolean).join(' · ');
}

export function optionalPersonContact(fd: FormData, prefix: string) {
  const name = String(fd.get(`${prefix}Name`) || '').trim();
  if (!name) return undefined;
  return {
    name,
    relationship: String(fd.get(`${prefix}Relationship`) || '').trim() || undefined,
    phone: String(fd.get(`${prefix}Phone`) || '').trim() || undefined,
    phoneSecondary: String(fd.get(`${prefix}PhoneSecondary`) || '').trim() || undefined,
  };
}

export function patientPayloadFromForm(fd: FormData) {
  const province = String(fd.get('healthProvince') || '').trim();
  const healthCardNumber = String(fd.get('healthCardNumber') || '').trim();
  const versionCode = String(fd.get('versionCode') || '').trim();

  const street = String(fd.get('street') || '').trim();
  const city = String(fd.get('city') || '').trim();
  const addrProvince = String(fd.get('addrProvince') || '').trim();
  const postalCode = String(fd.get('postalCode') || '').trim();

  const address =
    street || city || addrProvince || postalCode
      ? {
          street: street || undefined,
          city: city || undefined,
          province: addrProvince || undefined,
          postalCode: postalCode || undefined,
          country: 'CA',
        }
      : undefined;

  const provincialHealth =
    province && healthCardNumber
      ? {
          province,
          healthCardNumber,
          versionCode: versionCode || undefined,
        }
      : undefined;

  const legacyAddress = address
    ? [address.street, address.city, address.province, address.postalCode]
        .filter(Boolean)
        .join(', ')
    : String(fd.get('address') || '');

  return {
    mrn: String(fd.get('mrn') || '').trim() || undefined,
    givenName: String(fd.get('givenName') || '').trim(),
    familyName: String(fd.get('familyName') || '').trim(),
    preferredName: String(fd.get('preferredName') || '').trim() || undefined,
    birthDate: String(fd.get('birthDate') || ''),
    language: String(fd.get('language') || 'en'),
    sex: String(fd.get('sex') || 'unknown'),
    genderIdentity: String(fd.get('genderIdentity') || 'unknown'),
    contact: {
      phone: String(fd.get('phone') || '').trim() || undefined,
      email: String(fd.get('email') || '').trim() || undefined,
      address: legacyAddress || undefined,
    },
    address,
    provincialHealth,
    emergencyContact: optionalPersonContact(fd, 'emergency'),
    substituteDecisionMaker: optionalPersonContact(fd, 'sdm'),
    identifiers: {
      insuranceMemberId: String(fd.get('insuranceMemberId') || '').trim() || undefined,
    },
  };
}
