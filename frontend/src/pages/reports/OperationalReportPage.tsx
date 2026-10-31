import StatCard from '../../components/StatCard';
import Panel from '../../components/Panel';
import { TrendChart } from '../../components/reports/Charts';
import { reportsApi, type OperationalReport, type OrderReport, type ReferralReport } from '../../api/reports';
import { ExportButton, ReportMessage, useReportLoad } from './ReportsShell';

export default function OperationalReportPage() {
  const ops = useReportLoad<OperationalReport>(reportsApi.operational);
  const referrals = useReportLoad<ReferralReport>(reportsApi.referrals);
  const orders = useReportLoad<OrderReport>(reportsApi.orders);
  const loading = ops.loading || referrals.loading || orders.loading;
  const error = ops.error || referrals.error || orders.error;
  if (!ops.ready || loading || error || !ops.data || !referrals.data || !orders.data) {
    return (
      <div className="space-y-8">
        <ReportMessage
          loading={loading}
          error={error}
          ready={ops.ready}
          onRetry={() => {
            ops.retry();
            referrals.retry();
            orders.retry();
          }}
        />
      </div>
    );
  }
  const operations = ops.data;
  const referralReport = referrals.data;
  const orderReport = orders.data;

  return (
    <div className="space-y-8">
          <section className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-gray-900">Operations</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {operations.range.label}. Appointments are scheduled in this range. Open encounters, referrals, and orders are current.
                </p>
              </div>
              <ExportButton kind="appointments" label="Export appointments" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Appointments" value={operations.appointments} tone="accent" hint="Scheduled in this range" />
              <StatCard label="Completed visits" value={operations.completedVisits} tone="good" hint="Completed appointments" />
              <StatCard label="No-shows" value={operations.noShows} tone={operations.noShows ? 'warn' : 'default'} />
              <StatCard label="Cancellations" value={operations.cancellations} tone={operations.cancellations ? 'bad' : 'default'} />
              <StatCard
                label="Average wait"
                value={operations.averageWaitMinutes == null ? '—' : `${operations.averageWaitMinutes} min`}
                hint={
                  operations.waitSamples
                    ? `${operations.waitSamples} arrival${operations.waitSamples === 1 ? '' : 's'} to room`
                    : 'No roomed visits in this range'
                }
              />
              <StatCard label="Active encounters" value={operations.activeEncounters} hint="Open, in progress, or awaiting signature" />
              <StatCard label="Active referrals" value={operations.activeReferrals} hint="Draft through scheduled" />
              <StatCard label="Active orders" value={operations.activeOrders} hint="Draft through resulted" />
            </div>
            <Panel title="Appointment volume" subtitle={operations.range.bucket === 'week' ? 'Weekly' : 'Daily'}>
              <TrendChart
                bucket={operations.range.bucket}
                points={operations.trend}
                series={[
                  { key: 'appointments', label: 'Appointments', color: '#0d9488' },
                  { key: 'completedVisits', label: 'Completed', color: '#16a34a' },
                  { key: 'noShows', label: 'No-shows', color: '#d97706' },
                  { key: 'cancellations', label: 'Cancellations', color: '#dc2626' },
                ]}
              />
            </Panel>
          </section>

          <section className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-gray-900">Referrals</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Created, completed, and cancelled in this range. Awaiting follow-up is the current queue.
                </p>
              </div>
              <ExportButton kind="referrals" label="Export referrals" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Referrals created" value={referralReport.created} tone="accent" />
              <StatCard label="Referrals completed" value={referralReport.completed} tone="good" />
              <StatCard label="Referrals cancelled" value={referralReport.cancelled} tone={referralReport.cancelled ? 'bad' : 'default'} />
              <StatCard label="Awaiting follow-up" value={referralReport.awaitingFollowUp} tone={referralReport.awaitingFollowUp ? 'warn' : 'default'} hint="Current queue" />
            </div>
            <Panel title="Referral activity" subtitle={referralReport.range.bucket === 'week' ? 'Weekly' : 'Daily'}>
              <TrendChart
                bucket={referralReport.range.bucket}
                points={referralReport.trend}
                series={[
                  { key: 'created', label: 'Created', color: '#0d9488' },
                  { key: 'completed', label: 'Completed', color: '#16a34a' },
                  { key: 'cancelled', label: 'Cancelled', color: '#dc2626' },
                ]}
              />
            </Panel>
          </section>

          <section className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-gray-900">Orders</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Completed and cancelled in this range. Active orders and outstanding results are current.
                </p>
              </div>
              <ExportButton kind="orders" label="Export orders" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Active orders" value={orderReport.active} hint="Draft through resulted" />
              <StatCard label="Completed orders" value={orderReport.completed} tone="good" />
              <StatCard label="Cancelled orders" value={orderReport.cancelled} tone={orderReport.cancelled ? 'bad' : 'default'} />
              <StatCard
                label="Outstanding results"
                value={orderReport.outstandingResults}
                tone={orderReport.outstandingResults ? 'warn' : 'default'}
                hint="Ordered, scheduled, or collected"
              />
            </div>
            <Panel title="Order completions" subtitle={orderReport.range.bucket === 'week' ? 'Weekly' : 'Daily'}>
              <TrendChart
                bucket={orderReport.range.bucket}
                points={orderReport.trend}
                series={[
                  { key: 'completed', label: 'Completed', color: '#16a34a' },
                  { key: 'cancelled', label: 'Cancelled', color: '#dc2626' },
                ]}
              />
            </Panel>
          </section>
    </div>
  );
}
