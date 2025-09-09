import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import buildServer from '../src/server.js';
import { parseExecLog } from '../src/util/parse-exec-log.js';
import { insertReviewResult } from '../src/repos/agent-review-result.js';
import { insertUser } from './repos/users.js';
import { insertAgent } from './repos/agents.js';
import { insertReviewRawLog } from './repos/agent-review-raw-log.js';
import { db } from '../src/db/index.js';
import * as binance from '../src/services/binance.js';
import { authCookies } from './helpers.js';

describe('agent exec log routes', () => {
  it('returns orders for log and enforces ownership', async () => {
    const app = await buildServer();
    const user1Id = await insertUser('10');
    const user2Id = await insertUser('11');
    const agent = await insertAgent({
      userId: user1Id,
      model: 'gpt',
      status: 'active',
      startBalance: null,
      name: 'A',
      tokens: [
        { token: 'BTC', minAllocation: 10 },
        { token: 'ETH', minAllocation: 20 },
      ],
      risk: 'low',
      reviewInterval: '1h',
      agentInstructions: 'inst',
      manualRebalance: false,
    });
    const reviewResultId = await insertReviewResult({ agentId: agent.id, log: '' });
    await db.query(
      'INSERT INTO limit_order (user_id, planned_json, status, review_result_id, order_id) VALUES ($1, $2, $3, $4, $5)',
      [
        user1Id,
        JSON.stringify({ side: 'BUY', quantity: 1, price: 100, symbol: 'BTCETH' }),
        'open',
        reviewResultId,
        '1',
      ],
    );
    let res = await app.inject({
      method: 'GET',
      url: `/api/agents/${agent.id}/exec-log/${reviewResultId}/orders`,
      cookies: authCookies(user1Id),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      orders: [
        {
          id: '1',
          side: 'BUY',
          quantity: 1,
          price: 100,
          status: 'open',
          createdAt: expect.any(Number),
        },
      ],
    });
    res = await app.inject({
      method: 'GET',
      url: `/api/agents/${agent.id}/exec-log/${reviewResultId}/orders`,
      cookies: authCookies(user2Id),
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('cancels open order and enforces ownership', async () => {
    const app = await buildServer();
    const user1Id = await insertUser('12');
    const user2Id = await insertUser('13');
    const agent = await insertAgent({
      userId: user1Id,
      model: 'gpt',
      status: 'active',
      startBalance: null,
      name: 'A',
      tokens: [
        { token: 'BTC', minAllocation: 10 },
        { token: 'ETH', minAllocation: 20 },
      ],
      risk: 'low',
      reviewInterval: '1h',
      agentInstructions: 'inst',
      manualRebalance: false,
    });
    const reviewResultId = await insertReviewResult({ agentId: agent.id, log: '' });
    await db.query(
      'INSERT INTO limit_order (user_id, planned_json, status, review_result_id, order_id) VALUES ($1, $2, $3, $4, $5)',
      [
        user1Id,
        JSON.stringify({ side: 'BUY', quantity: 1, price: 100, symbol: 'BTCETH' }),
        'open',
        reviewResultId,
        '2',
      ],
    );
    const spy = vi.spyOn(binance, 'cancelOrder').mockResolvedValue({} as any);
    let res = await app.inject({
      method: 'POST',
      url: `/api/agents/${agent.id}/exec-log/${reviewResultId}/orders/2/cancel`,
      cookies: authCookies(user1Id),
    });
    expect(res.statusCode).toBe(200);
    expect(spy).toHaveBeenCalledWith(user1Id, {
      symbol: 'BTCETH',
      orderId: 2,
    });
    let row = await db.query('SELECT status FROM limit_order WHERE order_id=$1', ['2']);
    expect(row.rows[0].status).toBe('canceled');
    res = await app.inject({
      method: 'POST',
      url: `/api/agents/${agent.id}/exec-log/${reviewResultId}/orders/2/cancel`,
      cookies: authCookies(user2Id),
    });
    expect(res.statusCode).toBe(403);
    row = await db.query('SELECT status FROM limit_order WHERE order_id=$1', ['2']);
    expect(row.rows[0].status).toBe('canceled');
    spy.mockRestore();
    await app.close();
  });

  it('returns prompt for log and enforces ownership', async () => {
    const app = await buildServer();
    const user1Id = await insertUser('20');
    const user2Id = await insertUser('21');
    const agent = await insertAgent({
      userId: user1Id,
      model: 'gpt',
      status: 'active',
      startBalance: null,
      name: 'A',
      tokens: [
        { token: 'BTC', minAllocation: 10 },
        { token: 'ETH', minAllocation: 20 },
      ],
      risk: 'low',
      reviewInterval: '1h',
      agentInstructions: 'inst',
      manualRebalance: false,
    });
    const rawId = await insertReviewRawLog({
      agentId: agent.id,
      prompt: { a: 1 },
      response: 'resp',
    });
    const reviewResultId = await insertReviewResult({
      agentId: agent.id,
      log: 'log',
      rawLogId: rawId,
    });
    let res = await app.inject({
      method: 'GET',
      url: `/api/agents/${agent.id}/exec-log/${reviewResultId}/prompt`,
      cookies: authCookies(user1Id),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ prompt: { a: 1 } });
    res = await app.inject({
      method: 'GET',
      url: `/api/agents/${agent.id}/exec-log/${reviewResultId}/prompt`,
      cookies: authCookies(user2Id),
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });
  it('returns paginated logs and enforces ownership', async () => {
    const app = await buildServer();
    const user1Id = await insertUser('1');
    const user2Id = await insertUser('2');

    const agent = await insertAgent({
      userId: user1Id,
      model: 'gpt',
      status: 'active',
      startBalance: null,
      name: 'A',
      tokens: [
        { token: 'BTC', minAllocation: 10 },
        { token: 'ETH', minAllocation: 20 },
      ],
      risk: 'low',
      reviewInterval: '1h',
      agentInstructions: 'inst',
      manualRebalance: false,
    });
    const agentId = agent.id;

    for (let i = 0; i < 3; i++) {
      await insertReviewRawLog({ agentId, prompt: `prompt-${i}`, response: `log-${i}` });
      const parsed = parseExecLog(`log-${i}`);
      await insertReviewResult({
        agentId,
        log: parsed.text,
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

    let res = await app.inject({
      method: 'GET',
      url: `/api/agents/${agentId}/exec-log?page=1&pageSize=2`,
      cookies: authCookies(user1Id),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ total: 3, page: 1, pageSize: 2 });
    expect(res.json().items).toHaveLength(2);

    res = await app.inject({
      method: 'GET',
      url: `/api/agents/${agentId}/exec-log?page=1&pageSize=2`,
      cookies: authCookies(user2Id),
    });
    expect(res.statusCode).toBe(403);

    await app.close();
  });

  it('parses OpenAI response content JSON into {response}', async () => {
    const app = await buildServer();
    const userId = await insertUser('3');

    const agent = await insertAgent({
      userId,
      model: 'gpt',
      status: 'active',
      startBalance: null,
      name: 'A',
      tokens: [
        { token: 'BTC', minAllocation: 10 },
        { token: 'ETH', minAllocation: 20 },
      ],
      risk: 'low',
      reviewInterval: '1h',
      agentInstructions: 'inst',
      manualRebalance: false,
    });
    const agentId = agent.id;

    const aiLog = readFileSync(
      join(__dirname, 'fixtures/real-openai-log.json'),
      'utf8',
    );

      await insertReviewRawLog({ agentId, prompt: 'p', response: aiLog });
    const parsedAi = parseExecLog(aiLog);
    await insertReviewResult({
      agentId,
      log: parsedAi.text,
      ...(parsedAi.response
        ? {
            rebalance: parsedAi.response.rebalance,
            newAllocation: parsedAi.response.newAllocation,
            shortReport: parsedAi.response.shortReport,
          }
        : {}),
      ...(parsedAi.error ? { error: parsedAi.error } : {}),
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/agents/${agentId}/exec-log?page=1&pageSize=10`,
      cookies: authCookies(userId),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(typeof body.items[0].log).toBe('string');
    expect(body.items[0].log).toContain('"result"');
    expect(body.items[0].log).toContain('"rebalance"');

    expect(body.items[0].response).toMatchObject({
      rebalance: true,
      newAllocation: 70, // matches the provided fixture
    });
    expect(typeof body.items[0].response.shortReport).toBe('string');
    expect(body.items[0].response.shortReport.length).toBeGreaterThan(0);

    await app.close();
  });

  it('handles exec log entries with prompt wrapper', async () => {
    const app = await buildServer();
    const userId = await insertUser('5');
    const agent = await insertAgent({
      userId,
      model: 'gpt',
      status: 'active',
      startBalance: null,
      name: 'A',
      tokens: [
        { token: 'BTC', minAllocation: 10 },
        { token: 'ETH', minAllocation: 20 },
      ],
      risk: 'low',
      reviewInterval: '1h',
      agentInstructions: 'inst',
      manualRebalance: false,
    });
    const agentId = agent.id;
    const entry = JSON.stringify({ prompt: { instructions: 'inst' }, response: 'ok' });
    await insertReviewRawLog({ agentId, prompt: 'p', response: entry });
    const parsedP = parseExecLog(entry);
    await insertReviewResult({
      agentId,
      log: parsedP.text,
      ...(parsedP.response
        ? {
            rebalance: parsedP.response.rebalance,
            newAllocation: parsedP.response.newAllocation,
            shortReport: parsedP.response.shortReport,
          }
        : {}),
      ...(parsedP.error ? { error: parsedP.error } : {}),
    });
    const res = await app.inject({
      method: 'GET',
      url: `/api/agents/${agentId}/exec-log?page=1&pageSize=10`,
      cookies: authCookies(userId),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items[0].log).toBe('ok');
    await app.close();
  });

  it('creates manual rebalance order once', async () => {
    const app = await buildServer();
    const userId = await insertUser('20');
    const agent = await insertAgent({
      userId,
      model: 'gpt',
      status: 'active',
      startBalance: null,
      name: 'A',
      tokens: [
        { token: 'BTC', minAllocation: 10 },
        { token: 'ETH', minAllocation: 20 },
      ],
      risk: 'low',
      reviewInterval: '1h',
      agentInstructions: 'inst',
      manualRebalance: true,
    });
    const reviewResultId = await insertReviewResult({
      agentId: agent.id,
      log: '',
      rebalance: true,
      newAllocation: 60,
    });
    vi.spyOn(binance, 'fetchAccount').mockResolvedValue({
      balances: [
        { asset: 'BTC', free: '1', locked: '0' },
        { asset: 'ETH', free: '1', locked: '0' },
      ],
    } as any);
    vi.spyOn(binance, 'fetchPairData').mockResolvedValue({
      currentPrice: 100,
    } as any);
    vi.spyOn(binance, 'fetchPairInfo').mockResolvedValue({
      symbol: 'BTCETH',
      baseAsset: 'BTC',
      quoteAsset: 'ETH',
      quantityPrecision: 8,
      pricePrecision: 8,
      minNotional: 0,
    } as any);
    vi.spyOn(binance, 'createLimitOrder').mockResolvedValue({ orderId: 1 } as any);
    let res = await app.inject({
      method: 'POST',
      url: `/api/agents/${agent.id}/exec-log/${reviewResultId}/rebalance`,
      cookies: authCookies(userId),
    });
    expect(res.statusCode).toBe(201);
    const { rows } = await db.query(
      'SELECT * FROM limit_order WHERE review_result_id = $1',
      [reviewResultId],
    );
    expect(rows).toHaveLength(1);
    expect(JSON.parse(rows[0].planned_json)).toMatchObject({ price: 99.9 });
    res = await app.inject({
      method: 'POST',
      url: `/api/agents/${agent.id}/exec-log/${reviewResultId}/rebalance`,
      cookies: authCookies(userId),
    });
    expect(res.statusCode).toBe(400);
    vi.restoreAllMocks();
    await app.close();
  });

  it('rejects manual rebalance order below minimum value', async () => {
    const app = await buildServer();
    const userId = await insertUser('60');
    const agent = await insertAgent({
      userId,
      model: 'gpt',
      status: 'active',
      startBalance: null,
      name: 'A',
      tokens: [
        { token: 'BTC', minAllocation: 10 },
        { token: 'ETH', minAllocation: 20 },
      ],
      risk: 'low',
      reviewInterval: '1h',
      agentInstructions: 'inst',
      manualRebalance: true,
    });
    const reviewResultId = await insertReviewResult({
      agentId: agent.id,
      log: '',
      rebalance: true,
      newAllocation: 50,
    });
    vi.spyOn(binance, 'fetchAccount').mockResolvedValue({
      balances: [
        { asset: 'BTC', free: '1', locked: '0' },
        { asset: 'ETH', free: '0.9999', locked: '0' },
      ],
    } as any);
    vi.spyOn(binance, 'fetchPairData').mockResolvedValue({
      currentPrice: 100,
    } as any);
    vi.spyOn(binance, 'fetchPairInfo').mockResolvedValue({
      symbol: 'BTCETH',
      baseAsset: 'BTC',
      quoteAsset: 'ETH',
      quantityPrecision: 8,
      pricePrecision: 8,
      minNotional: 0,
    } as any);
    const spy = vi
      .spyOn(binance, 'createLimitOrder')
      .mockResolvedValue({ orderId: 1 } as any);
    const res = await app.inject({
      method: 'POST',
      url: `/api/agents/${agent.id}/exec-log/${reviewResultId}/rebalance`,
      cookies: authCookies(userId),
    });
    expect(res.statusCode).toBe(400);
    const { rows } = await db.query(
      'SELECT * FROM limit_order WHERE review_result_id = $1',
      [reviewResultId],
    );
    expect(rows).toHaveLength(0);
    expect(spy).not.toHaveBeenCalled();
    vi.restoreAllMocks();
    await app.close();
  });

  it('rejects manual rebalance order below exchange minimum', async () => {
    const app = await buildServer();
    const userId = await insertUser('61');
    const agent = await insertAgent({
      userId,
      model: 'gpt',
      status: 'active',
      startBalance: null,
      name: 'A',
      tokens: [
        { token: 'BTC', minAllocation: 10 },
        { token: 'USDT', minAllocation: 20 },
      ],
      risk: 'low',
      reviewInterval: '1h',
      agentInstructions: 'inst',
      manualRebalance: true,
    });
    const reviewResultId = await insertReviewResult({
      agentId: agent.id,
      log: '',
      rebalance: true,
      newAllocation: 50,
    });
    vi.spyOn(binance, 'fetchAccount').mockResolvedValue({
      balances: [
        { asset: 'BTC', free: '0.95', locked: '0' },
        { asset: 'USDT', free: '105', locked: '0' },
      ],
    } as any);
    vi.spyOn(binance, 'fetchPairData').mockResolvedValue({ currentPrice: 100 } as any);
    vi.spyOn(binance, 'fetchPairInfo').mockResolvedValue({
      symbol: 'BTCUSDT',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      quantityPrecision: 8,
      pricePrecision: 8,
      minNotional: 10,
    } as any);
    const spy = vi
      .spyOn(binance, 'createLimitOrder')
      .mockResolvedValue({ orderId: 1 } as any);
    const res = await app.inject({
      method: 'POST',
      url: `/api/agents/${agent.id}/exec-log/${reviewResultId}/rebalance`,
      cookies: authCookies(userId),
    });
    expect(res.statusCode).toBe(400);
    const { rows } = await db.query(
      'SELECT * FROM limit_order WHERE review_result_id = $1',
      [reviewResultId],
    );
    expect(rows).toHaveLength(0);
    expect(spy).not.toHaveBeenCalled();
    vi.restoreAllMocks();
    await app.close();
  });

  it('previews manual rebalance order', async () => {
    const app = await buildServer();
    const userId = await insertUser('21');
    const agent = await insertAgent({
      userId,
      model: 'gpt',
      status: 'active',
      startBalance: null,
      name: 'A',
      tokens: [
        { token: 'BTC', minAllocation: 10 },
        { token: 'ETH', minAllocation: 20 },
      ],
      risk: 'low',
      reviewInterval: '1h',
      agentInstructions: 'inst',
      manualRebalance: true,
    });
    const reviewResultId = await insertReviewResult({
      agentId: agent.id,
      log: '',
      rebalance: true,
      newAllocation: 60,
    });
    vi.spyOn(binance, 'fetchAccount').mockResolvedValue({
      balances: [
        { asset: 'BTC', free: '1', locked: '0' },
        { asset: 'ETH', free: '1', locked: '0' },
      ],
    } as any);
    vi.spyOn(binance, 'fetchPairData').mockResolvedValue({
      currentPrice: 100,
    } as any);
    vi.spyOn(binance, 'fetchPairInfo').mockResolvedValue({
      symbol: 'BTCETH',
      baseAsset: 'BTC',
      quoteAsset: 'ETH',
      quantityPrecision: 8,
      pricePrecision: 8,
      minNotional: 0,
    } as any);
    const res = await app.inject({
      method: 'GET',
      url: `/api/agents/${agent.id}/exec-log/${reviewResultId}/rebalance/preview`,
      cookies: authCookies(userId),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.order).toMatchObject({
      side: 'BUY',
      quantity: 0.2,
      price: 99.9,
    });
    vi.restoreAllMocks();
    await app.close();
  });

  it('returns binance error message when limit order fails', async () => {
    const app = await buildServer();
    const userId = await insertUser('31');
    const agent = await insertAgent({
      userId,
      model: 'gpt',
      status: 'active',
      startBalance: null,
      name: 'A',
      tokens: [
        { token: 'BTC', minAllocation: 10 },
        { token: 'ETH', minAllocation: 20 },
      ],
      risk: 'low',
      reviewInterval: '1h',
      agentInstructions: 'inst',
      manualRebalance: true,
    });
    const reviewResultId = await insertReviewResult({
      agentId: agent.id,
      log: '',
      rebalance: true,
      newAllocation: 60,
    });
    vi.spyOn(binance, 'fetchAccount').mockResolvedValue({
      balances: [
        { asset: 'BTC', free: '1', locked: '0' },
        { asset: 'ETH', free: '1', locked: '0' },
      ],
    } as any);
    vi.spyOn(binance, 'fetchPairData').mockResolvedValue({
      currentPrice: 100,
    } as any);
    vi.spyOn(binance, 'fetchPairInfo').mockResolvedValue({
      symbol: 'BTCETH',
      baseAsset: 'BTC',
      quoteAsset: 'ETH',
      quantityPrecision: 8,
      pricePrecision: 8,
      minNotional: 0,
    } as any);
    vi.spyOn(binance, 'createLimitOrder').mockRejectedValue(
      new Error(
        'failed to create order: 401 {"code":-2015,"msg":"Invalid API-key, IP, or permissions for action."}',
      ),
    );
    const res = await app.inject({
      method: 'POST',
      url: `/api/agents/${agent.id}/exec-log/${reviewResultId}/rebalance`,
      cookies: authCookies(userId),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({
      error: 'Invalid API-key, IP, or permissions for action.',
    });
    vi.restoreAllMocks();
    await app.close();
  });

  it('filters exec log by rebalanceOnly', async () => {
    const app = await buildServer();
    const userId = await insertUser('9');
    const agent = await insertAgent({
      userId,
      model: 'gpt',
      status: 'active',
      startBalance: null,
      name: 'A',
      tokens: [
        { token: 'BTC', minAllocation: 10 },
        { token: 'ETH', minAllocation: 20 },
      ],
      risk: 'low',
      reviewInterval: '1h',
      agentInstructions: 'inst',
      manualRebalance: false,
    });
    await insertReviewResult({ agentId: agent.id, log: 'no', rebalance: false });
    await insertReviewResult({ agentId: agent.id, log: 'yes', rebalance: true });
    const res = await app.inject({
      method: 'GET',
      url: `/api/agents/${agent.id}/exec-log?rebalanceOnly=true`,
      cookies: authCookies(userId),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBe(1);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].response.rebalance).toBe(true);
    await app.close();
  });
});
