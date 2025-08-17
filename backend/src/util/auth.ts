import type { FastifyReply, FastifyRequest } from 'fastify';
import { errorResponse, ERROR_MESSAGES } from './errorMessages.js';

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
