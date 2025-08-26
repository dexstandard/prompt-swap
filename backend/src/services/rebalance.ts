import type { FastifyBaseLogger } from 'fastify';
import { fetchPairData, createLimitOrder } from './binance.js';

export async function createRebalanceLimitOrder(opts: {
  userId: string;
  tokenA: string;
  tokenB: string;
  positions: { sym: string; value_usdt: number }[];
  newAllocation: number;
  log: FastifyBaseLogger;
}) {
  const { userId, tokenA, tokenB, positions, newAllocation, log } = opts;
  const posA = positions.find((p) => p.sym === tokenA);
  const posB = positions.find((p) => p.sym === tokenB);
  if (!posA || !posB) {
    log.error('missing position data');
    return;
  }
  const { currentPrice } = await fetchPairData(tokenA, tokenB);
  const total = posA.value_usdt + posB.value_usdt;
  const targetA = (newAllocation / 100) * total;
  const diff = targetA - posA.value_usdt;
  if (!diff) {
    log.info('no rebalance needed');
    return;
  }
  const side = diff > 0 ? 'BUY' : 'SELL';
  const quantity = Math.abs(diff) / currentPrice;
  const params = {
    symbol: `${tokenA}${tokenB}`.toUpperCase(),
    side,
    quantity,
    price: currentPrice,
  } as const;
  log.info({ order: params }, 'creating limit order');
  await createLimitOrder(userId, params);
}
