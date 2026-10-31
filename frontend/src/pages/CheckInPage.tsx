import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  appointmentsApi,
  visitsApi,
  type AppointmentProvider,
  type VisitBoard,
  type VisitBoardRow,
} from '../api/client';
import { useAuth } from '../context/AuthContext';
import { canBookAppointments, localDateInput, patientLabel } from '../components/appointmentDisplay';
import { canManageEncounters } from '../components/encounterDisplay';
import VisitWorkbench from '../components/VisitWorkbench';
import { flowStatus } from '../components/visitDisplay';
import OperationsBoard, { BoardSkeleton } from '../components/checkin/OperationsBoard';
import { ErrorNotice } from '../components/feedback';
import {
  isStatusFilter,
  patientIds,
  uniqueRows,
  type StatusAction,
} from '../components/checkin/boardModel';
import { usePatientFlags } from '../components/checkin/usePatientFlags';

const NO_ROOMS: string[] = [];

function describeAction(row: VisitBoardRow, action: StatusAction) {
  const name = patientLabel(row.appointment.patientId);
  if (action.type === 'room') return `${name} is roomed in ${action.examRoom}.`;
  if (action.status === 'waiting' && flowStatus(row) === 'roomed') {
    return `${name} returned to the waiting room.`;
  }
  if (action.status === 'waiting') return `${name} is in the waiting room.`;
  if (action.status === 'in_progress') return `${name} is in progress.`;
  return `${name} is completed.`;
}

function scrollToVisit() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.getElementById('visit-review')?.scrollIntoView({
    behavior: reduce ? 'auto' : 'smooth',
    block: 'start',
  });
}

export default function CheckInPage() {
  const { user } = useAuth();
  const canOperate = canBookAppointments(user?.role);
  const [searchParams, setSearchParams] = useSearchParams();
  const date = searchParams.get('date') || localDateInput();
  const location = searchParams.get('location') || '';
  const providerId = searchParams.get('providerId') || '';
  const rawStatus = searchParams.get('status') || '';
  const statusFilter = isStatusFilter(rawStatus) ? rawStatus : '';
  const selectedId = searchParams.get('appointmentId') || '';
  const requestKey = `${date}|${providerId}|${location}`;

  const [providers, setProviders] = useState<AppointmentProvider[]>([]);
  const [board, setBoard] = useState<VisitBoard | null>(null);
  const [loadedKey, setLoadedKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [pendingId, setPendingId] = useState('');
  const [flagEpoch, setFlagEpoch] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const pendingScroll = useRef(false);

  const ready = Boolean(board && loadedKey === requestKey);
  const rows = ready && board ? uniqueRows(board) : [];
  const flags = usePatientFlags(patientIds(rows), flagEpoch);
  const selected = rows.find((row) => row.appointment._id === selectedId);
  const rooms = selected ? board?.examRooms[selected.appointment.clinicLocation] ?? NO_ROOMS : NO_ROOMS;

  function updateParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setSearchParams(next, { replace: true });
  }

  useEffect(() => {
    appointmentsApi
      .providers()
      .then((res) => setProviders(res.data))
      .catch(() => setProviders([]));
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const load = useCallback(async () => {
    const key = `${date}|${providerId}|${location}`;
    setLoading(true);
    try {
      const res = await visitsApi.board({
        date,
        providerId: providerId || undefined,
        location: location || undefined,
      });
      setBoard(res);
      setLoadedKey(key);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the check-in board');
    } finally {
      setLoading(false);
    }
  }, [date, providerId, location]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selected || !pendingScroll.current) return;
    pendingScroll.current = false;
    scrollToVisit();
  }, [selected]);

  function select(id: string, scroll: boolean) {
    const compact = window.matchMedia('(max-width: 1023px)').matches;
    pendingScroll.current = scroll || compact;
    if (id === selectedId) {
      if (pendingScroll.current) scrollToVisit();
      pendingScroll.current = false;
      return;
    }
    updateParams({ appointmentId: id });
  }

  async function apply(row: VisitBoardRow, action: StatusAction) {
    if (pendingId) return;
    setPendingId(row.appointment._id);
    setActionError('');
    setNotice('');
    try {
      if (action.type === 'room') {
        await visitsApi.assignRoom({ appointmentId: row.appointment._id, examRoom: action.examRoom });
      } else {
        await visitsApi.setStatus({ appointmentId: row.appointment._id, status: action.status });
      }
      setNotice(describeAction(row, action));
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not update the visit');
    } finally {
      setPendingId('');
    }
  }

  function refresh() {
    setFlagEpoch((value) => value + 1);
    void load();
  }

  return (
    <div className="space-y-4">
      {error && (
        <ErrorNotice title="The check-in board could not be loaded" message={error} onRetry={() => void load()} />
      )}
      {actionError && (
        <ErrorNotice title="The visit could not be updated" message={actionError} />
      )}
      <div role="status" aria-live="polite" className="text-sm font-medium text-teal-800">
        {notice}
      </div>

      {!ready && loading && <BoardSkeleton />}
      {!ready && !loading && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
          <p className="text-sm font-medium text-slate-800">The board did not load.</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 rounded-xl bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
          >
            Try again
          </button>
        </div>
      )}

      {ready && board && (
        <OperationsBoard
          date={date}
          location={location}
          providerId={providerId}
          statusFilter={statusFilter}
          providers={providers}
          rows={rows}
          examRooms={board.examRooms}
          selectedId={selectedId}
          now={now}
          canOperate={canOperate}
          flags={flags}
          pendingId={pendingId}
          refreshing={loading}
          onDate={(value) => updateParams({ date: value, appointmentId: null })}
          onLocation={(value) => updateParams({ location: value || null, appointmentId: null })}
          onProvider={(value) => updateParams({ providerId: value || null, appointmentId: null })}
          onStatus={(value) => updateParams({ status: value || null })}
          onSelect={(id) => select(id, false)}
          onApply={(row, action) => void apply(row, action)}
          onCheckIn={(id) => select(id, true)}
          onRefresh={refresh}
        />
      )}

      <div id="visit-review" className="scroll-mt-24">
        {selected ? (
          <VisitWorkbench
            row={selected}
            rooms={rooms}
            canOperate={canOperate}
            canLaunchEncounter={canManageEncounters(user?.role)}
            onUpdated={load}
          />
        ) : ready && selectedId ? (
          <p className="text-sm text-slate-500">That appointment is not on this board.</p>
        ) : ready ? (
          <p className="text-sm text-slate-500">
            Select a patient to verify demographics and continue the visit.
          </p>
        ) : null}
      </div>
    </div>
  );
}
