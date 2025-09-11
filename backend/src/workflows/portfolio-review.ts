import type { FastifyBaseLogger } from 'fastify';
import {
  getActivePortfolioWorkflowById,
  getActivePortfolioWorkflowsByInterval,
  type ActivePortfolioWorkflowRow,
} from '../repos/portfolio-workflow.js';
import { run as runMainTrader, collectPromptData } from '../agents/main-trader.js';
import { runNewsAnalyst } from '../agents/news-analyst.js';
import { runTechnicalAnalyst } from '../agents/technical-analyst.js';
import { insertReviewRawLog } from '../repos/agent-review-raw-log.js';
import {
  getOpenLimitOrdersForAgent,
  updateLimitOrderStatus,
} from '../repos/limit-orders.js';
import { env } from '../util/env.js';
import { decrypt } from '../util/crypto.js';
import { insertReviewResult } from '../repos/agent-review-result.js';
import { parseExecLog, validateExecResponse } from '../util/parse-exec-log.js';
import {
  cancelOrder,
  parseBinanceError,
} from '../services/binance.js';
import { createRebalanceLimitOrder } from '../services/rebalance.js';
import { type RebalancePrompt } from '../util/ai.js';

/** Workflows currently running. Used to avoid concurrent runs. */
const runningWorkflows = new Set<string>();

export function removeWorkflowFromSchedule(id: string) {
  runningWorkflows.delete(id);
}

export async function reviewPortfolio(
  log: FastifyBaseLogger,
  workflowId: string,
): Promise<void> {
  const workflow = await getActivePortfolioWorkflowById(workflowId);
  if (!workflow) return;
  const { toRun, skipped } = filterRunningWorkflows([workflow]);
  if (skipped.length) throw new Error('Agent is already reviewing portfolio');
  await runReviewWorkflows(log, toRun);
}

export default async function reviewPortfolios(
  log: FastifyBaseLogger,
  interval: string,
): Promise<void> {
  const workflows = await getActivePortfolioWorkflowsByInterval(interval);
  const { toRun } = filterRunningWorkflows(workflows);
  if (!toRun.length) return;
  await runReviewWorkflows(log, toRun);
}

async function runReviewWorkflows(
  log: FastifyBaseLogger,
  workflowRows: ActivePortfolioWorkflowRow[],
) {
  await Promise.all(
    workflowRows.map((wf) =>
      executeWorkflow(
        wf,
        log.child({ userId: wf.user_id, portfolioId: wf.id }),
      ).finally(() => {
        runningWorkflows.delete(wf.id);
      }),
    ),
  );
}

function filterRunningWorkflows(workflowRows: ActivePortfolioWorkflowRow[]) {
  const toRun: ActivePortfolioWorkflowRow[] = [];
  const skipped: ActivePortfolioWorkflowRow[] = [];
  for (const row of workflowRows) {
    if (runningWorkflows.has(row.id)) skipped.push(row);
    else {
      runningWorkflows.add(row.id);
      toRun.push(row);
    }
  }
  return { toRun, skipped };
}


async function cleanupOpenOrders(
  wf: ActivePortfolioWorkflowRow,
  log: FastifyBaseLogger,
) {
  const orders = await getOpenLimitOrdersForAgent(wf.id);
  for (const o of orders) {
    const planned = JSON.parse(o.planned_json);
    try {
      await cancelOrder(o.user_id, {
        symbol: planned.symbol,
        orderId: Number(o.order_id),
      });
      await updateLimitOrderStatus(o.user_id, o.order_id, 'canceled');
      log.info({ orderId: o.order_id }, 'canceled stale order');
    } catch (err) {
      const msg = parseBinanceError(err);
      if (msg && /UNKNOWN_ORDER/i.test(msg)) {
        await updateLimitOrderStatus(o.user_id, o.order_id, 'filled');
      } else {
        log.error({ err }, 'failed to cancel order');
      }
    }
  }
}

export async function executeWorkflow(
  wf: ActivePortfolioWorkflowRow,
  log: FastifyBaseLogger,
) {
  let prompt: RebalancePrompt | undefined;
  try {
    await cleanupOpenOrders(wf, log);

    const key = decrypt(wf.ai_api_key_enc, env.KEY_PASSWORD);

    prompt = await collectPromptData(wf, log);
    if (!prompt) {
      await saveFailure(wf, 'failed to collect prompt data');
      return;
    }

    const params = { log, model: wf.model, apiKey: key, portfolioId: wf.id };
    await Promise.all([
      runNewsAnalyst(params, prompt),
      runTechnicalAnalyst({ ...params, timeframe: wf.review_interval }, prompt),
    ]);

    const decision = await runMainTrader(params, prompt);
    const logId = await insertReviewRawLog({
      portfolioId: wf.id,
      prompt,
      response: decision,
    });
    const validationError = validateExecResponse(
      decision ?? undefined,
      prompt.policy,
    );
    if (validationError) log.error({ err: validationError }, 'validation failed');
    const resultId = await insertReviewResult({
      portfolioId: wf.id,
      log: decision ? JSON.stringify(decision) : '',
      rawLogId: logId,
      ...(decision && !validationError
        ? {
            rebalance: decision.rebalance,
            newAllocation: decision.newAllocation,
            shortReport: decision.shortReport,
          }
        : {}),
      ...((!decision || validationError)
        ? { error: { message: validationError ?? 'decision unavailable' } }
        : {}),
    });
    if (
      decision &&
      !validationError &&
      !wf.manual_rebalance &&
      decision.rebalance &&
      decision.newAllocation !== undefined
    ) {
      await createRebalanceLimitOrder({
        userId: wf.user_id,
        tokens: wf.tokens.map((t) => t.token),
        positions: prompt.portfolio.positions,
        newAllocation: decision.newAllocation,
        log,
        reviewResultId: resultId,
      });
    }
    log.info('workflow run complete');
  } catch (err) {
    await saveFailure(wf, String(err), prompt);
    log.error({ err }, 'workflow run failed');
  }
}

async function saveFailure(
  row: ActivePortfolioWorkflowRow,
  message: string,
  prompt?: RebalancePrompt,
) {
  let rawId: string | undefined;
  if (prompt) {
    rawId = await insertReviewRawLog({
      portfolioId: row.id,
      prompt,
      response: { error: message },
    });
  }
  const parsed = parseExecLog({ error: message });
  await insertReviewResult({
    portfolioId: row.id,
    log: parsed.text,
    ...(rawId ? { rawLogId: rawId } : {}),
    ...(parsed.response
      ? {
          rebalance: parsed.response.rebalance,
          newAllocation: parsed.response.newAllocation,
          shortReport: parsed.response.shortReport,
        }
      : {}),
    ...(parsed.error ? { error: parsed.error } : {}),
  });
}

export { reviewPortfolio as reviewAgentPortfolio };

