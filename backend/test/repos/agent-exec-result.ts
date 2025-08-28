import { db } from '../../src/db/index.js';
import { insertExecResult as insertExecResultProd } from '../../src/repos/agent-exec-result.js';

export function insertExecResult(entry: any) {
  return insertExecResultProd({
    agentId: entry.agentId,
    log: entry.log,
    rebalance: entry.rebalance,
    newAllocation: entry.newAllocation,
    shortReport: entry.shortReport,
    error: entry.error,
  });
}
