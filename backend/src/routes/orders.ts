import { Router, Request, Response, NextFunction } from 'express';
import { authorize, canReadClinical, canWriteOrders } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { parsePagination, paginated } from '../utils/pagination.js';
import { writeAudit } from '../services/auditService.js';
import { ORDER_AUDIT_EVENTS, ORDER_STATUSES, type OrderStatus } from '../types/orders.js';
import { orderCancelSchema, orderCreateSchema, orderResultSchema, orderStatusSchema } from '../validators/schemas.js';
import {
  addOrderResult,
  cancelOrder,
  changeOrderStatus,
  createOrder,
  getPresentedOrder,
  listOrderingClinicians,
  listOrders,
  listPatientResults,
  orderSummary,
} from '../services/orderService.js';

const router = Router({ mergeParams: true });

function patientIdOf(req: Request) {
  return String(req.params.patientId);
}

function resourceId(order: { _id: unknown }) {
  return String(order._id);
}

router.get('/summary', authorize(...canReadClinical), async (req, res, next) => {
  try {
    res.json(await orderSummary(patientIdOf(req)));
  } catch (err) {
    next(err);
  }
});

router.get('/clinicians', authorize(...canReadClinical), async (_req, res, next) => {
  try {
    res.json({ data: await listOrderingClinicians() });
  } catch (err) {
    next(err);
  }
});

router.get('/results', authorize(...canReadClinical), async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req);
    const { data, total } = await listPatientResults(patientIdOf(req), skip, limit);
    res.json(paginated(data, total, page, limit));
  } catch (err) {
    next(err);
  }
});

router.get('/', authorize(...canReadClinical), async (req, res, next) => {
  try {
    let view: 'active' | 'completed' | undefined;
    if (req.query.view) {
      const value = String(req.query.view);
      if (value !== 'active' && value !== 'completed') {
        return res.status(400).json({ error: 'Invalid view' });
      }
      view = value;
    }
    const status = req.query.status ? String(req.query.status) : undefined;
    if (status && !ORDER_STATUSES.includes(status as OrderStatus)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const { page, limit, skip } = parsePagination(req);
    const { data, total } = await listOrders(
      patientIdOf(req),
      {
        view,
        status: status as OrderStatus | undefined,
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
  authorize(...canWriteOrders),
  validateBody(orderCreateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await createOrder(patientIdOf(req), req.body, req.user!.id);
      await writeAudit(req, {
        action: 'create',
        resourceType: 'Order',
        resourceId: resourceId(result.order),
        patientId: patientIdOf(req),
        event: ORDER_AUDIT_EVENTS.created,
        after: result.after,
      });
      res.status(201).json(result.order);
    } catch (err) {
      next(err);
    }
  }
);

router.get('/:id', authorize(...canReadClinical), async (req, res, next) => {
  try {
    res.json(await getPresentedOrder(String(req.params.id), patientIdOf(req)));
  } catch (err) {
    next(err);
  }
});

router.post(
  '/:id/status',
  authorize(...canWriteOrders),
  validateBody(orderStatusSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await changeOrderStatus(String(req.params.id), patientIdOf(req), req.body, req.user!.id);
      await writeAudit(req, {
        action: 'update',
        resourceType: 'Order',
        resourceId: resourceId(result.order),
        patientId: patientIdOf(req),
        event: ORDER_AUDIT_EVENTS.statusChanged,
        before: result.before,
        after: result.after,
      });
      res.json(result.order);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:id/cancel',
  authorize(...canWriteOrders),
  validateBody(orderCancelSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await cancelOrder(String(req.params.id), patientIdOf(req), req.body, req.user!.id);
      await writeAudit(req, {
        action: 'update',
        resourceType: 'Order',
        resourceId: resourceId(result.order),
        patientId: patientIdOf(req),
        event: ORDER_AUDIT_EVENTS.cancelled,
        before: result.before,
        after: result.after,
      });
      res.json(result.order);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:id/results',
  authorize(...canWriteOrders),
  validateBody(orderResultSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await addOrderResult(String(req.params.id), patientIdOf(req), req.body, req.user!.id);
      await writeAudit(req, {
        action: 'create',
        resourceType: 'OrderResult',
        resourceId: String((result.result as { _id?: unknown })._id),
        patientId: patientIdOf(req),
        event: ORDER_AUDIT_EVENTS.resultEntered,
        after: result.result,
      });
      if (result.statusChanged) {
        await writeAudit(req, {
          action: 'update',
          resourceType: 'Order',
          resourceId: resourceId(result.order),
          patientId: patientIdOf(req),
          event: ORDER_AUDIT_EVENTS.statusChanged,
          before: result.before,
          after: result.after,
        });
      }
      res.status(201).json(result.order);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
