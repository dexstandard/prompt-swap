import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import buildServer from '../src/server.js';
import { parseExecLog } from '../src/util/parse-exec-log.js';
import { insertExecResult } from '../src/repos/agent-exec-result.js';
import { insertUser } from './repos/users.js';
import { insertAgent } from './repos/agents.js';
import { insertExecLog } from './repos/agent-exec-log.js';

describe('agent exec log routes', () => {
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
      tokenA: 'BTC',
      tokenB: 'ETH',
      minTokenAAllocation: 10,
      minTokenBAllocation: 20,
      risk: 'low',
      reviewInterval: '1h',
      agentInstructions: 'inst',
      manualRebalance: false,
    });
    const agentId = agent.id;

    for (let i = 0; i < 3; i++) {
      await insertExecLog({ agentId, response: `log-${i}` });
      const parsed = parseExecLog(`log-${i}`);
      await insertExecResult({
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
      headers: { 'x-user-id': user1Id },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ total: 3, page: 1, pageSize: 2 });
    expect(res.json().items).toHaveLength(2);

    res = await app.inject({
      method: 'GET',
      url: `/api/agents/${agentId}/exec-log?page=1&pageSize=2`,
      headers: { 'x-user-id': user2Id },
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
      tokenA: 'BTC',
      tokenB: 'ETH',
      minTokenAAllocation: 10,
      minTokenBAllocation: 20,
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

    await insertExecLog({ agentId, response: aiLog });
    const parsedAi = parseExecLog(aiLog);
    await insertExecResult({
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
      headers: { 'x-user-id': userId },
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
      tokenA: 'BTC',
      tokenB: 'ETH',
      minTokenAAllocation: 10,
      minTokenBAllocation: 20,
      risk: 'low',
      reviewInterval: '1h',
      agentInstructions: 'inst',
      manualRebalance: false,
    });
    const agentId = agent.id;
    const entry = JSON.stringify({ prompt: { instructions: 'inst' }, response: 'ok' });
    await insertExecLog({ agentId, response: entry });
    const parsedP = parseExecLog(entry);
    await insertExecResult({
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
      headers: { 'x-user-id': userId },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items[0].log).toBe('ok');
    await app.close();
  });
});
