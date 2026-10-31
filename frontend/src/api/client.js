const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';
function getToken() {
    return localStorage.getItem('clinix_token');
}
export class ApiError extends Error {
    status;
    code;
    warnings;
    constructor(message, status, extra) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.code = extra?.code;
        this.warnings = extra?.warnings;
    }
}
function warningList(value) {
    if (!Array.isArray(value) || value.length === 0)
        return undefined;
    return value;
}
function explainFailure(status, message) {
    const generic = !message ||
        message === 'Request failed' ||
        /^(unauthorized|forbidden|not found|internal server error|bad gateway|service unavailable)$/i.test(message);
    if (!generic)
        return message;
    if (status === 401)
        return 'Your session expired. Sign in again.';
    if (status === 403)
        return 'You do not have permission to view or change this.';
    if (status === 404)
        return 'That record could not be found.';
    if (status >= 500)
        return 'The clinic service is unavailable. Try again in a moment.';
    return message || 'The request could not be completed.';
}
export async function api(path, options = {}) {
    const headers = new Headers(options.headers);
    if (!headers.has('Content-Type') && options.body) {
        headers.set('Content-Type', 'application/json');
    }
    const token = getToken();
    if (token)
        headers.set('Authorization', `Bearer ${token}`);
    let res;
    try {
        res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    }
    catch {
        throw new ApiError('The clinic network could not be reached. Check your connection and try again.', 0);
    }
    const text = await res.text();
    let data = null;
    if (text) {
        try {
            data = JSON.parse(text);
        }
        catch {
            throw new ApiError('The clinic service returned a response the app could not read.', res.status);
        }
    }
    if (!res.ok) {
        const message = explainFailure(res.status, data?.error || res.statusText || 'Request failed');
        if (res.status === 401 && token && !path.startsWith('/auth/login')) {
            localStorage.removeItem('clinix_token');
            sessionStorage.setItem('clinix_session_notice', 'Your session expired. Sign in again.');
            window.dispatchEvent(new Event('clinix-session-expired'));
        }
        const details = data?.details;
        const detailRecord = details && typeof details === 'object' && !Array.isArray(details)
            ? details
            : undefined;
        const formatted = formatDetails(details);
        throw new ApiError(formatted ? `${message}: ${formatted}` : message, res.status, {
            code: typeof data?.code === 'string' ? data.code : detailRecord?.code,
            warnings: warningList(data?.warnings) || warningList(detailRecord?.warnings),
        });
    }
    return data;
}
function formatDetails(details) {
    if (!Array.isArray(details))
        return '';
    const kinds = new Set(['provider', 'patient', 'provider,patient']);
    return details
        .map((item) => {
        if (typeof item === 'string')
            return item;
        if (!item || typeof item !== 'object' || !('message' in item))
            return '';
        const message = String(item.message ?? '');
        const path = 'path' in item && item.path
            ? String(item.path)
            : '';
        if (!message)
            return '';
        if (path && !kinds.has(path))
            return `${path}: ${message}`;
        return message;
    })
        .filter(Boolean)
        .join('; ');
}
export const authApi = {
    login: (email, password) => api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    }),
    me: () => api('/auth/me'),
    directory: () => api('/auth/users'),
};
export const patientsApi = {
    list: (params = '') => {
        const query = new URLSearchParams();
        query.set('limit', '50');
        if (typeof params === 'string') {
            if (params)
                query.set('q', params);
        }
        else {
            if (params.limit != null)
                query.set('limit', String(params.limit));
            if (params.q)
                query.set('q', params.q);
            if (params.mrn)
                query.set('mrn', params.mrn);
            if (params.healthCardNumber)
                query.set('healthCardNumber', params.healthCardNumber);
            if (params.name)
                query.set('name', params.name);
            if (params.birthDate)
                query.set('birthDate', params.birthDate);
        }
        return api(`/patients?${query.toString()}`);
    },
    get: (id) => api(`/patients/${id}`),
    create: (body) => api('/patients', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => api(`/patients/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
};
export const auditApi = {
    list: (patientId) => api(`/patients/${patientId}/audit?limit=50`),
};
function nested(patientId, resource) {
    return {
        list: (qs = '') => api(`/patients/${patientId}/${resource}${qs}`),
        create: (body) => api(`/patients/${patientId}/${resource}`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
        update: (resourceId, body) => api(`/patients/${patientId}/${resource}/${resourceId}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        }),
    };
}
export const clinicalApi = {
    conditions: (id) => nested(id, 'conditions'),
    diagnoses: (id) => ({
        list: (qs = '') => api(`/patients/${id}/diagnoses${qs}`),
        create: (body) => api(`/patients/${id}/diagnoses`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
        update: (diagnosisId, body) => api(`/patients/${id}/diagnoses/${diagnosisId}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        }),
        remove: (diagnosisId) => api(`/patients/${id}/diagnoses/${diagnosisId}`, { method: 'DELETE' }),
        promote: (diagnosisId, body) => api(`/patients/${id}/diagnoses/${diagnosisId}/promote`, { method: 'POST', body: JSON.stringify(body) }),
    }),
    vitals: (id) => nested(id, 'vitals'),
    medications: (id) => ({
        list: (qs = '') => api(`/patients/${id}/medications${qs}`),
        summary: () => api(`/patients/${id}/medications/summary`),
        clinicians: () => api(`/patients/${id}/medications/clinicians`),
        check: (body) => api(`/patients/${id}/medications/check`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
        create: (body) => api(`/patients/${id}/medications`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
        update: (medicationId, body) => api(`/patients/${id}/medications/${medicationId}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        }),
        hold: (medicationId, body) => api(`/patients/${id}/medications/${medicationId}/hold`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
        resume: (medicationId, body) => api(`/patients/${id}/medications/${medicationId}/resume`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
        discontinue: (medicationId, body) => api(`/patients/${id}/medications/${medicationId}/discontinue`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
        complete: (medicationId, body) => api(`/patients/${id}/medications/${medicationId}/complete`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    }),
    orders: (id) => ({
        list: (qs = '') => api(`/patients/${id}/orders${qs}`),
        summary: () => api(`/patients/${id}/orders/summary`),
        clinicians: () => api(`/patients/${id}/orders/clinicians`),
        results: (qs = '') => api(`/patients/${id}/orders/results${qs}`),
        create: (body) => api(`/patients/${id}/orders`, { method: 'POST', body: JSON.stringify(body) }),
        setStatus: (orderId, body) => api(`/patients/${id}/orders/${orderId}/status`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
        cancel: (orderId, body) => api(`/patients/${id}/orders/${orderId}/cancel`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
        addResult: (orderId, body) => api(`/patients/${id}/orders/${orderId}/results`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    }),
    referrals: (id) => ({
        list: (qs = '') => api(`/patients/${id}/referrals${qs}`),
        summary: () => api(`/patients/${id}/referrals/summary`),
        create: (body) => api(`/patients/${id}/referrals`, { method: 'POST', body: JSON.stringify(body) }),
        setStatus: (referralId, body) => api(`/patients/${id}/referrals/${referralId}/status`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
        cancel: (referralId, body) => api(`/patients/${id}/referrals/${referralId}/cancel`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
        addOutcome: (referralId, body) => api(`/patients/${id}/referrals/${referralId}/outcomes`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
        addDocument: (referralId, body) => api(`/patients/${id}/referrals/${referralId}/documents`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
        setFollowUp: (referralId, body) => api(`/patients/${id}/referrals/${referralId}/follow-up`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    }),
    carePlans: (id) => ({
        list: (qs = '') => api(`/patients/${id}/care-plans${qs}`),
        summary: () => api(`/patients/${id}/care-plans/summary`),
        options: () => api(`/patients/${id}/care-plans/options`),
        create: (body) => api(`/patients/${id}/care-plans`, { method: 'POST', body: JSON.stringify(body) }),
        update: (planId, body) => api(`/patients/${id}/care-plans/${planId}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        }),
        setStatus: (planId, body) => api(`/patients/${id}/care-plans/${planId}/status`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
        addProgress: (planId, body) => api(`/patients/${id}/care-plans/${planId}/progress`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
        addGoal: (planId, body) => api(`/patients/${id}/care-plans/${planId}/goals`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
        updateGoal: (planId, goalId, body) => api(`/patients/${id}/care-plans/${planId}/goals/${goalId}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        }),
        addIntervention: (planId, body) => api(`/patients/${id}/care-plans/${planId}/interventions`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
        updateIntervention: (planId, interventionId, body) => api(`/patients/${id}/care-plans/${planId}/interventions/${interventionId}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        }),
    }),
    monitoring: (id) => ({
        dashboard: () => api(`/patients/${id}/monitoring/dashboard`),
        trends: () => api(`/patients/${id}/monitoring/trends`),
        options: () => api(`/patients/${id}/monitoring/options`),
        programs: (qs = '') => api(`/patients/${id}/monitoring/programs${qs}`),
        createProgram: (body) => api(`/patients/${id}/monitoring/programs`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
        updateProgram: (programId, body) => api(`/patients/${id}/monitoring/programs/${programId}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        }),
        setProgramStatus: (programId, body) => api(`/patients/${id}/monitoring/programs/${programId}/status`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
        recordMetric: (programId, body) => api(`/patients/${id}/monitoring/programs/${programId}/metrics`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
        updateMetric: (metricId, body) => api(`/patients/${id}/monitoring/metrics/${metricId}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        }),
        recalls: (qs = '') => api(`/patients/${id}/monitoring/recalls${qs}`),
        createRecall: (body) => api(`/patients/${id}/monitoring/recalls`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
        updateRecall: (recallId, body) => api(`/patients/${id}/monitoring/recalls/${recallId}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        }),
        setRecallStatus: (recallId, body) => api(`/patients/${id}/monitoring/recalls/${recallId}/status`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    }),
    tasks: (id) => nested(id, 'tasks'),
    notes: (id) => ({
        ...nested(id, 'notes'),
        revisions: (noteId) => api(`/patients/${id}/notes/${noteId}/revisions`),
    }),
    allergies: (id) => nested(id, 'allergies'),
};
export const appointmentsApi = {
    list: (params = {}) => {
        const query = new URLSearchParams();
        if (params.patientId)
            query.set('patientId', params.patientId);
        if (params.providerId)
            query.set('providerId', params.providerId);
        if (params.status)
            query.set('status', params.status);
        if (params.from)
            query.set('from', params.from);
        if (params.to)
            query.set('to', params.to);
        query.set('limit', String(params.limit ?? 50));
        return api(`/appointments?${query.toString()}`);
    },
    providers: () => api('/appointments/providers'),
    day: (providerId, date) => api(`/appointments/day?providerId=${encodeURIComponent(providerId)}&date=${encodeURIComponent(date)}`),
    history: (patientId, limit = 50) => api(`/patients/${patientId}/appointments?limit=${Math.min(100, Math.max(1, limit))}`),
    create: (body) => api('/appointments', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => api(`/appointments/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    reschedule: (id, body) => api(`/appointments/${id}/reschedule`, {
        method: 'POST',
        body: JSON.stringify(body),
    }),
    cancel: (id, reason) => api(`/appointments/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason || undefined }),
    }),
};
export const visitsApi = {
    board: (params) => {
        const query = new URLSearchParams({ date: params.date });
        if (params.providerId)
            query.set('providerId', params.providerId);
        if (params.location)
            query.set('location', params.location);
        return api(`/visits/board?${query.toString()}`);
    },
    checkIn: (body) => api('/visits/check-in', {
        method: 'POST',
        body: JSON.stringify(body),
    }),
    assignRoom: (body) => api('/visits/room', {
        method: 'POST',
        body: JSON.stringify(body),
    }),
    setStatus: (body) => api('/visits/status', {
        method: 'POST',
        body: JSON.stringify(body),
    }),
    forPatient: (patientId) => api(`/patients/${patientId}/visits`),
};
export const encountersApi = {
    list: (patientId, limit = 50) => api(`/patients/${patientId}/encounters?limit=${Math.min(100, Math.max(1, limit))}`),
    summary: (patientId) => api(`/patients/${patientId}/encounters/summary`),
    current: (patientId, visitId) => api(`/patients/${patientId}/encounters/current?visitId=${encodeURIComponent(visitId)}`),
    get: (patientId, id) => api(`/patients/${patientId}/encounters/${id}`),
    create: (patientId, body) => api(`/patients/${patientId}/encounters`, {
        method: 'POST',
        body: JSON.stringify(body),
    }),
    setStatus: (patientId, id, status) => api(`/patients/${patientId}/encounters/${id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status }),
    }),
    assignProviders: (patientId, id, body) => api(`/patients/${patientId}/encounters/${id}/providers`, {
        method: 'POST',
        body: JSON.stringify(body),
    }),
    sign: (patientId, id) => api(`/patients/${patientId}/encounters/${id}/sign`, { method: 'POST' }),
    amend: (patientId, id, body) => api(`/patients/${patientId}/encounters/${id}/amend`, {
        method: 'POST',
        body: JSON.stringify(body),
    }),
};
