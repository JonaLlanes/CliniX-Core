import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  appointmentsApi,
  patientsApi,
  type Appointment,
  type AppointmentProvider,
  type AppointmentStatus,
  type Patient,
} from '../api/client';
import { useAuth } from '../context/AuthContext';
import { StatusBadge, statusLabel } from '../components/StatusBadge';
import { ErrorNotice, RowSkeleton } from '../components/feedback';
import {
  APPOINTMENT_TYPES,
  CLINIC_LOCATIONS,
  STATUS_BLOCK,
  canBookAppointments,
  formatAppointmentWhen,
  formatClock,
  localDateInput,
  patientLabel,
  providerLabel,
  refId,
  shiftDate,
  toDateTimeInput,
  typeLabel,
} from '../components/appointmentDisplay';

const START_HOUR = 7;
const END_HOUR = 19;
const PX_PER_MIN = 1.15;
const DAY_MINUTES = (END_HOUR - START_HOUR) * 60;
const GRID_HEIGHT = DAY_MINUTES * PX_PER_MIN;

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm';
const labelCls = 'block text-xs font-medium text-gray-600 mb-1';
const btnPrimary =
  'px-4 py-2 bg-clinical-teal text-white rounded-lg text-sm hover:bg-clinical-teal-dark disabled:opacity-50';
const btnGhost = 'px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50';

const STATUS_ACTIONS: Record<string, { status: AppointmentStatus; label: string }[]> = {
  booked: [{ status: 'confirmed', label: 'Confirm' }],
  confirmed: [
    { status: 'no_show', label: 'No show' },
    { status: 'booked', label: 'Back to booked' },
  ],
  arrived: [
    { status: 'completed', label: 'Complete' },
    { status: 'no_show', label: 'No show' },
  ],
};

function minutesOfDay(value: string) {
  const date = new Date(value);
  return date.getHours() * 60 + date.getMinutes();
}

function defaultSlot(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  const now = new Date();
  let start = new Date(year, month - 1, day, 9, 0, 0, 0);
  if (date === localDateInput(now)) {
    const rounded = new Date(now);
    rounded.setSeconds(0, 0);
    const remainder = rounded.getMinutes() % 30;
    rounded.setMinutes(rounded.getMinutes() + (remainder === 0 ? 30 : 30 - remainder));
    const withinClinic =
      localDateInput(rounded) === date &&
      rounded.getHours() >= START_HOUR &&
      rounded.getHours() < END_HOUR;
    if (withinClinic) start = rounded;
  }
  return {
    start: toDateTimeInput(start),
    end: toDateTimeInput(new Date(start.getTime() + 30 * 60 * 1000)),
  };
}

function layoutAppointments(items: Appointment[]) {
  const visible = items
    .filter((item) => {
      const start = minutesOfDay(item.startTime);
      const end = minutesOfDay(item.endTime);
      return end > START_HOUR * 60 && start < END_HOUR * 60;
    })
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const clusters: Appointment[][] = [];
  let cluster: Appointment[] = [];
  let clusterEnd = 0;
  for (const item of visible) {
    const start = new Date(item.startTime).getTime();
    const end = new Date(item.endTime).getTime();
    if (cluster.length === 0 || start < clusterEnd) {
      cluster.push(item);
      clusterEnd = Math.max(clusterEnd, end);
    } else {
      clusters.push(cluster);
      cluster = [item];
      clusterEnd = end;
    }
  }
  if (cluster.length) clusters.push(cluster);

  const placed: { item: Appointment; col: number; cols: number }[] = [];
  for (const group of clusters) {
    const columnEnds: number[] = [];
    const local: { item: Appointment; col: number }[] = [];
    for (const item of group) {
      const start = new Date(item.startTime).getTime();
      const end = new Date(item.endTime).getTime();
      let col = columnEnds.findIndex((until) => until <= start);
      if (col === -1) {
        col = columnEnds.length;
        columnEnds.push(end);
      } else {
        columnEnds[col] = end;
      }
      local.push({ item, col });
    }
    for (const entry of local) placed.push({ ...entry, cols: columnEnds.length });
  }
  return placed;
}

