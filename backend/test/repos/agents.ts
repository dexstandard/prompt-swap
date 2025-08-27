import { db } from '../../src/db/index.js';
import {
  insertAgent as insertAgentProd,
  startAgent,
  stopAgent,
  deleteAgent,
} from '../../src/repos/agents.js';

export const insertAgent = insertAgentProd;
export { startAgent, stopAgent, deleteAgent };

export function clearAgents() {
  db.prepare('DELETE FROM agents').run();
}

export function setAgentStatus(id: string, status: string) {
  db.prepare('UPDATE agents SET status = $1 WHERE id = $2').run(status, id);
}
