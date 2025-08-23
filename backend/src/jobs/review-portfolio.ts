import type { FastifyBaseLogger } from 'fastify';
import { randomUUID } from 'node:crypto';
import { env } from '../util/env.js';
import { decrypt } from '../util/crypto.js';
import {
  getActiveAgents,
  type AgentRow,
} from '../repos/agents.js';
import { insertExecLog } from '../repos/agent-exec-log.js';
import {
  insertExecResult,
  getRecentExecResults,
} from '../repos/agent-exec-result.js';
import { parseExecLog } from '../util/parse-exec-log.js';
import { callAi } from '../util/ai.js';
import { fetchAccount, fetchPairData } from '../services/binance.js';

export default async function reviewPortfolio(
  log: FastifyBaseLogger,
  agentId?: string,
): Promise<void> {
  const agents = getActiveAgents(agentId);
  await Promise.all(agents.map((row) => processAgent(row, log)));
}

async function processAgent(row: AgentRow, parentLog: FastifyBaseLogger) {
  const execLogId = randomUUID();
  const log = parentLog.child({
    userId: row.user_id,
    agentId: row.id,
    execLogId,
  });

  const key = decrypt(row.ai_api_key_enc, env.KEY_PASSWORD);

  const balances = await fetchBalances(row, log, execLogId);
  if (!balances) return;

  const prompt = await buildPrompt(row, balances, log, execLogId);
  if (!prompt) return;

  const prevRows = getRecentExecResults(row.id, 5);
  const previous_responses = prevRows.map((r) => {
    const str = JSON.stringify(r);
    return str === '{}' ? '' : str;
  });
  prompt.previous_responses = previous_responses;

  await executeAgent(row, prompt, key, log, execLogId);
}

async function fetchBalances(
  row: AgentRow,
  log: FastifyBaseLogger,
  execLogId: string,
): Promise<{ tokenABalance: number; tokenBBalance: number } | undefined> {
  let tokenABalance: number | undefined;
  let tokenBBalance: number | undefined;
  try {
    const account = await fetchAccount(row.user_id);
    if (account) {
      const balA = account.balances.find((b) => b.asset === row.token_a);
      if (balA) tokenABalance = Number(balA.free) + Number(balA.locked);
      const balB = account.balances.find((b) => b.asset === row.token_b);
      if (balB) tokenBBalance = Number(balB.free) + Number(balB.locked);
    }
  } catch (err) {
    log.error({ err }, 'failed to fetch balance');
  }
  if (tokenABalance === undefined || tokenBBalance === undefined) {
    const msg = 'failed to fetch token balances';
    saveFailure(row, execLogId, msg);
    log.error({ err: msg }, 'agent run failed');
    return undefined;
  }
  return { tokenABalance, tokenBBalance };
}

async function buildPrompt(
  row: AgentRow,
  balances: { tokenABalance: number; tokenBBalance: number },
  log: FastifyBaseLogger,
  execLogId: string,
): Promise<Record<string, any> | undefined> {
  try {
    const marketData = await fetchPairData(row.token_a, row.token_b);
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
    const valueA = balances.tokenABalance * priceA;
    const valueB = balances.tokenBBalance * priceB;
    const totalValue = valueA + valueB;
    const floors: Record<string, number> = {
      [row.token_a]: row.min_a_allocation / 100,
      [row.token_b]: row.min_b_allocation / 100,
    };
    const positions = [
      {
        sym: row.token_a,
        qty: balances.tokenABalance,
        price_usdt: priceA,
        value_usdt: valueA,
      },
      {
        sym: row.token_b,
        qty: balances.tokenBBalance,
        price_usdt: priceB,
        value_usdt: valueB,
      },
    ];
    const weights: Record<string, number> = {
      [row.token_a]: totalValue ? valueA / totalValue : 0,
      [row.token_b]: totalValue ? valueB / totalValue : 0,
    };
    return {
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
    saveFailure(row, execLogId, msg);
    log.error({ err }, 'agent run failed');
    return undefined;
  }
}

async function executeAgent(
  row: AgentRow,
  prompt: Record<string, any>,
  key: string,
  log: FastifyBaseLogger,
  execLogId: string,
) {
  try {
    const text = await callAi(row.model, prompt, key);
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
    log.info('agent run complete');
  } catch (err) {
    saveFailure(row, execLogId, String(err), prompt);
    log.error({ err }, 'agent run failed');
  }
}

function saveFailure(
  row: AgentRow,
  execLogId: string,
  message: string,
  prompt?: Record<string, any>,
) {
  const createdAt = Date.now();
  insertExecLog({
    id: execLogId,
    agentId: row.id,
    ...(prompt ? { prompt } : {}),
    response: { error: message },
    createdAt,
  });
  const parsed = parseExecLog({ error: message });
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
}

