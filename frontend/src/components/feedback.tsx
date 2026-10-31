import type { ReactNode } from 'react';

export function ErrorNotice({
  title = 'This could not be loaded',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-950">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-rose-900">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-lg bg-rose-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-900"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200 motion-reduce:animate-none ${className}`} />;
}

export function CardSkeleton({ rows = 3, label }: { rows?: number; label: string }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      <SkeletonBlock className="h-8 w-48" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: rows }, (_, index) => (
          <SkeletonBlock key={index} className="h-28" />
        ))}
      </div>
    </div>
  );
}

export function RowSkeleton({ rows = 6, label }: { rows?: number; label: string }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <SkeletonBlock key={index} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function EmptyPanel({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
      <p className="text-sm font-medium text-slate-800">{title}</p>
      {body && <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">{body}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
