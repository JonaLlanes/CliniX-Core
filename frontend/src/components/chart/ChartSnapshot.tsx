import { useState, type ReactNode } from 'react';
import type { Allergy } from '../../api/client';
import { formatAppointmentWhen, providerLabel, typeLabel } from '../appointmentDisplay';
import { StatusBadge } from '../StatusBadge';
import {
  activeAllergies,
  activeConditions,
  formatChartDate,
  medicationDetail,
  medicationLabel,
  openTasks,
  upcomingAppointment,
  type ChartSnapshotData,
  type ChartTab,
} from './chartDisplay';

function Section({
  title,
  action,
  onAction,
  children,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {action && onAction && (
          <button type="button" onClick={onAction} className="text-xs font-medium text-teal-800 hover:underline">
            {action}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">
      {text}
    </p>
  );
}

function SnapshotBody({
  allergies,
  snapshot,
  onOpen,
}: {
  allergies: Allergy[];
  snapshot: ChartSnapshotData | null;
  onOpen: (tab: ChartTab) => void;
}) {
  if (!snapshot) {
    return (
      <div className="space-y-3" aria-hidden>
        <div className="h-28 animate-pulse rounded-2xl bg-slate-200" />
        <div className="h-28 animate-pulse rounded-2xl bg-slate-200" />
        <div className="h-28 animate-pulse rounded-2xl bg-slate-200" />
      </div>
    );
  }

  const conditions = activeConditions(snapshot.conditions);
  const medications = snapshot.medications;
  const allergiesActive = activeAllergies(allergies);
  const nextVisit = upcomingAppointment(snapshot.appointments);
  const tasks = openTasks(snapshot.tasks);

  return (
    <div className="space-y-3">
      <Section title="Active conditions" action="Problem list" onAction={() => onOpen('problems')}>
        {conditions.length === 0 ? (
          <EmptyLine text="No active conditions." />
        ) : (
          <ul className="space-y-2.5">
            {conditions.slice(0, 5).map((condition) => (
              <li key={condition._id} className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900" title={condition.display}>
                    {condition.display}
                  </p>
                  {condition.code && <p className="text-xs text-slate-500">{condition.code}</p>}
                </div>
                <StatusBadge value={condition.severity} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Current medications" action="Medications" onAction={() => onOpen('medications')}>
        {medications.length === 0 ? (
          <EmptyLine text="No active medications." />
        ) : (
          <ul className="space-y-2.5">
            {medications.slice(0, 5).map((medication) => (
              <li key={medication._id} className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900" title={medicationLabel(medication)}>
                  {medicationLabel(medication)}
                </p>
                <p className="truncate text-xs text-slate-500">{medicationDetail(medication) || 'No regimen recorded'}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Allergies" action="Allergies" onAction={() => onOpen('allergies')}>
        {allergiesActive.length === 0 ? (
          <EmptyLine text="No active allergies." />
        ) : (
          <ul className="space-y-2.5">
            {allergiesActive.slice(0, 5).map((allergy) => (
              <li key={allergy._id} className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{allergy.substance}</p>
                  <p className="truncate text-xs text-slate-500">{allergy.reaction}</p>
                </div>
                <StatusBadge value={allergy.severity} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Upcoming appointment" action="Appointments" onAction={() => onOpen('appointments')}>
        {!nextVisit ? (
          <EmptyLine text="No upcoming appointments." />
        ) : (
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-900">
              {formatAppointmentWhen(nextVisit.startTime, nextVisit.endTime)}
            </p>
            <p className="text-xs text-slate-500">
              {typeLabel(nextVisit.appointmentType)} · {providerLabel(nextVisit.providerId)}
            </p>
            <p className="text-xs text-slate-500">{nextVisit.clinicLocation}</p>
          </div>
        )}
      </Section>

      <Section title="Tasks assigned" action="Care plans" onAction={() => onOpen('care')}>
        {tasks.length === 0 ? (
          <EmptyLine text="No open tasks." />
        ) : (
          <ul className="space-y-2.5">
            {tasks.slice(0, 5).map((task) => (
              <li key={task._id} className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900" title={task.title}>
                  {task.title}
                </p>
                <p className="text-xs text-slate-500">
                  {task.assigneeRole}
                  {task.dueDate ? ` · due ${formatChartDate(task.dueDate)}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

export default function ChartSnapshot({
  allergies,
  snapshot,
  onOpen,
  stickyTop,
}: {
  allergies: Allergy[];
  snapshot: ChartSnapshotData | null;
  onOpen: (tab: ChartTab) => void;
  stickyTop: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <aside
      className="order-1 lg:sticky lg:order-2 lg:max-h-[calc(100vh-4rem-var(--chart-chrome)-1.5rem)] lg:overflow-y-auto lg:pr-1"
      style={{ top: stickyTop }}
    >
      <div className="mb-3 flex items-center justify-between lg:mb-3">
        <h2 className="text-sm font-semibold text-slate-900">Patient snapshot</h2>
        <button
          type="button"
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 lg:hidden"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          {open ? 'Hide' : 'Show'}
        </button>
      </div>
      <div className={open ? 'block' : 'hidden lg:block'}>
        <SnapshotBody allergies={allergies} snapshot={snapshot} onOpen={onOpen} />
      </div>
    </aside>
  );
}
