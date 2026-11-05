import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { allowedOrigins, assertProductionEnv, config } from './config/env.js';
import { connectDb } from './config/db.js';
import { errorHandler, notFound } from './middleware/error.js';
import authRoutes from './routes/auth.js';
import patientRoutes from './routes/patients.js';
import clinicalRoutes from './routes/clinical.js';
import analyticsRoutes from './routes/analytics.js';
import reportRoutes from './routes/reports.js';
import appointmentRoutes from './routes/appointments.js';
import visitRoutes from './routes/visits.js';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

/** Vite build output, whether the process starts from the repo root or from backend/. */
function resolveFrontendDist() {
  const candidates = [
    path.resolve(moduleDir, '../../frontend/dist'),
    path.resolve(process.cwd(), 'frontend/dist'),
    path.resolve(process.cwd(), '../frontend/dist'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'index.html'))) return dir;
  }
  return null;
}

async function main() {
  assertProductionEnv();
  await connectDb();

  const app = express();
  if (config.nodeEnv === 'production') {
    app.set('trust proxy', 1);
  }

  const origins = allowedOrigins();
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || origins.includes(origin.replace(/\/$/, ''))) {
          callback(null, true);
          return;
        }
        callback(new Error(`Origin not allowed: ${origin}`));
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: '1mb' }));

  app.use(
    '/api/v1/auth/login',
    rateLimit({ windowMs: 15 * 60 * 1000, max: 50, standardHeaders: true })
  );

  app.get('/api/v1/health', (_req, res) => {
    res.json({ status: 'ok', service: 'clinix-core' });
  });

  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/patients', patientRoutes);
  app.use('/api/v1/patients/:patientId', clinicalRoutes);
  app.use('/api/v1/appointments', appointmentRoutes);
  app.use('/api/v1/visits', visitRoutes);
  app.use('/api/v1/analytics', analyticsRoutes);
  app.use('/api/v1/reports', reportRoutes);

  const frontendDist = resolveFrontendDist();
  if (config.nodeEnv === 'production' && !frontendDist) {
    console.error(
      'frontend/dist not found. The hosted site will have no UI. Build from the repo root with npm run build.'
    );
  }
  if (frontendDist) {
    app.use(express.static(frontendDist, { index: false }));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        next();
        return;
      }
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  }

  app.use(notFound);
  app.use(errorHandler);

  app.listen(config.port, '0.0.0.0', () => {
    const renderUrl = process.env.RENDER_EXTERNAL_URL;
    const where = renderUrl || `http://localhost:${config.port}`;
    console.log(`CliniX Core API listening on ${where}`);
    if (frontendDist) console.log(`Serving the clinic UI from ${frontendDist}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
