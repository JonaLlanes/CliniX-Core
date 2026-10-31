import { useEffect, useRef, type KeyboardEvent } from 'react';
import { CHART_GROUPS, type ChartTab } from './chartDisplay';

const TABS = CHART_GROUPS.flatMap((group) => group.tabs);

export default function ChartNav({
  tab,
  onChange,
  allergyCount = 0,
  overdueRecalls = 0,
}: {
  tab: ChartTab;
  onChange: (tab: ChartTab) => void;
  allergyCount?: number;
  overdueRecalls?: number;
}) {
  const selectedRef = useRef<HTMLButtonElement>(null);
  const movedByKey = useRef(false);

  useEffect(() => {
    if (!movedByKey.current) return;
    movedByKey.current = false;
    selectedRef.current?.focus();
  }, [tab]);

  function move(event: KeyboardEvent, index: number) {
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % TABS.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = TABS.length - 1;
    else return;
    event.preventDefault();
    movedByKey.current = true;
    onChange(TABS[next].id);
  }

  let index = 0;

  return (
    <nav className="chart-nav mt-4 max-w-full overflow-x-auto pb-1" aria-label="Chart sections">
      <div className="flex gap-2 lg:flex-wrap" role="tablist" aria-label="Chart sections">
        {CHART_GROUPS.map((group) => (
          <div key={group.id} className="shrink-0 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
            <p className="px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
              {group.label}
            </p>
            <div className="flex gap-0.5">
              {group.tabs.map((item) => {
                const selected = tab === item.id;
                const position = index;
                index += 1;
                const allergyAlert = item.id === 'allergies' && allergyCount > 0;
                const recallAlert = item.id === 'monitoring' && overdueRecalls > 0;
                return (
                  <button
                    key={item.id}
                    ref={selected ? selectedRef : undefined}
                    id={`chart-tab-${item.id}`}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-controls="chart-panel"
                    tabIndex={selected ? 0 : -1}
                    onClick={() => onChange(item.id)}
                    onKeyDown={(event) => move(event, position)}
                    className={`relative whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-medium transition-colors ${
                      selected
                        ? 'bg-teal-700 text-white shadow-sm'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                    {allergyAlert && <span className="sr-only">, active allergies</span>}
                    {recallAlert && <span className="sr-only">, overdue recalls</span>}
                    {(allergyAlert || recallAlert) && (
                      <span
                        className={`ml-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle ${
                          selected ? 'bg-amber-200' : 'bg-rose-600'
                        }`}
                        aria-hidden
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}
