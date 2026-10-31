import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

export type TrendTone = 'neutral' | 'good' | 'warn';
export type TrendDirection = 'up' | 'down' | 'flat';

export type Trend = {
  direction: TrendDirection;
  label: string;
  tone: TrendTone;
};

const TREND_TONE: Record<TrendTone, string> = {
  neutral: 'bg-slate-100 text-slate-600',
  good: 'bg-emerald-50 text-emerald-800',
  warn: 'bg-amber-100 text-amber-900',
};

const ARROW: Record<TrendDirection, string> = {
  up: '↑',
  down: '↓',
  flat: '→',
};

export function TrendChip({ trend }: { trend: Trend }) {
  return (
    <span className={`inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${TREND_TONE[trend.tone]}`}>
      <span aria-hidden>{ARROW[trend.direction]}</span>
      <span className="truncate">{trend.label}</span>
    </span>
  );
}

export function OpsCard({
  label,
  value,
  trend,
  icon,
  onClick,
}: {
  label: string;
  value: number | null;
  trend: Trend | null;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[8.5rem] flex-col rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-teal-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
    >
      <span className="flex items-start justify-between gap-2">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal-50 text-clinical-teal">{icon}</span>
        {trend ? <TrendChip trend={trend} /> : <span className="h-5 w-16 animate-pulse rounded-full bg-slate-100" />}
      </span>
      {value == null ? (
        <span className="mt-4 h-8 w-14 animate-pulse rounded-lg bg-slate-200" />
      ) : (
        <span className="mt-4 text-3xl font-semibold tabular-nums tracking-tight text-slate-950">{value}</span>
      )}
      <span className="mt-1 text-sm font-medium text-slate-600">{label}</span>
    </button>
  );
}

export function QuickActionCard({
  title,
  body,
  icon,
  to,
  onClick,
}: {
  title: string;
  body: string;
  icon: ReactNode;
  to?: string;
  onClick?: () => void;
}) {
  const className =
    'group flex min-h-[9.5rem] flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-teal-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 sm:p-5';
  const inner = (
    <>
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-teal-700 text-white shadow-sm transition group-hover:bg-teal-800">
        {icon}
      </span>
      <span className="mt-4 block">
        <span className="block text-base font-semibold text-slate-950">{title}</span>
        <span className="mt-1 block text-sm leading-snug text-slate-500">{body}</span>
      </span>
    </>
  );
  if (to) {
    return (
      <Link to={to} className={className}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {inner}
    </button>
  );
}

export function SectionCard({
  id,
  title,
  subtitle,
  action,
  children,
  warning = false,
}: {
  id?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  warning?: boolean;
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-24 rounded-2xl border shadow-sm ${
        warning ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'
      }`}
    >
      <div className={`flex flex-wrap items-start justify-between gap-3 border-b px-4 py-4 sm:px-5 ${warning ? 'border-amber-200' : 'border-slate-100'}`}>
        <div className="min-w-0">
          <h2 className={`text-base font-semibold ${warning ? 'text-amber-950' : 'text-slate-950'}`}>{title}</h2>
          {subtitle && (
            <p className={`mt-1 max-w-3xl text-sm leading-relaxed ${warning ? 'text-amber-950' : 'text-slate-600'}`}>
              {subtitle}
            </p>
          )}
        </div>
        {action}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function EmptyBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
      <p className="text-sm font-medium text-slate-800">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-slate-500">{body}</p>
    </div>
  );
}

export function Bone({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200 ${className}`} />;
}
