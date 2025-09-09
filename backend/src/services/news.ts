import Parser from 'rss-parser';
import { TOKENS } from '../util/tokens.js';

const parser = new Parser();

const FEEDS = [
  'https://www.coindesk.com/arc/outboundfeeds/rss/',
  'https://cointelegraph.com/rss',
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

export async function fetchNews(): Promise<NewsItem[]> {
  const items: NewsItem[] = [];
  for (const url of FEEDS) {
    try {
      const feed = await parser.parseURL(url);
      for (const item of feed.items) {
        if (!item.title || !item.link) continue;
        const tokens = tagTokens(item.title);
        if (!tokens.length) continue;
        items.push({
          title: item.title,
          link: item.link,
          pubDate: item.pubDate,
          tokens,
        });
      }
    } catch (err) {
      // ignore individual feed errors, caller will handle logging
    }
  }
  return items;
}
