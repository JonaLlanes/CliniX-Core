import { useMemo, useRef, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { StatusBadge } from '../StatusBadge';
import { Bone, EmptyBlock, SectionCard } from './ui';
import type { WorkFilter, WorkItem, WorkKind } from './useClinicOperations';

const FILTERS: { id: WorkFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'encounter', label: 'Unsigned encounters' },
  { id: 'order', label: 'Pending orders' },
  { id: 'referral', label: 'Outstanding referrals' },
  { id: 'task', label: 'Open tasks' },
];

const KIND_LABEL: Record<WorkKind, string> = {
  encounter: 'Unsigned encounter',
  order: 'Pending order',
  referral: 'Outstanding referral',
  task: 'Open task',
};

const PRIORITY_STYLE: Record<WorkItem['priority'], string> = {
  stat: 'bg-red-100 text-red-800',
  urgent: 'bg-amber-100 text-amber-900',
  high: 'bg-orange-100 text-orange-900',
  routine: 'bg-slate-100 text-slate-600',
};

const PRIORITY_LABEL: Record<WorkItem['priority'], string> = {
  stat: 'Stat',
  urgent: 'Urgent',
  high: 'High',
  routine: 'Routine',
};

const EMPTY: Record<WorkFilter, { title: string; body: string }> = {
  all: {
    title: 'No open work',
    body: 'Unsigned encounters, pending orders, outstanding referrals, and open tasks show up here.',
  },
  encounter: {
    title: 'No unsigned encounters',
    body: 'Encounters that still need a note or a signature show up here.',
  },
  order: {
    title: 'No pending orders',
    body: 'Orders that are still open show up here.',
  },
  referral: {
    title: 'No outstanding referrals',
    body: 'Active referrals and follow-ups show up here.',
  },
  task: {
    title: 'No open tasks',
    body: 'Unfinished care tasks show up here.',
  },
};

function countOf(items: WorkItem[], id: WorkFilter) {
  if (id === 'all') return items.length;
  return items.filter((item) => item.kind === id).length;
}

export default function WorklistPanel({
  items,
  ready,
  filter,
  onFilter,
  note,
}: {
  items: WorkItem[];
  ready: boolean;
  filter: WorkFilter;
  onFilter: (filter: WorkFilter) => void;
  note: string;
}) {
  const visible = useMemo(
    () => (filter === 'all' ? items : items.filter((item) => item.kind === filter)),
    [filter, items]
  );
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function onTabKey(event: KeyboardEvent, index: number) {
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % FILTERS.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + FILTERS.length) % FILTERS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = FILTERS.length - 1;
    else return;
    event.preventDefault();
    onFilter(FILTERS[next].id);
    tabRefs.current[next]?.focus();
  }

  const empty = EMPTY[filter];

  return (
    <SectionCard
      id="care-team-worklist"
      title="Care team worklist"
      subtitle={note || 'Unsigned encounters, pending orders, outstanding referrals, and open tasks.'}
    >
      <div className="mb-4 flex max-w-full gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Worklist">
        {FILTERS.map((item, index) => {
          const selected = filter === item.id;
          const count = ready ? countOf(items, item.id) : null;
          return (
            <button
              key={item.id}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`worklist-tab-${item.id}`}
              aria-selected={selected}
              aria-controls="worklist-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => onFilter(item.id)}
              onKeyDown={(event) => onTabKey(event, index)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                selected ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {item.label}
              {count != null && <span className={selected ? 'text-teal-100' : 'text-slate-600'}> {count}</span>}
            </button>
          );
        })}
      </div>

      <div id="worklist-panel" role="tabpanel" aria-labelledby={`worklist-tab-${filter}`}>
      {!ready && (
        <div className="space-y-2" aria-busy="true" aria-live="polite">
          <span className="sr-only">Loading the worklist</span>
          {Array.from({ length: 5 }, (_, index) => (
            <Bone key={index} className="h-16 w-full" />
          ))}
        </div>
      )}

      {ready && visible.length === 0 && (
        <EmptyBlock title={empty.title} body={empty.body} />
      )}

      {ready && visible.length > 0 && (
        <div className="max-w-full overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead>
              <tr className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                <th className="pb-2 pr-3 font-semibold">Patient</th>
                <th className="pb-2 pr-3 font-semibold">Work</th>
                <th className="pb-2 pr-3 font-semibold">Priority</th>
                <th className="pb-2 pr-3 font-semibold">Status</th>
                <th className="pb-2 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="py-3 pr-3 align-middle">
                    <Link to={item.href} className="font-medium text-slate-950 hover:text-teal-800 hover:underline">
                      {item.patientName}
                    </Link>
                    <p className="text-xs text-slate-500">MRN {item.mrn}</p>
                  </td>
                  <td className="max-w-[16rem] py-3 pr-3 align-middle">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">{KIND_LABEL[item.kind]}</p>
                    <p className="truncate font-medium text-slate-800" title={item.title}>
                      {item.title}
                    </p>
                  </td>
                  <td className="py-3 pr-3 align-middle">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLE[item.priority]}`}>
                      {PRIORITY_LABEL[item.priority]}
                    </span>
                  </td>
                  <td className="py-3 pr-3 align-middle">
                    <StatusBadge value={item.status} />
                  </td>
                  <td className="py-3 text-right align-middle">
                    <Link
                      to={item.href}
                      className="inline-flex rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
                    >
                      {item.action}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </div>
    </SectionCard>
  );
}
