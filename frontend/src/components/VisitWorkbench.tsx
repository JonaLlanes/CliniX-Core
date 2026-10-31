import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { visitsApi, type VisitBoardRow, type VisitStatus } from '../api/client';
import { StatusBadge } from './StatusBadge';
import { formatAddress } from './canadianRegistration';
import {
  formatAppointmentWhen,
  formatClock,
  patientLabel,
  providerLabel,
  typeLabel,
} from './appointmentDisplay';
import {
  flowStatus,
  formatDob,
  healthCardLabel,
} from './visitDisplay';
import { EncounterVisitSection } from './EncounterPanels';

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm';
const labelCls = 'block text-xs font-medium text-gray-600 mb-1';
const btnPrimary =
  'px-4 py-2 bg-clinical-teal text-white rounded-lg text-sm hover:bg-clinical-teal-dark disabled:opacity-50';
const btnGhost = 'px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50';

const LANGUAGE: Record<string, string> = {
  en: 'English',
  fr: 'French',
  other: 'Other',
};

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm text-gray-900">{value || '—'}</div>
    </div>
  );
}

export default function VisitWorkbench({
  row,
  rooms,
  canOperate,
  canLaunchEncounter,
  onUpdated,
}: {
  row: VisitBoardRow;
  rooms: string[];
  canOperate: boolean;
  canLaunchEncounter: boolean;
  onUpdated: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const appointment = row.appointment;
  const patient = appointment.patientId;
  const visit = row.visit;
  const status = flowStatus(row);
  const card = healthCardLabel(patient);
  const address = formatAddress(patient.address) || patient.contact?.address || '';

  const [demographicsChecked, setDemographicsChecked] = useState(false);
  const [healthCardChecked, setHealthCardChecked] = useState(false);
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [room, setRoom] = useState(visit?.examRoom || rooms[0] || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDemographicsChecked(false);
    setHealthCardChecked(false);
    setNote('');
    setReason('');
    setRoom(visit?.examRoom || rooms[0] || '');
    setError('');
  }, [appointment._id, visit?.status, visit?.examRoom, rooms]);

  const needsCheckIn =
    status === 'booked' ||
    status === 'confirmed' ||
    (status === 'arrived' && (!visit || !visit.demographicsVerified || !visit.healthCardVerified));
  const roomable =
    !!visit &&
    !needsCheckIn &&
    ['arrived', 'waiting', 'roomed', 'in_progress'].includes(status);
  const canNoShow = status === 'confirmed' || status === 'arrived' || status === 'waiting';
  const canCancel = ['booked', 'confirmed', 'arrived', 'waiting', 'roomed', 'in_progress'].includes(status);

  async function run(action: () => Promise<void>) {
    setSaving(true);
    setError('');
    try {
      await action();
      await onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setSaving(false);
    }
  }

  function onCheckIn(event: FormEvent) {
    event.preventDefault();
    void run(() =>
      visitsApi.checkIn({
        appointmentId: appointment._id,
        demographicsVerified: true,
        healthCardVerified: true,
        note: note.trim() || undefined,
      }).then(() => undefined)
    );
  }

  function changeStatus(next: VisitStatus) {
    void run(() =>
      visitsApi
        .setStatus({
          appointmentId: appointment._id,
          status: next,
          reason: reason.trim() || undefined,
          note: note.trim() || undefined,
        })
        .then(() => undefined)
    );
  }

  function onAssignRoom(event: FormEvent) {
    event.preventDefault();
    void run(() =>
      visitsApi.assignRoom({ appointmentId: appointment._id, examRoom: room }).then(() => undefined)
    );
  }

  async function startVisit() {
    setSaving(true);
    setError('');
    try {
      await visitsApi.setStatus({ appointmentId: appointment._id, status: 'in_progress' });
      navigate(`/patients/${patient._id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the visit');
      setSaving(false);
    }
  }

  return (
    <section id="visit-detail" className="bg-white rounded-lg border border-gray-200 p-5 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{patientLabel(patient)}</h2>
          <p className="text-sm text-gray-600 mt-1">
            {patient.mrn} · {formatAppointmentWhen(appointment.startTime, appointment.endTime)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge value={status} />
          <Link to={`/patients/${patient._id}`} className="text-sm text-clinical-teal hover:underline">
            Open chart
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-lg border border-gray-200 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">Appointment</h3>
          <Field label="When" value={`${formatClock(appointment.startTime)}–${formatClock(appointment.endTime)}`} />
          <Field label="Type" value={typeLabel(appointment.appointmentType)} />
          <Field label="Location" value={appointment.clinicLocation} />
          <Field label="Provider" value={providerLabel(appointment.providerId)} />
          <div>
            <div className="text-xs text-gray-500 mb-1">Appointment status</div>
            <StatusBadge value={appointment.status} />
          </div>
          {visit?.examRoom && <Field label="Exam room" value={visit.examRoom} />}
          {visit?.arrivalAt && <Field label="Arrived" value={formatClock(visit.arrivalAt)} />}
          {appointment.cancelReason && <Field label="Cancel reason" value={appointment.cancelReason} />}
          {visit?.cancelReason && visit.cancelReason !== appointment.cancelReason && (
            <Field label="Visit cancel reason" value={visit.cancelReason} />
          )}
        </div>

        <div className="rounded-lg border border-gray-200 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">Demographics</h3>
          <Field label="Legal name" value={`${patient.givenName} ${patient.familyName}`} />
          <Field
            label="Preferred name"
            value={patient.preferredName && patient.preferredName !== patient.givenName ? patient.preferredName : '—'}
          />
          <Field label="Date of birth" value={formatDob(patient.birthDate)} />
          <Field label="Sex at birth" value={patient.sex} />
          <Field label="Gender identity" value={patient.genderIdentity} />
          <Field label="Language" value={LANGUAGE[patient.language || ''] || patient.language} />
          <Field label="Phone" value={patient.contact?.phone} />
          <Field label="Email" value={patient.contact?.email} />
          <Field label="Address" value={address} />
        </div>

        <div className="rounded-lg border border-gray-200 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">Health card</h3>
          {card ? (
            <p className="font-mono text-sm text-gray-900">{card}</p>
          ) : (
            <p className="text-sm text-amber-800">No health card on file. Review this with the patient before check-in.</p>
          )}
          {visit?.demographicsVerified && visit.healthCardVerified && (
            <p className="text-sm text-green-800">Demographics and health card were reviewed at check-in.</p>
          )}
        </div>
      </div>

      {canOperate && needsCheckIn && (
        <form onSubmit={onCheckIn} className="border-t border-gray-100 pt-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">Check in</h3>
          <label className="flex items-start gap-2 text-sm text-gray-800">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={demographicsChecked}
              onChange={(event) => setDemographicsChecked(event.target.checked)}
            />
            Demographics verified with the patient
          </label>
          <label className="flex items-start gap-2 text-sm text-gray-800">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={healthCardChecked}
              onChange={(event) => setHealthCardChecked(event.target.checked)}
            />
            Health card information reviewed
          </label>
          <div>
            <label className={labelCls} htmlFor="check-in-note">
              Note (optional)
            </label>
            <input
              id="check-in-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className={inputCls}
            />
          </div>
          <button
            type="submit"
            className={btnPrimary}
            disabled={saving || !demographicsChecked || !healthCardChecked}
          >
            {saving ? 'Checking in...' : 'Check in'}
          </button>
        </form>
      )}

      {canOperate && !needsCheckIn && (status === 'arrived' || status === 'roomed') && (
        <div className="border-t border-gray-100 pt-4 flex flex-wrap gap-2">
          {status === 'arrived' && (
            <button type="button" className={btnPrimary} disabled={saving} onClick={() => changeStatus('waiting')}>
              Send to waiting room
            </button>
          )}
          {status === 'roomed' && (
            <button type="button" className={btnGhost} disabled={saving} onClick={() => changeStatus('waiting')}>
              Return to waiting room
            </button>
          )}
        </div>
      )}

      {canOperate && roomable && (
        <form onSubmit={onAssignRoom} className="border-t border-gray-100 pt-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">
            {visit?.examRoom ? 'Reassign room' : 'Assign exam room'}
          </h3>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="min-w-48">
              <label className={labelCls} htmlFor="exam-room">
                Exam room
              </label>
              <select
                id="exam-room"
                value={room}
                onChange={(event) => setRoom(event.target.value)}
                className={inputCls}
              >
                {rooms.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className={btnPrimary} disabled={saving || !room || room === visit?.examRoom}>
              {visit?.examRoom ? 'Reassign' : 'Assign room'}
            </button>
          </div>
        </form>
      )}

      {canOperate && (status === 'roomed' || status === 'in_progress') && (
        <div className="border-t border-gray-100 pt-4 flex flex-wrap gap-2">
          {status === 'roomed' && (
            <button type="button" className={btnPrimary} disabled={saving} onClick={() => void startVisit()}>
              Start visit
            </button>
          )}
          {status === 'in_progress' && (
            <>
              <button type="button" className={btnPrimary} disabled={saving} onClick={() => changeStatus('completed')}>
                Complete visit
              </button>
              <Link
                to={`/patients/${patient._id}`}
                className={`${btnGhost} inline-flex items-center`}
              >
                Open chart
              </Link>
            </>
          )}
        </div>
      )}

      {visit ? (
        <EncounterVisitSection
          patientId={patient._id}
          visitId={visit._id}
          appointmentId={appointment._id}
          clinicLocation={appointment.clinicLocation}
          appointmentType={appointment.appointmentType}
          defaultAttendingId={appointment.providerId.role === 'clinician' ? appointment.providerId._id : ''}
          visitStatus={status}
          canManage={canLaunchEncounter}
          onChanged={onUpdated}
        />
      ) : (
        <div className="border-t border-gray-100 pt-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Timeline</h3>
          {appointment.createdAt ? (
            <ol className="space-y-3">
              <li className="flex gap-3 text-sm">
                <div className="w-36 shrink-0 text-gray-500">{formatClock(appointment.createdAt)}</div>
                <div className="font-medium text-gray-900">Appointment booked</div>
              </li>
            </ol>
          ) : (
            <p className="text-sm text-gray-500">No visit events yet.</p>
          )}
        </div>
      )}

      {canOperate && (canNoShow || canCancel) && status !== 'completed' && (
        <div className="border-t border-gray-100 pt-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">Close without finishing</h3>
          {canCancel && (
            <div>
              <label className={labelCls} htmlFor="cancel-visit-reason">
                Cancel reason (optional)
              </label>
              <input
                id="cancel-visit-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className={inputCls}
              />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {canNoShow && (
              <button type="button" className={btnGhost} disabled={saving} onClick={() => changeStatus('no_show')}>
                No show
              </button>
            )}
            {canCancel && (
              <button
                type="button"
                disabled={saving}
                onClick={() => changeStatus('cancelled')}
                className="px-3 py-2 border border-red-200 text-red-700 rounded-lg text-sm hover:bg-red-50 disabled:opacity-50"
              >
                Cancel visit
              </button>
            )}
          </div>
        </div>
      )}

      {!canOperate && (
        <p className="text-sm text-gray-500 border-t border-gray-100 pt-4">
          Check-in and room updates are available to clinicians, nurses, and administrators on the care team.
        </p>
      )}
    </section>
  );
}
