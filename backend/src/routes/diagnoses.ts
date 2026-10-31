import { Router, Request, Response, NextFunction } from 'express';
import { authorize, canManageEncounters, canReadClinical } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { parsePagination, paginated } from '../utils/pagination.js';
import { writeAudit } from '../services/auditService.js';
import { DIAGNOSIS_AUDIT_EVENTS } from '../types/diagnoses.js';
import {
  diagnosisCreateSchema,
  diagnosisPromoteSchema,
  diagnosisUpdateSchema,
} from '../validators/schemas.js';
import {
  createEncounterDiagnosis,
  deleteEncounterDiagnosis,
  listDiagnoses,
  plainProblem,
  presentDiagnosis,
  problemAuditEntries,
  promoteDiagnosis,
  updateEncounterDiagnosis,
} from '../services/diagnosisService.js';

const router = Router({ mergeParams: true });

function patientIdOf(req: Request) {
  return String(req.params.patientId);
}

router.get('/', authorize(...canReadClinical), async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req);
    const encounterId = req.query.encounterId ? String(req.query.encounterId) : undefined;
    const { data, total } = await listDiagnoses(patientIdOf(req), encounterId, skip, limit);
    res.json(paginated(data, total, page, limit));
  } catch (err) {
    next(err);
  }
});

router.post(
  '/',
  authorize(...canManageEncounters),
  validateBody(diagnosisCreateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const diagnosis = await createEncounterDiagnosis(patientIdOf(req), req.body, req.user!.id);
      await writeAudit(req, {
        action: 'create',
        resourceType: 'EncounterDiagnosis',
        resourceId: String(diagnosis._id),
        patientId: patientIdOf(req),
        event: DIAGNOSIS_AUDIT_EVENTS.created,
        after: diagnosis.toObject(),
      });
      res.status(201).json(await presentDiagnosis(diagnosis));
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/:id',
  authorize(...canManageEncounters),
  validateBody(diagnosisUpdateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { diagnosis, before } = await updateEncounterDiagnosis(
        String(req.params.id),
        patientIdOf(req),
        req.body
      );
      await writeAudit(req, {
        action: 'update',
        resourceType: 'EncounterDiagnosis',
        resourceId: String(diagnosis._id),
        patientId: patientIdOf(req),
        before,
        after: diagnosis.toObject(),
      });
      res.json(await presentDiagnosis(diagnosis));
    } catch (err) {
      next(err);
    }
  }
);

router.delete('/:id', authorize(...canManageEncounters), async (req, res, next) => {
  try {
    const { diagnosis, before } = await deleteEncounterDiagnosis(String(req.params.id), patientIdOf(req));
    await writeAudit(req, {
      action: 'delete',
      resourceType: 'EncounterDiagnosis',
      resourceId: String(diagnosis._id),
      patientId: patientIdOf(req),
      before,
      after: null,
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/:id/promote',
  authorize(...canManageEncounters),
  validateBody(diagnosisPromoteSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { diagnosis, diagnosisBefore, problem, problemBefore } = await promoteDiagnosis(
        patientIdOf(req),
        String(req.params.id),
        req.body,
        req.user!.id
      );
      const problemAfter = plainProblem(problem);
      for (const entry of problemAuditEntries(problemBefore ? 'update' : 'create', problemBefore, problemAfter)) {
        await writeAudit(req, {
          action: entry.action,
          resourceType: 'Condition',
          resourceId: String(problem._id),
          patientId: patientIdOf(req),
          event: entry.event,
          before: entry.before,
          after: entry.after,
        });
      }
      await writeAudit(req, {
        action: 'update',
        resourceType: 'EncounterDiagnosis',
        resourceId: String(diagnosis._id),
        patientId: patientIdOf(req),
        before: diagnosisBefore,
        after: diagnosis.toObject(),
      });
      await problem.populate({ path: 'clinicianOwner', select: 'displayName role' });
      res.json({
        diagnosis: await presentDiagnosis(diagnosis),
        problem,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
