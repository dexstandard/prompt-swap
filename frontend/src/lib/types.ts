export type LimitOrderStatus = 'open' | 'filled' | 'canceled';

export interface LimitOrder {
  id: string;
  side: string;
  quantity: number;
  price: number;
  status: LimitOrderStatus;
  createdAt: number;
}
