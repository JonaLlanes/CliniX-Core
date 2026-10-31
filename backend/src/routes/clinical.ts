import { Router, Request, Response, NextFunction } from 'express';
import { Condition, type ICondition } from '../models/Condition.js';
import { Vital } from '../models/Vital.js';
import { Task } from '../models/Task.js';
import { ClinicalNote } from '../models/ClinicalNote.js';
import { Allergy } from '../models/Allergy.js';
import { AuditEvent } from '../models/AuditEvent.js';
import {
  authenticate,
  authorize,
  canReadClinical,
  canWriteConditions,
  canWriteVitals,
  canWriteTasks,
  canWriteNotes,
  canWriteAllergies,
} from '../middleware/auth.js';
import { requireChartAccess } from '../middleware/chartAccess.js';
import type { Role as RoleType } from '../types/roles.js';
import { validateBody } from '../middleware/validate.js';
import {
  conditionSchema,
  vitalSchema,
  taskSchema,
  noteSchema,
  allergySchema,
} from '../validators/schemas.js';
import { createPatientResourceRouter } from './patientResource.js';
import { parsePagination, paginated, notDeleted } from '../utils/pagination.js';
import { writeAudit } from '../services/auditService.js';
import encounterRoutes from './encounters.js';
import diagnosisRoutes from './diagnoses.js';
import medicationRoutes from './medications.js';
import orderRoutes from './orders.js';
import referralRoutes from './referrals.js';
import carePlanRoutes from './carePlans.js';
import monitoringRoutes from './monitoring.js';
import { prepareProblemWrite, problemAuditEntries } from '../services/diagnosisService.js';
import { listAppointments } from '../services/appointmentService.js';
import { listPatientVisits } from '../services/visitService.js';
import { APPOINTMENT_STATUSES } from '../types/appointments.js';
import { Types } from 'mongoose';

const router = Router({ mergeParams: true });

router.use(authenticate);
router.use(requireChartAccess('patientId'));

router.get('/audit', authorize(...canReadClinical), async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req);
  const filter = { patientId: req.params.patientId };
  const [data, total] = await Promise.all([
    AuditEvent.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'displayName email role'),
    AuditEvent.countDocuments(filter),
  ]);
  res.json(paginated(data, total, page, limit));
});

function methodAuth(writeRoles: RoleType[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET') return authorize(...canReadClinical)(req, res, next);
    return authorize(...writeRoles)(req, res, next);
  };
}

function maybeValidate(schema: Parameters<typeof validateBody>[0]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'POST' || req.method === 'PATCH') {
      return validateBody(schema)(req, res, next);
    }
    next();
  };
}

// --- Conditions ---
router.use(
  '/conditions',
  methodAuth(canWriteConditions),
  maybeValidate(conditionSchema),
  createPatientResourceRouter({
    model: Condition,
    resourceType: 'Condition',
    buildFilter: (req) => (req.query.status ? { status: String(req.query.status) } : {}),
    populate: { path: 'clinicianOwner', select: 'displayName role' },
    beforeCreate: async (_req, body) => {
      await prepareProblemWrite(body);
    },
    beforeUpdate: async (_req, body, doc) => {
      const problem = doc as unknown as ICondition;
      await prepareProblemWrite(body, problem);
    },
    auditEntries: problemAuditEntries,
  })
);

router.use('/diagnoses', diagnosisRoutes);

// --- Vitals ---
router.use('/vitals', methodAuth(canWriteVitals));
router.use('/vitals', (req, res, next) => {
  if ((req.method === 'POST' || req.method === 'PATCH') && req.user?.role === 'caregiver') {
    const source = req.body?.source;
    if (source && !['home', 'device', 'caregiver'].includes(source)) {
      return res.status(403).json({
        error: 'Caregivers may only record vitals with source home, device, or caregiver',
      });
    }
  }
  next();
});
router.use(
  '/vitals',
  maybeValidate(vitalSchema),
  createPatientResourceRouter({
    model: Vital,
    resourceType: 'Vital',
    buildFilter: (req) => {
      const f: Record<string, unknown> = {};
      if (req.query.source) f.source = String(req.query.source);
      if (req.query.from || req.query.to) {
        const range: Record<string, Date> = {};
        if (req.query.from) range.$gte = new Date(String(req.query.from));
        if (req.query.to) range.$lte = new Date(String(req.query.to));
        f.effectiveAt = range;
      }
      return f;
    },
    sort: { effectiveAt: -1 },
  })
);

router.use('/medications', medicationRoutes);

router.use('/orders', orderRoutes);

router.use('/referrals', referralRoutes);

router.use('/encounters', encounterRoutes);

router.use('/care-plans', carePlanRoutes);

router.use('/monitoring', monitoringRoutes);

// --- Tasks ---
router.use(
  '/tasks',
  methodAuth(canWriteTasks),
  maybeValidate(taskSchema),
  createPatientResourceRouter({
    model: Task,
    resourceType: 'Task',
    buildFilter: (req) => {
      const f: Record<string, unknown> = {};
      if (req.query.status) f.status = String(req.query.status);
      if (req.query.assigneeRole) f.assigneeRole = String(req.query.assigneeRole);
      if (req.query.dueBefore) f.dueDate = { $lte: new Date(String(req.query.dueBefore)) };
      return f;
    },
    populate: 'assigneeUserId',
    beforeUpdate: async (req, _body, doc) => {
      const user = req.user!;
      if (user.role === 'admin' || user.role === 'clinician') return;
      const task = doc as unknown as {
        assigneeRole: string;
        assigneeUserId?: { toString(): string };
      };
      const assignedToUser =
        task.assigneeUserId && task.assigneeUserId.toString() === user.id;
      if (task.assigneeRole !== user.role && !assignedToUser) {
        const err = new Error('You may only update tasks for your role') as Error & {
          status: number;
        };
        err.status = 403;
        throw err;
      }
    },
  })
);

