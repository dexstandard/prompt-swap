import { describe, it, expect, vi } from 'vitest';
import type { RebalancePrompt } from '../src/util/ai.js';

describe('callRebalancingAgent structured output', () => {
  it('includes json schema in request', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ text: async () => '' });
    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = fetchMock;
    const { callRebalancingAgent } = await import('../src/util/ai.js');
    const prompt: RebalancePrompt = {
      instructions: 'inst',
      policy: { floor: { USDT: 20 } },
      portfolio: {
        ts: new Date().toISOString(),
        positions: [
          { sym: 'USDT', qty: 1, price_usdt: 1, value_usdt: 1 },
        ],
      },
      marketData: { currentPrice: 1 },
      previous_responses: [
        { shortReport: 'p1' },
        { rebalance: true, newAllocation: 50 },
      ],
    };
    await callRebalancingAgent('gpt-test', prompt, 'key');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, opts] = fetchMock.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(opts.body).toBe(JSON.stringify(body));
    expect(body.instructions).toMatch(/- Decide whether to rebalance/i);
    expect(body.instructions).toMatch(/On error, return \{error:"message"\}/i);
    const parsedInput = JSON.parse(body.input);
    expect(parsedInput.previous_responses).toEqual([
      { shortReport: 'p1' },
      { rebalance: true, newAllocation: 50 },
    ]);
    expect(body.input).not.toMatch(/":\s/);
    expect(body.input).not.toMatch(/,\s/);
    expect(body.text.format.type).toBe('json_schema');
    const anyOf = body.text.format.schema.properties.result.anyOf;
    expect(Array.isArray(anyOf)).toBe(true);
    expect(anyOf).toHaveLength(3);
    (globalThis as any).fetch = originalFetch;
  });

  it('removes extraneous whitespace from json input', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ text: async () => '' });
    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = fetchMock;
    const { callRebalancingAgent } = await import('../src/util/ai.js');
    const prompt = '{\n  "a": 1,\n  "b": 2\n}';
    await callRebalancingAgent('gpt-test', prompt as any, 'key');
    const [, opts] = fetchMock.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.input).toBe('{"a":1,"b":2}');
    (globalThis as any).fetch = originalFetch;
  });
});
