import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize, canReadPopulationReports } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import {
  clinicalDashboard,
  medicationMetrics,
  monitoringMetrics,
  operationalDashboard,
  orderMetrics,
  referralMetrics,
} from '../services/reporting/dashboardService.js';
import { cohortDashboard } from '../services/reporting/cohortService.js';
import { openExport, sendCsv } from '../services/reporting/exportService.js';
import { resolveReportRange } from '../services/reporting/range.js';

const router = Router();

router.use(authenticate, authorize(...canReadPopulationReports));
router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

router.get('/operational', handler(async (req, res) => {
  res.json(await operationalDashboard(resolveReportRange(queryOf(req))));
}));

router.get('/clinical', handler(async (req, res) => {
  res.json(await clinicalDashboard(resolveReportRange(queryOf(req))));
}));

router.get('/cohorts', handler(async (req, res) => {
  res.json(await cohortDashboard(resolveReportRange(queryOf(req))));
}));

router.get('/referrals', handler(async (req, res) => {
  res.json(await referralMetrics(resolveReportRange(queryOf(req))));
}));

router.get('/orders', handler(async (req, res) => {
  res.json(await orderMetrics(resolveReportRange(queryOf(req))));
}));

router.get('/medications', handler(async (req, res) => {
  res.json(await medicationMetrics(resolveReportRange(queryOf(req))));
}));

router.get('/monitoring', handler(async (req, res) => {
  res.json(await monitoringMetrics(resolveReportRange(queryOf(req))));
}));

router.get('/export/:kind', handler(async (req, res) => {
  const range = resolveReportRange(queryOf(req));
  const exp = await openExport(String(req.params.kind), range);
  if (!exp) throw new HttpError(404, 'Unknown export');
  await sendCsv(res, exp);
}));

function queryOf(req: Request) {
  return req.query as Record<string, unknown>;
}

function handler(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch((err) => {
      if (res.headersSent) {
        res.end();
        return;
      }
      next(err);
    });
  };
}

export default router;
