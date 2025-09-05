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
    'Manage this index based on the configured parameters, actively monitoring real-time market data and relevant news to dynamically adjust positions, aiming to capture local highs for exits and local lows for entries to maximize performance within the defined allocation strategy. Ensure each trade is at least $0.02 in notional value; if that is not possible, ask the user to top up their balance.';

export const createAgentSchema = z
    .object({
        tokens: z
            .array(
                z.object({
                    token: z.string().min(1, 'Token is required'),
                    minAllocation: z
                        .number()
                        .min(0, 'Must be at least 0')
                        .max(95, 'Must be 95 or less'),
                })
            )
            .length(2),
        risk: z.enum(['low', 'medium', 'high']),
        reviewInterval: z.enum(['1h', '3h', '5h', '12h', '24h', '3d', '1w']),
    })
    .refine((data) => data.tokens[0].token !== data.tokens[1].token, {
        message: 'Tokens must be different',
        path: ['tokens', 1, 'token'],
    })
    .refine(
        (data) =>
            data.tokens[0].minAllocation + data.tokens[1].minAllocation <= 95,
        {
            message: 'Min allocations must leave at least 5% unallocated',
            path: ['tokens', 1, 'minAllocation'],
        }
    );

export type CreateAgentFormValues = z.infer<typeof createAgentSchema>;

export const createAgentDefaults: CreateAgentFormValues = {
    tokens: [
        {token: 'USDT', minAllocation: 0},
        {token: 'SOL', minAllocation: 30},
    ],
    risk: 'low',
    reviewInterval: '1h',
};

