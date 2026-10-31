import type { ChartTab } from '../chart/chartDisplay';

export function chartLink(patientId: string, tab?: ChartTab) {
  if (!tab || tab === 'overview') return `/patients/${patientId}`;
  return `/patients/${patientId}?tab=${tab}`;
}
