import { Request, Response, NextFunction } from 'express';

export class HttpError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  console.error(err);
  if (err && typeof err === 'object' && 'code' in err && (err as { code: number }).code === 11000) {
    return res.status(400).json({ error: 'Duplicate key', details: err });
  }
  const status =
    err && typeof err === 'object' && 'status' in err
      ? Number((err as { status: number }).status)
      : 500;
  const message = err instanceof Error ? err.message : 'Internal server error';
  const details =
    err && typeof err === 'object' && 'details' in err
      ? (err as { details?: unknown }).details
      : undefined;
  const body: { error: string; details?: unknown } = { error: message };
  if (details !== undefined) body.details = details;
  res.status(status >= 400 && status < 600 ? status : 500).json(body);
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: 'Not found' });
}
