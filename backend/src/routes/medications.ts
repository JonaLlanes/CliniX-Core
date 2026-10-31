import { Router, Request, Response, NextFunction } from 'express';
import { authorize, canReadClinical, canWriteMedications } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { parsePagination, paginated } from '../utils/pagination.js';
import { writeAudit } from '../services/auditService.js';
import { MEDICATION_AUDIT_EVENTS } from '../types/medications.js';
import type { AllergyWarning } from '../types/medications.js';
import {
  medicationActionSchema,
  medicationCheckSchema,
  medicationCreateSchema,
  medicationUpdateSchema,
} from '../validators/schemas.js';
import {
  changeMedication,
  completeMedication,
  discontinueMedication,
  findAllergyWarnings,
  getPresentedMedication,
  holdMedication,
  listMedications,
  listPrescribers,
  medicationSummary,
  resumeMedication,
  startMedication,
} from '../services/medicationService.js';

const router = Router({ mergeParams: true });

function patientIdOf(req: Request) {
  return String(req.params.patientId);
}

async function auditSaved(
  req: Request,
  action: 'create' | 'update',
  event: string,
  result: {
    medication: { _id: unknown };
    before: Record<string, unknown> | null;
    after: Record<string, unknown>;
    acknowledgedWarnings: AllergyWarning[];
  }
) {
  const patientId = patientIdOf(req);
  const resourceId = String(result.medication._id);
  await writeAudit(req, {
    action,
    resourceType: 'Medication',
    resourceId,
    patientId,
    event,
    before: result.before,
    after: result.after,
  });
  if (result.acknowledgedWarnings.length) {
    await writeAudit(req, {
      action: 'update',
      resourceType: 'Medication',
      resourceId,
      patientId,
      event: MEDICATION_AUDIT_EVENTS.allergyAcknowledged,
      after: { warnings: result.acknowledgedWarnings },
    });
  }
}

router.get('/summary', authorize(...canReadClinical), async (req, res, next) => {
  try {
    res.json(await medicationSummary(patientIdOf(req)));
  } catch (err) {
    next(err);
  }
});

router.get('/clinicians', authorize(...canReadClinical), async (_req, res, next) => {
  try {
    const data = await listPrescribers();
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/check',
  authorize(...canWriteMedications),
  validateBody(medicationCheckSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const warnings = await findAllergyWarnings(patientIdOf(req), req.body);
      res.json({ warnings });
    } catch (err) {
      next(err);
    }
  }
);

router.get('/', authorize(...canReadClinical), async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req);
    const { data, total } = await listMedications(
      patientIdOf(req),
      {
        status: req.query.status ? String(req.query.status) : undefined,
        encounterId: req.query.encounterId ? String(req.query.encounterId) : undefined,
      },
      skip,
      limit
    );
    res.json(paginated(data, total, page, limit));
  } catch (err) {
    next(err);
  }
});

router.post(
  '/',
  authorize(...canWriteMedications),
  validateBody(medicationCreateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await startMedication(patientIdOf(req), req.body, req.user!.id);
      await auditSaved(req, 'create', MEDICATION_AUDIT_EVENTS.added, result);
      res.status(201).json(result.medication);
    } catch (err) {
      next(err);
    }
  }
);

router.get('/:id', authorize(...canReadClinical), async (req, res, next) => {
  try {
    res.json(await getPresentedMedication(String(req.params.id), patientIdOf(req)));
  } catch (err) {
    next(err);
  }
});

router.patch(
  '/:id',
  authorize(...canWriteMedications),
  validateBody(medicationUpdateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await changeMedication(String(req.params.id), patientIdOf(req), req.body, req.user!.id);
      await auditSaved(req, 'update', MEDICATION_AUDIT_EVENTS.changed, result);
      res.json(result.medication);
    } catch (err) {
      next(err);
    }
  }
);

function actionRoute(
  event: string,
  run: (
    id: string,
    patientId: string,
    body: { reason: string; date: Date; clinicianId?: string },
    actorId: string
  ) => ReturnType<typeof holdMedication>
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await run(String(req.params.id), patientIdOf(req), req.body, req.user!.id);
      await auditSaved(req, 'update', event, result);
      res.json(result.medication);
    } catch (err) {
      next(err);
    }
  };
}

router.post(
  '/:id/hold',
  authorize(...canWriteMedications),
  validateBody(medicationActionSchema),
  actionRoute(MEDICATION_AUDIT_EVENTS.held, holdMedication)
);

router.post(
  '/:id/resume',
  authorize(...canWriteMedications),
  validateBody(medicationActionSchema),
  actionRoute(MEDICATION_AUDIT_EVENTS.resumed, resumeMedication)
);

router.post(
  '/:id/discontinue',
  authorize(...canWriteMedications),
  validateBody(medicationActionSchema),
  actionRoute(MEDICATION_AUDIT_EVENTS.discontinued, discontinueMedication)
);

router.post(
  '/:id/complete',
  authorize(...canWriteMedications),
  validateBody(medicationActionSchema),
  actionRoute(MEDICATION_AUDIT_EVENTS.completed, completeMedication)
);

export default router;
