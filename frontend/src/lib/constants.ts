import {createElement} from 'react';
import {z} from 'zod';
import RiskDisplay from '../components/RiskDisplay';

export const tokens = [
    {value: 'BTC', label: 'BTC'},
    {value: 'ETH', label: 'ETH'},
    {value: 'SOL', label: 'SOL'},
    {value: 'USDT', label: 'USDT'},
];

export const riskOptions = [
    {value: 'low', label: createElement(RiskDisplay, {risk: 'low'})},
    {value: 'medium', label: createElement(RiskDisplay, {risk: 'medium'})},
    {value: 'high', label: createElement(RiskDisplay, {risk: 'high'})},
];

export const reviewIntervalOptions = [
    {value: '1h', label: '1 Hour'},
    {value: '3h', label: '3 Hours'},
    {value: '5h', label: '5 Hours'},
    {value: '12h', label: '12 Hours'},
    {value: '24h', label: '1 Day'},
    {value: '3d', label: '3 Days'},
    {value: '1w', label: '1 Week'},
];

export const DEFAULT_AGENT_INSTRUCTIONS =
    'Manage this index based on the configured parameters, actively monitoring real-time market data and relevant news to dynamically adjust positions, aiming to capture local highs for exits and local lows for entries to maximize performance within the defined allocation strategy.';

export const createAgentSchema = z
    .object({
        tokenA: z.string().min(1, 'Token A is required'),
        tokenB: z.string().min(1, 'Token B is required'),
        minTokenAAllocation: z
            .number()
            .min(0, 'Must be at least 0')
            .max(95, 'Must be 95 or less'),
        minTokenBAllocation: z
            .number()
            .min(0, 'Must be at least 0')
            .max(95, 'Must be 95 or less'),
        risk: z.enum(['low', 'medium', 'high']),
        reviewInterval: z.enum(['1h', '3h', '5h', '12h', '24h', '3d', '1w']),
    })
    .refine((data) => data.tokenA !== data.tokenB, {
        message: 'Tokens must be different',
        path: ['tokenB'],
    })
    .refine(
        (data) => data.minTokenAAllocation + data.minTokenBAllocation <= 95,
        {
            message: 'Min allocations must leave at least 5% unallocated',
            path: ['minTokenBAllocation'],
        }
    );

export type CreateAgentFormValues = z.infer<typeof createAgentSchema>;

export const createAgentDefaults: CreateAgentFormValues = {
    tokenA: 'USDT',
    tokenB: 'SOL',
    minTokenAAllocation: 0,
    minTokenBAllocation: 30,
    risk: 'low',
    reviewInterval: '1h',
};

