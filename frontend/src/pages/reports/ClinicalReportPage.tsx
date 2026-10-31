import StatCard from '../../components/StatCard';
import Panel from '../../components/Panel';
import { BarList, TrendChart } from '../../components/reports/Charts';
import {
  reportsApi,
  type ClinicalReport,
  type MedicationReport,
  type MonitoringReport,
} from '../../api/reports';
import { ExportButton, ReportMessage, useReportLoad } from './ReportsShell';

export default function ClinicalReportPage() {
  const clinical = useReportLoad<ClinicalReport>(reportsApi.clinical);
  const medications = useReportLoad<MedicationReport>(reportsApi.medications);
  const monitoring = useReportLoad<MonitoringReport>(reportsApi.monitoring);
  const loading = clinical.loading || medications.loading || monitoring.loading;
  const error = clinical.error || medications.error || monitoring.error;
  if (!clinical.ready || loading || error || !clinical.data || !medications.data || !monitoring.data) {
    return (
      <div className="space-y-8">
        <ReportMessage
          loading={loading}
          error={error}
          ready={clinical.ready}
          onRetry={() => {
            clinical.retry();
            medications.retry();
            monitoring.retry();
          }}
        />
      </div>
    );
  }
  const panel = clinical.data;
  const medicationReport = medications.data;
  const monitoringReport = monitoring.data;

  return (
    <div className="space-y-8">
          <section className="space-y-4">
            <div>
              <h2 className="font-semibold text-gray-900">Clinical panel</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {panel.range.label}. Census figures are current. Patients seen are arrived or completed visits in this range.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Active patients" value={panel.activePatients} tone="accent" hint="Registered charts" />
              <StatCard label="Patients seen" value={panel.patientsSeen} hint="Arrived or completed in this range" />
              <StatCard label="Active problems" value={panel.activeProblems} />
              <StatCard label="Active medications" value={panel.activeMedications} />
              <StatCard label="Active care plans" value={panel.activeCarePlans} />
              <StatCard label="Monitoring enrollments" value={panel.monitoringEnrollments} hint="Active programs" />
              <StatCard
                label="Overdue recalls"
                value={panel.overdueRecalls}
                tone={panel.overdueRecalls ? 'bad' : 'default'}
                hint="Open and past due"
              />
            </div>
            <Panel title="Patients seen" subtitle={panel.range.bucket === 'week' ? 'Weekly' : 'Daily'}>
              <TrendChart
                bucket={panel.range.bucket}
                points={panel.seenTrend}
                series={[{ key: 'patientsSeen', label: 'Patients seen', color: '#0d9488' }]}
              />
            </Panel>
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="font-semibold text-gray-900">Medications</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Active medications are current. Discontinued medications and allergy acknowledgements are in this range.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard label="Active medications" value={medicationReport.active} tone="accent" />
              <StatCard label="Discontinued medications" value={medicationReport.discontinued} />
              <StatCard label="Allergy acknowledgements" value={medicationReport.allergyAcknowledgements} hint="Warnings acknowledged in this range" />
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-gray-900">Monitoring</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Active programs and overdue recalls are current. Completed recalls and abnormal readings are in this range.
                </p>
              </div>
              <ExportButton kind="recalls" label="Export recalls" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Active monitoring programs" value={monitoringReport.activePrograms} tone="accent" />
              <StatCard
                label="Overdue recalls"
                value={monitoringReport.overdueRecalls}
                tone={monitoringReport.overdueRecalls ? 'bad' : 'default'}
              />
              <StatCard label="Completed recalls" value={monitoringReport.completedRecalls} tone="good" />
              <StatCard
                label="Abnormal readings"
                value={monitoringReport.abnormalReadings}
                tone={monitoringReport.abnormalReadings ? 'warn' : 'default'}
              />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Abnormal readings by type">
                <BarList
                  items={monitoringReport.abnormalByType.map((item) => ({
                    label: item.label,
                    value: item.count,
                  }))}
                />
              </Panel>
              <Panel title="Abnormal readings" subtitle={monitoringReport.range.bucket === 'week' ? 'Weekly' : 'Daily'}>
                <TrendChart
                  bucket={monitoringReport.range.bucket}
                  points={monitoringReport.trend}
                  series={[{ key: 'abnormalReadings', label: 'Abnormal readings', color: '#d97706' }]}
                />
              </Panel>
            </div>
          </section>
    </div>
  );
}
