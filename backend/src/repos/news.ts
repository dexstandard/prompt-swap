import { db } from '../db/index.js';
import type { NewsItem } from '../services/news.js';

export async function insertNews(items: NewsItem[]) {
  if (!items.length) return;
  const params: any[] = [];
  const values: string[] = [];
  items.forEach((item, i) => {
    const base = i * 4;
    values.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`);
    params.push(item.title, item.link, item.pubDate ?? null, item.tokens);
  });
  await db.query(
    `INSERT INTO news (title, link, pub_date, tokens)
     VALUES ${values.join(', ')}
     ON CONFLICT (link) DO NOTHING`,
    params as any[],
  );
}
