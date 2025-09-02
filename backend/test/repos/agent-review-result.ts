import { db } from '../../src/db/index.js';
import { insertReviewResult as insertReviewResultProd } from '../../src/repos/agent-review-result.js';

export function insertReviewResult(entry: any) {
  return insertReviewResultProd({
    agentId: entry.agentId,
    log: entry.log,
    rebalance: entry.rebalance,
    newAllocation: entry.newAllocation,
    shortReport: entry.shortReport,
    error: entry.error,
  });
}
