import { db } from '../../src/db/index.js';
import { insertReviewRawLog as insertReviewRawLogProd } from '../../src/repos/agent-review-raw-log.js';

export function insertReviewRawLog(entry: any) {
  return insertReviewRawLogProd({
    agentId: entry.agentId,
    prompt: entry.prompt,
    response: entry.response,
  });
}

export async function getAgentReviewRawResponses(agentId: string) {
  const { rows } = await db.query(
    'SELECT response FROM agent_review_raw_log WHERE agent_id = $1',
    [agentId],
  );
  return rows as { response: string | null }[];
}

export async function getAgentReviewRawPromptsResponses(agentId: string) {
  const { rows } = await db.query(
    'SELECT prompt, response FROM agent_review_raw_log WHERE agent_id = $1',
    [agentId],
  );
  return rows as { prompt: string | null; response: string | null }[];
}
