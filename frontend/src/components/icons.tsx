import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function base({ className = 'h-5 w-5', ...props }: IconProps) {
  return { props, className };
}

export function SearchIcon(iconProps: IconProps) {
  const { props, className } = base(iconProps);
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.2-3.2" />
    </svg>
  );
}

export function BellIcon(iconProps: IconProps) {
  const { props, className } = base(iconProps);
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} {...props}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function MenuIcon(iconProps: IconProps) {
  const { props, className } = base(iconProps);
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden="true" className={className} {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function CloseIcon(iconProps: IconProps) {
  const { props, className } = base(iconProps);
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden="true" className={className} {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function DashboardIcon(iconProps: IconProps) {
  const { props, className } = base(iconProps);
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} {...props}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function UsersIcon(iconProps: IconProps) {
  const { props, className } = base(iconProps);
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} {...props}>
      <path d="M16 20.5v-1.8a3.7 3.7 0 0 0-3.7-3.7H7.2A3.7 3.7 0 0 0 3.5 18.7v1.8" />
      <circle cx="9.8" cy="7.2" r="3" />
      <path d="M20.5 20.5v-1.8a3.7 3.7 0 0 0-2.8-3.6" />
      <path d="M16.2 4.3a3 3 0 0 1 0 5.8" />
    </svg>
  );
}

export function CalendarIcon(iconProps: IconProps) {
  const { props, className } = base(iconProps);
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} {...props}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3.5V7M16 3.5V7" />
    </svg>
  );
}

export function CheckInIcon(iconProps: IconProps) {
  const { props, className } = base(iconProps);
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} {...props}>
      <rect x="6" y="3.5" width="12" height="17" rx="2" />
      <path d="M9 3.5h6V6H9z" />
      <path d="M9 12.5l2 2 4-4" />
    </svg>
  );
}

export function ReportsIcon(iconProps: IconProps) {
  const { props, className } = base(iconProps);
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} {...props}>
      <path d="M4 19V5M4 19h16" />
      <path d="M8 15.5l3.2-4 2.8 2.2L18 8" />
    </svg>
  );
}

export function SettingsIcon(iconProps: IconProps) {
  const { props, className } = base(iconProps);
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3V20.5M3.5 12h2.2M18.3 12H20.5M5.8 5.8l1.6 1.6M16.6 16.6l1.6 1.6M18.2 5.8l-1.6 1.6M7.4 16.6l-1.6 1.6" />
    </svg>
  );
}

export function CareIcon(iconProps: IconProps) {
  const { props, className } = base(iconProps);
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden="true" className={className} {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

export function PulseIcon(iconProps: IconProps) {
  const { props, className } = base(iconProps);
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} {...props}>
      <path d="M3 12h4.2l2.1-5 3.6 10 2.2-5H21" />
    </svg>
  );
}

export function BuildingIcon(iconProps: IconProps) {
  const { props, className } = base(iconProps);
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} {...props}>
      <path d="M4 20V6.8A1.5 1.5 0 0 1 5.5 5.3h7A1.5 1.5 0 0 1 14 6.8V20" />
      <path d="M14 10h5.2A1.3 1.3 0 0 1 20.5 11.3V20" />
      <path d="M4 20h16.5" />
      <path d="M7 9h2M7 13h2M7 17h2M16.2 13.2h2M16.2 17h2" />
    </svg>
  );
}

export function CapsuleIcon(iconProps: IconProps) {
  const { props, className } = base(iconProps);
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} {...props}>
      <path d="M8.4 15.6 15.6 8.4a3.6 3.6 0 0 1 5.1 5.1l-7.2 7.2a3.6 3.6 0 0 1-5.1-5.1z" />
      <path d="M10 10l4 4" />
    </svg>
  );
}

export function CheckIcon(iconProps: IconProps) {
  const { props, className } = base(iconProps);
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} {...props}>
      <path d="M5 12.5 9.2 17 19 7" />
    </svg>
  );
}

export function EncounterIcon(iconProps: IconProps) {
  const { props, className } = base(iconProps);
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} {...props}>
      <path d="M8 4.5v5a4 4 0 0 0 8 0v-5" />
      <path d="M8 4.5h2.2M13.8 4.5H16" />
      <path d="M12 13.5v1.1a2.6 2.6 0 0 0 2.6 2.6H16" />
      <circle cx="16.8" cy="17.2" r="2" />
    </svg>
  );
}

export function ReferralIcon(iconProps: IconProps) {
  const { props, className } = base(iconProps);
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} {...props}>
      <path d="M14 4.5h5.5V10" />
      <path d="M19.5 4.5 11 13" />
      <rect x="4" y="9" width="9" height="10.5" rx="1.5" />
    </svg>
  );
}

export function OrderIcon(iconProps: IconProps) {
  const { props, className } = base(iconProps);
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} {...props}>
      <path d="M9 3.5h6" />
      <path d="M10 3.5v4.2L6.7 16.2A3.2 3.2 0 0 0 9.6 20.5h4.8a3.2 3.2 0 0 0 2.9-4.3L14 7.7V3.5" />
      <path d="M8.4 13.2h7.2" />
    </svg>
  );
}

export function VisitFlowIcon(iconProps: IconProps) {
  const { props, className } = base(iconProps);
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} {...props}>
      <path d="M4.5 20V6.2A1.5 1.5 0 0 1 6 4.7h7.2A1.5 1.5 0 0 1 14.7 6.2V20" />
      <path d="M4.5 20h15" />
      <circle cx="11.2" cy="12" r="0.8" fill="currentColor" stroke="none" />
      <path d="M16.2 9.2 19 12l-2.8 2.8" />
    </svg>
  );
}

export function NoteIcon(iconProps: IconProps) {
  const { props, className } = base(iconProps);
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} {...props}>
      <path d="M7 3.5h7.2L18.5 8v12a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 20V5A1.5 1.5 0 0 1 7 3.5z" />
      <path d="M14 3.6V8h4.4" />
      <path d="M8.5 12.2h7M8.5 15.6h4.8" />
    </svg>
  );
}

export function CarePlanIcon(iconProps: IconProps) {
  const { props, className } = base(iconProps);
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} {...props}>
      <rect x="5" y="3.5" width="14" height="17" rx="2" />
      <path d="M8.4 8.6 9.6 9.8l2.4-2.4M8.4 13.8 9.6 15l2.4-2.4" />
      <path d="M13.6 9h2.8M13.6 14.2h2.8" />
    </svg>
  );
}

export function BrandMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <div className={`${className} grid shrink-0 place-items-center rounded-xl bg-clinical-teal text-white`}>
      <CareIcon className="h-5 w-5" />
    </div>
  );
}
