import type { FastifyBaseLogger } from 'fastify';
import { insertLimitOrder, type LimitOrderStatus } from '../repos/limit-orders.js';
import { fetchPairData, fetchPairInfo, createLimitOrder } from './binance.js';

export const MIN_LIMIT_ORDER_USD = 0.02;

export async function calcRebalanceOrder(opts: {
  tokens: string[];
  positions: { sym: string; value_usdt: number }[];
  newAllocation: number;
}) {
  const { tokens, positions, newAllocation } = opts;
  const [token1, token2] = tokens;
  const pos1 = positions.find((p) => p.sym === token1);
  const pos2 = positions.find((p) => p.sym === token2);
  if (!pos1 || !pos2) return null;
  const { currentPrice } = await fetchPairData(token1, token2);
  const total = pos1.value_usdt + pos2.value_usdt;
  const target1 = (newAllocation / 100) * total;
  const diff = target1 - pos1.value_usdt;
  if (!diff || Math.abs(diff) < MIN_LIMIT_ORDER_USD) return null;
  const side = diff > 0 ? 'BUY' : 'SELL';
  const quantity = Math.abs(diff) / currentPrice;
  const better = side === 'BUY' ? 0.999 : 1.001;
  const price = currentPrice * better;
  return { side, quantity, price } as const;
}

export async function createRebalanceLimitOrder(opts: {
  userId: string;
  tokens: string[];
  positions: { sym: string; value_usdt: number }[];
  newAllocation: number;
  reviewResultId: string;
  log: FastifyBaseLogger;
  price?: number;
  quantity?: number;
  manuallyEdited?: boolean;
}) {
  const {
    userId,
    tokens,
    positions,
    newAllocation,
    reviewResultId,
    log,
    price,
    quantity,
    manuallyEdited,
  } = opts;
  const [token1, token2] = tokens;
  const order = await calcRebalanceOrder({ tokens, positions, newAllocation });
  if (!order) {
    log.info('no rebalance needed');
    return;
  }
  const info = await fetchPairInfo(token1, token2);
  const qty = quantity ?? order.quantity;
  const prc = price ?? order.price;
  const params = {
    symbol: info.symbol,
    side: order.side,
    quantity: Number(qty.toFixed(info.quantityPrecision)),
    price: Number(prc.toFixed(info.pricePrecision)),
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
      planned: { ...params, manuallyEdited: manuallyEdited ?? false },
      status: 'open' as LimitOrderStatus,
      reviewResultId,
      orderId: String(res.orderId),
    });
  } catch (err) {
    log.error({ err }, 'failed to create limit order');
    throw err;
  }
}
