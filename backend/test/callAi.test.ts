import { describe, it, expect, vi } from 'vitest';

describe('callAi structured output', () => {
  it('includes json schema in request', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ text: async () => '' });
    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = fetchMock;
    const { callAi } = await import('../src/util/ai.js');
    await callAi('gpt-test', { foo: 'bar' }, 'key', ['p1', 'p2']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, opts] = fetchMock.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.instructions).toMatch(/assist a real trader/i);
    const parsedInput = JSON.parse(body.input);
    expect(parsedInput.previous_responses).toEqual(['p1', 'p2']);
    expect(body.text.format.type).toBe('json_schema');
    const anyOf = body.text.format.schema.properties.result.anyOf;
    expect(Array.isArray(anyOf)).toBe(true);
    expect(anyOf).toHaveLength(3);
    (globalThis as any).fetch = originalFetch;
  });
});
