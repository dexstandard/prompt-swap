import { db } from '../db/index.js';

export interface ReviewRawLogInsert {
  agentId: string;
  prompt?: unknown;
  response: unknown;
}

export async function insertReviewRawLog(entry: ReviewRawLogInsert): Promise<string> {
  const { rows } = await db.query(
    'INSERT INTO agent_review_raw_log (agent_id, prompt, response) VALUES ($1, $2, $3) RETURNING id',
    [
      entry.agentId,
      entry.prompt === undefined ? '' : JSON.stringify(entry.prompt),
      JSON.stringify(entry.response),
    ],
  );
  return rows[0].id as string;
}
