import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config/env.js';
import { connectDb } from './config/db.js';
import { errorHandler, notFound } from './middleware/error.js';
import authRoutes from './routes/auth.js';
import patientRoutes from './routes/patients.js';
import clinicalRoutes from './routes/clinical.js';
import analyticsRoutes from './routes/analytics.js';
import reportRoutes from './routes/reports.js';
import appointmentRoutes from './routes/appointments.js';
import visitRoutes from './routes/visits.js';

async function main() {
  await connectDb();

  const app = express();
  app.use(helmet());
  app.use(
    cors({
      origin: [config.clientOrigin, 'http://localhost:5173'],
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

  app.use(notFound);
  app.use(errorHandler);

  app.listen(config.port, () => {
    console.log(`CliniX Core API listening on http://localhost:${config.port}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
