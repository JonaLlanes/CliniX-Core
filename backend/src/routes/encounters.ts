import { Router, Request, Response, NextFunction } from 'express';
import { ZodError, type ZodSchema } from 'zod';
import { authorize, canManageEncounters, canReadClinical } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { validateBody } from '../middleware/validate.js';
import {
  encounterAmendSchema,
  encounterCreateSchema,
  encounterListQuerySchema,
  encounterProviderSchema,
  encounterStatusSchema,
  encounterVisitQuerySchema,
} from '../validators/schemas.js';
import { parsePagination, paginated } from '../utils/pagination.js';
import { writeAudit } from '../services/auditService.js';
import { ENCOUNTER_AUDIT_EVENTS } from '../types/encounters.js';
import {
  amendEncounter,
  assignEncounterProviders,
  changeEncounterStatus,
  createEncounter,
  encounterSummary,
  getEncounter,
  getVisitEncounterView,
  listEncounters,
  presentEncounter,
  signEncounter,
} from '../services/encounterService.js';

const router = Router({ mergeParams: true });

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

function patientIdOf(req: Request) {
  return String(req.params.patientId);
}

async function auditEncounter(
  req: Request,
  encounter: { _id: unknown; patientId: unknown; toObject: () => object },
  before: Record<string, unknown> | null,
  events: Array<'created' | 'status' | 'provider'>
) {
  const after = encounter.toObject() as Record<string, unknown>;
  const base = {
    resourceType: 'Encounter',
    resourceId: String(encounter._id),
    patientId: String(encounter.patientId),
  };
  for (const event of events) {
    if (event === 'created') {
      await writeAudit(req, {
        ...base,
        action: 'create',
        event: ENCOUNTER_AUDIT_EVENTS.created,
        after,
      });
    }
    if (event === 'status') {
      await writeAudit(req, {
        ...base,
        action: 'update',
        event: ENCOUNTER_AUDIT_EVENTS.statusChanged,
        before: before ? { status: before.status } : null,
        after: {
          status: after.status,
          signedBy: after.signedBy ?? null,
          signedAt: after.signedAt ?? null,
        },
      });
    }
    if (event === 'provider') {
      await writeAudit(req, {
        ...base,
        action: 'update',
        event: ENCOUNTER_AUDIT_EVENTS.providerAssigned,
        before: before
          ? {
              attendingProviderId: before.attendingProviderId ?? null,
              supervisingProviderId: before.supervisingProviderId ?? null,
            }
          : null,
        after: {
          attendingProviderId: after.attendingProviderId ?? null,
          supervisingProviderId: after.supervisingProviderId ?? null,
        },
      });
    }
  }
}

router.get('/summary', authorize(...canReadClinical), async (req, res, next) => {
  try {
    res.json(await encounterSummary(patientIdOf(req)));
  } catch (err) {
    next(err);
  }
});

router.get('/current', authorize(...canReadClinical), async (req, res, next) => {
  try {
    const query = parseQuery(encounterVisitQuerySchema, { visitId: req.query.visitId });
    res.json(await getVisitEncounterView(patientIdOf(req), query.visitId));
  } catch (err) {
    next(err);
  }
});

router.get('/', authorize(...canReadClinical), async (req, res, next) => {
  try {
    const query = parseQuery(encounterListQuerySchema, {
      visitId: req.query.visitId || undefined,
      status: req.query.status || undefined,
    });
    const { page, limit, skip } = parsePagination(req);
    const { data, total } = await listEncounters(patientIdOf(req), query, skip, limit);
    res.json(paginated(data, total, page, limit));
  } catch (err) {
    next(err);
  }
});

router.post(
  '/',
  authorize(...canManageEncounters),
  validateBody(encounterCreateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { encounter, visitChange } = await createEncounter(req.body, req.user!.id, patientIdOf(req));
      await auditEncounter(req, encounter, null, ['created', 'provider']);
      if (visitChange.changed) {
        await writeAudit(req, {
          action: 'update',
          resourceType: 'Visit',
          resourceId: String(visitChange.visit._id),
          patientId: String(visitChange.visit.patientId),
          before: visitChange.before,
          after: visitChange.visit.toObject(),
        });
      }
      res.status(201).json(await presentEncounter(encounter));
    } catch (err) {
      next(err);
    }
  }
);

router.get('/:id', authorize(...canReadClinical), async (req, res, next) => {
  try {
    const encounter = await getEncounter(String(req.params.id), patientIdOf(req));
    res.json(await presentEncounter(encounter));
  } catch (err) {
    next(err);
  }
});

router.post(
  '/:id/status',
  authorize(...canManageEncounters),
  validateBody(encounterStatusSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Documentation moves an in-progress encounter to awaiting signature through this action.
      const { encounter, before } = await changeEncounterStatus(
        String(req.params.id),
        patientIdOf(req),
        req.body.status,
        req.user!.id
      );
      await auditEncounter(req, encounter, before, ['status']);
      res.json(await presentEncounter(encounter));
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:id/providers',
  authorize(...canManageEncounters),
  validateBody(encounterProviderSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { encounter, before } = await assignEncounterProviders(
        String(req.params.id),
        patientIdOf(req),
        req.body,
        req.user!.id
      );
      await auditEncounter(req, encounter, before, ['provider']);
      res.json(await presentEncounter(encounter));
    } catch (err) {
      next(err);
    }
  }
);

router.post('/:id/sign', authorize(...canManageEncounters), async (req, res, next) => {
  try {
    const { encounter, before } = await signEncounter(String(req.params.id), patientIdOf(req), {
      id: req.user!.id,
      role: req.user!.role,
    });
    await auditEncounter(req, encounter, before, ['status']);
    res.json(await presentEncounter(encounter));
  } catch (err) {
    next(err);
  }
});

router.post(
  '/:id/amend',
  authorize(...canManageEncounters),
  validateBody(encounterAmendSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { originalBefore, original, created } = await amendEncounter(
        String(req.params.id),
        patientIdOf(req),
        req.body,
        req.user!.id
      );
      await auditEncounter(req, original, originalBefore, ['status']);
      await auditEncounter(req, created, null, ['created', 'provider']);
      res.status(201).json(await presentEncounter(created));
    } catch (err) {
      next(err);
    }
  }
);

export default router;
