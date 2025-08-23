import type { FastifyReply, FastifyRequest } from 'fastify';
import { errorResponse, ERROR_MESSAGES } from './errorMessages.js';
import { getUser } from '../repos/users.js';

export function requireUserId(
  req: FastifyRequest,
  reply: FastifyReply
): string | null {
  const userId = req.headers['x-user-id'] as string | undefined;
  if (!userId) {
    reply.code(403).send(errorResponse(ERROR_MESSAGES.forbidden));
    return null;
  }
  return userId;
}

export function requireAdmin(
  req: FastifyRequest,
  reply: FastifyReply
): string | null {
  const userId = requireUserId(req, reply);
  if (!userId) return null;
  const row = getUser(userId);
  if (!row || row.role !== 'admin' || !row.is_enabled) {
    reply.code(403).send(errorResponse(ERROR_MESSAGES.forbidden));
    return null;
  }
  return userId;
}

export function requireUserIdMatch(
  req: FastifyRequest,
  reply: FastifyReply,
  id: string,
): string | null {
  const userId = requireUserId(req, reply);
  if (!userId) return null;
  if (userId !== id) {
    reply.code(403).send(errorResponse(ERROR_MESSAGES.forbidden));
    return null;
  }
  return userId;
}
