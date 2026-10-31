import { Link } from 'react-router-dom';
import type { VisitBoardRow } from '../../api/client';
import { StatusBadge } from '../StatusBadge';
import { formatClock, providerLabel, typeLabel } from '../appointmentDisplay';
import { flowStatus, waitedLabel } from '../visitDisplay';
import { chartLink } from './chartLink';
import { Bone, EmptyBlock, SectionCard } from './ui';

const STATUS_BAR: Record<string, string> = {
  booked: 'bg-blue-500',
  confirmed: 'bg-teal-600',
  arrived: 'bg-emerald-500',
  completed: 'bg-slate-400',
  cancelled: 'bg-rose-500',
  no_show: 'bg-amber-500',
};

const LEGEND = [
  { status: 'booked', label: 'Booked', bar: 'bg-blue-500' },
  { status: 'confirmed', label: 'Confirmed', bar: 'bg-teal-600' },
  { status: 'arrived', label: 'Arrived', bar: 'bg-emerald-500' },
  { status: 'completed', label: 'Completed', bar: 'bg-slate-400' },
  { status: 'cancelled', label: 'Cancelled', bar: 'bg-rose-500' },
  { status: 'no_show', label: 'No-show', bar: 'bg-amber-500' },
];

function patientName(row: VisitBoardRow) {
  const patient = row.appointment.patientId;
  if (!patient || typeof patient !== 'object') return 'Patient';
  return `${patient.familyName}, ${patient.givenName}`;
}

function patientId(row: VisitBoardRow) {
  const patient = row.appointment.patientId;
  if (!patient || typeof patient !== 'object') return '';
  return patient._id;
}

export default function SchedulePanel({ rows, ready }: { rows: VisitBoardRow[]; ready: boolean }) {
  return (
    <SectionCard
      id="todays-schedule"
      title="Today’s schedule"
      subtitle="Every appointment on today’s board. Open the chart without leaving the day."
      action={
        <Link to="/schedule" className="text-sm font-medium text-clinical-teal hover:underline">
          Provider schedule
        </Link>
      }
    >
      <ul className="mb-4 flex flex-wrap gap-x-4 gap-y-2" aria-label="Appointment status colors">
        {LEGEND.map((item) => (
          <li key={item.status} className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
            <span className={`h-2.5 w-2.5 rounded-full ${item.bar}`} aria-hidden />
            {item.label}
          </li>
        ))}
      </ul>

      {!ready && (
        <div className="space-y-2" aria-busy="true">
          <span className="sr-only">Loading today’s schedule</span>
          {Array.from({ length: 4 }, (_, index) => (
            <Bone key={index} className="h-16 w-full" />
          ))}
        </div>
      )}

      {ready && rows.length === 0 && (
        <EmptyBlock
          title="No appointments today"
          body="The clinic day is clear. Book a visit from the schedule, or check another date on the provider calendar."
        />
      )}

      {ready && rows.length > 0 && (
        <ul className="divide-y divide-slate-100">
          {rows.map((row) => {
            const id = patientId(row);
            const status = row.appointment.status;
            const flow = flowStatus(row);
            const floorLabel =
              flow === 'waiting' ? 'Waiting' : flow === 'roomed' ? 'Roomed' : flow === 'in_progress' ? 'In progress' : '';
            const wait = waitedLabel(row.visit?.arrivalAt);
            const meta = [
              providerLabel(row.appointment.providerId),
              typeLabel(row.appointment.appointmentType),
              row.appointment.clinicLocation,
              row.visit?.examRoom || '',
              floorLabel,
              wait,
            ].filter(Boolean);
            const muted = status === 'cancelled' || status === 'no_show';
            return (
              <li key={row.appointment._id} className={`flex items-center gap-3 py-3 ${muted ? 'opacity-70' : ''}`}>
                <span className={`h-12 w-1 shrink-0 rounded-full ${STATUS_BAR[status] ?? 'bg-slate-300'}`} aria-hidden />
                <div className="w-16 shrink-0 text-sm font-semibold tabular-nums text-slate-900">
                  {formatClock(row.appointment.startTime)}
                </div>
                <div className="min-w-0 flex-1">
                  {id ? (
                    <Link to={chartLink(id)} className="block truncate text-sm font-semibold text-slate-950 hover:text-teal-800 hover:underline">
                      {patientName(row)}
                    </Link>
                  ) : (
                    <p className="truncate text-sm font-semibold text-slate-950">{patientName(row)}</p>
                  )}
                  <p className="truncate text-xs text-slate-500">{meta.join(' · ')}</p>
                </div>
                <StatusBadge value={status} />
                {id && (
                  <Link
                    to={chartLink(id)}
                    className="hidden shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-teal-200 hover:text-teal-800 sm:inline-flex"
                  >
                    Open chart
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