// --- Allergies ---
router.use(
  '/allergies',
  methodAuth(canWriteAllergies),
  maybeValidate(allergySchema),
  createPatientResourceRouter({
    model: Allergy,
    resourceType: 'Allergy',
    buildFilter: (req) => (req.query.status ? { status: String(req.query.status) } : {}),
    sort: { recordedDate: -1 },
  })
);

// --- Notes (immutable revisions) ---
const notesRouter = Router({ mergeParams: true });
notesRouter.use(methodAuth(canWriteNotes));
notesRouter.use(maybeValidate(noteSchema));

notesRouter.get('/', async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req);
  const filter: Record<string, unknown> = {
    patientId: req.params.patientId,
    ...notDeleted,
  };
  if (req.query.encounterId) filter.encounterId = req.query.encounterId;
  const all = await ClinicalNote.find(filter)
    .populate('authorId', 'displayName role')
    .sort({ version: -1, createdAt: -1 });
  const seen = new Set<string>();
  const latest = [];
  for (const note of all) {
    const key = String(note.rootId);
    if (seen.has(key)) continue;
    seen.add(key);
    latest.push(note);
  }
  latest.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  res.json(paginated(latest.slice(skip, skip + limit), latest.length, page, limit));
});

notesRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const _id = new Types.ObjectId();
    const note = await ClinicalNote.create({
      _id,
      rootId: _id,
      patientId: req.params.patientId,
      encounterId: req.body.encounterId,
      authorId: req.user!.id,
      body: req.body.body,
      version: 1,
    });
    await note.populate('authorId', 'displayName role');
    await writeAudit(req, {
      action: 'create',
      resourceType: 'ClinicalNote',
      resourceId: String(note._id),
      patientId: String(req.params.patientId),
      after: note,
    });
    res.status(201).json(note);
  } catch (err) {
    next(err);
  }
});

notesRouter.get('/:id/revisions', async (req: Request, res: Response) => {
  const note = await ClinicalNote.findOne({
    _id: req.params.id,
    patientId: req.params.patientId,
    ...notDeleted,
  });
  if (!note) return res.status(404).json({ error: 'Not found' });
  const data = await ClinicalNote.find({
    patientId: req.params.patientId,
    rootId: note.rootId,
    ...notDeleted,
  })
    .populate('authorId', 'displayName role')
    .sort({ version: 1 });
  res.json({ data });
});

notesRouter.get('/:id', async (req: Request, res: Response) => {
  const note = await ClinicalNote.findOne({
    _id: req.params.id,
    patientId: req.params.patientId,
    ...notDeleted,
  }).populate('authorId', 'displayName role');
  if (!note) return res.status(404).json({ error: 'Not found' });
  res.json(note);
});

notesRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const current = await ClinicalNote.findOne({
      _id: req.params.id,
      patientId: req.params.patientId,
      ...notDeleted,
    });
    if (!current) return res.status(404).json({ error: 'Not found' });
    const latest = await ClinicalNote.findOne({
      patientId: req.params.patientId,
      rootId: current.rootId,
      ...notDeleted,
    }).sort({ version: -1 });
    const base = latest ?? current;
    const created = await ClinicalNote.create({
      patientId: req.params.patientId,
      encounterId:
        req.body.encounterId !== undefined ? req.body.encounterId : base.encounterId,
      authorId: req.user!.id,
      body: req.body.body,
      version: base.version + 1,
      rootId: base.rootId,
    });
    await created.populate('authorId', 'displayName role');
    await writeAudit(req, {
      action: 'update',
      resourceType: 'ClinicalNote',
      resourceId: String(created._id),
      patientId: String(req.params.patientId),
      before: base.toObject(),
      after: created.toObject(),
    });
    res.json(created);
  } catch (err) {
    next(err);
  }
});

notesRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const note = await ClinicalNote.findOne({
      _id: req.params.id,
      patientId: req.params.patientId,
      ...notDeleted,
    });
    if (!note) return res.status(404).json({ error: 'Not found' });
    const chain = await ClinicalNote.find({
      patientId: req.params.patientId,
      rootId: note.rootId,
      ...notDeleted,
    }).sort({ version: -1 });
    const before = chain[0]?.toObject() ?? note.toObject();
    await ClinicalNote.updateMany(
      { patientId: req.params.patientId, rootId: note.rootId, ...notDeleted },
      { $set: { deletedAt: new Date() } }
    );
    await writeAudit(req, {
      action: 'delete',
      resourceType: 'ClinicalNote',
      resourceId: String(note.rootId),
      patientId: String(req.params.patientId),
      before,
      after: null,
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.use('/notes', notesRouter);

router.get('/visits', authorize(...canReadClinical), async (req, res, next) => {
  try {
    const data = await listPatientVisits(String(req.params.patientId));
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

router.get('/appointments', authorize(...canReadClinical), async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req);
    const filter: Record<string, unknown> = { patientId: req.params.patientId };
    if (req.query.status) {
      const status = String(req.query.status);
      if (!APPOINTMENT_STATUSES.includes(status as (typeof APPOINTMENT_STATUSES)[number])) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      filter.status = status;
    }
    res.json(
      await listAppointments(filter, page, limit, skip, { startTime: -1 })
    );
  } catch (err) {
    next(err);
  }
});

export default router;
