import { memo, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AttentionPanel from '../components/dashboard/AttentionPanel';
import KpiStrip, { type KpiId } from '../components/dashboard/KpiStrip';
import QuickActions from '../components/dashboard/QuickActions';
import RecentPatients from '../components/dashboard/RecentPatients';
import SchedulePanel from '../components/dashboard/SchedulePanel';
import WorklistPanel from '../components/dashboard/WorklistPanel';
import { useClinicOperations, type WorkFilter } from '../components/dashboard/useClinicOperations';
import { useAuth } from '../context/AuthContext';
import { useOnboarding } from '../context/OnboardingContext';
import { accountRoleLabel, clinicDateLine, greetingForClinic, suggestedOnboardingRole, workspaceBlurb } from '../onboarding/content';
import { ErrorNotice } from '../components/feedback';
import { canViewPopulationReports } from './reports/reportDisplay';

const MemoKpi = memo(KpiStrip);
const MemoQuick = memo(QuickActions);
const MemoWorklist = memo(WorklistPanel);
const MemoAttention = memo(AttentionPanel);
const MemoSchedule = memo(SchedulePanel);
const MemoRecent = memo(RecentPatients);

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { role } = useOnboarding();
  const navigate = useNavigate();
  const canView = canViewPopulationReports(user?.role);
  const ops = useClinicOperations(canView);
  const [workFilter, setWorkFilter] = useState<WorkFilter>('all');
  const blurb = workspaceBlurb(role ?? suggestedOnboardingRole(user?.role));

  const kpiValues = useMemo(
    () => ({
      appointments: ops.appointments,
      waiting: ops.waiting,
      roomed: ops.roomed,
      encounters: ops.encounters,
      orders: ops.orders,
      referrals: ops.referrals,
      recalls: ops.recalls,
    }),
    [ops.appointments, ops.waiting, ops.roomed, ops.encounters, ops.orders, ops.referrals, ops.recalls]
  );

  const onKpi = useCallback(
    (id: KpiId) => {
      if (id === 'appointments') {
        scrollToSection('todays-schedule');
        return;
      }
      if (id === 'waiting' || id === 'roomed') {
        navigate('/check-in');
        return;
      }
      if (id === 'recalls') {
        scrollToSection('clinical-attention');
        return;
      }
      const filter: WorkFilter = id === 'encounters' ? 'encounter' : id === 'orders' ? 'order' : 'referral';
      setWorkFilter(filter);
      scrollToSection('care-team-worklist');
    },
    [navigate]
  );

  return (
    <div className="mx-auto max-w-[90rem] space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-clinical-teal">{clinicDateLine()} · America/Toronto</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
            {greetingForClinic()}, {user?.displayName}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">{blurb}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {ops.refreshing && ops.readyBoard && (
            <span className="text-xs font-medium text-slate-600" role="status">
              Updating…
            </span>
          )}
          <button
            type="button"
            onClick={ops.refresh}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-teal-200 hover:text-teal-800"
          >
            Refresh
          </button>
          <span className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-medium text-teal-800 ring-1 ring-teal-100">
            {accountRoleLabel(user?.role)}
          </span>
        </div>
      </header>

      {(ops.boardError || ops.workError) && (
        <ErrorNotice
          title={ops.boardError ? 'Today’s clinic board did not load' : 'The care team worklist did not load'}
          message={ops.boardError || ops.workError}
          onRetry={ops.refresh}
        />
      )}

      <MemoKpi values={kpiValues} trends={ops.trends} onSelect={onKpi} />

      <MemoQuick />

      <div className="grid items-start gap-6 xl:grid-cols-5">
        <div className="min-w-0 xl:col-span-3">
          <MemoWorklist
            items={ops.work}
            ready={ops.readyWork}
            filter={workFilter}
            onFilter={setWorkFilter}
            note={ops.scopeNote}
          />
        </div>
        <div className="min-w-0 xl:col-span-2">
          <MemoAttention items={ops.attention} ready={ops.readyWork} />
        </div>
      </div>

      <MemoSchedule rows={ops.schedule} ready={ops.readyBoard} />
      <MemoRecent />
    </div>
  );
}
