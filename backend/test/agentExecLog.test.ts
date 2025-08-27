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
    insertUser('u1');
    insertUser('u2');

    const agentId = 'a1';
    insertAgent({
      id: agentId,
      userId: 'u1',
      model: 'gpt',
      status: 'active',
      createdAt: 0,
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

    for (let i = 0; i < 3; i++) {
      insertExecLog({
        id: `log${i}`,
        agentId,
        response: `log-${i}`,
        createdAt: i,
      });
      const parsed = parseExecLog(`log-${i}`);
      insertExecResult({
        id: `log${i}`,
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
        createdAt: i,
      });
    }

    let res = await app.inject({
      method: 'GET',
      url: `/api/agents/${agentId}/exec-log?page=1&pageSize=2`,
      headers: { 'x-user-id': 'u1' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ total: 3, page: 1, pageSize: 2 });
    expect(res.json().items).toHaveLength(2);

    res = await app.inject({
      method: 'GET',
      url: `/api/agents/${agentId}/exec-log?page=1&pageSize=2`,
      headers: { 'x-user-id': 'u2' },
    });
    expect(res.statusCode).toBe(403);

    await app.close();
  });

  it('parses OpenAI response content JSON into {response}', async () => {
    const app = await buildServer();
    insertUser('u3');

    const agentId = 'a2';
    insertAgent({
      id: agentId,
      userId: 'u3',
      model: 'gpt',
      status: 'active',
      createdAt: 0,
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

    const aiLog = readFileSync(
      join(__dirname, 'fixtures/real-openai-log.json'),
      'utf8',
    );

    insertExecLog({ id: 'log-new', agentId, response: aiLog, createdAt: 0 });
    const parsedAi = parseExecLog(aiLog);
    insertExecResult({
      id: 'log-new',
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
      createdAt: 0,
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/agents/${agentId}/exec-log?page=1&pageSize=10`,
      headers: { 'x-user-id': 'u3' },
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
    insertUser('u5');
    const agentId = 'a5';
    insertAgent({
      id: agentId,
      userId: 'u5',
      model: 'gpt',
      status: 'active',
      createdAt: 0,
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
    const entry = JSON.stringify({ prompt: { instructions: 'inst' }, response: 'ok' });
    insertExecLog({ id: 'logp', agentId, response: entry, createdAt: 0 });
    const parsedP = parseExecLog(entry);
    insertExecResult({
      id: 'logp',
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
      createdAt: 0,
    });
    const res = await app.inject({
      method: 'GET',
      url: `/api/agents/${agentId}/exec-log?page=1&pageSize=10`,
      headers: { 'x-user-id': 'u5' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items[0].log).toBe('ok');
    await app.close();
  });
});
