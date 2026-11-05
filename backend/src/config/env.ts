import dotenv from 'dotenv';

dotenv.config();

const DEV_JWT_SECRETS = new Set(['clinix-core-dev-secret', 'clinix-core-dev-secret-change-me']);

export const config = {
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/clinix_core',
  jwtSecret: process.env.JWT_SECRET || 'clinix-core-dev-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: (process.env.NODE_ENV || 'development') === 'development',
};

function normalizeOrigin(value: string | undefined) {
  if (!value) return null;
  let url = value.trim().replace(/\/$/, '');
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  return url.replace(/\/$/, '');
}

/** Browser origins allowed to call the API. Same-origin Render traffic uses RENDER_EXTERNAL_URL. */
export function allowedOrigins() {
  const origins = new Set<string>();
  const add = (value: string | undefined) => {
    const normalized = normalizeOrigin(value);
    if (normalized) origins.add(normalized);
  };

  add(config.clientOrigin);
  add(process.env.FRONTEND_URL);
  add(process.env.RENDER_EXTERNAL_URL);
  if (process.env.CORS_ORIGINS) {
    for (const origin of process.env.CORS_ORIGINS.split(',')) add(origin);
  }
  if (config.isDev) {
    origins.add('http://localhost:5173');
    origins.add('http://127.0.0.1:5173');
    origins.add(`http://localhost:${config.port}`);
    origins.add(`http://127.0.0.1:${config.port}`);
  }
  return [...origins];
}

/** Fail fast on Render when the database or signing key is still a local default. */
export function assertProductionEnv() {
  if (config.nodeEnv !== 'production') return;

  const missing: string[] = [];
  if (!process.env.MONGODB_URI) missing.push('MONGODB_URI');
  if (!process.env.JWT_SECRET) missing.push('JWT_SECRET');
  if (missing.length) {
    console.error(`Production requires: ${missing.join(', ')}`);
    process.exit(1);
  }

  if (DEV_JWT_SECRETS.has(process.env.JWT_SECRET || '')) {
    console.error('JWT_SECRET is still a development placeholder. Set a long random value before deploying.');
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI || '';
  if (uri.includes('127.0.0.1') || uri.includes('localhost')) {
    console.warn('MONGODB_URI points at localhost in production. Use MongoDB Atlas for the hosted demo.');
  }
}
