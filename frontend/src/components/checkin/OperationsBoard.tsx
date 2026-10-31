import type { ReactNode } from 'react';
import type { AppointmentProvider, VisitBoardRow, VisitStatus } from '../../api/client';
import { CLINIC_LOCATIONS, localDateInput } from '../appointmentDisplay';
import {
  KANBAN_COLUMNS,
  STATUS_FILTERS,
  boardMetrics,
  columnRows,
  queueRows,
  type StatusAction,
} from './boardModel';
import PatientCard from './PatientCard';
import { CLINIC_SCALE, WAIT_SCALE, formatDuration, thresholdTone } from './timing';
import type { PatientFlags } from './usePatientFlags';

const NO_ROOMS: string[] = [];
const fieldCls =
  'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100';

function QueueEmpty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white/80 px-3 py-8 text-center">
      <p className="text-sm font-medium text-slate-800">{title}</p>
      <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-slate-500">{body}</p>
    </div>
  );
}

function MetricButton({
  label,
  detail,
  value,
  pressed = false,
  tone = 'none',
  onClick,
}: {
  label: string;
  detail: string;
  value: string;
  pressed?: boolean;
  tone?: 'green' | 'yellow' | 'red' | 'none';
  onClick?: () => void;
}) {
  const toneClass =
    tone === 'red'
      ? 'border-rose-200 bg-rose-50'
      : tone === 'yellow'
        ? 'border-amber-200 bg-amber-50'
        : tone === 'green'
          ? 'border-emerald-200 bg-emerald-50'
          : 'border-slate-200 bg-white';
  const className = `flex min-h-[6.75rem] flex-col rounded-2xl border p-4 text-left shadow-sm ${toneClass} ${
    pressed ? 'ring-2 ring-teal-600' : ''
  } ${onClick ? 'hover:border-teal-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600' : ''}`;
  const inner = (
    <>
      <span className="text-3xl font-semibold tabular-nums tracking-tight text-slate-950">{value}</span>
      <span className="mt-1 text-sm font-medium text-slate-800">{label}</span>
      <span className="text-xs text-slate-500">{detail}</span>
    </>
  );
  if (!onClick) {
    return <div className={className}>{inner}</div>;
  }
  return (
    <button type="button" className={className} aria-pressed={pressed} onClick={onClick}>
      {inner}
    </button>
  );
}

export function BoardSkeleton() {
  return (
    <div className="space-y-4">
      <p role="status" className="sr-only">
        Loading the clinic operations board.
      </p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5" aria-hidden>
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-200 motion-reduce:animate-none" />
        ))}
      </div>
      <div className="flex flex-col gap-4 lg:flex-row" aria-hidden>
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="space-y-3 rounded-2xl bg-slate-100 p-3 lg:w-72 lg:shrink-0">
            <div className="h-5 w-24 animate-pulse rounded-lg bg-slate-200 motion-reduce:animate-none" />
            <div className="h-40 animate-pulse rounded-2xl bg-white motion-reduce:animate-none" />
            <div className="h-40 animate-pulse rounded-2xl bg-white motion-reduce:animate-none" />
          </div>
        ))}
      </div>
    </div>
  );
}

function CardList({
  rows,
  className,
  card,
}: {
  rows: VisitBoardRow[];
  className: string;
  card: (row: VisitBoardRow) => ReactNode;
}) {
  return (
    <ul className={className}>
      {rows.map((row) => (
        <li key={row.appointment._id}>{card(row)}</li>
      ))}
    </ul>
  );
}

