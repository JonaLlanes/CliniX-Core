const KEY = 'clinix.recentCommands';
const MAX_COMMANDS = 6;

export type RecentCommand = {
  id: string;
  label: string;
  usedAt: string;
};

function isRecentCommand(value: unknown): value is RecentCommand {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<RecentCommand>;
  return Boolean(row.id && row.label && row.usedAt);
}

export function readRecentCommands(): RecentCommand[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecentCommand).slice(0, MAX_COMMANDS);
  } catch {
    return [];
  }
}

export function rememberCommand(entry: { id: string; label: string }) {
  const next: RecentCommand = { ...entry, usedAt: new Date().toISOString() };
  const rest = readRecentCommands().filter((item) => item.id !== next.id);
  localStorage.setItem(KEY, JSON.stringify([next, ...rest].slice(0, MAX_COMMANDS)));
}
