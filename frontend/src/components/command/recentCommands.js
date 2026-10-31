const KEY = 'clinix.recentCommands';
const MAX_COMMANDS = 6;
function isRecentCommand(value) {
    if (!value || typeof value !== 'object')
        return false;
    const row = value;
    return Boolean(row.id && row.label && row.usedAt);
}
export function readRecentCommands() {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw)
            return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed))
            return [];
        return parsed.filter(isRecentCommand).slice(0, MAX_COMMANDS);
    }
    catch {
        return [];
    }
}
export function rememberCommand(entry) {
    const next = { ...entry, usedAt: new Date().toISOString() };
    const rest = readRecentCommands().filter((item) => item.id !== next.id);
    localStorage.setItem(KEY, JSON.stringify([next, ...rest].slice(0, MAX_COMMANDS)));
}
