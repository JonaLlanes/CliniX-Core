import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { Patient, type IPatient } from '../models/Patient.js';
import { notDeleted } from '../utils/pagination.js';
import type { AuthUser } from './auth.js';

declare global {
  namespace Express {
    interface Request {
      chartPatient?: IPatient;
    }
  }
}

export function isChartBypass(role: string) {
  return role === 'admin' || role === 'insight_service';
}

export function canAccessChart(
  user: AuthUser,
  patient: { careTeam?: Types.ObjectId[] }
) {
  if (isChartBypass(user.role)) return true;
  return (patient.careTeam ?? []).some((id) => id.toString() === user.id);
}

export function requireChartAccess(paramName = 'patientId') {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }
    const patientId = req.params[paramName];
    if (typeof patientId !== 'string' || !Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({ error: 'Invalid patient id' });
    }
    const patient = await Patient.findOne({ _id: patientId, ...notDeleted });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    if (!canAccessChart(req.user, patient)) {
      return res.status(403).json({ error: 'You are not assigned to this patient chart' });
    }
    req.chartPatient = patient;
    next();
  };
}
