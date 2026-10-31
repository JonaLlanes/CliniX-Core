import { ONBOARDING_ROLES } from './content';
const STORAGE_KEY = 'clinix_onboarding_v1';
const ROLE_IDS = new Set(ONBOARDING_ROLES.map((role) => role.id));
function isRole(value) {
    return typeof value === 'string' && ROLE_IDS.has(value);
}
function readAll() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw)
            return {};
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
            return {};
        return parsed;
    }
    catch {
        return {};
    }
}
function parseRecord(value) {
    if (!value || typeof value !== 'object')
        return null;
    const row = value;
    if (row.completed !== true || typeof row.completedAt !== 'string')
        return null;
    return {
        completed: true,
        role: row.role == null ? null : isRole(row.role) ? row.role : null,
        skippedTour: row.skippedTour === true,
        completedAt: row.completedAt,
    };
}
export function readOnboarding(userId) {
    return parseRecord(readAll()[userId]);
}
export function writeOnboarding(userId, record) {
    const all = readAll();
    all[userId] = record;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return record;
}
export function clearOnboarding(userId) {
    const all = readAll();
    delete all[userId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}
