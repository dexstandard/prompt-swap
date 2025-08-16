import {useParams} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import api from '../lib/axios';
import {useUser} from '../lib/user';
import React from "react";

interface IndexDetails {
    id: string;
    userId: string;
    tokenA: string;
    tokenB: string;
    targetAllocation: number;
    minTokenAAllocation: number;
    minTokenBAllocation: number;
    risk: string;
    rebalance: string;
    model: string;
    systemPrompt: string;
}

export default function ViewIndex() {
    const {id} = useParams();
    const {user} = useUser();
    const {data} = useQuery({
        queryKey: ['index-template', id],
        queryFn: async () => {
            const res = await api.get(`/index-templates/${id}`);
            return res.data as IndexDetails;
        },
        enabled: !!id,
    });

    const balanceA = useQuery({
        queryKey: ['binance-balance', user?.id, data?.tokenA?.toUpperCase()],
        enabled: !!user && !!data?.tokenA,
        queryFn: async () => {
            const res = await api.get(
                `/users/${user!.id}/binance-balance/${data!.tokenA.toUpperCase()}`,
                {headers: {'x-user-id': user!.id}}
            );
            return res.data as { asset: string; free: number; locked: number };
        },
    });

    const balanceB = useQuery({
        queryKey: ['binance-balance', user?.id, data?.tokenB?.toUpperCase()],
        enabled: !!user && !!data?.tokenB,
        queryFn: async () => {
            const res = await api.get(
                `/users/${user!.id}/binance-balance/${data!.tokenB.toUpperCase()}`,
                {headers: {'x-user-id': user!.id}}
            );
            return res.data as { asset: string; free: number; locked: number };
        },
    });

    if (!data) return <div className="p-4">Loading...</div>;

    function WarningSign({children}: { children: React.ReactNode }) {
        return (
            <div className="mt-2 p-4 text-sm text-red-600 border border-red-600 rounded bg-red-100">
                <div>{children}</div>
            </div>
        );
    }

    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">
                {`${data.tokenA.toUpperCase()} ${data.targetAllocation} / ${data.tokenB.toUpperCase()} ${100 - data.targetAllocation}`}
            </h1>
            <p>
                <strong>User ID:</strong> {data.userId}
            </p>
            <p>
                <strong>Target Allocation:</strong> {data.targetAllocation}/{100 - data.targetAllocation}
            </p>
            <p>
                <strong>Minimum {data.tokenA.toUpperCase()} Allocation:</strong> {data.minTokenAAllocation}%
            </p>
            <p>
                <strong>Minimum {data.tokenB.toUpperCase()} Allocation:</strong> {data.minTokenBAllocation}%
            </p>
            <p>
                <strong>Risk Tolerance:</strong> {data.risk}
            </p>
            <p>
                <strong>Rebalance Frequency:</strong> {data.rebalance}
            </p>
            <p>
                <strong>AI Model:</strong> {data.model}
            </p>
            <div className="mt-4">
                <h2 className="text-xl font-bold mb-2">Trading Agent Instructions</h2>
                <pre className="whitespace-pre-wrap">{data.systemPrompt}</pre>
            </div>
            <div className="mt-4">
                <h2 className="text-xl font-bold mb-2">Binance Balances</h2>
                <p>
                    <strong>{data.tokenA.toUpperCase()}:</strong>{' '}
                    {balanceA.isLoading
                        ? 'Loading...'
                        : (balanceA.data?.free ?? 0) + (balanceA.data?.locked ?? 0)}
                </p>
                <p>
                    <strong>{data.tokenB.toUpperCase()}:</strong>{' '}
                    {balanceB.isLoading
                        ? 'Loading...'
                        : (balanceB.data?.free ?? 0) + (balanceB.data?.locked ?? 0)}
                </p>
                <WarningSign>
                    Trading agent will use all available balance
                    for {data.tokenA.toUpperCase()} and {data.tokenB.toUpperCase()} in your Binance Spot wallet. Move excess
                    funds to futures wallet before trading.
                    <br/>
                    <strong>DON&#39;T MOVE FUNDS ON SPOT WALLET DURING TRADING!</strong> It will confuse the trading
                    agent and may lead to unexpected results.
                </WarningSign>
                <button
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
                    onClick={() => console.log('Start trading')}
                >
                    Start trading
                </button>
            </div>
        </div>
    );
}
