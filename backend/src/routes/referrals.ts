import { Router, Request, Response, NextFunction } from 'express';
import { authorize, canReadClinical, canWriteReferrals } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { parsePagination, paginated } from '../utils/pagination.js';
import { writeAudit } from '../services/auditService.js';
import { REFERRAL_AUDIT_EVENTS, REFERRAL_STATUSES, type ReferralStatus } from '../types/referrals.js';
import {
  referralCancelSchema,
  referralCreateSchema,
  referralDocumentSchema,
  referralFollowUpSchema,
  referralOutcomeSchema,
  referralStatusSchema,
} from '../validators/schemas.js';
import {
  addReferralDocument,
  addReferralOutcome,
  cancelReferral,
  changeReferralStatus,
  createReferral,
  getPresentedReferral,
  listReferrals,
  referralSummary,
  updateReferralFollowUp,
} from '../services/referralService.js';

const router = Router({ mergeParams: true });

function patientIdOf(req: Request) {
  return String(req.params.patientId);
}

function resourceId(referral: { _id: unknown }) {
  return String(referral._id);
}

router.get('/summary', authorize(...canReadClinical), async (req, res, next) => {
  try {
    res.json(await referralSummary(patientIdOf(req)));
  } catch (err) {
    next(err);
  }
});

router.get('/', authorize(...canReadClinical), async (req, res, next) => {
  try {
    let view: 'active' | 'completed' | 'follow_up' | undefined;
    if (req.query.view) {
      const value = String(req.query.view);
      if (value !== 'active' && value !== 'completed' && value !== 'follow_up') {
        return res.status(400).json({ error: 'Invalid view' });
      }
      view = value;
    }
    const status = req.query.status ? String(req.query.status) : undefined;
    if (status && !REFERRAL_STATUSES.includes(status as ReferralStatus)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const { page, limit, skip } = parsePagination(req);
    const { data, total } = await listReferrals(
      patientIdOf(req),
      {
        view,
        status: status as ReferralStatus | undefined,
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
  authorize(...canWriteReferrals),
  validateBody(referralCreateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await createReferral(patientIdOf(req), req.body, req.user!.id);
      await writeAudit(req, {
        action: 'create',
        resourceType: 'Referral',
        resourceId: resourceId(result.referral),
        patientId: patientIdOf(req),
        event: REFERRAL_AUDIT_EVENTS.created,
        after: result.after,
      });
      res.status(201).json(result.referral);
    } catch (err) {
      next(err);
    }
  }
);

router.get('/:id', authorize(...canReadClinical), async (req, res, next) => {
  try {
    res.json(await getPresentedReferral(String(req.params.id), patientIdOf(req)));
  } catch (err) {
    next(err);
  }
});

router.post(
  '/:id/status',
  authorize(...canWriteReferrals),
  validateBody(referralStatusSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await changeReferralStatus(
        String(req.params.id),
        patientIdOf(req),
        req.body,
        req.user!.id
      );
      await writeAudit(req, {
        action: 'update',
        resourceType: 'Referral',
        resourceId: resourceId(result.referral),
        patientId: patientIdOf(req),
        event: REFERRAL_AUDIT_EVENTS.statusChanged,
        before: result.before,
        after: result.after,
      });
      res.json(result.referral);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:id/cancel',
  authorize(...canWriteReferrals),
  validateBody(referralCancelSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await cancelReferral(String(req.params.id), patientIdOf(req), req.body, req.user!.id);
      await writeAudit(req, {
        action: 'update',
        resourceType: 'Referral',
        resourceId: resourceId(result.referral),
        patientId: patientIdOf(req),
        event: REFERRAL_AUDIT_EVENTS.cancelled,
        before: result.before,
        after: result.after,
      });
      res.json(result.referral);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:id/outcomes',
  authorize(...canWriteReferrals),
  validateBody(referralOutcomeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await addReferralOutcome(
        String(req.params.id),
        patientIdOf(req),
        req.body,
        req.user!.id
      );
      if (result.outcomeCreated && result.outcome) {
        await writeAudit(req, {
          action: result.previousOutcome ? 'update' : 'create',
          resourceType: 'ReferralOutcome',
          resourceId: String(result.outcome._id),
          patientId: patientIdOf(req),
          event: REFERRAL_AUDIT_EVENTS.outcomeUpdated,
          before: result.previousOutcome,
          after: result.outcome,
        });
        const receivedChanged =
          String(result.before?.outcomeReceivedDate ?? '') !== String(result.after.outcomeReceivedDate ?? '');
        const followUpChanged = result.before?.followUpRequired !== result.after.followUpRequired;
        if (receivedChanged || followUpChanged) {
          await writeAudit(req, {
            action: 'update',
            resourceType: 'Referral',
            resourceId: resourceId(result.referral),
            patientId: patientIdOf(req),
            event: REFERRAL_AUDIT_EVENTS.outcomeUpdated,
            before: result.before,
            after: result.after,
          });
        }
      } else {
        await writeAudit(req, {
          action: 'update',
          resourceType: 'Referral',
          resourceId: resourceId(result.referral),
          patientId: patientIdOf(req),
          event: REFERRAL_AUDIT_EVENTS.followUpUpdated,
          before: result.before,
          after: result.after,
        });
      }
      res.status(result.outcomeCreated ? 201 : 200).json(result.referral);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:id/documents',
  authorize(...canWriteReferrals),
  validateBody(referralDocumentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await addReferralDocument(
        String(req.params.id),
        patientIdOf(req),
        req.body,
        req.user!.id
      );
      await writeAudit(req, {
        action: 'create',
        resourceType: 'ReferralDocument',
        resourceId: String(result.document._id),
        patientId: patientIdOf(req),
        event: REFERRAL_AUDIT_EVENTS.documentAdded,
        after: result.document,
      });
      res.status(201).json(result.referral);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:id/follow-up',
  authorize(...canWriteReferrals),
  validateBody(referralFollowUpSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await updateReferralFollowUp(
        String(req.params.id),
        patientIdOf(req),
        req.body,
        req.user!.id
      );
      await writeAudit(req, {
        action: 'update',
        resourceType: 'Referral',
        resourceId: resourceId(result.referral),
        patientId: patientIdOf(req),
        event: REFERRAL_AUDIT_EVENTS.followUpUpdated,
        before: result.before,
        after: result.after,
      });
      res.json(result.referral);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
