import { describe, it, expect } from 'vitest';
import { tagTokens } from '../src/services/news.js';
import { insertNews } from '../src/repos/news.js';
import { db } from '../src/db/index.js';

describe('tagTokens', () => {
  it('detects token tags case-insensitively', () => {
    const res = tagTokens('Bitcoin and HeDeRa rally while eth falls');
    expect(res.sort()).toEqual(['BTC', 'HBAR', 'ETH'].sort());
  });
});

describe('insertNews', () => {
  it('avoids inserting duplicates by link', async () => {
    const item = {
      title: 'BTC rises',
      link: 'https://example.com/btc',
      pubDate: new Date().toISOString(),
      tokens: ['BTC'],
    };
    await insertNews([item]);
    await insertNews([item]);
    const { rows } = await db.query('SELECT title, link, tokens FROM news');
    expect(rows).toHaveLength(1);
    expect(rows[0].tokens).toEqual(['BTC']);
  });

  it('skips items without token matches', async () => {
    const item = {
      title: 'General market news',
      link: 'https://example.com/general',
      pubDate: new Date().toISOString(),
      tokens: [],
    };
    await insertNews([item]);
    const { rows } = await db.query('SELECT 1 FROM news WHERE link = $1', [item.link]);
    expect(rows).toHaveLength(0);
  });
});
