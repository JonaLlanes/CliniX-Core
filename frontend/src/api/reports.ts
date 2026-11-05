import { api, apiBase } from './client';

const API_BASE = apiBase();

export interface ReportRange {
  preset: 'today' | 'last_7_days' | 'current_month' | 'custom';
  from: string;
  to: string;
  label: string;
  bucket: 'day' | 'week';
  timeZone: string;
}

export interface OperationalReport {
  range: ReportRange;
  appointments: number;
  completedVisits: number;
  noShows: number;
  cancellations: number;
  averageWaitMinutes: number | null;
  waitSamples: number;
  activeEncounters: number;
  activeReferrals: number;
  activeOrders: number;
  trend: Array<{
    date: string;
    appointments: number;
    completedVisits: number;
    noShows: number;
    cancellations: number;
  }>;
}

export interface ClinicalReport {
  range: ReportRange;
  activePatients: number;
  patientsSeen: number;
  activeProblems: number;
  activeMedications: number;
  activeCarePlans: number;
  monitoringEnrollments: number;
  overdueRecalls: number;
  seenTrend: Array<{ date: string; patientsSeen: number }>;
}

export interface ReferralReport {
  range: ReportRange;
  created: number;
  completed: number;
  cancelled: number;
  awaitingFollowUp: number;
  trend: Array<{ date: string; created: number; completed: number; cancelled: number }>;
}

export interface OrderReport {
  range: ReportRange;
  active: number;
  completed: number;
  cancelled: number;
  outstandingResults: number;
  trend: Array<{ date: string; completed: number; cancelled: number }>;
}

export interface MedicationReport {
  range: ReportRange;
  active: number;
  discontinued: number;
  allergyAcknowledgements: number;
}

export interface MonitoringReport {
  range: ReportRange;
  activePrograms: number;
  overdueRecalls: number;
  completedRecalls: number;
  abnormalReadings: number;
  abnormalByType: Array<{ metricType: string | null; label: string; count: number }>;
  trend: Array<{ date: string; abnormalReadings: number }>;
}

export interface CohortReport {
  range: ReportRange;
  cohorts: Array<{
    key: string;
    label: string;
    patients: number;
    activeCarePlans: number;
    overdueRecalls: number;
    recentAbnormalReadings: number;
  }>;
}

export const reportsApi = {
  operational: (qs: string) => api<OperationalReport>(`/reports/operational?${qs}`),
  clinical: (qs: string) => api<ClinicalReport>(`/reports/clinical?${qs}`),
  referrals: (qs: string) => api<ReferralReport>(`/reports/referrals?${qs}`),
  orders: (qs: string) => api<OrderReport>(`/reports/orders?${qs}`),
  medications: (qs: string) => api<MedicationReport>(`/reports/medications?${qs}`),
  monitoring: (qs: string) => api<MonitoringReport>(`/reports/monitoring?${qs}`),
  cohorts: (qs: string) => api<CohortReport>(`/reports/cohorts?${qs}`),
};

export async function downloadReport(kind: string, qs: string) {
  const token = localStorage.getItem('clinix_token');
  const res = await fetch(`${API_BASE}/reports/export/${kind}?${qs}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const type = res.headers.get('content-type') || '';
  if (!res.ok || type.includes('text/html')) {
    if (type.includes('text/html')) {
      throw new Error(
        'API not reachable from this site. Set VITE_API_URL to your Render URL and redeploy the frontend.'
      );
    }
    let message = 'Export failed';
    try {
      const body = await res.json();
      if (body?.error) message = String(body.error);
    } catch {
      message = res.statusText || message;
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const header = res.headers.get('Content-Disposition') || '';
  const match = /filename="([^"]+)"/.exec(header);
  const filename = match?.[1] || `${kind}.csv`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
