export function chartRecordId(scope, id) {
    return `chart-record-${scope}-${id}`;
}
export function focusedRecordClass(active, surface = 'card') {
    if (!active)
        return 'scroll-mt-48';
    if (surface === 'row')
        return 'scroll-mt-48 bg-teal-50 ring-2 ring-inset ring-teal-600';
    return 'scroll-mt-48 ring-2 ring-teal-600 ring-offset-2';
}
export function scrollChartRecord(scope, id, fallbackScope, fallbackId) {
    const primary = document.getElementById(chartRecordId(scope, id));
    const fallback = !primary && fallbackScope && fallbackId
        ? document.getElementById(chartRecordId(fallbackScope, fallbackId))
        : null;
    const node = primary || fallback;
    if (!node)
        return false;
    const reduce = typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    node.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    return true;
}
/** Retry until the destination panel has rendered the record. */
export function watchChartRecord(scope, id, fallbackScope, fallbackId) {
    let tries = 0;
    let timer = 0;
    const attempt = () => {
        if (scrollChartRecord(scope, id, fallbackScope, fallbackId))
            return;
        if (tries++ < 16)
            timer = window.setTimeout(attempt, 150);
    };
    timer = window.setTimeout(attempt, 40);
    return () => window.clearTimeout(timer);
}
