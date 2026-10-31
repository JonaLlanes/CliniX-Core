const KEY = 'clinix.recentCharts';
const MAX_CHARTS = 8;
function isRecentChart(value) {
    if (!value || typeof value !== 'object')
        return false;
    const row = value;
    return Boolean(row.id && row.name && row.mrn && row.openedAt);
}
export function readRecentCharts() {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw)
            return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed))
            return [];
        return parsed.filter(isRecentChart).slice(0, MAX_CHARTS);
    }
    catch {
        return [];
    }
}
export function rememberChart(entry) {
    const next = { ...entry, openedAt: new Date().toISOString() };
    const rest = readRecentCharts().filter((item) => item.id !== next.id);
    localStorage.setItem(KEY, JSON.stringify([next, ...rest].slice(0, MAX_CHARTS)));
}
export function formatLastOpened(iso, now = Date.now()) {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then))
        return 'Earlier';
    const mins = Math.max(0, Math.round((now - then) / 60000));
    if (mins < 1)
        return 'Just now';
    if (mins < 60)
        return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24)
        return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1)
        return 'Yesterday';
    if (days < 7)
        return `${days}d ago`;
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
