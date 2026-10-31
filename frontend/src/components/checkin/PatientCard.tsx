import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { VisitBoardRow } from '../../api/client';
import { chartLink } from '../dashboard/chartLink';
import { StatusBadge } from '../StatusBadge';
import {
  formatClock,
  patientLabel,
  providerLabel,
  typeLabel,
} from '../appointmentDisplay';
import { flowStatus } from '../visitDisplay';
import type { StatusAction } from './boardModel';
import {
  durationLabel,
  formatDuration,
  toneWord,
  visitClock,
  type WaitTone,
} from './timing';
import type { PatientFlags } from './usePatientFlags';

const TONE_CLASS: Record<WaitTone, string> = {
  green: 'bg-emerald-50 text-emerald-950 ring-emerald-200',
  yellow: 'bg-amber-50 text-amber-950 ring-amber-200',
  red: 'bg-rose-50 text-rose-950 ring-rose-200',
  none: 'bg-slate-50 text-slate-600 ring-slate-200',
};

const linkCls =
  'inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center text-xs font-medium leading-tight text-slate-700 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600';

function DurationStat({
  label,
  minutes,
  tone,
  empty,
}: {
  label: string;
  minutes: number | null;
  tone: WaitTone;
  empty: string;
}) {
  const word = toneWord(tone);
  return (
    <div
      className={`rounded-lg px-2 py-1.5 ring-1 ${TONE_CLASS[tone]}`}
      aria-label={durationLabel(label, minutes, tone, empty)}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide" aria-hidden>
        {label}
      </p>
      <p className="text-sm font-semibold tabular-nums" aria-hidden>
        {formatDuration(minutes)}
      </p>
      {word && (
        <p className="text-[10px] font-medium" aria-hidden>
          {word}
        </p>
      )}
    </div>
  );
}

function nameList(names: string[], noun: string) {
  if (names.length === 0) return noun;
  const shown = names.slice(0, 3).join(', ');
  const extra = names.length > 3 ? `, and ${names.length - 3} more` : '';
  return `${noun}: ${shown}${extra}`;
}

