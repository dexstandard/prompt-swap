import type { FastifyBaseLogger } from 'fastify';
import { randomUUID } from 'node:crypto';
import { env } from '../util/env.js';
import { decrypt } from '../util/crypto.js';
import { getActiveAgents } from '../repos/agents.js';
import { insertExecLog } from '../repos/agent-exec-log.js';
import { insertExecResult, getRecentExecResults } from '../repos/agent-exec-result.js';
import { parseExecLog } from '../util/parse-exec-log.js';
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
      let prompt: Record<string, unknown> | undefined;
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
          const createdAt = Date.now();
          insertExecLog({
            id: execLogId,
            agentId: row.id,
            response: { error: msg },
            createdAt,
          });
          const parsed = parseExecLog({ error: msg });
          insertExecResult({
            id: execLogId,
            agentId: row.id,
            log: parsed.text,
            ...(parsed.response
              ? {
                  rebalance: parsed.response.rebalance,
                  newAllocation: parsed.response.newAllocation,
                  shortReport: parsed.response.shortReport,
                }
              : {}),
            ...(parsed.error ? { error: parsed.error } : {}),
            createdAt,
          });
          childLog.error({ err: msg }, 'agent run failed');
          return;
        }
        let marketData;
        try {
          marketData = await fetchPairData(row.token_a, row.token_b);
          const [priceAData, priceBData] = await Promise.all([
            row.token_a === 'USDT'
              ? Promise.resolve({ currentPrice: 1 })
              : fetchPairData(row.token_a, 'USDT'),
            row.token_b === 'USDT'
              ? Promise.resolve({ currentPrice: 1 })
              : fetchPairData(row.token_b, 'USDT'),
          ]);
          const priceA = priceAData.currentPrice;
          const priceB = priceBData.currentPrice;
          const valueA = tokenABalance * priceA;
          const valueB = tokenBBalance * priceB;
          const totalValue = valueA + valueB;
          const floors: Record<string, number> = {
            [row.token_a]: row.min_a_allocation / 100,
            [row.token_b]: row.min_b_allocation / 100,
          };
          const positions = [
            {
              sym: row.token_a,
              qty: tokenABalance,
              price_usdt: priceA,
              value_usdt: valueA,
            },
            {
              sym: row.token_b,
              qty: tokenBBalance,
              price_usdt: priceB,
              value_usdt: valueB,
            },
          ];
          const weights: Record<string, number> = {
            [row.token_a]: totalValue ? valueA / totalValue : 0,
            [row.token_b]: totalValue ? valueB / totalValue : 0,
          };
          prompt = {
            instructions: row.agent_instructions,
            config: {
              policy: { floors },
              portfolio: {
                ts: new Date().toISOString(),
                positions,
                weights,
              },
            },
            marketData,
          };
        } catch (err) {
          const msg = 'failed to fetch market data';
          const createdAt = Date.now();
          insertExecLog({
            id: execLogId,
            agentId: row.id,
            response: { error: msg },
            createdAt,
          });
          const parsed = parseExecLog({ error: msg });
          insertExecResult({
            id: execLogId,
            agentId: row.id,
            log: parsed.text,
            ...(parsed.response
              ? {
                  rebalance: parsed.response.rebalance,
                  newAllocation: parsed.response.newAllocation,
                  shortReport: parsed.response.shortReport,
                }
              : {}),
            ...(parsed.error ? { error: parsed.error } : {}),
            createdAt,
          });
          childLog.error({ err }, 'agent run failed');
          return;
        }
        const prevRows = getRecentExecResults(row.id, 5);
        const previousResponses = prevRows.map((r) => {
          const str = JSON.stringify(r);
          return str === '{}' ? '' : str;
        });
        const text = await callAi(row.model, prompt, key, previousResponses);
        const createdAt = Date.now();
        insertExecLog({
          id: execLogId,
          agentId: row.id,
          prompt,
          response: text,
          createdAt,
        });
        const parsed = parseExecLog(text);
        insertExecResult({
          id: execLogId,
          agentId: row.id,
          log: parsed.text,
          ...(parsed.response
            ? {
                rebalance: parsed.response.rebalance,
                newAllocation: parsed.response.newAllocation,
                shortReport: parsed.response.shortReport,
              }
            : {}),
          ...(parsed.error ? { error: parsed.error } : {}),
          createdAt,
        });
        childLog.info('agent run complete');
      } catch (err) {
        const createdAt = Date.now();
        insertExecLog({
          id: execLogId,
          agentId: row.id,
          ...(prompt ? { prompt } : {}),
          response: { error: String(err) },
          createdAt,
        });
        const parsed = parseExecLog({ error: String(err) });
        insertExecResult({
          id: execLogId,
          agentId: row.id,
          log: parsed.text,
          ...(parsed.response
            ? {
                rebalance: parsed.response.rebalance,
                newAllocation: parsed.response.newAllocation,
                shortReport: parsed.response.shortReport,
              }
            : {}),
          ...(parsed.error ? { error: parsed.error } : {}),
          createdAt,
        });
        childLog.error({ err }, 'agent run failed');
      }
    }),
  );
}
