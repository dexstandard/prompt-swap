import axios from './axios';
import { Pool, NewPool } from '../types';

let pools: Pool[] = [
  {
    id: '1',
    name: 'Demo Pool',
    exchange: 'binance',
    symbols: ['BTCUSDT'],
    status: 'active',
    roi30d: 0,
    subscribers: 0,
    createdAt: new Date().toISOString(),
  },
];

export function setupMocks() {
  if (import.meta.env.VITE_USE_MOCKS !== 'true') return;

  axios.interceptors.request.use(async (config) => {
    const { method, url, data } = config;
    if (method === 'get' && url === '/pools') {
      config.adapter = async () => ({ data: pools, status: 200, statusText: 'OK', headers: {}, config });
    }
    if (method === 'post' && url === '/pools') {
      const payload: NewPool = JSON.parse(data as any);
      const pool: Pool = {
        ...payload,
        id: Math.random().toString(36).slice(2),
        exchange: payload.exchange as Pool['exchange'],
        status: 'active',
        roi30d: 0,
        subscribers: 0,
        createdAt: new Date().toISOString(),
      };
      pools = [pool, ...pools];
      config.adapter = async () => ({ data: pool, status: 200, statusText: 'OK', headers: {}, config });
    }
    if (method === 'patch' && url?.startsWith('/pools/')) {
      const id = url.split('/').pop()!;
      const payload = JSON.parse(data as any);
      pools = pools.map((p) => (p.id === id ? { ...p, ...payload } : p));
      const pool = pools.find((p) => p.id === id)!;
      config.adapter = async () => ({ data: pool, status: 200, statusText: 'OK', headers: {}, config });
    }
    return config;
  });
}