export default function SchedulePage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const canBook = canBookAppointments(user?.role);
  const [providers, setProviders] = useState<AppointmentProvider[]>([]);
  const [providerId, setProviderId] = useState(searchParams.get('providerId') || '');
  const [date, setDate] = useState(searchParams.get('date') || localDateInput());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedId, setSelectedId] = useState(searchParams.get('appointmentId') || '');
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState('');
  const [showBook, setShowBook] = useState(Boolean(searchParams.get('patientId')) && canBook);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const initialSlot = defaultSlot(searchParams.get('date') || localDateInput());
  const [patientQuery, setPatientQuery] = useState('');
  const [patientHits, setPatientHits] = useState<Patient[]>([]);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [location, setLocation] = useState<(typeof CLINIC_LOCATIONS)[number]>('Toronto Main');
  const [appointmentType, setAppointmentType] = useState('follow_up');
  const [startInput, setStartInput] = useState(initialSlot.start);
  const [endInput, setEndInput] = useState(initialSlot.end);
  const [bookStatus, setBookStatus] = useState<'booked' | 'confirmed'>('booked');

  const [rescheduleStart, setRescheduleStart] = useState('');
  const [rescheduleEnd, setRescheduleEnd] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [history, setHistory] = useState<Appointment[]>([]);

  const selected = appointments.find((item) => item._id === selectedId) || null;
  const focusPatientId = patient?._id || (selected ? refId(selected.patientId) : '');

  useEffect(() => {
    appointmentsApi
      .providers()
      .then((res) => {
        setProviders(res.data);
        setProviderId((current) => {
          if (current && res.data.some((item) => item._id === current)) return current;
          const mine = res.data.find((item) => item._id === user?.id);
          return mine?._id || res.data.find((item) => item.role === 'clinician')?._id || res.data[0]?._id || '';
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load providers'));
  }, [user?.id]);

  useEffect(() => {
    const patientId = searchParams.get('patientId');
    if (!patientId) return;
    patientsApi
      .get(patientId)
      .then((found) => {
        setPatient(found);
        setPatientQuery(`${found.familyName}, ${found.givenName}`);
      })
      .catch(() => setPatient(null));
  }, [searchParams]);

  useEffect(() => {
    if (!providerId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    let active = true;
    setLoading(true);
    appointmentsApi
      .day(providerId, date)
      .then((res) => {
        if (!active) return;
        setAppointments(res.data);
        setError('');
        setSelectedId((current) => {
          if (current && res.data.some((item) => item._id === current)) return current;
          const requested = searchParams.get('appointmentId');
          if (requested && res.data.some((item) => item._id === requested)) return requested;
          return '';
        });
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load the day');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [providerId, date, searchParams, reloadKey]);

  useEffect(() => {
    if (!selected) return;
    setRescheduleStart(toDateTimeInput(selected.startTime));
    setRescheduleEnd(toDateTimeInput(selected.endTime));
    setCancelReason('');
    setShowBook(false);
  }, [selected]);

  useEffect(() => {
    if (!focusPatientId) {
      setHistory([]);
      return;
    }
    let active = true;
    appointmentsApi
      .history(focusPatientId)
      .then((res) => {
        if (active) setHistory(res.data);
      })
      .catch(() => {
        if (active) setHistory([]);
      });
    return () => {
      active = false;
    };
  }, [focusPatientId, appointments]);

  useEffect(() => {
    const q = patientQuery.trim();
    if (q.length < 2 || (patient && q === `${patient.familyName}, ${patient.givenName}`)) {
      setPatientHits([]);
      return;
    }
    const timer = setTimeout(() => {
      patientsApi
        .list({ q, limit: 8 })
        .then((res) => setPatientHits(res.data))
        .catch(() => setPatientHits([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [patientQuery, patient]);

  const placed = useMemo(() => layoutAppointments(appointments), [appointments]);
  const outside = appointments.filter((item) => {
    const start = minutesOfDay(item.startTime);
    const end = minutesOfDay(item.endTime);
    return end <= START_HOUR * 60 || start >= END_HOUR * 60;
  });

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes() - START_HOUR * 60;
  const showNow = date === localDateInput(now) && nowMinutes >= 0 && nowMinutes <= DAY_MINUTES;

  function openBook(start?: Date) {
    const slot = start
      ? { start: toDateTimeInput(start), end: toDateTimeInput(new Date(start.getTime() + 30 * 60 * 1000)) }
      : defaultSlot(date);
    setStartInput(slot.start);
    setEndInput(slot.end);
    setFormError('');
    setSelectedId('');
    setShowBook(true);
  }

  function onGridClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!canBook) return;
    if ((event.target as HTMLElement).closest('[data-appointment]')) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const y = event.clientY - rect.top;
    let minutes = Math.round(y / PX_PER_MIN / 15) * 15;
    minutes = Math.max(0, Math.min(DAY_MINUTES - 15, minutes));
    const [year, month, day] = date.split('-').map(Number);
    const start = new Date(year, month - 1, day, START_HOUR, 0, 0, 0);
    start.setMinutes(start.getMinutes() + minutes);
    openBook(start);
  }

  async function reloadDay() {
    const res = await appointmentsApi.day(providerId, date);
    setAppointments(res.data);
    return res.data;
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!patient) {
      setFormError('Choose a patient');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const created = await appointmentsApi.create({
        patientId: patient._id,
        providerId,
        clinicLocation: location,
        appointmentType,
        startTime: new Date(startInput).toISOString(),
        endTime: new Date(endInput).toISOString(),
        status: bookStatus,
      });
      const createdDay = localDateInput(new Date(created.startTime));
      if (createdDay !== date || refId(created.providerId) !== providerId) {
        setDate(createdDay);
        setProviderId(refId(created.providerId));
      } else {
        await reloadDay();
      }
      setSelectedId(created._id);
      setShowBook(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not book the appointment');
    } finally {
      setSaving(false);
    }
  }

  async function onStatus(status: AppointmentStatus) {
    if (!selected) return;
    setSaving(true);
    setFormError('');
    try {
      await appointmentsApi.update(selected._id, { status });
      await reloadDay();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not update status');
    } finally {
      setSaving(false);
    }
  }

  async function onReschedule(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setFormError('');
    try {
      const updated = await appointmentsApi.reschedule(selected._id, {
        startTime: new Date(rescheduleStart).toISOString(),
        endTime: new Date(rescheduleEnd).toISOString(),
      });
      const nextDay = localDateInput(new Date(updated.startTime));
      if (nextDay !== date) setDate(nextDay);
      else await reloadDay();
      setSelectedId(updated._id);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not reschedule');
    } finally {
      setSaving(false);
    }
  }

  async function onCancel(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setFormError('');
    try {
      await appointmentsApi.cancel(selected._id, cancelReason.trim());
      await reloadDay();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not cancel');
    } finally {
      setSaving(false);
    }
  }

  const providerName = providers.find((item) => item._id === providerId)?.displayName || 'Provider';
  const headingDate = new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Schedule</h1>
          <p className="text-gray-600 mt-1">
            {providerName} · {headingDate}
          </p>
        </div>
        {canBook && (
          <button type="button" onClick={() => openBook()} className={btnPrimary}>
            Book appointment
          </button>
        )}
      </header>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select
          aria-label="Provider"
          value={providerId}
          onChange={(event) => setProviderId(event.target.value)}
          className={`${inputCls} max-w-xs`}
        >
          {providers.map((item) => (
            <option key={item._id} value={item._id}>
              {item.displayName}
            </option>
          ))}
        </select>
        <button type="button" className={btnGhost} onClick={() => setDate((value) => shiftDate(value, -1))}>
          Previous
        </button>
        <input
          type="date"
          aria-label="Schedule date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className={`${inputCls} max-w-[11rem]`}
        />
        <button type="button" className={btnGhost} onClick={() => setDate(localDateInput())}>
          Today
        </button>
        <button type="button" className={btnGhost} onClick={() => setDate((value) => shiftDate(value, 1))}>
          Next
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 text-xs text-gray-600">
        {Object.entries(STATUS_BLOCK).map(([status, color]) => (
          <span key={status} className={`inline-flex items-center gap-1 px-2 py-1 rounded border ${color}`}>
            <StatusBadge value={status} />
          </span>
        ))}
      </div>

      {error && (
        <div className="mb-4">
          <ErrorNotice
            title="The schedule could not be loaded"
            message={error}
            onRetry={() => setReloadKey((value) => value + 1)}
          />
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_22rem] gap-6 items-start">
        <section className="bg-white rounded-lg border border-gray-200 p-4 overflow-hidden">
          <p className="text-xs text-gray-500 mb-3">
            Clinic day, 7:00 AM–7:00 PM. Click an open time to book. Cancelled and no-show visits stay on the day and do not block the slot.
          </p>
          {loading ? (
            <RowSkeleton rows={8} label="Loading the clinic day" />
          ) : (
            <div className="overflow-auto max-h-[70vh]">
              <div className="flex min-w-[36rem]">
                <div className="w-16 shrink-0 relative" style={{ height: GRID_HEIGHT }}>
                  {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => (
                    <div
                      key={index}
                      className="absolute right-2 text-[11px] text-slate-600 -translate-y-1/2"
                      style={{ top: index * 60 * PX_PER_MIN }}
                    >
                      {new Date(2000, 0, 1, START_HOUR + index).toLocaleTimeString(undefined, {
                        hour: 'numeric',
                      })}
                    </div>
                  ))}
                </div>
                <div
                  className="relative flex-1 border-l border-gray-200"
                  style={{ height: GRID_HEIGHT }}
                  onClick={onGridClick}
                >
                  {Array.from({ length: END_HOUR - START_HOUR }, (_, index) => (
                    <div
                      key={index}
                      className="absolute left-0 right-0 border-t border-gray-100"
                      style={{ top: index * 60 * PX_PER_MIN }}
                    />
                  ))}
                  {showNow && (
                    <div
                      className="absolute left-0 right-0 border-t-2 border-red-700 z-10 pointer-events-none"
                      style={{ top: nowMinutes * PX_PER_MIN }}
                    >
                      <span className="sr-only">Current time</span>
                    </div>
                  )}
                  {placed.map(({ item, col, cols }) => {
                    const start = Math.max(minutesOfDay(item.startTime), START_HOUR * 60);
                    const end = Math.min(minutesOfDay(item.endTime), END_HOUR * 60);
                    const top = (start - START_HOUR * 60) * PX_PER_MIN;
                    const height = Math.max(28, (end - start) * PX_PER_MIN - 2);
                    return (
                      <button
                        key={item._id}
                        type="button"
                        data-appointment
                        aria-pressed={selectedId === item._id}
                        aria-label={`${formatClock(item.startTime)} ${patientLabel(item.patientId)}, ${statusLabel(item.status)}, ${typeLabel(item.appointmentType)}`}
                        onClick={() => {
                          setSelectedId(item._id);
                          setShowBook(false);
                          setFormError('');
                        }}
                        className={`absolute rounded-md border px-2 py-1 text-left overflow-hidden shadow-sm ${
                          STATUS_BLOCK[item.status] || 'bg-white border-gray-300'
                        } ${selectedId === item._id ? 'ring-2 ring-clinical-teal z-20' : 'z-0'}`}
                        style={{
                          top,
                          height,
                          left: `calc(${(col * 100) / cols}% + 4px)`,
                          width: `calc(${100 / cols}% - 8px)`,
                        }}
                      >
                        <div className={`font-medium truncate ${item.status === 'cancelled' ? 'line-through' : ''}`}>
                          {formatClock(item.startTime)} {patientLabel(item.patientId)}
                        </div>
                        <div className="truncate">
                          {statusLabel(item.status)} · {typeLabel(item.appointmentType)} · {item.clinicLocation}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          {outside.length > 0 && (
            <div className="mt-4 border-t border-gray-100 pt-3">
              <h2 className="text-xs font-medium text-gray-500 mb-2">Outside 7:00 AM–7:00 PM</h2>
              <ul className="space-y-1">
                {outside.map((item) => (
                  <li key={item._id}>
                    <button
                      type="button"
                      className="text-sm text-clinical-teal hover:underline"
                      onClick={() => setSelectedId(item._id)}
                    >
                      {formatClock(item.startTime)}–{formatClock(item.endTime)} · {patientLabel(item.patientId)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!loading && appointments.length === 0 && (
            <p className="text-sm text-slate-600 text-center py-4">No appointments on this day. Book a visit, or choose another date.</p>
          )}
        </section>

        <aside className="space-y-4">
          {formError && (
            <div role="alert" className="bg-red-50 border border-red-200 text-red-900 px-4 py-3 rounded-lg text-sm">
              {formError}
            </div>
          )}

          {showBook && canBook && (
            <form onSubmit={onCreate} className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
              <h2 className="font-semibold text-gray-900">Book appointment</h2>
              <div>
                <label className={labelCls} htmlFor="patient-search">
                  Patient
                </label>
                <input
                  id="patient-search"
                  value={patientQuery}
                  onChange={(event) => {
                    setPatientQuery(event.target.value);
                    setPatient(null);
                  }}
                  placeholder="Search MRN or name"
                  className={inputCls}
                />
                {patientHits.length > 0 && (
                  <ul className="mt-1 border border-gray-200 rounded-lg bg-white shadow-sm max-h-48 overflow-auto">
                    {patientHits.map((hit) => (
                      <li key={hit._id}>
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-teal-50"
                          onClick={() => {
                            setPatient(hit);
                            setPatientQuery(`${hit.familyName}, ${hit.givenName}`);
                            setPatientHits([]);
                          }}
                        >
                          {hit.familyName}, {hit.givenName}
                          <span className="text-gray-500"> · {hit.mrn}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <label className={labelCls} htmlFor="book-location">
                  Clinic location
                </label>
                <select
                  id="book-location"
                  value={location}
                  onChange={(event) => setLocation(event.target.value as (typeof CLINIC_LOCATIONS)[number])}
                  className={inputCls}
                >
                  {CLINIC_LOCATIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls} htmlFor="book-type">
                  Appointment type
                </label>
                <select
                  id="book-type"
                  value={appointmentType}
                  onChange={(event) => setAppointmentType(event.target.value)}
                  className={inputCls}
                >
                  {APPOINTMENT_TYPES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls} htmlFor="book-start">
                    Start
                  </label>
                  <input
                    id="book-start"
                    type="datetime-local"
                    required
                    value={startInput}
                    onChange={(event) => setStartInput(event.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls} htmlFor="book-end">
                    End
                  </label>
                  <input
                    id="book-end"
                    type="datetime-local"
                    required
                    value={endInput}
                    onChange={(event) => setEndInput(event.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls} htmlFor="book-status">
                  Status
                </label>
                <select
                  id="book-status"
                  value={bookStatus}
                  onChange={(event) => setBookStatus(event.target.value as 'booked' | 'confirmed')}
                  className={inputCls}
                >
                  <option value="booked">Booked</option>
                  <option value="confirmed">Confirmed</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button type="submit" className={btnPrimary} disabled={saving || !providerId}>
                  {saving ? 'Saving...' : 'Create'}
                </button>
                <button type="button" className={btnGhost} onClick={() => setShowBook(false)}>
                  Close
                </button>
              </div>
            </form>
          )}

          {selected && (
            <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-gray-900">{patientLabel(selected.patientId)}</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {formatAppointmentWhen(selected.startTime, selected.endTime)}
                  </p>
                  <p className="text-sm text-gray-600">
                    {typeLabel(selected.appointmentType)} · {selected.clinicLocation}
                  </p>
                  <p className="text-sm text-gray-600">{providerLabel(selected.providerId)}</p>
                </div>
                <StatusBadge value={selected.status} />
              </div>
              <Link
                to={`/patients/${refId(selected.patientId)}`}
                className="text-sm text-clinical-teal hover:underline"
              >
                Open chart
              </Link>
              {selected.cancelReason && (
                <p className="text-sm text-gray-600">Reason: {selected.cancelReason}</p>
              )}

              {canBook && (STATUS_ACTIONS[selected.status] || []).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {['booked', 'confirmed', 'arrived'].includes(selected.status) && (
                    <Link
                      to={`/check-in?date=${date}&appointmentId=${selected._id}`}
                      className={`${btnGhost} inline-flex items-center`}
                    >
                      {selected.status === 'arrived' ? 'Open check-in' : 'Check in'}
                    </Link>
                  )}
                  {STATUS_ACTIONS[selected.status].map((action) => (
                    <button
                      key={action.status}
                      type="button"
                      className={btnGhost}
                      disabled={saving}
                      onClick={() => onStatus(action.status)}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}

              {canBook && ['booked', 'confirmed', 'no_show'].includes(selected.status) && (
                <form onSubmit={onReschedule} className="space-y-3 border-t border-gray-100 pt-3">
                  <h3 className="text-sm font-medium text-gray-900">Reschedule</h3>
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className={labelCls} htmlFor="reschedule-start">
                        Start
                      </label>
                      <input
                        id="reschedule-start"
                        type="datetime-local"
                        required
                        value={rescheduleStart}
                        onChange={(event) => setRescheduleStart(event.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls} htmlFor="reschedule-end">
                        End
                      </label>
                      <input
                        id="reschedule-end"
                        type="datetime-local"
                        required
                        value={rescheduleEnd}
                        onChange={(event) => setRescheduleEnd(event.target.value)}
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <button type="submit" className={btnPrimary} disabled={saving}>
                    Save new time
                  </button>
                </form>
              )}

              {canBook && ['booked', 'confirmed', 'arrived'].includes(selected.status) && (
                <form onSubmit={onCancel} className="space-y-3 border-t border-gray-100 pt-3">
                  <h3 className="text-sm font-medium text-gray-900">Cancel</h3>
                  <div>
                    <label className={labelCls} htmlFor="cancel-reason">
                      Reason (optional)
                    </label>
                    <input
                      id="cancel-reason"
                      value={cancelReason}
                      onChange={(event) => setCancelReason(event.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-3 py-2 border border-red-200 text-red-700 rounded-lg text-sm hover:bg-red-50 disabled:opacity-50"
                  >
                    Cancel appointment
                  </button>
                </form>
              )}
            </div>
          )}

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="font-semibold text-gray-900 mb-1">Patient history</h2>
            <p className="text-xs text-gray-500 mb-3">
              {focusPatientId ? 'Newest visits for the selected patient' : 'Select a patient or appointment'}
            </p>
            {history.length === 0 ? (
              <p className="text-sm text-gray-500">
                {focusPatientId ? 'No appointments on this chart.' : 'Select a patient to see appointment history.'}
              </p>
            ) : (
              <ul className="space-y-2 max-h-72 overflow-auto">
                {history.map((item) => (
                  <li key={item._id} className="text-sm">
                    <button
                      type="button"
                      className="text-left w-full hover:bg-gray-50 rounded px-1 py-1"
                      onClick={() => {
                        setProviderId(refId(item.providerId));
                        setDate(localDateInput(new Date(item.startTime)));
                        setSelectedId(item._id);
                        setShowBook(false);
                      }}
                    >
                      <span className="text-gray-800">{formatAppointmentWhen(item.startTime, item.endTime)}</span>
                      <span className="block text-xs text-gray-500">
                        {typeLabel(item.appointmentType)} · {providerLabel(item.providerId)} · {item.status.replace('_', ' ')}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
