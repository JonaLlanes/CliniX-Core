import { useEffect, useRef, useState } from 'react';
import { clinicalApi } from '../../api/client';
import { activeAllergies, criticalFindings, isHighRiskMedication, medicationLabel } from '../chart/chartDisplay';
const cache = new Map();
const inflight = new Map();
function activeHighAlert(medications) {
    return medications.filter((item) => (item.status === 'active' || item.status === 'on-hold') && isHighRiskMedication(item));
}
async function fetchFlags(patientId) {
    const [allergies, medications, monitor, results] = await Promise.all([
        clinicalApi.allergies(patientId).list('?limit=100').catch(() => null),
        clinicalApi.medications(patientId).summary().catch(() => null),
        clinicalApi.monitoring(patientId).dashboard().catch(() => null),
        clinicalApi.orders(patientId).results('?limit=40').catch(() => null),
    ]);
    const incomplete = !allergies || !medications || !monitor || !results;
    const active = allergies ? activeAllergies(allergies.data) : [];
    const findings = criticalFindings(results?.data ?? [], monitor?.recentAbnormal ?? []);
    return {
        allergyNames: active.filter((item) => item.severity !== 'severe').map((item) => item.substance),
        severeNames: active.filter((item) => item.severity === 'severe').map((item) => item.substance),
        highAlertNames: medications ? activeHighAlert(medications.active).map((item) => medicationLabel(item)) : [],
        criticalResults: findings.filter((item) => item.level === 'critical').length,
        abnormalResults: findings.filter((item) => item.level === 'abnormal').length,
        overdueRecalls: monitor?.counts.overdueRecalls ?? 0,
        incomplete,
    };
}
function loadOne(patientId) {
    const cached = cache.get(patientId);
    if (cached)
        return Promise.resolve(cached);
    const pending = inflight.get(patientId);
    if (pending)
        return pending;
    const request = fetchFlags(patientId)
        .then((flags) => {
        if (!flags.incomplete)
            cache.set(patientId, flags);
        return flags;
    })
        .finally(() => {
        inflight.delete(patientId);
    });
    inflight.set(patientId, request);
    return request;
}
export function usePatientFlags(patientIds, refreshKey) {
    const [flags, setFlags] = useState({});
    const seenRefresh = useRef(refreshKey);
    const key = [...new Set(patientIds)].sort().join('|');
    useEffect(() => {
        const ids = key ? key.split('|') : [];
        let cancelled = false;
        if (refreshKey !== seenRefresh.current) {
            seenRefresh.current = refreshKey;
            ids.forEach((id) => cache.delete(id));
        }
        const known = {};
        const missing = [];
        for (const id of ids) {
            const hit = cache.get(id);
            if (hit)
                known[id] = hit;
            else
                missing.push(id);
        }
        setFlags(known);
        const queue = [...missing];
        let active = 0;
        const pump = () => {
            if (cancelled)
                return;
            while (active < 4 && queue.length > 0) {
                const id = queue.shift();
                active += 1;
                void loadOne(id)
                    .then((value) => {
                    if (!cancelled)
                        setFlags((current) => ({ ...current, [id]: value }));
                })
                    .catch(() => {
                    if (!cancelled) {
                        setFlags((current) => ({
                            ...current,
                            [id]: {
                                allergyNames: [],
                                severeNames: [],
                                highAlertNames: [],
                                criticalResults: 0,
                                abnormalResults: 0,
                                overdueRecalls: 0,
                                incomplete: true,
                            },
                        }));
                    }
                })
                    .finally(() => {
                    active -= 1;
                    pump();
                });
            }
        };
        pump();
        return () => {
            cancelled = true;
        };
    }, [key, refreshKey]);
    return flags;
}
