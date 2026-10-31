import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { appointmentsApi, type Appointment } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Panel, { EmptyState } from './Panel';
import { StatusBadge } from './StatusBadge';
import { chartRecordId, focusedRecordClass, watchChartRecord } from './chart/recordFocus';
import {
  canBookAppointments,
  formatAppointmentWhen,
  localDateInput,
  providerLabel,
  refId,
  typeLabel,
} from './appointmentDisplay';

export default function AppointmentHistory({
  patientId,
  focusId = '',
  focusToken = 0,
}: {
  patientId: string;
  focusId?: string;
  focusToken?: number;
}) {
  const { user } = useAuth();
  const [items, setItems] = useState<Appointment[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const canBook = canBookAppointments(user?.role);

  useEffect(() => {
    let active = true;
    setLoading(true);
    appointmentsApi
      .history(patientId, 100)
      .then((res) => {
        if (active) {
          setItems(res.data);
          setError('');
        }
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load appointments');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [patientId]);

  useEffect(() => {
    if (!focusToken || !focusId || loading) return;
    return watchChartRecord('appointment', focusId);
  }, [focusToken, focusId, loading, items]);

  return (
    <Panel
      title="Appointment history"
      subtitle="Booked visits for this chart, newest first"
      link={`/schedule?patientId=${patientId}`}
      linkLabel={canBook ? 'Book appointment' : 'Open schedule'}
    >
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}
      {loading ? (
        <p className="text-sm text-gray-500">Loading appointments...</p>
      ) : items.length === 0 ? (
        <EmptyState text="No appointments on this chart" hint="Booked visits for this patient show up here." />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-medium text-gray-500 border-b border-gray-200">
              <th className="pb-3 pr-3">When</th>
              <th className="pb-3 pr-3">Type</th>
              <th className="pb-3 pr-3">Provider</th>
              <th className="pb-3 pr-3">Location</th>
              <th className="pb-3 pr-3">Status</th>
              <th className="pb-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item) => (
              <tr
                key={item._id}
                id={chartRecordId('appointment', item._id)}
                className={focusedRecordClass(item._id === focusId, 'row')}
              >
                <td className="py-3 pr-3 whitespace-nowrap">
                  {formatAppointmentWhen(item.startTime, item.endTime)}
                </td>
                <td className="py-3 pr-3">{typeLabel(item.appointmentType)}</td>
                <td className="py-3 pr-3">{providerLabel(item.providerId)}</td>
                <td className="py-3 pr-3">{item.clinicLocation}</td>
                <td className="py-3 pr-3">
                  <StatusBadge value={item.status} />
                  {item.cancelReason && (
                    <div className="text-xs text-gray-500 mt-1">{item.cancelReason}</div>
                  )}
                </td>
                <td className="py-3 text-right whitespace-nowrap">
                  {['booked', 'confirmed', 'arrived'].includes(item.status) && (
                    <Link
                      to={`/check-in?appointmentId=${item._id}&date=${localDateInput(new Date(item.startTime))}`}
                      className="text-clinical-teal hover:underline mr-3"
                    >
                      Check in
                    </Link>
                  )}
                  <Link
                    to={`/schedule?patientId=${patientId}&providerId=${refId(item.providerId)}&appointmentId=${item._id}&date=${localDateInput(new Date(item.startTime))}`}
                    className="text-clinical-teal hover:underline"
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
