import { api } from './client';
const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';
export const reportsApi = {
    operational: (qs) => api(`/reports/operational?${qs}`),
    clinical: (qs) => api(`/reports/clinical?${qs}`),
    referrals: (qs) => api(`/reports/referrals?${qs}`),
    orders: (qs) => api(`/reports/orders?${qs}`),
    medications: (qs) => api(`/reports/medications?${qs}`),
    monitoring: (qs) => api(`/reports/monitoring?${qs}`),
    cohorts: (qs) => api(`/reports/cohorts?${qs}`),
};
export async function downloadReport(kind, qs) {
    const token = localStorage.getItem('clinix_token');
    const res = await fetch(`${API_BASE}/reports/export/${kind}?${qs}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
        let message = 'Export failed';
        try {
            const body = await res.json();
            if (body?.error)
                message = String(body.error);
        }
        catch {
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