export default function OperationsBoard({
  date,
  location,
  providerId,
  statusFilter,
  providers,
  rows,
  examRooms,
  selectedId,
  now,
  canOperate,
  flags,
  pendingId,
  refreshing,
  onDate,
  onLocation,
  onProvider,
  onStatus,
  onSelect,
  onApply,
  onCheckIn,
  onRefresh,
}: {
  date: string;
  location: string;
  providerId: string;
  statusFilter: VisitStatus | '';
  providers: AppointmentProvider[];
  rows: VisitBoardRow[];
  examRooms: Record<string, string[]>;
  selectedId: string;
  now: number;
  canOperate: boolean;
  flags: Record<string, PatientFlags>;
  pendingId: string;
  refreshing: boolean;
  onDate: (value: string) => void;
  onLocation: (value: string) => void;
  onProvider: (value: string) => void;
  onStatus: (value: string) => void;
  onSelect: (id: string) => void;
  onApply: (row: VisitBoardRow, action: StatusAction) => void;
  onCheckIn: (id: string) => void;
  onRefresh: () => void;
}) {
  const metrics = boardMetrics(rows, now);
  const columns = statusFilter ? KANBAN_COLUMNS.filter((column) => column.status === statusFilter) : KANBAN_COLUMNS;
  const showScheduled = !statusFilter || statusFilter === 'booked' || statusFilter === 'confirmed';
  const showClosed = !statusFilter || statusFilter === 'no_show' || statusFilter === 'cancelled';
  const scheduledStatuses: VisitStatus[] =
    statusFilter === 'booked' ? ['booked'] : statusFilter === 'confirmed' ? ['confirmed'] : ['booked', 'confirmed'];
  const closedStatuses: VisitStatus[] =
    statusFilter === 'no_show' ? ['no_show'] : statusFilter === 'cancelled' ? ['cancelled'] : ['no_show', 'cancelled'];
  const scheduled = queueRows(rows, scheduledStatuses);
  const closed = queueRows(rows, closedStatuses);
  const completedLabel = date === localDateInput() ? 'Completed Today' : 'Completed';
  const averageTone = thresholdTone(metrics.averageWait, WAIT_SCALE);

  function toggleStatus(next: VisitStatus) {
    onStatus(statusFilter === next ? '' : next);
  }

  function renderCard(row: VisitBoardRow) {
    return (
      <PatientCard
        row={row}
        now={now}
        date={date}
        selected={row.appointment._id === selectedId}
        rooms={examRooms[row.appointment.clinicLocation] ?? NO_ROOMS}
        canOperate={canOperate}
        flags={flags[row.appointment.patientId._id]}
        pending={pendingId === row.appointment._id}
        onSelect={() => onSelect(row.appointment._id)}
        onApply={(action) => onApply(row, action)}
        onCheckIn={() => onCheckIn(row.appointment._id)}
      />
    );
  }

  return (
    <div className="space-y-4" aria-busy={refreshing}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-clinical-teal">Clinic operations</p>
          <h1 className="text-2xl font-bold text-slate-950">Check-in board</h1>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600">
            Move arrived patients through the waiting room, an exam room, and the visit. Check-in still verifies
            demographics and the health card. Rooming still assigns an exam room.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 disabled:opacity-50"
        >
          {refreshing ? 'Updating…' : 'Refresh'}
        </button>
      </div>

      <section aria-label="Clinic operations">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <MetricButton
            label="Patients Waiting"
            detail="Waiting room"
            value={String(metrics.waiting)}
            pressed={statusFilter === 'waiting'}
            onClick={() => toggleStatus('waiting')}
          />
          <MetricButton
            label="Average Wait"
            detail="Arrived and waiting"
            value={formatDuration(metrics.averageWait)}
            tone={averageTone}
          />
          <MetricButton
            label="Roomed Patients"
            detail="In an exam room"
            value={String(metrics.roomed)}
            pressed={statusFilter === 'roomed'}
            onClick={() => toggleStatus('roomed')}
          />
          <MetricButton
            label="In Progress"
            detail="Visit started"
            value={String(metrics.inProgress)}
            pressed={statusFilter === 'in_progress'}
            onClick={() => toggleStatus('in_progress')}
          />
          <MetricButton
            label={completedLabel}
            detail="Finished visits"
            value={String(metrics.completed)}
            pressed={statusFilter === 'completed'}
            onClick={() => toggleStatus('completed')}
          />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          <span className="font-semibold text-emerald-800">Green</span> under {WAIT_SCALE.yellowAt} minutes,{' '}
          <span className="font-semibold text-amber-800">yellow</span> {WAIT_SCALE.yellowAt}–{WAIT_SCALE.redAt - 1}{' '}
          minutes, <span className="font-semibold text-rose-800">red</span> at {WAIT_SCALE.redAt} minutes. Current wait
          uses that scale, and roomed time uses it while the patient is still waiting in the room. Total clinic time
          turns yellow at {CLINIC_SCALE.yellowAt} minutes and red at {CLINIC_SCALE.redAt}.
        </p>
      </section>

      <div role="group" aria-labelledby="board-filters-label" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 id="board-filters-label" className="text-sm font-semibold text-slate-950">
          Filters
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="block text-sm font-medium text-slate-700" htmlFor="board-date">
            Clinic day
            <input
              id="board-date"
              type="date"
              value={date}
              onChange={(event) => onDate(event.target.value)}
              className={fieldCls}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700" htmlFor="board-provider">
            Provider
            <select
              id="board-provider"
              value={providerId}
              onChange={(event) => onProvider(event.target.value)}
              className={fieldCls}
            >
              <option value="">All providers</option>
              {providers.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700" htmlFor="board-site">
            Clinic site
            <select
              id="board-site"
              value={location}
              onChange={(event) => onLocation(event.target.value)}
              className={fieldCls}
            >
              <option value="">All sites</option>
              {CLINIC_LOCATIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700" htmlFor="board-status">
            Status
            <select
              id="board-status"
              value={statusFilter}
              onChange={(event) => onStatus(event.target.value)}
              className={fieldCls}
            >
              {STATUS_FILTERS.map((item) => (
                <option key={item.value || 'all'} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {showScheduled && (scheduled.length > 0 || statusFilter === 'booked' || statusFilter === 'confirmed') && (
        <section aria-labelledby="scheduled-queue" className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3">
            <h2 id="scheduled-queue" className="text-base font-semibold text-slate-950">
              Scheduled
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {scheduled.length === 1 ? '1 appointment' : `${scheduled.length} appointments`}. Check-in is still required before Arrived.
            </p>
          </div>
          {scheduled.length === 0 ? (
            <QueueEmpty title="No one left to check in" body="Booked and confirmed appointments for this day will show here." />
          ) : (
            <CardList rows={scheduled} className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3" card={renderCard} />
          )}
        </section>
      )}

      {columns.length > 0 && (
        <div
          className={
            columns.length > 1
              ? 'flex min-w-0 max-w-full flex-col gap-4 lg:flex-row lg:items-start lg:gap-3 lg:overflow-x-auto lg:pb-2'
              : ''
          }
        >
          {columns.map((column) => {
            const items = columnRows(rows, column.status, now);
            return (
              <section
                key={column.status}
                aria-labelledby={`queue-${column.status}`}
                className={`min-w-0 rounded-2xl bg-slate-100/90 p-3 ${
                  columns.length > 1 ? 'lg:max-h-[min(44rem,calc(100vh-12rem))] lg:w-80 lg:shrink-0 lg:overflow-y-auto' : 'lg:max-w-xl'
                }`}
              >
                <div className="mb-3 px-1">
                  <div className="flex items-center justify-between gap-2">
                    <h2 id={`queue-${column.status}`} className="text-sm font-semibold text-slate-950">
                      {column.title}
                    </h2>
                    <span
                      aria-hidden
                      className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-700 ring-1 ring-slate-200"
                    >
                      {items.length}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {items.length === 1 ? '1 patient' : `${items.length} patients`} · {column.hint}
                  </p>
                </div>
                {items.length === 0 ? (
                  <QueueEmpty title={column.emptyTitle} body={column.emptyBody} />
                ) : (
                  <CardList rows={items} className="space-y-3" card={renderCard} />
                )}
              </section>
            );
          })}
        </div>
      )}

      {showClosed && (closed.length > 0 || statusFilter === 'no_show' || statusFilter === 'cancelled') && (
        <section aria-labelledby="closed-queue" className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3">
            <h2 id="closed-queue" className="text-base font-semibold text-slate-950">
              No show and cancelled
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              These visits stay off the completed column. {closed.length === 1 ? '1 visit.' : `${closed.length} visits.`}
            </p>
          </div>
          {closed.length === 0 ? (
            <QueueEmpty title="Nothing closed this way" body="No-show and cancelled visits for this day will show here." />
          ) : (
            <CardList rows={closed} className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3" card={renderCard} />
          )}
        </section>
      )}
    </div>
  );
}
