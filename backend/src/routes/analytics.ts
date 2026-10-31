import { Router, Request, Response } from 'express';
import { Vital } from '../models/Vital.js';
import { Patient } from '../models/Patient.js';
import { authenticate, authorize, canReadClinical } from '../middleware/auth.js';
import { isChartBypass, requireChartAccess } from '../middleware/chartAccess.js';
import { parsePagination, paginated, notDeleted } from '../utils/pagination.js';
import { buildPatientTimeline } from '../services/timelineService.js';

const router = Router();

router.use(authenticate, authorize(...canReadClinical));

router.get('/patients/:id/timeline', requireChartAccess('id'), async (req: Request, res: Response) => {
  const patient = await Patient.findOne({ _id: req.params.id, ...notDeleted });
  if (!patient) return res.status(404).json({ error: 'Patient not found' });

  const data = await buildPatientTimeline(String(patient._id));
  res.json({ data, total: data.length });
});

router.get('/cohort/vitals', async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req);
  const filter: Record<string, unknown> = { ...notDeleted };
  if (req.user && !isChartBypass(req.user.role)) {
    const ids = await Patient.find({ careTeam: req.user.id, ...notDeleted }).distinct('_id');
    filter.patientId = { $in: ids };
  }
  if (req.query.from || req.query.to) {
    const range: Record<string, Date> = {};
    if (req.query.from) range.$gte = new Date(String(req.query.from));
    if (req.query.to) range.$lte = new Date(String(req.query.to));
    filter.effectiveAt = range;
  }
  if (req.query.source) filter.source = String(req.query.source);

  const metric = req.query.metric ? String(req.query.metric) : undefined;
  if (metric) {
    filter[`measurements.${metric}`] = { $exists: true, $ne: null };
  }

  const [data, total] = await Promise.all([
    Vital.find(filter).sort({ effectiveAt: -1 }).skip(skip).limit(limit).lean(),
    Vital.countDocuments(filter),
  ]);
  res.json(paginated(data, total, page, limit));
});

export default router;
