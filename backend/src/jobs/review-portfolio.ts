import type { FastifyBaseLogger } from 'fastify';
import { randomUUID } from 'node:crypto';
import { db } from '../db/index.js';
import { env } from '../util/env.js';
import { decrypt } from '../util/crypto.js';
import { getActiveAgents } from '../repos/agents.js';
import { callAi } from '../util/ai.js';
import { fetchAccount } from '../services/binance.js';

export default async function reviewPortfolio(
  log: FastifyBaseLogger,
  agentId?: string,
): Promise<void> {
  const rows = getActiveAgents(agentId);
  await Promise.all(
    rows.map(async (row) => {
      const execLogId = randomUUID();
      const childLog = log.child({
        userId: row.user_id,
        agentId: row.id,
        execLogId,
      });
      try {
        const key = decrypt(row.ai_api_key_enc, env.KEY_PASSWORD);
        let tokenABalance: number | undefined;
        let tokenBBalance: number | undefined;
        try {
          const account = await fetchAccount(row.user_id);
          if (account) {
            const balA = account.balances.find((b) => b.asset === row.token_a);
            if (balA)
              tokenABalance = Number(balA.free) + Number(balA.locked);
            const balB = account.balances.find((b) => b.asset === row.token_b);
            if (balB)
              tokenBBalance = Number(balB.free) + Number(balB.locked);
          }
        } catch (err) {
          childLog.error({ err }, 'failed to fetch balance');
        }
        if (tokenABalance === undefined || tokenBBalance === undefined) {
          const msg = 'failed to fetch token balances';
          db.prepare(
            'INSERT INTO agent_exec_log (id, agent_id, log, created_at) VALUES (?, ?, ?, ?)',
          ).run(execLogId, row.id, JSON.stringify({ error: msg }), Date.now());
          childLog.error({ err: msg }, 'agent run failed');
          return;
        }
        const prompt = {
          instructions: row.agent_instructions,
          tokenA: row.token_a,
          tokenB: row.token_b,
          tokenABalance,
          tokenBBalance,
          minTokenAAllocation: row.min_a_allocation,
          minTokenBAllocation: row.min_b_allocation,
          risk: row.risk,
          reviewInterval: row.review_interval,
        };
        const prevRows = db
          .prepare(
            'SELECT log FROM agent_exec_log WHERE agent_id = ? ORDER BY created_at DESC LIMIT 5',
          )
          .all(row.id) as { log: string }[];
        const previousResponses = prevRows.map((r) => r.log);
        const text = await callAi(row.model, prompt, key, previousResponses);
        db.prepare(
          'INSERT INTO agent_exec_log (id, agent_id, log, created_at) VALUES (?, ?, ?, ?)',
        ).run(execLogId, row.id, text, Date.now());
        childLog.info('agent run complete');
      } catch (err) {
        db.prepare(
          'INSERT INTO agent_exec_log (id, agent_id, log, created_at) VALUES (?, ?, ?, ?)',
        ).run(execLogId, row.id, JSON.stringify({ error: String(err) }), Date.now());
        childLog.error({ err }, 'agent run failed');
      }
    }),
  );
}
