import { Link } from 'react-router-dom';
import { Bone, EmptyBlock, SectionCard } from './ui';
import type { AttentionItem, AttentionKind } from './useClinicOperations';

const GROUPS: { id: AttentionKind; label: string; row: string }[] = [
  { id: 'critical', label: 'Critical results', row: 'border-rose-200 bg-white' },
  { id: 'recall', label: 'Overdue recalls', row: 'border-amber-200 bg-white' },
  { id: 'medication', label: 'High-alert medications', row: 'border-orange-200 bg-white' },
  { id: 'abnormal', label: 'Unresolved abnormalities', row: 'border-amber-200 bg-white' },
];

export default function AttentionPanel({ items, ready }: { items: AttentionItem[]; ready: boolean }) {
  const populated = GROUPS.map((group) => ({
    ...group,
    items: items.filter((item) => item.kind === group.id),
  })).filter((group) => group.items.length > 0);

  return (
    <SectionCard
      id="clinical-attention"
      title="Clinical Attention Needed"
      subtitle="Overdue recalls, critical results, high-alert medications, and unresolved abnormalities."
      warning
    >
      {!ready && (
        <div className="space-y-2" aria-busy="true">
          <span className="sr-only">Loading clinical attention</span>
          <Bone className="h-20 w-full" />
          <Bone className="h-20 w-full" />
          <Bone className="h-20 w-full" />
        </div>
      )}

      {ready && populated.length === 0 && (
        <EmptyBlock
          title="No clinical alerts in the charts reviewed"
          body="Overdue recalls, critical results, high-alert medications, and unresolved abnormalities will collect here."
        />
      )}

      {ready && populated.length > 0 && (
        <div className="space-y-4">
          {populated.map((group) => (
            <div key={group.id}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-900">{group.label}</h3>
              <ul className="mt-2 space-y-2">
                {group.items.map((item) => (
                  <li key={item.id} className={`rounded-xl border px-3 py-2.5 ${group.row}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-950">{item.title}</p>
                        <p className="truncate text-xs text-slate-600">
                          {item.patientName} · MRN {item.mrn}
                        </p>
                        {item.detail && <p className="mt-1 text-xs leading-relaxed text-slate-600">{item.detail}</p>}
                      </div>
                      <Link to={item.href} className="shrink-0 text-xs font-semibold text-amber-950 underline-offset-2 hover:underline">
                        Open chart
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
