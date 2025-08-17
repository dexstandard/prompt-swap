import { describe, it, expect } from 'vitest';

process.env.DATABASE_URL = ':memory:';
process.env.KEY_PASSWORD = 'test-pass';
process.env.GOOGLE_CLIENT_ID = 'test-client';

const { db, migrate } = await import('../src/db/index.js');
import buildServer from '../src/server.js';

migrate();

describe('agent template routes', () => {
  it('performs CRUD operations', async () => {
    const app = await buildServer();
    db.prepare('INSERT INTO users (id) VALUES (?)').run('user1');

    const payload = {
      userId: 'user1',
      name: 'BTC 60 / ETH 40',
      tokenA: 'BTC',
      tokenB: 'ETH',
      targetAllocation: 60,
      minTokenAAllocation: 10,
      minTokenBAllocation: 20,
      risk: 'low',
      rebalance: '1h',
      agentInstructions: 'prompt',
    };

    let res = await app.inject({
      method: 'POST',
      url: '/api/agent-templates',
      headers: { 'x-user-id': 'user1' },
      payload,
    });
    expect(res.statusCode).toBe(200);
    const id = res.json().id as string;

    res = await app.inject({
      method: 'GET',
      url: `/api/agent-templates/${id}`,
      headers: { 'x-user-id': 'user1' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id, ...payload });

    res = await app.inject({
      method: 'GET',
      url: '/api/agent-templates',
      headers: { 'x-user-id': 'user1' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);

    res = await app.inject({
      method: 'GET',
      url: '/api/agent-templates/paginated?page=1&pageSize=10',
      headers: { 'x-user-id': 'user1' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ total: 1, page: 1, pageSize: 10 });
    expect(res.json().items).toHaveLength(1);

    const update = { ...payload, name: 'BTC 70 / ETH 30', targetAllocation: 70, risk: 'medium' };
    res = await app.inject({
      method: 'PUT',
      url: `/api/agent-templates/${id}`,
      headers: { 'x-user-id': 'user1' },
      payload: update,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id, ...update });

    res = await app.inject({
      method: 'PATCH',
      url: `/api/agent-templates/${id}/instructions`,
      headers: { 'x-user-id': 'user1' },
      payload: { userId: 'user1', agentInstructions: 'new prompt' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id, agentInstructions: 'new prompt' });

    res = await app.inject({
      method: 'PATCH',
      url: `/api/agent-templates/${id}/name`,
      headers: { 'x-user-id': 'user1' },
      payload: { userId: 'user1', name: 'custom name' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id, name: 'custom name' });

    res = await app.inject({
      method: 'DELETE',
      url: `/api/agent-templates/${id}`,
      headers: { 'x-user-id': 'user1' },
    });
    expect(res.statusCode).toBe(200);

    res = await app.inject({
      method: 'GET',
      url: `/api/agent-templates/${id}`,
      headers: { 'x-user-id': 'user1' },
    });
    expect(res.statusCode).toBe(404);

    await app.close();
  });

  it('enforces user ownership', async () => {
    const app = await buildServer();
    db.prepare('INSERT INTO users (id) VALUES (?)').run('user3');
    db.prepare('INSERT INTO users (id) VALUES (?)').run('user4');

    const payload = {
      userId: 'user3',
      name: 'BTC 60 / ETH 40',
      tokenA: 'BTC',
      tokenB: 'ETH',
      targetAllocation: 60,
      minTokenAAllocation: 10,
      minTokenBAllocation: 20,
      risk: 'low',
      rebalance: '1h',
      agentInstructions: 'prompt',
    };

    let res = await app.inject({
      method: 'POST',
      url: '/api/agent-templates',
      headers: { 'x-user-id': 'user3' },
      payload,
    });
    const id1 = res.json().id as string;

    res = await app.inject({
      method: 'POST',
      url: '/api/agent-templates',
      headers: { 'x-user-id': 'user4' },
      payload: { ...payload, userId: 'user4' },
    });
    const id2 = res.json().id as string;

    res = await app.inject({
      method: 'GET',
      url: '/api/agent-templates',
      headers: { 'x-user-id': 'user3' },
    });
    expect(res.json()).toHaveLength(1);
    expect(res.json()[0].id).toBe(id1);

    res = await app.inject({
      method: 'GET',
      url: `/api/agent-templates/${id2}`,
      headers: { 'x-user-id': 'user3' },
    });
    expect(res.statusCode).toBe(403);

    res = await app.inject({
      method: 'POST',
      url: '/api/agent-templates',
      headers: { 'x-user-id': 'user3' },
      payload: { ...payload, userId: 'user4' },
    });
    expect(res.statusCode).toBe(403);

    await app.close();
  });

  it('auto-corrects allocation inputs', async () => {
    const app = await buildServer();
    db.prepare('INSERT INTO users (id) VALUES (?)').run('user5');

    const base = {
      userId: 'user5',
      name: 'base',
      tokenA: 'BTC',
      tokenB: 'ETH',
      risk: 'low',
      rebalance: '1h',
      agentInstructions: 'prompt',
    };

    let res = await app.inject({
      method: 'POST',
      url: '/api/agent-templates',
      headers: { 'x-user-id': 'user5' },
      payload: { ...base, targetAllocation: 50, minTokenAAllocation: 80, minTokenBAllocation: 30 },
    });
    expect(res.json()).toMatchObject({ targetAllocation: 70, minTokenAAllocation: 70, minTokenBAllocation: 30 });

    res = await app.inject({
      method: 'POST',
      url: '/api/agent-templates',
      headers: { 'x-user-id': 'user5' },
      payload: { ...base, targetAllocation: 50, minTokenAAllocation: 20, minTokenBAllocation: 90 },
    });
    expect(res.json()).toMatchObject({ targetAllocation: 20, minTokenAAllocation: 20, minTokenBAllocation: 80 });

    res = await app.inject({
      method: 'POST',
      url: '/api/agent-templates',
      headers: { 'x-user-id': 'user5' },
      payload: { ...base, targetAllocation: 5, minTokenAAllocation: 10, minTokenBAllocation: 10 },
    });
    expect(res.json()).toMatchObject({ targetAllocation: 10, minTokenAAllocation: 10, minTokenBAllocation: 10 });

    res = await app.inject({
      method: 'POST',
      url: '/api/agent-templates',
      headers: { 'x-user-id': 'user5' },
      payload: { ...base, targetAllocation: 95, minTokenAAllocation: 10, minTokenBAllocation: 10 },
    });
    expect(res.json()).toMatchObject({ targetAllocation: 90, minTokenAAllocation: 10, minTokenBAllocation: 10 });

    await app.close();
  });

  it('enforces ownership on instruction updates', async () => {
    const app = await buildServer();
    db.prepare('INSERT INTO users (id) VALUES (?)').run('owner');
    db.prepare('INSERT INTO users (id) VALUES (?)').run('intruder');

    const payload = {
      userId: 'owner',
      name: 'BTC 60 / ETH 40',
      tokenA: 'BTC',
      tokenB: 'ETH',
      targetAllocation: 60,
      minTokenAAllocation: 10,
      minTokenBAllocation: 20,
      risk: 'low',
      rebalance: '1h',
      agentInstructions: 'prompt',
    };

    const create = await app.inject({
      method: 'POST',
      url: '/api/agent-templates',
      headers: { 'x-user-id': 'owner' },
      payload,
    });
    const id = create.json().id as string;

    let res = await app.inject({
      method: 'PATCH',
      url: `/api/agent-templates/${id}/instructions`,
      headers: { 'x-user-id': 'intruder' },
      payload: { userId: 'intruder', agentInstructions: 'hack' },
    });
    expect(res.statusCode).toBe(403);

    res = await app.inject({
      method: 'PATCH',
      url: `/api/agent-templates/${id}/instructions`,
      headers: { 'x-user-id': 'owner' },
      payload: { userId: 'intruder', agentInstructions: 'hack' },
    });
    expect(res.statusCode).toBe(403);

    res = await app.inject({
      method: 'PATCH',
      url: '/api/agent-templates/missing/instructions',
      headers: { 'x-user-id': 'owner' },
      payload: { userId: 'owner', agentInstructions: 'prompt2' },
    });
    expect(res.statusCode).toBe(404);

    await app.close();
  });

  it('returns templates in reverse order', async () => {
    const app = await buildServer();
    db.prepare('INSERT INTO users (id) VALUES (?)').run('user6');

    const base = {
      userId: 'user6',
      name: 'base',
      tokenA: 'BTC',
      tokenB: 'ETH',
      targetAllocation: 60,
      minTokenAAllocation: 10,
      minTokenBAllocation: 20,
      risk: 'low',
      rebalance: '1h',
      agentInstructions: 'prompt',
    };

    let res = await app.inject({
      method: 'POST',
      url: '/api/agent-templates',
      headers: { 'x-user-id': 'user6' },
      payload: base,
    });
    const id1 = res.json().id as string;

    res = await app.inject({
      method: 'POST',
      url: '/api/agent-templates',
      headers: { 'x-user-id': 'user6' },
      payload: base,
    });
    const id2 = res.json().id as string;

    res = await app.inject({
      method: 'GET',
      url: '/api/agent-templates/paginated?page=1&pageSize=2',
      headers: { 'x-user-id': 'user6' },
    });
    expect(res.statusCode).toBe(200);
    const items = res.json().items as { id: string }[];
    expect(items[0].id).toBe(id2);
    expect(items[1].id).toBe(id1);

    await app.close();
  });
});
