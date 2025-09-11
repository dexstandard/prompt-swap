import {createElement} from 'react';
import {z} from 'zod';
import RiskDisplay from '../components/RiskDisplay';

export const tokens = [
    {value: 'BTC', label: 'BTC'},
    {value: 'BNB', label: 'BNB'},
    {value: 'DOGE', label: 'DOGE'},
    {value: 'ETH', label: 'ETH'},
    {value: 'HBAR', label: 'HBAR'},
    {value: 'PEPE', label: 'PEPE'},
    {value: 'SHIB', label: 'SHIB'},
    {value: 'SOL', label: 'SOL'},
    {value: 'TON', label: 'TON'},
    {value: 'TRX', label: 'TRX'},
    {value: 'XRP', label: 'XRP'},
    {value: 'USDT', label: 'USDT'},
    {value: 'USDC', label: 'USDC'},
];

export const stableCoins = ['USDT', 'USDC'];

export const riskOptions = [
    {value: 'low', label: createElement(RiskDisplay, {risk: 'low'})},
    {value: 'medium', label: createElement(RiskDisplay, {risk: 'medium'})},
    {value: 'high', label: createElement(RiskDisplay, {risk: 'high'})},
];

export const reviewIntervalOptions = (t: (key: string) => string) => [
    {value: '10m', label: t('review_interval_10m')},
    {value: '15m', label: t('review_interval_15m')},
    {value: '30m', label: t('review_interval_30m')},
    {value: '1h', label: t('review_interval_1h')},
    {value: '3h', label: t('review_interval_3h')},
    {value: '5h', label: t('review_interval_5h')},
    {value: '12h', label: t('review_interval_12h')},
    {value: '24h', label: t('review_interval_24h')},
    {value: '3d', label: t('review_interval_3d')},
    {value: '1w', label: t('review_interval_1w')},
];

export const DEFAULT_AGENT_INSTRUCTIONS =
    'Day trade this pair and determine the target allocation yourself. Monitor real-time market data and news, trimming positions after rallies and adding to them after dips to stay within policy floors while exploiting intraday swings.';

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
        reviewInterval: z.enum([
            '10m',
            '15m',
            '30m',
            '1h',
            '3h',
            '5h',
            '12h',
            '24h',
            '3d',
            '1w',
        ]),
    })
    .refine((data) => data.tokens[0].token !== data.tokens[1].token, {
        message: 'Tokens must be different',
        path: ['tokens', 1, 'token'],
    })
    .refine(
        (data) =>
            !(
                stableCoins.includes(data.tokens[0].token.toUpperCase()) &&
                stableCoins.includes(data.tokens[1].token.toUpperCase())
            ),
        {
            message: 'Stablecoin pairs are not allowed',
            path: ['tokens', 1, 'token'],
        }
    )
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
    reviewInterval: '30m',
};

