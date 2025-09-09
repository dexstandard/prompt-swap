import Parser from 'rss-parser';
import { TOKENS } from '../util/tokens.js';

const parser = new Parser();

export const FEEDS = [
  'https://www.coindesk.com/arc/outboundfeeds/rss/',
  'https://cointelegraph.com/rss',
  'https://bitcoinist.com/feed/',
  'https://cryptopotato.com/feed/',
  'https://news.bitcoin.com/feed/',
];

export interface NewsItem {
  title: string;
  link: string;
  pubDate?: string;
  tokens: string[];
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|\[\]\\]/g, '\$&');
}

export function tagTokens(text: string): string[] {
  const matches: string[] = [];
  for (const { symbol, tags } of TOKENS) {
    for (const tag of tags) {
      const regex = new RegExp(`\\b${escapeRegex(tag)}\\b`, 'i');
      if (regex.test(text)) {
        matches.push(symbol);
        break;
      }
    }
  }
  return matches;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function isRecent(pubDate?: string, now: Date = new Date()): boolean {
  if (!pubDate) return false;
  const date = new Date(pubDate);
  if (isNaN(date.getTime())) return false;
  const cutoff = new Date(now.getTime() - DAY_MS);
  return date >= cutoff;
}

export async function fetchNews(now: Date = new Date()): Promise<NewsItem[]> {
  const items: NewsItem[] = [];
  for (const url of FEEDS) {
    try {
      const feed = await parser.parseURL(url);
      for (const item of feed.items) {
        if (!item.title || !item.link) continue;
        if (!isRecent(item.pubDate, now)) continue;
        const tokens = tagTokens(item.title);
        if (!tokens.length) continue;
        items.push({
          title: item.title,
          link: item.link,
          pubDate: new Date(item.pubDate!).toISOString(),
          tokens,
        });
      }
    } catch (err) {
      // ignore individual feed errors, caller will handle logging
    }
  }
  return items;
}
