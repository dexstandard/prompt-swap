import { describe, it, expect, vi } from 'vitest';

const callAiMock = vi.fn();
const extractJsonMock = vi.fn();

vi.mock('../src/util/ai.js', () => ({
  callAi: callAiMock,
  extractJson: extractJsonMock,
  compactJson: (v: unknown) => JSON.stringify(v),
}));

describe('performance analyst service', () => {
  it('falls back when AI response is malformed', async () => {
    callAiMock.mockResolvedValue('bad');
    extractJsonMock.mockReturnValue(null);
    const { getPerformanceAnalysis } = await import('../src/services/performance-analyst.js');
    const res = await getPerformanceAnalysis({ reports: [{}], orders: [] }, 'gpt', 'key');
    expect(res.analysis?.comment).toBe('Analysis unavailable');
    expect(res.analysis?.score).toBe(0);
  });

  it('falls back when AI request fails', async () => {
    callAiMock.mockRejectedValue(new Error('network'));
    const { getPerformanceAnalysis } = await import('../src/services/performance-analyst.js');
    const res = await getPerformanceAnalysis({ reports: [{}], orders: [] }, 'gpt', 'key');
    expect(res.analysis?.comment).toBe('Analysis unavailable');
    expect(res.analysis?.score).toBe(0);
  });
});
