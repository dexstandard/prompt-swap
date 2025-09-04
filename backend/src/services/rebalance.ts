import type { FastifyBaseLogger } from 'fastify';
import { insertLimitOrder, type LimitOrderStatus } from '../repos/limit-orders.js';
import { fetchPairData, createLimitOrder } from './binance.js';

export async function createRebalanceLimitOrder(opts: {
  userId: string;
  tokens: string[];
  positions: { sym: string; value_usdt: number }[];
  newAllocation: number;
  reviewResultId: string;
  log: FastifyBaseLogger;
}) {
  const { userId, tokens, positions, newAllocation, reviewResultId, log } = opts;
  const [tokenA, tokenB] = tokens;
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
  try {
    const res = await createLimitOrder(userId, params);
    if (!res || res.orderId === undefined || res.orderId === null) {
      log.error('failed to create limit order');
      return;
    }
    await insertLimitOrder({
      userId,
      planned: params,
      status: 'open' as LimitOrderStatus,
      reviewResultId,
      orderId: String(res.orderId),
    });
  } catch (err) {
    log.error({ err }, 'failed to create limit order');
    throw err;
  }
}
