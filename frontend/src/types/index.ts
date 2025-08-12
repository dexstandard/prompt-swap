import { z } from 'zod';

export const poolSchema = z.object({
  id: z.string(),
  name: z.string(),
  exchange: z.enum(['binance', 'bybit', 'okx']),
  symbols: z.array(z.string()),
  status: z.enum(['active', 'paused']),
  roi30d: z.number(),
  subscribers: z.number(),
  createdAt: z.string(),
});

export type Pool = z.infer<typeof poolSchema>;

export const newPoolSchema = z.object({
  name: z.string().min(1),
  exchange: z.string(),
  symbols: z.array(z.string()),
  riskPct: z.number(),
  maxPositions: z.number(),
  tpPct: z.number(),
  slPct: z.number(),
  notes: z.string().optional(),
});

export type NewPool = z.infer<typeof newPoolSchema>;
