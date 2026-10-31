export const LAUNCH_VISIT_STATUSES = ['waiting', 'roomed', 'in_progress'];
export function canManageEncounters(role) {
    return role === 'clinician' || role === 'admin';
}
export function formatEncounterWhen(value) {
    if (!value)
        return '—';
    return new Date(value).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}
export function providerName(value) {
    if (!value || typeof value === 'string')
        return '—';
    return value.displayName || '—';
}
export function providerId(value) {
    if (!value)
        return '';
    return typeof value === 'string' ? value : value._id;
}
