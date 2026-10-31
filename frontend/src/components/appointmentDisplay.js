export const APPOINTMENT_TYPES = [
    { value: 'new_patient', label: 'New patient' },
    { value: 'follow_up', label: 'Follow-up' },
    { value: 'consultation', label: 'Consultation' },
    { value: 'procedure', label: 'Procedure' },
    { value: 'telehealth', label: 'Telehealth' },
];
export const CLINIC_LOCATIONS = ['Toronto Main', 'North York', 'Mississauga', 'Virtual'];
export const STATUS_BLOCK = {
    booked: 'bg-blue-50 border-blue-300 text-blue-950',
    confirmed: 'bg-teal-50 border-teal-400 text-teal-950',
    arrived: 'bg-green-50 border-green-400 text-green-950',
    no_show: 'bg-amber-50 border-amber-300 text-amber-950',
    cancelled: 'bg-gray-50 border-gray-300 text-gray-500',
    completed: 'bg-slate-50 border-slate-300 text-slate-700',
};
export function canBookAppointments(role) {
    return !!role && ['clinician', 'nurse', 'admin'].includes(role);
}
export function refId(value) {
    return typeof value === 'string' ? value : value._id;
}
export function isPerson(value) {
    return typeof value === 'object' && value !== null && 'familyName' in value;
}
export function isProvider(value) {
    return typeof value === 'object' && value !== null && 'displayName' in value;
}
export function patientLabel(value) {
    if (!isPerson(value))
        return 'Patient';
    const preferred = value.preferredName && value.preferredName !== value.givenName ? ` (${value.preferredName})` : '';
    return `${value.familyName}, ${value.givenName}${preferred}`;
}
export function providerLabel(value) {
    if (!isProvider(value))
        return 'Provider';
    return value.displayName;
}
export function typeLabel(value) {
    return APPOINTMENT_TYPES.find((item) => item.value === value)?.label ?? value;
}
export function formatClock(value) {
    return new Date(value).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
export function formatAppointmentWhen(start, end) {
    const startDate = new Date(start);
    const day = startDate.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
    return `${day} · ${formatClock(start)}–${formatClock(end)}`;
}
export function localDateInput(date = new Date()) {
    const copy = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return copy.toISOString().slice(0, 10);
}
export function toDateTimeInput(value) {
    const date = new Date(value);
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
export function shiftDate(isoDate, days) {
    const [year, month, day] = isoDate.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + days);
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
