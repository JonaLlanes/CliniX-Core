import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { visitsApi, type PatientVisit } from '../api/client';
import { StatusBadge } from './StatusBadge';
import { localDateInput } from './appointmentDisplay';

const ACTIVE = ['arrived', 'waiting', 'roomed', 'in_progress'];

function appointmentIdOf(visit: PatientVisit) {
  return typeof visit.appointmentId === 'string' ? visit.appointmentId : visit.appointmentId._id;
}

function boardDate(visit: PatientVisit) {
  if (typeof visit.appointmentId === 'string' || !visit.appointmentId.startTime) {
    return localDateInput();
  }
  return localDateInput(new Date(visit.appointmentId.startTime));
}

export default function ActiveVisitBanner({ patientId }: { patientId: string }) {
  const [visit, setVisit] = useState<PatientVisit | null>(null);

  useEffect(() => {
    let active = true;
    visitsApi
      .forPatient(patientId)
      .then((res) => {
        if (!active) return;
        setVisit(res.data.find((item) => ACTIVE.includes(item.status)) ?? null);
      })
      .catch(() => {
        if (active) setVisit(null);
      });
    return () => {
      active = false;
    };
  }, [patientId]);

  if (!visit) return null;

  return (
    <div className="mb-4 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2 text-sm text-teal-950">
        <span className="font-medium">Clinic visit</span>
        <StatusBadge value={visit.status} />
        {visit.examRoom && <span>{visit.examRoom}</span>}
      </div>
      <Link
        to={`/check-in?appointmentId=${appointmentIdOf(visit)}&date=${boardDate(visit)}`}
        className="text-sm text-clinical-teal hover:underline"
      >
        Open check-in
      </Link>
    </div>
  );
}
