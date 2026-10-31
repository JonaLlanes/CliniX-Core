import { Request } from 'express';

export function parsePagination(req: Request) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export function paginated<T>(data: T[], total: number, page: number, limit: number) {
  return { data, page, limit, total };
}

export const notDeleted = { deletedAt: null };
