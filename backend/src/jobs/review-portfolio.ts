import type { FastifyBaseLogger } from 'fastify';
import { randomUUID } from 'node:crypto';
import { db } from '../db/index.js';
import { env } from '../util/env.js';
import { decrypt } from '../util/crypto.js';
import { getActiveAgents } from '../repos/agents.js';
import { callAi } from '../util/ai.js';

export default async function reviewPortfolio(
  log: FastifyBaseLogger,
  agentId?: string,
): Promise<void> {
  const rows = getActiveAgents(agentId);
  await Promise.all(
    rows.map(async (row) => {
      try {
        const key = decrypt(row.ai_api_key_enc, env.KEY_PASSWORD);
        const prompt = {
          instructions: row.agent_instructions,
          tokenA: row.token_a,
          tokenB: row.token_b,
          targetAllocation: row.target_allocation,
          minTokenAAllocation: row.min_a_allocation,
          minTokenBAllocation: row.min_b_allocation,
          risk: row.risk,
          reviewInterval: row.review_interval,
        };
        const text = await callAi(row.model, prompt, key);
        db.prepare(
          'INSERT INTO agent_exec_log (id, agent_id, log, created_at) VALUES (?, ?, ?, ?)',
        ).run(randomUUID(), row.id, text, Date.now());
        log.info({ agentId: row.id }, 'agent run complete');
      } catch (err) {
        log.error({ err, agentId: row.id }, 'agent run failed');
      }
    }),
  );
}
