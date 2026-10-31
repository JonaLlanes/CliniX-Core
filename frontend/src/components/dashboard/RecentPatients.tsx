import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { chartLink } from './chartLink';
import { formatLastOpened, readRecentCharts, type RecentChart } from './recentCharts';
import { EmptyBlock, SectionCard } from './ui';

export default function RecentPatients() {
  const [charts, setCharts] = useState<RecentChart[]>([]);

  useEffect(() => {
    setCharts(readRecentCharts());
  }, []);

  return (
    <SectionCard
      id="recent-patients"
      title="Recently viewed patients"
      subtitle="Charts you opened on this browser. Selecting one returns you to that chart."
    >
      {charts.length === 0 ? (
        <EmptyBlock
          title="No recent charts"
          body="Open a patient from the schedule, the worklist, or Find Patient. The last charts you viewed will stay here."
        />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {charts.map((chart) => (
            <li key={chart.id}>
              <Link
                to={chartLink(chart.id)}
                className="block rounded-xl border border-slate-200 px-3 py-3 transition hover:border-teal-200 hover:bg-teal-50/40"
              >
                <p className="truncate text-sm font-semibold text-slate-950">{chart.name}</p>
                <p className="mt-0.5 text-xs text-slate-500">MRN {chart.mrn}</p>
                <p className="mt-1 text-xs font-medium text-slate-600">Last opened {formatLastOpened(chart.openedAt)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
