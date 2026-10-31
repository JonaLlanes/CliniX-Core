import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import type { Role } from '../types/roles.js';

export type { Role };

export interface AuthUser {
  id: string;
  role: Role;
  displayName: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, config.jwtSecret) as AuthUser & { sub?: string };
    req.user = {
      id: payload.id || payload.sub || '',
      role: payload.role,
      displayName: payload.displayName,
      email: payload.email,
    };
    if (!req.user.id) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function authorize(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

/**
 * Clinic population reports. Caregivers stay on their own chart and do not
 * see panel, cohort, or operational totals.
 */
export const canReadPopulationReports: Role[] = ['clinician', 'nurse', 'admin'];

/** Read access for clinical + insight; write sets are route-specific. */
export const canReadClinical: Role[] = [
  'clinician',
  'nurse',
  'caregiver',
  'pharmacist',
  'admin',
  'insight_service',
];

export const canWritePatients: Role[] = ['clinician', 'nurse', 'admin'];
export const canWriteConditions: Role[] = ['clinician', 'nurse', 'admin'];
export const canWriteVitals: Role[] = ['clinician', 'nurse', 'caregiver', 'admin'];
export const canWriteMedications: Role[] = ['clinician', 'pharmacist', 'admin'];
/** Clinicians, nurses, and administrators track local orders and results. */
export const canWriteOrders: Role[] = ['clinician', 'nurse', 'admin'];
/** Clinicians, nurses, and administrators track internal referrals. */
export const canWriteReferrals: Role[] = ['clinician', 'nurse', 'admin'];
/** Clinicians and administrators own the encounter lifecycle. */
export const canManageEncounters: Role[] = ['clinician', 'admin'];
export const canWriteEncounters: Role[] = canManageEncounters;
export const canWriteAppointments: Role[] = ['clinician', 'nurse', 'admin'];
export const canWriteVisits: Role[] = ['clinician', 'nurse', 'admin'];
export const canWriteCarePlans: Role[] = ['clinician', 'nurse', 'admin'];
/** Clinicians, nurses, and administrators enroll patients and manage recalls. */
export const canWriteMonitoring: Role[] = ['clinician', 'nurse', 'admin'];
/** Caregivers may record home, device, and caregiver readings. */
export const canWriteMonitoringMetrics: Role[] = ['clinician', 'nurse', 'caregiver', 'admin'];
export const canWriteTasks: Role[] = [
  'clinician',
  'nurse',
  'caregiver',
  'pharmacist',
  'admin',
];
export const canWriteNotes: Role[] = ['clinician', 'nurse', 'admin'];
export const canWriteAllergies: Role[] = ['clinician', 'nurse', 'admin'];
export const canManageUsers: Role[] = ['admin'];
export const canListUsers: Role[] = ['clinician', 'nurse', 'admin'];
