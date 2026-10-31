import { ONBOARDING_ROLES, type OnboardingRole } from './content';

const STORAGE_KEY = 'clinix_onboarding_v1';

export interface OnboardingRecord {
  completed: boolean;
  role: OnboardingRole | null;
  skippedTour: boolean;
  completedAt: string;
}

const ROLE_IDS = new Set<string>(ONBOARDING_ROLES.map((role) => role.id));

function isRole(value: unknown): value is OnboardingRole {
  return typeof value === 'string' && ROLE_IDS.has(value);
}

function readAll(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

function parseRecord(value: unknown): OnboardingRecord | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Partial<OnboardingRecord>;
  if (row.completed !== true || typeof row.completedAt !== 'string') return null;
  return {
    completed: true,
    role: row.role == null ? null : isRole(row.role) ? row.role : null,
    skippedTour: row.skippedTour === true,
    completedAt: row.completedAt,
  };
}

export function readOnboarding(userId: string): OnboardingRecord | null {
  return parseRecord(readAll()[userId]);
}

export function writeOnboarding(userId: string, record: OnboardingRecord) {
  const all = readAll();
  all[userId] = record;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  return record;
}

export function clearOnboarding(userId: string) {
  const all = readAll();
  delete all[userId];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}
