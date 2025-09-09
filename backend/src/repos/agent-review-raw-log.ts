import { db } from '../db/index.js';

export interface ReviewRawLogInsert {
  agentId: string;
  prompt: unknown;
  response: unknown;
}

export async function insertReviewRawLog(entry: ReviewRawLogInsert): Promise<string> {
  const { rows } = await db.query(
    'INSERT INTO agent_review_raw_log (agent_id, prompt, response) VALUES ($1, $2, $3) RETURNING id',
    [entry.agentId, JSON.stringify(entry.prompt), JSON.stringify(entry.response)],
  );
  return rows[0].id as string;
}

export async function getPromptForReviewResult(
  agentId: string,
  resultId: string,
): Promise<string | null> {
  const { rows } = await db.query(
    `SELECT rl.prompt FROM agent_review_result rr
     JOIN agent_review_raw_log rl ON rr.raw_log_id = rl.id
     WHERE rr.id = $1 AND rr.agent_id = $2`,
    [resultId, agentId],
  );
  return rows[0]?.prompt ?? null;
}
