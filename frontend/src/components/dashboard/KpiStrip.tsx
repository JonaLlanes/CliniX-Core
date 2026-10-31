import type { ReactNode, SVGProps } from 'react';
import { BellIcon, BuildingIcon, CalendarIcon, PulseIcon, UsersIcon } from '../icons';
import { OpsCard, type Trend } from './ui';

export type KpiId = 'appointments' | 'waiting' | 'roomed' | 'encounters' | 'orders' | 'referrals' | 'recalls';

function OrderIcon(iconProps: SVGProps<SVGSVGElement>) {
  const { className = 'h-5 w-5', ...props } = iconProps;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className} {...props}>
      <rect x="6" y="3.5" width="12" height="17" rx="2" />
      <path d="M9 8.5h6M9 12.5h6M9 16.5h3.5" />
    </svg>
  );
}

function ReferralIcon(iconProps: SVGProps<SVGSVGElement>) {
  const { className = 'h-5 w-5', ...props } = iconProps;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className} {...props}>
      <path d="M7 7h9.5M13.5 4.5 16.5 7l-3 2.5" />
      <path d="M17 17H7.5M10.5 14.5 7.5 17l3 2.5" />
    </svg>
  );
}

const CARDS: { id: KpiId; label: string; icon: ReactNode }[] = [
  { id: 'appointments', label: "Today's Appointments", icon: <CalendarIcon className="h-5 w-5" /> },
  { id: 'waiting', label: 'Waiting Patients', icon: <UsersIcon className="h-5 w-5" /> },
  { id: 'roomed', label: 'Roomed Patients', icon: <BuildingIcon className="h-5 w-5" /> },
  { id: 'encounters', label: 'Active Encounters', icon: <PulseIcon className="h-5 w-5" /> },
  { id: 'orders', label: 'Open Orders', icon: <OrderIcon className="h-5 w-5" /> },
  { id: 'referrals', label: 'Pending Referrals', icon: <ReferralIcon className="h-5 w-5" /> },
  { id: 'recalls', label: 'Overdue Recalls', icon: <BellIcon className="h-5 w-5" /> },
];

export default function KpiStrip({
  values,
  trends,
  onSelect,
}: {
  values: Record<KpiId, number | null>;
  trends: Record<KpiId, Trend>;
  onSelect: (id: KpiId) => void;
}) {
  return (
    <section aria-label="Clinic totals">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
        {CARDS.map((card) => (
          <OpsCard
            key={card.id}
            label={card.label}
            value={values[card.id]}
            trend={values[card.id] == null ? null : trends[card.id]}
            icon={card.icon}
            onClick={() => onSelect(card.id)}
          />
        ))}
      </div>
    </section>
  );
}
