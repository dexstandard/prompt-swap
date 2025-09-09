import type { FastifyBaseLogger } from 'fastify';
import { fetchNews } from '../services/news.js';

export default async function fetchNewsJob(log: FastifyBaseLogger) {
  try {
    const news = await fetchNews();
    for (const item of news) {
      if (item.tokens.length) {
        log.info({ title: item.title, tokens: item.tokens, link: item.link }, 'news item');
      }
    }
  } catch (err) {
    log.error({ err }, 'failed to fetch news');
  }
}
