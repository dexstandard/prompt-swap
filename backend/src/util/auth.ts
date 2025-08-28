import type { FastifyReply, FastifyRequest } from 'fastify';
import { errorResponse, ERROR_MESSAGES } from './errorMessages.js';
import { getUser } from '../repos/users.js';

export function requireUserId(
  req: FastifyRequest,
  reply: FastifyReply
): number | null {
  const userIdHeader = req.headers['x-user-id'] as string | undefined;
  if (!userIdHeader) {
    reply.code(403).send(errorResponse(ERROR_MESSAGES.forbidden));
    return null;
  }
  const userId = Number(userIdHeader);
  if (!Number.isFinite(userId)) {
    reply.code(403).send(errorResponse(ERROR_MESSAGES.forbidden));
    return null;
  }
  return userId;
}

export async function requireAdmin(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<number | null> {
  const userId = requireUserId(req, reply);
  if (!userId) return null;
  const row = await getUser(userId);
  if (!row || row.role !== 'admin' || !row.is_enabled) {
    reply.code(403).send(errorResponse(ERROR_MESSAGES.forbidden));
    return null;
  }
  return userId;
}

export function requireUserIdMatch(
  req: FastifyRequest,
  reply: FastifyReply,
  id: number,
): number | null {
  const userId = requireUserId(req, reply);
  if (!userId) return null;
  if (userId !== id) {
    reply.code(403).send(errorResponse(ERROR_MESSAGES.forbidden));
    return null;
  }
  return userId;
}
