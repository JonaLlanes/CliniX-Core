import Panel from '../../components/Panel';
import { BarList } from '../../components/reports/Charts';
import { reportsApi, type CohortReport } from '../../api/reports';
import { ExportButton, ReportMessage, useReportLoad } from './ReportsShell';

export default function CohortReportPage() {
  const report = useReportLoad<CohortReport>(reportsApi.cohorts);

  return (
    <div className="space-y-6">
      {!report.ready || report.loading || report.error || !report.data ? (
        <ReportMessage loading={report.loading} error={report.error} ready={report.ready} onRetry={report.retry} />
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-gray-900">Chronic disease cohorts</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {report.data.range.label}. Patients with an active problem or an open monitoring program. Abnormal readings are in this range.
              </p>
            </div>
            <ExportButton kind="cohorts" label="Export cohorts" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {report.data.cohorts.map((cohort) => (
              <article key={cohort.key} className="bg-white rounded-lg border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900">{cohort.label}</h3>
                <p className="text-3xl font-bold text-clinical-teal mt-2">{cohort.patients.toLocaleString()}</p>
                <p className="text-xs text-gray-500">Patients</p>
                <dl className="mt-4 space-y-2 text-sm">
                  <Row label="Active care plans" value={cohort.activeCarePlans} />
                  <Row label="Overdue recalls" value={cohort.overdueRecalls} warn={cohort.overdueRecalls > 0} />
                  <Row label="Abnormal readings" value={cohort.recentAbnormalReadings} warn={cohort.recentAbnormalReadings > 0} />
                </dl>
              </article>
            ))}
          </div>
          <Panel title="Cohort size" subtitle="Patients in each chronic disease cohort">
            <BarList
              items={report.data.cohorts.map((cohort) => ({
                label: cohort.label,
                value: cohort.patients,
                hint: [
                  countPhrase(cohort.activeCarePlans, 'care plan'),
                  countPhrase(cohort.overdueRecalls, 'overdue recall', 'overdue recalls'),
                  countPhrase(cohort.recentAbnormalReadings, 'abnormal reading', 'abnormal readings'),
                ].join(' · '),
              }))}
            />
          </Panel>
        </>
      )}
    </div>
  );
}

function Row({ label, value, warn = false }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-gray-600">{label}</dt>
      <dd className={`font-medium ${warn ? 'text-amber-700' : 'text-gray-900'}`}>{value.toLocaleString()}</dd>
    </div>
  );
}

function countPhrase(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}
