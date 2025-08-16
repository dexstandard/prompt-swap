import {ReactNode, useEffect, useState} from 'react';
import {useParams} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import axios from 'axios';
import api from '../lib/axios';
import {useUser} from '../lib/useUser';
import KeySection from '../components/forms/KeySection';
import BinanceKeySection from '../components/forms/BinanceKeySection';

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
    agentInstructions: string;
}

export default function ViewIndex() {
    const {id} = useParams();
    const {user} = useUser();
    const {data} = useQuery({
        queryKey: ['index-template', id, user?.id],
        queryFn: async () => {
            const res = await api.get(`/index-templates/${id}`, {
                headers: {'x-user-id': user!.id},
            });
            return res.data as IndexDetails;
        },
        enabled: !!id && !!user,
    });
    const aiKeyQuery = useQuery<string | null>({
        queryKey: ['ai-key', user?.id],
        enabled: !!user,
        queryFn: async () => {
            try {
                const res = await api.get(`/users/${user!.id}/ai-key`);
                return res.data.key as string;
            } catch (err) {
                if (axios.isAxiosError(err) && err.response?.status === 404) return null;
                throw err;
            }
        },
    });
    const hasOpenAIKey = !!aiKeyQuery.data;
    const binanceKeyQuery = useQuery<string | null>({
        queryKey: ['binance-key', user?.id],
        enabled: !!user,
        queryFn: async () => {
            try {
                const res = await api.get(`/users/${user!.id}/binance-key`);
                return res.data.key as string;
            } catch (err) {
                if (axios.isAxiosError(err) && err.response?.status === 404) return null;
                throw err;
            }
        },
    });
    const hasBinanceKey = !!binanceKeyQuery.data;
    const modelsQuery = useQuery<string[]>({
        queryKey: ['openai-models', user?.id],
        enabled: !!user && hasOpenAIKey,
        queryFn: async () => {
            const res = await api.get(`/users/${user!.id}/models`);
            return res.data.models as string[];
        },
    });
    const [model, setModel] = useState('');
    useEffect(() => {
        if (modelsQuery.data && modelsQuery.data.length) {
            setModel(modelsQuery.data[0]);
        }
    }, [modelsQuery.data]);

    const balanceA = useQuery({
        queryKey: ['binance-balance', user?.id, data?.tokenA?.toUpperCase()],
        enabled: !!user && hasBinanceKey && !!data?.tokenA,
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
        enabled: !!user && hasBinanceKey && !!data?.tokenB,
        queryFn: async () => {
            const res = await api.get(
                `/users/${user!.id}/binance-balance/${data!.tokenB.toUpperCase()}`,
                {headers: {'x-user-id': user!.id}}
            );
            return res.data as { asset: string; free: number; locked: number };
        },
    });

    if (!data) return <div className="p-4">Loading...</div>;

    function WarningSign({children}: { children: ReactNode }) {
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
            <div className="mt-4">
                <h2 className="text-xl font-bold mb-2">Trading Agent Instructions</h2>
                <pre className="whitespace-pre-wrap">{data.agentInstructions}</pre>
            </div>
            {user && !hasOpenAIKey && (
                <div className="mt-4">
                    <KeySection label=""/>
                </div>
            )}
            {user && hasOpenAIKey && modelsQuery.data && modelsQuery.data.length > 0 && (
                <div className="mt-4">
                    <label className="block text-sm font-medium mb-1" htmlFor="model">Model</label>
                    <select
                        id="model"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        className="border rounded p-2"
                    >
                        {modelsQuery.data.map((m) => (
                            <option key={m} value={m}>
                                {m}
                            </option>
                        ))}
                    </select>
                </div>
            )}
            {user && !hasBinanceKey && (
                <div className="mt-4">
                    <BinanceKeySection label=""/>
                </div>
            )}

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
                    for {data.tokenA.toUpperCase()} and {data.tokenB.toUpperCase()} in your Binance Spot wallet. Move
                    excess funds to futures wallet before trading.
                    <br/>
                    <strong>DON&#39;T MOVE FUNDS ON SPOT WALLET DURING TRADING!</strong> It will confuse the trading
                    agent and may lead to unexpected results.
                </WarningSign>
                {!user && (
                    <p className="text-sm text-gray-600 mb-2 mt-4">Log in to continue</p>
                )}
                <button
                    className={`mt-4 px-4 py-2 rounded ${
                        user && hasOpenAIKey && hasBinanceKey && modelsQuery.data?.length
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                    disabled={!user || !hasOpenAIKey || !hasBinanceKey || !modelsQuery.data?.length}
                    onClick={async () => {
                        if (!user) return;
                        await api.post(
                            '/index-agents',
                            {
                                templateId: id,
                                userId: user.id,
                                model,
                            },
                            {headers: {'x-user-id': user.id}}
                        );
                    }}
                >
                    Start trading
                </button>
            </div>
        </div>
    );
}
