import { Router, Request, Response, NextFunction } from 'express';
import {
  authorize,
  canReadClinical,
  canWriteMonitoring,
  canWriteMonitoringMetrics,
} from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { parsePagination, paginated } from '../utils/pagination.js';
import { writeAudit } from '../services/auditService.js';
import { PROGRAM_STATUSES, RECALL_STATUSES, type ProgramStatus, type RecallStatus } from '../types/monitoring.js';
import {
  monitoringMetricSchema,
  monitoringMetricUpdateSchema,
  monitoringProgramCreateSchema,
  monitoringProgramStatusSchema,
  monitoringProgramUpdateSchema,
  recallCreateSchema,
  recallStatusSchema,
  recallUpdateSchema,
} from '../validators/schemas.js';
import {
  changeProgramStatus,
  changeRecallStatus,
  createProgram,
  createRecall,
  getPresentedProgram,
  getPresentedRecall,
  listPrograms,
  listRecalls,
  monitoringDashboard,
  monitoringOptions,
  monitoringTrends,
  recordMetric,
  updateMetric,
  updateProgram,
  updateRecall,
  type AuditTrail,
} from '../services/monitoringService.js';

const router = Router({ mergeParams: true });

function patientIdOf(req: Request) {
  return String(req.params.patientId);
}

async function record(req: Request, patientId: string, audits: AuditTrail[]) {
  for (const entry of audits) {
    await writeAudit(req, { ...entry, patientId });
  }
}

function caregiverSource(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'caregiver') return next();
  const source = req.body?.source;
  if (source && source !== 'home' && source !== 'device' && source !== 'caregiver') {
    return res.status(403).json({
      error: 'Caregivers may only record readings from home, a device, or a caregiver',
    });
  }
  next();
}

router.get('/dashboard', authorize(...canReadClinical), async (req, res, next) => {
  try {
    res.json(await monitoringDashboard(patientIdOf(req)));
  } catch (err) {
    next(err);
  }
});

router.get('/trends', authorize(...canReadClinical), async (req, res, next) => {
  try {
    res.json(await monitoringTrends(patientIdOf(req)));
  } catch (err) {
    next(err);
  }
});

router.get('/options', authorize(...canReadClinical), async (req, res, next) => {
  try {
    res.json(await monitoringOptions(patientIdOf(req)));
  } catch (err) {
    next(err);
  }
});

router.get('/programs', authorize(...canReadClinical), async (req, res, next) => {
  try {
    const status = req.query.status ? String(req.query.status) : undefined;
    if (status && !PROGRAM_STATUSES.includes(status as ProgramStatus)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const { page, limit, skip } = parsePagination(req);
    const { data, total } = await listPrograms(patientIdOf(req), status as ProgramStatus | undefined, skip, limit);
    res.json(paginated(data, total, page, limit));
  } catch (err) {
    next(err);
  }
});

router.post(
  '/programs',
  authorize(...canWriteMonitoring),
  validateBody(monitoringProgramCreateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const saved = await createProgram(patientIdOf(req), req.body);
      await record(req, patientIdOf(req), saved.audits);
      res.status(201).json(saved.program);
    } catch (err) {
      next(err);
    }
  }
);

router.get('/programs/:id', authorize(...canReadClinical), async (req, res, next) => {
  try {
    res.json(await getPresentedProgram(String(req.params.id), patientIdOf(req)));
  } catch (err) {
    next(err);
  }
});

router.patch(
  '/programs/:id',
  authorize(...canWriteMonitoring),
  validateBody(monitoringProgramUpdateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const saved = await updateProgram(String(req.params.id), patientIdOf(req), req.body);
      await record(req, patientIdOf(req), saved.audits);
      res.json(saved.program);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/programs/:id/status',
  authorize(...canWriteMonitoring),
  validateBody(monitoringProgramStatusSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const saved = await changeProgramStatus(String(req.params.id), patientIdOf(req), req.body);
      await record(req, patientIdOf(req), saved.audits);
      res.json(saved.program);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/programs/:id/metrics',
  authorize(...canWriteMonitoringMetrics),
  caregiverSource,
  validateBody(monitoringMetricSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const saved = await recordMetric(String(req.params.id), patientIdOf(req), req.body, {
        role: req.user!.role,
      });
      await record(req, patientIdOf(req), saved.audits);
      res.status(201).json(saved.metric);
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/metrics/:metricId',
  authorize(...canWriteMonitoringMetrics),
  caregiverSource,
  validateBody(monitoringMetricUpdateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const saved = await updateMetric(String(req.params.metricId), patientIdOf(req), req.body, {
        role: req.user!.role,
      });
      await record(req, patientIdOf(req), saved.audits);
      res.json(saved.metric);
    } catch (err) {
      next(err);
    }
  }
);

router.get('/recalls', authorize(...canReadClinical), async (req, res, next) => {
  try {
    const status = req.query.status ? String(req.query.status) : undefined;
    if (status && !RECALL_STATUSES.includes(status as RecallStatus)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const { page, limit, skip } = parsePagination(req);
    const { data, total } = await listRecalls(patientIdOf(req), status as RecallStatus | undefined, skip, limit);
    res.json(paginated(data, total, page, limit));
  } catch (err) {
    next(err);
  }
});

router.post(
  '/recalls',
  authorize(...canWriteMonitoring),
  validateBody(recallCreateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const saved = await createRecall(patientIdOf(req), req.body);
      await record(req, patientIdOf(req), saved.audits);
      res.status(201).json(saved.recall);
    } catch (err) {
      next(err);
    }
  }
);

router.get('/recalls/:id', authorize(...canReadClinical), async (req, res, next) => {
  try {
    res.json(await getPresentedRecall(String(req.params.id), patientIdOf(req)));
  } catch (err) {
    next(err);
  }
});

router.patch(
  '/recalls/:id',
  authorize(...canWriteMonitoring),
  validateBody(recallUpdateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const saved = await updateRecall(String(req.params.id), patientIdOf(req), req.body);
      await record(req, patientIdOf(req), saved.audits);
      res.json(saved.recall);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/recalls/:id/status',
  authorize(...canWriteMonitoring),
  validateBody(recallStatusSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const saved = await changeRecallStatus(String(req.params.id), patientIdOf(req), req.body);
      await record(req, patientIdOf(req), saved.audits);
      res.json(saved.recall);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
