export function chartLink(patientId, tab) {
    if (!tab || tab === 'overview')
        return `/patients/${patientId}`;
    return `/patients/${patientId}?tab=${tab}`;
}
