import { describe, it, expect } from 'vitest';
import { tagTokens } from '../src/services/news.js';

describe('tagTokens', () => {
  it('detects token tags case-insensitively', () => {
    const res = tagTokens('Bitcoin and HeDeRa rally while eth falls');
    expect(res.sort()).toEqual(['BTC', 'HBAR', 'ETH'].sort());
  });
});
