export type LimitOrderStatus = 'open' | 'filled' | 'canceled';

export interface LimitOrder {
  side: string;
  quantity: number;
  price: number;
  status: LimitOrderStatus;
}

export interface ApiError {
  error: string;
}
