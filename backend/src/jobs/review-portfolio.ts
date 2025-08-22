import type { FastifyBaseLogger } from 'fastify';
import { randomUUID } from 'node:crypto';
import { env } from '../util/env.js';
import { decrypt } from '../util/crypto.js';
import { getActiveAgents } from '../repos/agents.js';
import { insertExecLog, getRecentExecLogs } from '../repos/agent-exec-log.js';
import { callAi } from '../util/ai.js';
import { fetchAccount, fetchPairData } from '../services/binance.js';

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
          insertExecLog({
            id: execLogId,
            agentId: row.id,
            log: JSON.stringify({ error: msg }),
            createdAt: Date.now(),
          });
          childLog.error({ err: msg }, 'agent run failed');
          return;
        }
        let marketData;
        try {
          marketData = await fetchPairData(row.token_a, row.token_b);
        } catch (err) {
          const msg = 'failed to fetch market data';
          insertExecLog({
            id: execLogId,
            agentId: row.id,
            log: JSON.stringify({ error: msg }),
            createdAt: Date.now(),
          });
          childLog.error({ err }, 'agent run failed');
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
          marketData,
        };
        const prevRows = getRecentExecLogs(row.id, 5);
        const previousResponses = prevRows.map((r) => r.log);
        const text = await callAi(row.model, prompt, key, previousResponses);
        insertExecLog({
          id: execLogId,
          agentId: row.id,
          log: text,
          createdAt: Date.now(),
        });
        childLog.info('agent run complete');
      } catch (err) {
        insertExecLog({
          id: execLogId,
          agentId: row.id,
          log: JSON.stringify({ error: String(err) }),
          createdAt: Date.now(),
        });
        childLog.error({ err }, 'agent run failed');
      }
    }),
  );
}
