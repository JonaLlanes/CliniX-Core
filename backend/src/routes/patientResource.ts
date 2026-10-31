import { Router, Request, Response, NextFunction } from 'express';
import { Model, type PopulateOptions } from 'mongoose';
import { parsePagination, paginated, notDeleted } from '../utils/pagination.js';
import { writeAudit } from '../services/auditService.js';
import type { AuditAction } from '../models/AuditEvent.js';

type SoftDeletable = { deletedAt?: Date | null };

type AuditEntry = {
  action: AuditAction;
  event?: string;
  before?: unknown;
  after?: unknown;
};

export function createPatientResourceRouter<T extends SoftDeletable>(options: {
  model: Model<T>;
  resourceType: string;
  buildFilter?: (req: Request) => Record<string, unknown>;
  beforeCreate?: (req: Request, body: Record<string, unknown>) => void | Promise<void>;
  beforeUpdate?: (req: Request, body: Record<string, unknown>, doc: T) => void | Promise<void>;
  populate?: string | PopulateOptions | Array<string | PopulateOptions>;
  sort?: Record<string, 1 | -1>;
  auditEntries?: (
    action: AuditAction,
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null
  ) => AuditEntry[];
}) {
  const router = Router({ mergeParams: true });
  const { model, resourceType, buildFilter, beforeCreate, beforeUpdate, populate, sort, auditEntries } =
    options;

  async function recordAudit(
    req: Request,
    action: AuditAction,
    resourceId: string,
    before: unknown,
    after: unknown
  ) {
    const patientId = String(req.params.patientId);
    if (!auditEntries) {
      await writeAudit(req, { action, resourceType, resourceId, patientId, before, after });
      return;
    }
    const entries = auditEntries(
      action,
      (before as Record<string, unknown> | null) ?? null,
      (after as Record<string, unknown> | null) ?? null
    );
    for (const entry of entries) {
      await writeAudit(req, {
        action: entry.action,
        resourceType,
        resourceId,
        patientId,
        event: entry.event,
        before: entry.before,
        after: entry.after,
      });
    }
  }

  router.get('/', async (req: Request, res: Response) => {
    const { page, limit, skip } = parsePagination(req);
    const filter = {
      patientId: req.params.patientId,
      ...notDeleted,
      ...(buildFilter?.(req) || {}),
    };
    let query = model.find(filter).sort(sort || { createdAt: -1 }).skip(skip).limit(limit);
    if (populate) query = query.populate(populate as unknown as PopulateOptions);
    const [data, total] = await Promise.all([query.exec(), model.countDocuments(filter)]);
    res.json(paginated(data, total, page, limit));
  });

  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = { ...req.body, patientId: req.params.patientId };
      if (beforeCreate) await beforeCreate(req, body);
      const doc = await model.create(body);
      await recordAudit(req, 'create', String(doc._id), null, doc.toObject());
      res.status(201).json(doc);
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', async (req: Request, res: Response) => {
    let query = model.findOne({
      _id: req.params.id,
      patientId: req.params.patientId,
      ...notDeleted,
    });
    if (populate) query = query.populate(populate as unknown as PopulateOptions);
    const doc = await query.exec();
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  });

  router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await model.findOne({
        _id: req.params.id,
        patientId: req.params.patientId,
        ...notDeleted,
      });
      if (!existing) return res.status(404).json({ error: 'Not found' });
      const before = existing.toObject();
      const body = { ...req.body };
      delete body.patientId;
      if (beforeUpdate) await beforeUpdate(req, body, existing);
      Object.assign(existing, body);
      await existing.save();
      await recordAudit(req, 'update', String(existing._id), before, existing.toObject());
      res.json(existing);
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await model.findOne({
        _id: req.params.id,
        patientId: req.params.patientId,
        ...notDeleted,
      });
      if (!existing) return res.status(404).json({ error: 'Not found' });
      const before = existing.toObject();
      existing.deletedAt = new Date();
      await existing.save();
      await recordAudit(req, 'delete', String(existing._id), before, null);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
