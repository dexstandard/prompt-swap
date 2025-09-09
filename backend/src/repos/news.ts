import { db } from '../db/index.js';
import type { NewsItem } from '../services/news.js';

export async function insertNews(items: NewsItem[]) {
  const filtered = items.filter((i) => i.tokens.length);
  if (!filtered.length) return;
  const params: any[] = [];
  const values: string[] = [];
  filtered.forEach((item, i) => {
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

export interface NewsRow {
  title: string;
  link: string;
  pub_date: string | null;
}

export async function getNewsByToken(
  token: string,
  limit = 20,
): Promise<NewsRow[]> {
  const { rows } = await db.query(
    `SELECT title, link, pub_date
       FROM news
      WHERE tokens @> ARRAY[$1]::text[]
   ORDER BY pub_date DESC NULLS LAST
      LIMIT $2`,
    [token, limit],
  );
  return rows as NewsRow[];
}
