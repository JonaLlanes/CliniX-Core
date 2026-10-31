export function canViewPopulationReports(role?: string) {
  return role === 'clinician' || role === 'nurse' || role === 'admin';
}

export const REPORT_PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'last_7_days', label: 'Last 7 days' },
  { id: 'current_month', label: 'This month' },
  { id: 'custom', label: 'Custom' },
] as const;

export function shortDate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return iso;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