export default function PatientCard({
  row,
  now,
  date,
  selected,
  rooms,
  canOperate,
  flags,
  pending,
  onSelect,
  onApply,
  onCheckIn,
}: {
  row: VisitBoardRow;
  now: number;
  date: string;
  selected: boolean;
  rooms: string[];
  canOperate: boolean;
  flags?: PatientFlags;
  pending: boolean;
  onSelect: () => void;
  onApply: (action: StatusAction) => void;
  onCheckIn: () => void;
}) {
  const appointment = row.appointment;
  const patient = appointment.patientId;
  const status = flowStatus(row);
  const clock = visitClock(row, now);
  const name = patientLabel(patient);
  const nameId = useId();
  const panelId = useId();
  const hintId = useId();
  const roomFieldId = useId();
  const [open, setOpen] = useState(false);
  const [room, setRoom] = useState(rooms[0] || '');
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [status]);

  useEffect(() => {
    setRoom((current) => (rooms.includes(current) ? current : rooms[0] || ''));
  }, [rooms]);

  useEffect(() => {
    if (!open) return;
    const node = panelRef.current?.querySelector<HTMLElement>('select, button');
    node?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const terminal = status === 'completed' || status === 'no_show' || status === 'cancelled';
  const scheduled = status === 'booked' || status === 'confirmed';
  const alertBorder =
    clock.waitTone === 'red' || clock.roomedTone === 'red'
      ? 'border-rose-300'
      : clock.waitTone === 'yellow' || clock.roomedTone === 'yellow'
        ? 'border-amber-300'
        : 'border-slate-200';

  const scheduleHref = `/schedule?${new URLSearchParams({
    patientId: patient._id,
    providerId: appointment.providerId._id,
    appointmentId: appointment._id,
    date,
  }).toString()}`;

  function apply(action: StatusAction) {
    onApply(action);
  }

  return (
    <article
      aria-labelledby={nameId}
      className={`rounded-2xl border bg-white p-3 shadow-sm ${
        selected ? 'border-teal-600 ring-2 ring-teal-600' : alertBorder
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={selected}
          className="min-w-0 flex-1 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
        >
          <h3 id={nameId} className="truncate text-sm font-semibold text-slate-950" title={name}>
            {name}
          </h3>
          <p className="mt-0.5 font-mono text-xs text-slate-500">MRN {patient.mrn}</p>
        </button>
        <StatusBadge value={status} />
      </div>

      <dl className="mt-3 space-y-1 text-xs text-slate-600">
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">Appointment</dt>
          <dd className="text-right font-medium text-slate-800">
            {formatClock(appointment.startTime)}–{formatClock(appointment.endTime)}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">Visit type</dt>
          <dd className="text-right font-medium text-slate-800">{typeLabel(appointment.appointmentType)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">Provider</dt>
          <dd className="truncate text-right font-medium text-slate-800" title={providerLabel(appointment.providerId)}>
            {providerLabel(appointment.providerId)}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">Clinic</dt>
          <dd className="text-right font-medium text-slate-800">{appointment.clinicLocation}</dd>
        </div>
        {row.visit?.examRoom && (
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Room</dt>
            <dd className="text-right font-medium text-slate-800">{row.visit.examRoom}</dd>
          </div>
        )}
      </dl>

      <div className="mt-3 flex min-h-5 flex-wrap gap-1.5">
        {flags === undefined ? (
          <>
            <span className="h-5 w-16 animate-pulse rounded-full bg-slate-200 motion-reduce:animate-none" />
            <span className="sr-only">Loading clinical alerts</span>
          </>
        ) : (
          <>
            {flags.severeNames.length > 0 && (
              <span
                className="rounded-full bg-red-700 px-2 py-0.5 text-[11px] font-semibold text-white"
                title={flags.severeNames.join(', ')}
              >
                {flags.severeNames.length === 1 ? 'Severe allergy' : `Severe allergy · ${flags.severeNames.length}`}
                <span className="sr-only">. {nameList(flags.severeNames, 'Substances')}</span>
              </span>
            )}
            {flags.allergyNames.length > 0 && (
              <span
                className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-950"
                title={flags.allergyNames.join(', ')}
              >
                {flags.allergyNames.length === 1 ? 'Allergy warning' : `Allergy warning · ${flags.allergyNames.length}`}
                <span className="sr-only">. {nameList(flags.allergyNames, 'Substances')}</span>
              </span>
            )}
            {flags.criticalResults > 0 && (
              <span className="rounded-full bg-red-700 px-2 py-0.5 text-[11px] font-semibold text-white">
                {flags.criticalResults === 1 ? 'Critical result' : `Critical result · ${flags.criticalResults}`}
              </span>
            )}
            {flags.abnormalResults > 0 && (
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-950">
                {flags.abnormalResults === 1 ? 'Abnormal result' : `Abnormal result · ${flags.abnormalResults}`}
              </span>
            )}
            {flags.highAlertNames.length > 0 && (
              <span
                className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-950"
                title={flags.highAlertNames.join(', ')}
              >
                {flags.highAlertNames.length === 1
                  ? 'High-alert medication'
                  : `High-alert medication · ${flags.highAlertNames.length}`}
                <span className="sr-only">. {nameList(flags.highAlertNames, 'Medications')}</span>
              </span>
            )}
            {flags.overdueRecalls > 0 && (
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-950">
                {flags.overdueRecalls === 1 ? 'Overdue recall' : `Overdue recall · ${flags.overdueRecalls}`}
              </span>
            )}
            {flags.incomplete && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                Alerts incomplete
              </span>
            )}
            {!flags.incomplete &&
              flags.allergyNames.length === 0 &&
              flags.severeNames.length === 0 &&
              flags.highAlertNames.length === 0 &&
              flags.criticalResults === 0 &&
              flags.abnormalResults === 0 &&
              flags.overdueRecalls === 0 && (
                <span className="sr-only">No allergy, critical result, high-alert medication, or overdue recall on file.</span>
              )}
          </>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-1.5">
        <DurationStat label="Current wait" minutes={clock.waitMinutes} tone={clock.waitTone} empty="not started" />
        <DurationStat label="Roomed" minutes={clock.roomedMinutes} tone={clock.roomedTone} empty="not roomed" />
        <DurationStat label="Clinic time" minutes={clock.clinicMinutes} tone={clock.clinicTone} empty="not started" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1.5" role="group" aria-label={`Actions for ${name}`}>
        <Link to={chartLink(patient._id)} className={linkCls}>
          Open chart
        </Link>
        <Link to={chartLink(patient._id, 'encounters')} className={linkCls}>
          Open encounter
        </Link>
        <Link to={scheduleHref} className={linkCls}>
          Open appointment
        </Link>
        {terminal || !canOperate ? (
          <button
            type="button"
            className={`${linkCls} disabled:cursor-not-allowed disabled:opacity-50`}
            disabled
            aria-describedby={hintId}
            title={terminal ? 'No further status change' : 'Available to clinicians, nurses, and administrators'}
          >
            Change status
          </button>
        ) : (
          <button
            ref={toggleRef}
            type="button"
            className={`${linkCls} border-teal-700 bg-teal-700 text-white hover:border-teal-800 hover:bg-teal-800 hover:text-white`}
            aria-expanded={open}
            aria-controls={panelId}
            disabled={pending}
            onClick={() => setOpen((current) => !current)}
          >
            {pending ? 'Updating…' : 'Change status'}
          </button>
        )}
      </div>
      <p id={hintId} className="sr-only">
        {terminal
          ? 'This visit has no further status change.'
          : !canOperate
            ? 'Status changes are available to clinicians, nurses, and administrators.'
            : ''}
      </p>

      {open && canOperate && (
        <div id={panelId} ref={panelRef} className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
          {scheduled && (
            <div className="space-y-2">
              <p className="text-xs leading-relaxed text-slate-600">
                Check-in reviews demographics and the health card, then marks the patient arrived.
              </p>
              <button
                type="button"
                className={`${linkCls} w-full bg-white`}
                onClick={() => {
                  setOpen(false);
                  onCheckIn();
                }}
              >
                Check in
              </button>
            </div>
          )}

          {status === 'arrived' && (
            <button
              type="button"
              className={`${linkCls} w-full bg-white`}
              disabled={pending}
              onClick={() => apply({ type: 'status', status: 'waiting' })}
            >
              Send to waiting room
            </button>
          )}

          {status === 'waiting' && (
            <form
              className="space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (room) apply({ type: 'room', examRoom: room });
              }}
            >
              <label className="block text-xs font-medium text-slate-700" htmlFor={roomFieldId}>
                Exam room
              </label>
              {rooms.length === 0 ? (
                <p className="text-xs text-amber-900">No exam rooms are configured for this clinic.</p>
              ) : (
                <select
                  id={roomFieldId}
                  value={room}
                  onChange={(event) => setRoom(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm"
                >
                  {rooms.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              )}
              <button type="submit" className={`${linkCls} w-full bg-white`} disabled={pending || !room}>
                Assign room
              </button>
            </form>
          )}

          {status === 'roomed' && (
            <div className="space-y-1.5">
              <button
                type="button"
                className={`${linkCls} w-full bg-white`}
                disabled={pending}
                onClick={() => apply({ type: 'status', status: 'in_progress' })}
              >
                Start visit
              </button>
              <button
                type="button"
                className={`${linkCls} w-full bg-white`}
                disabled={pending}
                onClick={() => apply({ type: 'status', status: 'waiting' })}
              >
                Return to waiting room
              </button>
            </div>
          )}

          {status === 'in_progress' && (
            <button
              type="button"
              className={`${linkCls} w-full bg-white`}
              disabled={pending}
              onClick={() => apply({ type: 'status', status: 'completed' })}
            >
              Complete visit
            </button>
          )}
        </div>
      )}
    </article>
  );
}
