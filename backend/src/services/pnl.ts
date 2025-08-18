import { db } from '../db/index.js';
import { fetchTotalBalanceUsd } from './binance.js';

export async function calculatePnl(agentId: string, userId: string) {
  const row = db
    .prepare('SELECT start_balance FROM agents WHERE id = ? AND user_id = ?')
    .get(agentId, userId) as { start_balance: number } | undefined;
  if (!row) return null;
  const currentBalanceUsd = await fetchTotalBalanceUsd(userId);
  if (currentBalanceUsd === null) return null;
  const startBalanceUsd = row.start_balance;
  return {
    startBalanceUsd,
    currentBalanceUsd,
    pnlUsd: currentBalanceUsd - startBalanceUsd,
  };
}
