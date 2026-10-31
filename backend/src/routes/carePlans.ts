import { Router, Request, Response, NextFunction } from 'express';
import { authorize, canReadClinical, canWriteCarePlans } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { parsePagination, paginated } from '../utils/pagination.js';
import { writeAudit } from '../services/auditService.js';
import { CARE_PLAN_VIEWS, type CarePlanView } from '../types/carePlans.js';
import {
  carePlanCreateSchema,
  carePlanGoalCreateSchema,
  carePlanGoalUpdateSchema,
  carePlanInterventionCreateSchema,
  carePlanInterventionUpdateSchema,
  carePlanProgressSchema,
  carePlanStatusSchema,
  carePlanUpdateSchema,
} from '../validators/schemas.js';
import {
  addCarePlanProgress,
  addGoal,
  addIntervention,
  carePlanOptions,
  carePlanSummary,
  changeCarePlanStatus,
  createCarePlan,
  getPresentedPlan,
  listCarePlans,
  updateCarePlan,
  updateGoal,
  updateIntervention,
  type AuditTrail,
  type SavedPlan,
} from '../services/carePlanService.js';

const router = Router({ mergeParams: true });

function patientIdOf(req: Request) {
  return String(req.params.patientId);
}

async function record(req: Request, patientId: string, audits: AuditTrail[]) {
  for (const entry of audits) {
    await writeAudit(req, { ...entry, patientId });
  }
}

function sendPlan(res: Response, status: number, saved: SavedPlan) {
  res.status(status).json(saved.plan);
}

router.get('/summary', authorize(...canReadClinical), async (req, res, next) => {
  try {
    res.json(await carePlanSummary(patientIdOf(req)));
  } catch (err) {
    next(err);
  }
});

router.get('/options', authorize(...canReadClinical), async (req, res, next) => {
  try {
    res.json(await carePlanOptions(patientIdOf(req)));
  } catch (err) {
    next(err);
  }
});

router.get('/', authorize(...canReadClinical), async (req, res, next) => {
  try {
    const view = req.query.view ? String(req.query.view) : 'current';
    if (!CARE_PLAN_VIEWS.includes(view as CarePlanView)) {
      return res.status(400).json({ error: 'Invalid view' });
    }
    const { page, limit, skip } = parsePagination(req);
    const { data, total } = await listCarePlans(patientIdOf(req), view as CarePlanView, skip, limit);
    res.json(paginated(data, total, page, limit));
  } catch (err) {
    next(err);
  }
});

router.post(
  '/',
  authorize(...canWriteCarePlans),
  validateBody(carePlanCreateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const saved = await createCarePlan(patientIdOf(req), req.body);
      await record(req, patientIdOf(req), saved.audits);
      sendPlan(res, 201, saved);
    } catch (err) {
      next(err);
    }
  }
);

router.get('/:id', authorize(...canReadClinical), async (req, res, next) => {
  try {
    res.json(await getPresentedPlan(String(req.params.id), patientIdOf(req)));
  } catch (err) {
    next(err);
  }
});

router.patch(
  '/:id',
  authorize(...canWriteCarePlans),
  validateBody(carePlanUpdateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const saved = await updateCarePlan(String(req.params.id), patientIdOf(req), req.body);
      await record(req, patientIdOf(req), saved.audits);
      sendPlan(res, 200, saved);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:id/status',
  authorize(...canWriteCarePlans),
  validateBody(carePlanStatusSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const saved = await changeCarePlanStatus(String(req.params.id), patientIdOf(req), req.body);
      await record(req, patientIdOf(req), saved.audits);
      sendPlan(res, 200, saved);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:id/progress',
  authorize(...canWriteCarePlans),
  validateBody(carePlanProgressSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const saved = await addCarePlanProgress(
        String(req.params.id),
        patientIdOf(req),
        req.body.note,
        req.user!.id
      );
      await record(req, patientIdOf(req), saved.audits);
      sendPlan(res, 201, saved);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:id/goals',
  authorize(...canWriteCarePlans),
  validateBody(carePlanGoalCreateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const saved = await addGoal(String(req.params.id), patientIdOf(req), req.body);
      await record(req, patientIdOf(req), saved.audits);
      sendPlan(res, 201, saved);
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/:id/goals/:goalId',
  authorize(...canWriteCarePlans),
  validateBody(carePlanGoalUpdateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const saved = await updateGoal(String(req.params.id), patientIdOf(req), String(req.params.goalId), req.body);
      await record(req, patientIdOf(req), saved.audits);
      sendPlan(res, 200, saved);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:id/interventions',
  authorize(...canWriteCarePlans),
  validateBody(carePlanInterventionCreateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const saved = await addIntervention(String(req.params.id), patientIdOf(req), req.body);
      await record(req, patientIdOf(req), saved.audits);
      sendPlan(res, 201, saved);
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/:id/interventions/:interventionId',
  authorize(...canWriteCarePlans),
  validateBody(carePlanInterventionUpdateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const saved = await updateIntervention(
        String(req.params.id),
        patientIdOf(req),
        String(req.params.interventionId),
        req.body
      );
      await record(req, patientIdOf(req), saved.audits);
      sendPlan(res, 200, saved);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
