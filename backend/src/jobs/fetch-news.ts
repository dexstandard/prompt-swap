import type { FastifyBaseLogger } from 'fastify';
import { fetchNews } from '../services/news.js';
import { insertNews } from '../repos/news.js';

export default async function fetchNewsJob(log: FastifyBaseLogger) {
  try {
    const news = await fetchNews();
    await insertNews(news);
    for (const item of news) {
      if (item.tokens.length) {
        log.info({ title: item.title, tokens: item.tokens, link: item.link }, 'news item');
      }
    }
  } catch (err) {
    log.error({ err }, 'failed to fetch news');
  }
}
