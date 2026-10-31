function Block({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-2xl bg-slate-200 ${className}`} />;
}

export default function ChartSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading chart</span>
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <Block className="h-3 w-24" />
        <Block className="mt-3 h-7 w-64" />
        <Block className="mt-3 h-4 w-80 max-w-full" />
        <div className="mt-4 flex flex-wrap gap-2">
          <Block className="h-7 w-28 rounded-full" />
          <Block className="h-7 w-32 rounded-full" />
          <Block className="h-7 w-28 rounded-full" />
          <Block className="h-7 w-36 rounded-full" />
        </div>
      </div>
      <div className="flex gap-2 overflow-hidden">
        <Block className="h-16 w-72" />
        <Block className="h-16 w-64" />
        <Block className="h-16 w-44" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <Block className="h-28" />
            <Block className="h-28" />
          </div>
          <Block className="h-40" />
          <Block className="h-64" />
        </div>
        <div className="space-y-3">
          <Block className="h-28" />
          <Block className="h-28" />
          <Block className="h-28" />
        </div>
      </div>
    </div>
  );
}
