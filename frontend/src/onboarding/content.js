export const ONBOARDING_ROLES = [
    {
        id: 'physician',
        label: 'Physician',
        description: 'Charts, encounters, and the day’s schedule.',
    },
    {
        id: 'nurse',
        label: 'Nurse',
        description: 'Check-in, rooming, vitals, and the waiting room.',
    },
    {
        id: 'admin',
        label: 'Admin',
        description: 'Clinic operations, access, and reports.',
    },
    {
        id: 'pharmacist',
        label: 'Pharmacist',
        description: 'Medication lists for patients on your care team.',
    },
    {
        id: 'caregiver',
        label: 'Caregiver',
        description: 'Assigned charts, home vitals, and tasks.',
    },
];
export const TOUR_STEPS = [
    {
        id: 'dashboard',
        title: 'Dashboard',
        body: 'The clinic day starts here: today’s queue, open work, the schedule, and anything that needs clinical attention.',
        to: '/dashboard',
    },
    {
        id: 'patient-search',
        title: 'Patient Search',
        body: 'Open the command menu from this search field, or with Ctrl+K. Search by name, MRN, health card, or appointment, then open the chart.',
        to: '/',
    },
    {
        id: 'schedule',
        title: 'Schedule',
        body: 'This is one provider’s day. Book, reschedule, cancel, and update appointment status from the board.',
        to: '/schedule',
    },
    {
        id: 'check-in',
        title: 'Check-In Board',
        body: 'Follow arrivals through the waiting room, rooming, and the provider queue. Check-in is separate from the clinical note.',
        to: '/check-in',
    },
    {
        id: 'reports',
        title: 'Reports',
        body: 'Review operations, clinical workload, and chronic-disease cohorts. Clinicians, nurses, and administrators can open the full reports.',
        to: '/reports',
    },
];
const ACCOUNT_ROLE_LABELS = {
    admin: 'Administrator',
    clinician: 'Clinician',
    nurse: 'Nurse',
    caregiver: 'Caregiver',
    pharmacist: 'Pharmacist',
    insight_service: 'Insight Service',
};
export function accountRoleLabel(role) {
    if (!role)
        return 'Signed in';
    return ACCOUNT_ROLE_LABELS[role] ?? role;
}
export function suggestedOnboardingRole(accountRole) {
    switch (accountRole) {
        case 'clinician':
            return 'physician';
        case 'nurse':
            return 'nurse';
        case 'admin':
            return 'admin';
        case 'pharmacist':
            return 'pharmacist';
        case 'caregiver':
            return 'caregiver';
        default:
            return null;
    }
}
export function onboardingRoleLabel(role) {
    return ONBOARDING_ROLES.find((item) => item.id === role)?.label ?? null;
}
export function workspaceBlurb(role) {
    switch (role) {
        case 'physician':
            return 'Open charts, document the encounter, and keep the day’s schedule in view.';
        case 'nurse':
            return 'Check patients in, record vitals, and keep the waiting room moving.';
        case 'admin':
            return 'Oversee access, clinic operations, and the reports for this site.';
        case 'pharmacist':
            return 'Review medication lists on the charts assigned to your care team.';
        case 'caregiver':
            return 'Follow the patients on your care team and record vitals from home.';
        default:
            return 'Search charts, follow the schedule, and move through check-in from one workspace.';
    }
}
export function clinicDateLine(date = new Date()) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Toronto',
        weekday: 'long',
        month: 'long',
        day: 'numeric',
    }).format(date);
}
export function greetingForClinic(date = new Date()) {
    const hour = Number(new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Toronto',
        hour: 'numeric',
        hourCycle: 'h23',
    }).format(date));
    if (hour < 12)
        return 'Good morning';
    if (hour < 17)
        return 'Good afternoon';
    return 'Good evening';
}
