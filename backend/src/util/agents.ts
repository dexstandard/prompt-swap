import type { Logger } from 'pino';
import {
  getUserApiKeys,
  findIdenticalDraftAgent,
  findActiveTokenConflicts,
} from '../repos/agents.js';
import {
  errorResponse,
  lengthMessage,
  ERROR_MESSAGES,
} from './errorMessages.js';
import { fetchTokensBalanceUsd } from '../services/binance.js';
import { validateAllocations } from './allocations.js';

export enum AgentStatus {
  Active = 'active',
  Inactive = 'inactive',
  Draft = 'draft',
}

export interface AgentInput {
  userId: string;
  model: string;
  name: string;
  tokenA: string;
  tokenB: string;
  minTokenAAllocation: number;
  minTokenBAllocation: number;
  risk: string;
  reviewInterval: string;
  agentInstructions: string;
  status: AgentStatus;
}

export interface ValidationErr {
  code: number;
  body: unknown;
}

export function validateTokenConflicts(
  log: Logger,
  userId: string,
  tokenA: string,
  tokenB: string,
  id?: string,
): ValidationErr | null {
  const dupRows = findActiveTokenConflicts(userId, tokenA, tokenB, id);
  if (!dupRows.length) return null;
  const conflicts: { token: string; id: string; name: string }[] = [];
  for (const row of dupRows) {
    if (row.token_a === tokenA || row.token_b === tokenA)
      conflicts.push({ token: tokenA, id: row.id, name: row.name });
    if (row.token_a === tokenB || row.token_b === tokenB)
      conflicts.push({ token: tokenB, id: row.id, name: row.name });
  }
  const parts = conflicts.map((c) => `${c.token} used by ${c.name} (${c.id})`);
  const msg = `token${parts.length > 1 ? 's' : ''} ${parts.join(', ')} already used`;
  log.error('token conflict');
  return { code: 400, body: errorResponse(msg) };
}

function validateAgentInput(
  log: Logger,
  userId: string,
  body: AgentInput,
  id?: string,
): ValidationErr | null {
  if (body.userId !== userId) {
    log.error('user mismatch');
    return { code: 403, body: errorResponse(ERROR_MESSAGES.forbidden) };
  }
  if (body.model.length > 50) {
    log.error('model too long');
    return { code: 400, body: errorResponse(lengthMessage('model', 50)) };
  }
  if (body.status === AgentStatus.Draft) {
    const dupDraft = findIdenticalDraftAgent(
      {
        userId: body.userId,
        model: body.model,
        name: body.name,
        tokenA: body.tokenA,
        tokenB: body.tokenB,
        minTokenAAllocation: body.minTokenAAllocation,
        minTokenBAllocation: body.minTokenBAllocation,
        risk: body.risk,
        reviewInterval: body.reviewInterval,
        agentInstructions: body.agentInstructions,
      },
      id,
    );
    if (dupDraft) {
      log.error({ agentId: dupDraft.id }, 'identical draft exists');
      return {
        code: 400,
        body: errorResponse(
          `identical draft already exists: ${dupDraft.name} (${dupDraft.id})`,
        ),
      };
    }
  } else {
    const conflict = validateTokenConflicts(
      log,
      body.userId,
      body.tokenA,
      body.tokenB,
      id,
    );
    if (conflict) return conflict;
  }
  return null;
}

export function ensureApiKeys(
  log: Logger,
  userId: string,
): ValidationErr | null {
  const userRow = getUserApiKeys(userId);
  if (
    !userRow?.ai_api_key_enc ||
    !userRow.binance_api_key_enc ||
    !userRow.binance_api_secret_enc
  ) {
    log.error('missing api keys');
    return { code: 400, body: errorResponse('missing api keys') };
  }
  return null;
}

export async function getStartBalance(
  log: Logger,
  userId: string,
  tokenA: string,
  tokenB: string,
): Promise<number | ValidationErr> {
  try {
    const startBalance = await fetchTokensBalanceUsd(userId, [tokenA, tokenB]);
    if (startBalance === null) {
      log.error('failed to fetch balance');
      return { code: 500, body: errorResponse('failed to fetch balance') };
    }
    return startBalance;
  } catch {
    log.error('failed to fetch balance');
    return { code: 500, body: errorResponse('failed to fetch balance') };
  }
}

export async function prepareAgentForUpsert(
  log: Logger,
  userId: string,
  body: AgentInput,
  id?: string,
): Promise<{ body: AgentInput; startBalance: number | null } | ValidationErr> {
  let norm;
  try {
    norm = validateAllocations(
      body.minTokenAAllocation,
      body.minTokenBAllocation,
    );
  } catch {
    log.error('invalid allocations');
    return {
      code: 400,
      body: errorResponse('invalid minimum allocations'),
    };
  }
  body.minTokenAAllocation = norm.minTokenAAllocation;
  body.minTokenBAllocation = norm.minTokenBAllocation;
  const err = validateAgentInput(log, userId, body, id);
  if (err) return err;
  let startBalance: number | null = null;
  if (body.status === AgentStatus.Active) {
    const keyErr = ensureApiKeys(log, body.userId);
    if (keyErr) return keyErr;
    const bal = await getStartBalance(log, userId, body.tokenA, body.tokenB);
    if (typeof bal === 'number') startBalance = bal;
    else return bal;
  }
  return { body, startBalance };
}
