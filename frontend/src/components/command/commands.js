export const PALETTE_COMMANDS = [
    {
        id: 'find-patient',
        label: 'Find Patient',
        detail: 'Search the registry by name, MRN, or health card',
        keywords: 'search chart mrn health card patient find registry',
        kind: 'navigate',
        to: '/',
    },
    {
        id: 'new-encounter',
        label: 'New Encounter',
        detail: 'Choose a patient and open the encounter',
        keywords: 'note visit document clinical encounter',
        kind: 'pick',
        tab: 'encounters',
    },
    {
        id: 'new-order',
        label: 'New Order',
        detail: 'Choose a patient and open orders',
        keywords: 'lab imaging procedure order diagnostic',
        kind: 'pick',
        tab: 'orders',
    },
    {
        id: 'new-referral',
        label: 'New Referral',
        detail: 'Choose a patient and open referrals',
        keywords: 'specialist consult allied referral letter',
        kind: 'pick',
        tab: 'referrals',
    },
    {
        id: 'book-appointment',
        label: 'Book Appointment',
        detail: 'Open a provider day and reserve a slot',
        keywords: 'schedule book slot appointment calendar',
        kind: 'navigate',
        to: '/schedule',
    },
    {
        id: 'open-check-in',
        label: 'Open Check-In',
        detail: 'Arrivals, the waiting room, and rooming',
        keywords: 'check in check-in board waiting room arrival',
        kind: 'navigate',
        to: '/check-in',
    },
    {
        id: 'dashboard',
        label: 'Dashboard',
        detail: 'Today’s queue, schedule, and open work',
        keywords: 'home dashboard clinic day overview',
        kind: 'navigate',
        to: '/dashboard',
    },
    {
        id: 'reports',
        label: 'Reports',
        detail: 'Operations, clinical workload, and cohorts',
        keywords: 'reports analytics operations cohort clinical',
        kind: 'navigate',
        to: '/reports',
    },
];
export function commandById(id) {
    return PALETTE_COMMANDS.find((command) => command.id === id);
}
export function usesAppleCommand() {
    if (typeof navigator === 'undefined')
        return false;
    const nav = navigator;
    const platform = nav.userAgentData?.platform || navigator.platform || navigator.userAgent;
    return /mac|iphone|ipad|ipod/i.test(platform);
}
export function commandShortcutLabel() {
    return usesAppleCommand() ? '⌘K' : 'Ctrl K';
}
