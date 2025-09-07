import { db } from '../../src/db/index.js';

export async function getLimitOrders() {
  const { rows } = await db.query(
    'SELECT user_id, planned_json, status, review_result_id, order_id FROM limit_order',
  );
  return rows as {
    user_id: string;
    planned_json: string;
    status: string;
    review_result_id: string;
    order_id: string;
  }[];
}
