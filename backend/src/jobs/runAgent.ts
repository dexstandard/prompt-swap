import { randomUUID } from 'node:crypto';
import type { FastifyBaseLogger } from 'fastify';
import OpenAI from 'openai';
import { db } from '../db/index.js';

interface AgentInfo {
  model: string;
  agent_instructions: string;
  review_interval: string;
}

function parseInterval(interval: string): number {
  const match = /^(\d+)([smhd])$/.exec(interval);
  if (!match) return 0;
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const mult: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return value * (mult[unit] ?? 0);
}

export async function runAgent(agentId: string, log: FastifyBaseLogger) {
  const row = db
    .prepare<[string], AgentInfo>(
      'SELECT a.model, t.agent_instructions, t.review_interval FROM agents a JOIN agent_templates t ON a.template_id = t.id WHERE a.id = ?'
    )
    .get(agentId) as AgentInfo | undefined;
  if (!row) return;

  let content = '';
  if (process.env.NODE_ENV !== 'test') {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    try {
      const resp = await client.responses.create({
        model: row.model,
        input: [{ role: 'user', content: row.agent_instructions }],
      });
      content = resp.output_text ?? '';
    } catch (err) {
      log.error({ err }, 'openai call failed');
    }
  } else {
    content = `simulated run for ${agentId}`;
  }

  db.prepare(
    'INSERT INTO agent_exec_log (id, agent_id, log, created_at) VALUES (?, ?, ?, ?)'
  ).run(randomUUID(), agentId, content, Date.now());

  const ms = parseInterval(row.review_interval);
  if (ms > 0) {
    setTimeout(() => runAgent(agentId, log), ms).unref();
  }
}
