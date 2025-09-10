import type { FastifyBaseLogger } from 'fastify';
import { TOKEN_SYMBOLS } from '../util/tokens.js';
import { runNewsAnalyst } from './news-analyst.js';
import { runTechnicalAnalyst } from './technical-analyst.js';
import { runOrderBookAnalyst } from './order-book-analyst.js';
import { runPerformanceAnalyzer } from './performance-analyst.js';
import { getRecentLimitOrders } from '../repos/limit-orders.js';
import {
  callAi,
  developerInstructions,
  rebalanceResponseSchema,
} from '../util/ai.js';
import { insertReviewRawLog } from '../repos/agent-review-raw-log.js';

interface MainTraderOptions {
  log: FastifyBaseLogger;
  model: string;
  apiKey: string;
  timeframe: string;
  agentId: string;
  portfolioId: string;
}

export class MainTraderAgent {
  private log: FastifyBaseLogger;
  private model: string;
  private apiKey: string;
  private timeframe: string;
  private agentId: string;
  private portfolioId: string;

  constructor(opts: MainTraderOptions) {
    this.log = opts.log;
    this.model = opts.model;
    this.apiKey = opts.apiKey;
    this.timeframe = opts.timeframe;
    this.agentId = opts.agentId;
    this.portfolioId = opts.portfolioId;
  }

  private extractResult(res: string): any {
    try {
      const json = JSON.parse(res);
      const outputs = Array.isArray((json as any).output)
        ? (json as any).output
        : [];
      const msg = outputs.find(
        (o: any) => o.type === 'message' || o.id?.startsWith('msg_'),
      );
      const text = msg?.content?.[0]?.text;
      if (typeof text !== 'string') return null;
      const parsed = JSON.parse(text);
      return parsed.result ?? null;
    } catch {
      return null;
    }
  }

  async run(): Promise<{
    rebalance: boolean;
    newAllocation?: number;
    shortReport: string;
  } | null> {
    const [news, tech, orderbook, ordersRaw] = await Promise.all([
      runNewsAnalyst(this.log, this.model, this.apiKey, this.agentId),
      runTechnicalAnalyst(
        this.log,
        this.model,
        this.apiKey,
        this.timeframe,
        this.agentId,
      ),
      runOrderBookAnalyst(this.log, this.model, this.apiKey, this.agentId),
      getRecentLimitOrders(this.agentId, 20),
    ]);

    const reports = TOKEN_SYMBOLS.map((token) => ({
      token,
      news: news[token] ?? null,
      tech: tech[token] ?? null,
      orderbook: orderbook[token] ?? null,
    }));

    let performance = null;
    if (ordersRaw.length) {
      performance = await runPerformanceAnalyzer(
        this.log,
        this.model,
        this.apiKey,
        this.agentId,
        reports,
        ordersRaw,
      );
    }

    const prompt = { portfolioId: this.portfolioId, reports, performance };
    const res = await callAi(
      this.model,
      developerInstructions,
      rebalanceResponseSchema,
      prompt,
      this.apiKey,
      true,
    );
    await insertReviewRawLog({ agentId: this.agentId, prompt, response: res });
    const decision = this.extractResult(res);
    if (!decision) {
      this.log.error('main trader returned invalid response');
      return null;
    }
    return decision;
  }
}

export async function runMainTrader(
  log: FastifyBaseLogger,
  model: string,
  apiKey: string,
  timeframe: string,
  agentId: string,
  portfolioId: string,
) {
  const agent = new MainTraderAgent({
    log,
    model,
    apiKey,
    timeframe,
    agentId,
    portfolioId,
  });
  return agent.run();
}

