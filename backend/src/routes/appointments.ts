import { Router, Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import type { IAppointment } from '../models/Appointment.js';
import { ZodError, type ZodSchema } from 'zod';
import { Patient } from '../models/Patient.js';
import {
  authenticate,
  authorize,
  canReadClinical,
  canWriteAppointments,
} from '../middleware/auth.js';
import { canAccessChart, isChartBypass } from '../middleware/chartAccess.js';
import { HttpError } from '../middleware/error.js';
import { validateBody } from '../middleware/validate.js';
import {
  appointmentCancelSchema,
  appointmentDayQuerySchema,
  appointmentListQuerySchema,
  appointmentPatchSchema,
  appointmentRescheduleSchema,
  appointmentSchema,
} from '../validators/schemas.js';
import { parsePagination, notDeleted } from '../utils/pagination.js';
import { writeAudit } from '../services/auditService.js';
import {
  cancelAppointment,
  createAppointment,
  getAppointment,
  listAppointments,
  listBookableProviders,
  listProviderDay,
  populateAppointment,
  rescheduleAppointment,
  updateAppointment,
} from '../services/appointmentService.js';
import { syncVisitWithAppointment } from '../services/visitService.js';

const router = Router();

router.use(authenticate);

function parseQuery<T>(schema: ZodSchema<T>, value: unknown): T {
  try {
    return schema.parse(value);
  } catch (err) {
    if (err instanceof ZodError) {
      throw new HttpError(
        400,
        'Validation failed',
        err.errors.map((issue) => ({ path: issue.path.join('.'), message: issue.message }))
      );
    }
    throw err;
  }
}

/** Caregivers and pharmacists only see appointments for patients on their care team. */
async function readScope(req: Request) {
  const user = req.user!;
  if (isChartBypass(user.role) || user.role === 'clinician' || user.role === 'nurse') {
    return null;
  }
  const ids = await Patient.find({ careTeam: user.id, ...notDeleted }).distinct('_id');
  return ids as Types.ObjectId[];
}

function assertInScope(scope: Types.ObjectId[] | null, patientId: string) {
  if (!scope) return;
  if (!scope.some((id) => id.toString() === patientId)) {
    throw new HttpError(403, 'You are not assigned to this patient chart');
  }
}

async function auditSyncedVisit(req: Request, appointment: IAppointment) {
  if (!req.user) return;
  const synced = await syncVisitWithAppointment(appointment, req.user.id);
  if (!synced) return;
  await writeAudit(req, {
    action: 'update',
    resourceType: 'Visit',
    resourceId: String(synced.visit._id),
    patientId: String(synced.visit.patientId),
    before: synced.visitBefore,
    after: synced.visit.toObject(),
  });
}

router.get('/providers', authorize(...canReadClinical), async (_req, res, next) => {
  try {
    const data = await listBookableProviders();
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

router.get('/day', authorize(...canReadClinical), async (req, res, next) => {
  try {
    const query = parseQuery(appointmentDayQuerySchema, {
      providerId: req.query.providerId,
      date: req.query.date,
    });
    const scope = await readScope(req);
    const data = await listProviderDay(query.providerId, query.date, scope);
    res.json({ data, date: query.date, providerId: query.providerId });
  } catch (err) {
    next(err);
  }
});

router.get('/', authorize(...canReadClinical), async (req, res, next) => {
  try {
    const query = parseQuery(appointmentListQuerySchema, {
      patientId: req.query.patientId || undefined,
      providerId: req.query.providerId || undefined,
      status: req.query.status || undefined,
      from: req.query.from || undefined,
      to: req.query.to || undefined,
    });
    const { page, limit, skip } = parsePagination(req);
    const scope = await readScope(req);
    if (query.patientId) assertInScope(scope, query.patientId);

    const filter: Record<string, unknown> = {};
    if (query.patientId) filter.patientId = query.patientId;
    else if (scope) filter.patientId = { $in: scope };
    if (query.providerId) filter.providerId = query.providerId;
    if (query.status) filter.status = query.status;
    if (query.from || query.to) {
      const range: Record<string, Date> = {};
      if (query.from) range.$gte = query.from;
      if (query.to) range.$lte = query.to;
      filter.startTime = range;
    }

    res.json(await listAppointments(filter, page, limit, skip));
  } catch (err) {
    next(err);
  }
});

router.post(
  '/',
  authorize(...canWriteAppointments),
  validateBody(appointmentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patient = await Patient.findOne({ _id: req.body.patientId, ...notDeleted });
      if (!patient) return res.status(404).json({ error: 'Patient not found' });
      if (!req.user || !canAccessChart(req.user, patient)) {
        return res.status(403).json({ error: 'You are not assigned to this patient chart' });
      }
      const doc = await createAppointment(req.body);
      await writeAudit(req, {
        action: 'create',
        resourceType: 'Appointment',
        resourceId: String(doc._id),
        patientId: String(doc.patientId),
        after: doc.toObject(),
      });
      res.status(201).json(await populateAppointment(doc));
    } catch (err) {
      next(err);
    }
  }
);

router.get('/:id', authorize(...canReadClinical), async (req, res, next) => {
  try {
    const doc = await getAppointment(String(req.params.id));
    const scope = await readScope(req);
    assertInScope(scope, String(doc.patientId));
    res.json(await populateAppointment(doc));
  } catch (err) {
    next(err);
  }
});

router.patch(
  '/:id',
  authorize(...canWriteAppointments),
  validateBody(appointmentPatchSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doc = await getAppointment(String(req.params.id));
      const patient = await Patient.findOne({ _id: doc.patientId, ...notDeleted });
      if (!patient) return res.status(404).json({ error: 'Patient not found' });
      if (!req.user || !canAccessChart(req.user, patient)) {
        return res.status(403).json({ error: 'You are not assigned to this patient chart' });
      }
      const before = doc.toObject();
      await updateAppointment(doc, req.body);
      await writeAudit(req, {
        action: 'update',
        resourceType: 'Appointment',
        resourceId: String(doc._id),
        patientId: String(doc.patientId),
        before,
        after: doc.toObject(),
      });
      await auditSyncedVisit(req, doc);
      res.json(await populateAppointment(doc));
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:id/reschedule',
  authorize(...canWriteAppointments),
  validateBody(appointmentRescheduleSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doc = await getAppointment(String(req.params.id));
      const patient = await Patient.findOne({ _id: doc.patientId, ...notDeleted });
      if (!patient) return res.status(404).json({ error: 'Patient not found' });
      if (!req.user || !canAccessChart(req.user, patient)) {
        return res.status(403).json({ error: 'You are not assigned to this patient chart' });
      }
      const before = doc.toObject();
      await rescheduleAppointment(doc, req.body.startTime, req.body.endTime);
      await writeAudit(req, {
        action: 'update',
        resourceType: 'Appointment',
        resourceId: String(doc._id),
        patientId: String(doc.patientId),
        before,
        after: doc.toObject(),
      });
      await auditSyncedVisit(req, doc);
      res.json(await populateAppointment(doc));
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:id/cancel',
  authorize(...canWriteAppointments),
  validateBody(appointmentCancelSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doc = await getAppointment(String(req.params.id));
      const patient = await Patient.findOne({ _id: doc.patientId, ...notDeleted });
      if (!patient) return res.status(404).json({ error: 'Patient not found' });
      if (!req.user || !canAccessChart(req.user, patient)) {
        return res.status(403).json({ error: 'You are not assigned to this patient chart' });
      }
      const before = doc.toObject();
      await cancelAppointment(doc, req.body.reason);
      await writeAudit(req, {
        action: 'update',
        resourceType: 'Appointment',
        resourceId: String(doc._id),
        patientId: String(doc.patientId),
        before,
        after: doc.toObject(),
      });
      await auditSyncedVisit(req, doc);
      res.json(await populateAppointment(doc));
    } catch (err) {
      next(err);
    }
  }
);

export default router;
