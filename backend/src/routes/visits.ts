import { Router, Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { ZodError, type ZodSchema } from 'zod';
import { Patient } from '../models/Patient.js';
import { authenticate, authorize, canReadClinical, canWriteVisits } from '../middleware/auth.js';
import { canAccessChart, isChartBypass } from '../middleware/chartAccess.js';
import { HttpError } from '../middleware/error.js';
import { validateBody } from '../middleware/validate.js';
import {
  visitBoardQuerySchema,
  visitCheckInSchema,
  visitRoomSchema,
  visitStatusSchema,
} from '../validators/schemas.js';
import { notDeleted } from '../utils/pagination.js';
import { writeAudit } from '../services/auditService.js';
import { getAppointment } from '../services/appointmentService.js';
import {
  assignVisitRoom,
  checkInVisit,
  getVisit,
  getVisitBoard,
  presentVisit,
  presentVisitOnly,
  setVisitStatus,
  type VisitChange,
} from '../services/visitService.js';

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

async function requireChart(req: Request, patientId: unknown) {
  const patient = await Patient.findOne({ _id: patientId, ...notDeleted });
  if (!patient) throw new HttpError(404, 'Patient not found');
  if (!req.user || !canAccessChart(req.user, patient)) {
    throw new HttpError(403, 'You are not assigned to this patient chart');
  }
  return patient;
}

async function auditVisitChange(req: Request, result: VisitChange) {
  await writeAudit(req, {
    action: result.created ? 'create' : 'update',
    resourceType: 'Visit',
    resourceId: String(result.visit._id),
    patientId: String(result.visit.patientId),
    before: result.visitBefore,
    after: result.visit.toObject(),
  });
  if (!result.appointmentChanged) return;
  await writeAudit(req, {
    action: 'update',
    resourceType: 'Appointment',
    resourceId: String(result.appointment._id),
    patientId: String(result.appointment.patientId),
    before: result.appointmentBefore,
    after: result.appointment.toObject(),
  });
}

router.get('/board', authorize(...canReadClinical), async (req, res, next) => {
  try {
    const query = parseQuery(visitBoardQuerySchema, {
      date: req.query.date,
      providerId: req.query.providerId || undefined,
      location: req.query.location || undefined,
    });
    const scope = await readScope(req);
    res.json(
      await getVisitBoard({
        date: query.date,
        providerId: query.providerId,
        location: query.location,
        patientIds: scope,
      })
    );
  } catch (err) {
    next(err);
  }
});

router.post(
  '/check-in',
  authorize(...canWriteVisits),
  validateBody(visitCheckInSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const appointment = await getAppointment(req.body.appointmentId);
      await requireChart(req, appointment.patientId);
      const result = await checkInVisit(req.body, req.user!.id);
      await auditVisitChange(req, result);
      const body = await presentVisit(result.visit, result.appointment);
      res.status(result.created ? 201 : 200).json(body);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/room',
  authorize(...canWriteVisits),
  validateBody(visitRoomSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const appointment = await getAppointment(req.body.appointmentId);
      await requireChart(req, appointment.patientId);
      const result = await assignVisitRoom(req.body, req.user!.id);
      await auditVisitChange(req, result);
      res.json(await presentVisit(result.visit, result.appointment));
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/status',
  authorize(...canWriteVisits),
  validateBody(visitStatusSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const appointment = await getAppointment(req.body.appointmentId);
      await requireChart(req, appointment.patientId);
      const result = await setVisitStatus(req.body, req.user!.id);
      await auditVisitChange(req, result);
      const body = await presentVisit(result.visit, result.appointment);
      res.status(result.created ? 201 : 200).json(body);
    } catch (err) {
      next(err);
    }
  }
);

router.get('/:id', authorize(...canReadClinical), async (req, res, next) => {
  try {
    const visit = await getVisit(String(req.params.id));
    const scope = await readScope(req);
    assertInScope(scope, String(visit.patientId));
    res.json(await presentVisitOnly(visit));
  } catch (err) {
    next(err);
  }
});

export default router;
