import { Router, Request, Response, NextFunction } from 'express';
import { Patient } from '../models/Patient.js';
import { Condition } from '../models/Condition.js';
import { Medication } from '../models/Medication.js';
import { Order } from '../models/Order.js';
import { ACTIVE_ORDER_STATUSES } from '../types/orders.js';
import { Referral } from '../models/Referral.js';
import { ACTIVE_REFERRAL_STATUSES } from '../types/referrals.js';
import { Vital } from '../models/Vital.js';
import { monitoringCounts } from '../services/monitoringService.js';
import { User } from '../models/User.js';
import {
  authenticate,
  authorize,
  canReadClinical,
  canWritePatients,
} from '../middleware/auth.js';
import { isChartBypass, requireChartAccess } from '../middleware/chartAccess.js';
import { validateBody } from '../middleware/validate.js';
import { patientSchema, patientUpdateSchema } from '../validators/schemas.js';
import { parsePagination, paginated, notDeleted } from '../utils/pagination.js';
import { writeAudit } from '../services/auditService.js';

const router = Router();

router.use(authenticate);

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function knownUserIds(ids: string[]) {
  const unique = Array.from(new Set(ids));
  if (unique.length === 0) return unique;
  const found = await User.countDocuments({ _id: { $in: unique } });
  if (found !== unique.length) {
    const err = new Error('One or more care team members do not exist') as Error & {
      status: number;
    };
    err.status = 400;
    throw err;
  }
  return unique;
}

router.get('/', authorize(...canReadClinical), async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req);
  const filter: Record<string, unknown> = { ...notDeleted };
  if (req.user && !isChartBypass(req.user.role)) {
    filter.careTeam = req.user.id;
  }
  if (req.query.sex) filter.sex = req.query.sex;

  const and: Record<string, unknown>[] = [];

  // Free-text: MRN, legal/preferred name, health card number
  if (req.query.q) {
    const q = escapeRegex(String(req.query.q).trim());
    const digits = String(req.query.q).replace(/[\s-]/g, '');
    and.push({
      $or: [
        { mrn: new RegExp(q, 'i') },
        { givenName: new RegExp(q, 'i') },
        { familyName: new RegExp(q, 'i') },
        { preferredName: new RegExp(q, 'i') },
        { 'provincialHealth.healthCardNumber': new RegExp(escapeRegex(digits), 'i') },
      ],
    });
  }

  // Explicit lookup fields
  if (req.query.mrn) {
    and.push({ mrn: new RegExp(`^${escapeRegex(String(req.query.mrn).trim())}`, 'i') });
  }
  if (req.query.healthCardNumber) {
    const hcn = String(req.query.healthCardNumber).replace(/[\s-]/g, '');
    and.push({
      'provincialHealth.healthCardNumber': new RegExp(`^${escapeRegex(hcn)}`, 'i'),
    });
  }
  if (req.query.name) {
    const name = escapeRegex(String(req.query.name).trim());
    and.push({
      $or: [
        { givenName: new RegExp(name, 'i') },
        { familyName: new RegExp(name, 'i') },
        { preferredName: new RegExp(name, 'i') },
      ],
    });
  }
  if (req.query.birthDate) {
    const raw = String(req.query.birthDate).trim();
    const day = new Date(raw);
    if (!Number.isNaN(day.getTime())) {
      const start = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);
      and.push({ birthDate: { $gte: start, $lt: end } });
    }
  }

  if (and.length) filter.$and = and;

  const [data, total] = await Promise.all([
    Patient.find(filter).sort({ familyName: 1, givenName: 1 }).skip(skip).limit(limit),
    Patient.countDocuments(filter),
  ]);
  res.json(paginated(data, total, page, limit));
});

router.post(
  '/',
  authorize(...canWritePatients),
  validateBody(patientSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let careTeam: string[] = Array.isArray(req.body.careTeam) ? req.body.careTeam : [];
      if (req.user && req.user.role !== 'admin') {
        careTeam = Array.from(new Set([...careTeam, req.user.id]));
      }
      careTeam = await knownUserIds(careTeam);
      const patient = await Patient.create({ ...req.body, careTeam });
      await writeAudit(req, {
        action: 'create',
        resourceType: 'Patient',
        resourceId: String(patient._id),
        patientId: String(patient._id),
        after: patient,
      });
      res.status(201).json(patient);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:id',
  authorize(...canReadClinical),
  requireChartAccess('id'),
  async (req: Request, res: Response) => {
    const patient = req.chartPatient!;
    await patient.populate('careTeam', 'displayName email role');

    const [activeConditions, activeMeds, activeOrders, activeReferrals, followUpReferrals, latestVital, monitoring] =
      await Promise.all([
        Condition.countDocuments({ patientId: patient._id, status: 'active', ...notDeleted }),
        Medication.countDocuments({ patientId: patient._id, status: 'active', ...notDeleted }),
        Order.countDocuments({
          patientId: patient._id,
          status: { $in: [...ACTIVE_ORDER_STATUSES] },
          ...notDeleted,
        }),
        Referral.countDocuments({
          patientId: patient._id,
          status: { $in: [...ACTIVE_REFERRAL_STATUSES] },
          ...notDeleted,
        }),
        Referral.countDocuments({
          patientId: patient._id,
          followUpRequired: true,
          status: { $nin: ['cancelled', 'closed', 'draft'] },
          ...notDeleted,
        }),
        Vital.findOne({ patientId: patient._id, ...notDeleted }).sort({ effectiveAt: -1 }),
        monitoringCounts(String(patient._id)),
      ]);

    res.json({
      ...patient.toObject(),
      summary: {
        activeConditions,
        activeMedications: activeMeds,
        activeOrders,
        activeReferrals,
        followUpReferrals,
        activeMonitoring: monitoring.activePrograms,
        overdueRecalls: monitoring.overdueRecalls,
        latestVital,
      },
    });
  }
);

router.patch(
  '/:id',
  authorize(...canWritePatients),
  requireChartAccess('id'),
  validateBody(patientUpdateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patient = req.chartPatient!;
      if (req.user && req.user.role !== 'admin' && Array.isArray(req.body.careTeam)) {
        const ids = req.body.careTeam.map(String);
        if (!ids.includes(req.user.id)) {
          return res.status(400).json({
            error: 'You cannot remove yourself from the care team',
          });
        }
      }
      if (Array.isArray(req.body.careTeam)) {
        req.body.careTeam = await knownUserIds(req.body.careTeam.map(String));
      }
      const before = patient.toObject();
      Object.assign(patient, req.body);
      await patient.save();
      await writeAudit(req, {
        action: 'update',
        resourceType: 'Patient',
        resourceId: String(patient._id),
        patientId: String(patient._id),
        before,
        after: patient.toObject(),
      });
      await patient.populate('careTeam', 'displayName email role');
      res.json(patient);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
