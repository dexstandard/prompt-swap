import { db } from '../db/index.js';

export type LimitOrderStatus = 'open' | 'filled' | 'canceled';

export interface LimitOrderEntry {
  userId: string;
  planned: Record<string, unknown>;
  status: LimitOrderStatus;
  reviewResultId: string;
  orderId: string;
}

export async function insertLimitOrder(entry: LimitOrderEntry): Promise<void> {
  await db.query(
    'INSERT INTO limit_order (user_id, planned_json, status, review_result_id, order_id) VALUES ($1, $2, $3, $4, $5)',
    [
      entry.userId,
      JSON.stringify(entry.planned),
      entry.status,
      entry.reviewResultId,
      entry.orderId,
    ],
  );
}

export async function cancelOpenLimitOrdersByAgent(
  agentId: string,
): Promise<void> {
  await db.query(
    `UPDATE limit_order e
        SET status = 'canceled'
       FROM agent_review_result r
      WHERE e.status = 'open'
        AND e.review_result_id = r.id
        AND r.agent_id = $1`,
    [agentId],
  );
}

export async function getLimitOrdersByReviewResult(
  agentId: string,
  reviewResultId: string,
): Promise<{ planned_json: string; status: LimitOrderStatus }[]> {
  const { rows } = await db.query(
    `SELECT e.planned_json, e.status
       FROM limit_order e
       JOIN agent_review_result r ON e.review_result_id = r.id
      WHERE r.agent_id = $1 AND e.review_result_id = $2`,
    [agentId, reviewResultId],
  );
  return rows as { planned_json: string; status: LimitOrderStatus }[];
}
