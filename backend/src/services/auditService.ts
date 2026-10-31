import { Request } from 'express';
import { AuditEvent, type AuditAction } from '../models/AuditEvent.js';

function snapshot(value: unknown): unknown {
  if (value == null) return null;
  const record =
    typeof value === 'object' &&
    'toObject' in value &&
    typeof (value as { toObject: () => unknown }).toObject === 'function'
      ? (value as { toObject: () => Record<string, unknown> }).toObject()
      : value;
  if (!record || typeof record !== 'object') return record;
  const clone = { ...(record as Record<string, unknown>) };
  delete clone.passwordHash;
  return clone;
}

export async function writeAudit(
  req: Request,
  entry: {
    action: AuditAction;
    resourceType: string;
    resourceId: string;
    patientId?: string;
    before?: unknown;
    after?: unknown;
    event?: string;
  }
) {
  if (!req.user) return;
  await AuditEvent.create({
    userId: req.user.id,
    role: req.user.role,
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId,
    patientId: entry.patientId,
    before: snapshot(entry.before),
    after: snapshot(entry.after),
    event: entry.event,
    timestamp: new Date(),
  });
}
