import { db } from '../../src/db/index.js';
import {
  insertAgent as insertAgentProd,
  startAgent,
  stopAgent,
  deleteAgent,
} from '../../src/repos/portfolio-workflow.js';

export const insertAgent = (data: Parameters<typeof insertAgentProd>[0]) =>
  insertAgentProd({ cashToken: 'USDT', ...data });
export { startAgent, stopAgent, deleteAgent };

export async function setAgentStatus(id: string, status: string) {
  await db.query('UPDATE portfolio_workflow SET status = $1 WHERE id = $2', [status, id]);
}
