import {useEffect, useState} from 'react';
import type {ReactNode} from 'react';
import RiskDisplay from '../components/RiskDisplay';
import TokenDisplay from '../components/TokenDisplay';
import {useParams, useNavigate} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import axios from 'axios';
import api from '../lib/axios';
import {useUser} from '../lib/useUser';
import AiApiKeySection from '../components/forms/AiApiKeySection';
import ExchangeApiKeySection from '../components/forms/ExchangeApiKeySection';
import WalletBalances from '../components/WalletBalances';
import TradingAgentInstructions from '../components/TradingAgentInstructions';
import AgentTemplateName from '../components/AgentTemplateName';
import { useToast } from '../components/Toast';

interface AgentTemplateDetails {
    id: string;
    userId: string;
    name: string;
    tokenA: string;
    tokenB: string;
    targetAllocation: number;
    minTokenAAllocation: number;
    minTokenBAllocation: number;
    risk: string;
    reviewInterval: string;
    agentInstructions: string;
}

export default function ViewAgentTemplate() {
    const {id} = useParams();
    const navigate = useNavigate();
    const {user} = useUser();
    const toast = useToast();
    const {data} = useQuery({
        queryKey: ['agent-template', id, user?.id],
        queryFn: async () => {
            const res = await api.get(`/agent-templates/${id}`, {
                headers: {'x-user-id': user!.id},
            });
            return res.data as AgentTemplateDetails;
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
    const [instructions, setInstructions] = useState('');
    const [name, setName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    useEffect(() => {
        if (modelsQuery.data && modelsQuery.data.length) {
            setModel(modelsQuery.data[0]);
        }
    }, [modelsQuery.data]);
    useEffect(() => {
        if (data?.agentInstructions) {
            setInstructions(data.agentInstructions);
        }
    }, [data?.agentInstructions]);
    useEffect(() => {
        if (data?.name) {
            setName(data.name);
        }
    }, [data?.name]);

    if (!data) return <div className="p-4">Loading...</div>;

    const reviewIntervalMap: Record<string, string> = {
        '1h': '1 Hour',
        '3h': '3 Hours',
        '5h': '5 Hours',
        '12h': '12 Hours',
        '24h': '1 Day',
        '3d': '3 Days',
        '1w': '1 Week',
    };
    const reviewIntervalLabel = reviewIntervalMap[data.reviewInterval] ?? data.reviewInterval;

    function WarningSign({children}: { children: ReactNode }) {
        return (
            <div className="mt-2 p-4 text-sm text-red-600 border border-red-600 rounded bg-red-100">
                <div>{children}</div>
            </div>
        );
    }

    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold mb-2">Agent Template</h1>
            <AgentTemplateName templateId={data.id} name={name} onChange={setName} />
            <p className="flex items-center gap-1">
                <strong>Tokens:</strong>
                <TokenDisplay token={data.tokenA} />
                <span>/</span>
                <TokenDisplay token={data.tokenB} />
            </p>
            <p>
                <strong>Target Allocation:</strong> {data.targetAllocation} / {100 - data.targetAllocation}
            </p>
            <p>
                <strong>Minimum {data.tokenA.toUpperCase()} Allocation:</strong> {data.minTokenAAllocation}%
            </p>
            <p>
                <strong>Minimum {data.tokenB.toUpperCase()} Allocation:</strong> {data.minTokenBAllocation}%
            </p>
            <p className="flex items-center gap-1">
                <strong>Risk Tolerance:</strong> <RiskDisplay risk={data.risk} />
            </p>
            <p>
                <strong>Review Interval:</strong> {reviewIntervalLabel}
            </p>
            <TradingAgentInstructions
                templateId={data.id}
                instructions={instructions}
                onChange={setInstructions}
            />
            {user && !hasOpenAIKey && (
                <div className="mt-4">
                    <AiApiKeySection label="OpenAI API Key"/>
                </div>
            )}
            {user && hasOpenAIKey && modelsQuery.data && modelsQuery.data.length > 0 && (
                <div className="mt-4">
                    <h2 className="text-md font-bold">Model</h2>
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
                    <ExchangeApiKeySection exchange="binance" label="Binance API Credentials"/>
                </div>
            )}

            <div className="mt-4">
                <WalletBalances tokens={[data.tokenA, data.tokenB]} />
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
                        !isCreating && user && hasOpenAIKey && hasBinanceKey && modelsQuery.data?.length
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                    disabled={
                        isCreating ||
                        !user ||
                        !hasOpenAIKey ||
                        !hasBinanceKey ||
                        !modelsQuery.data?.length
                    }
                    onClick={async () => {
                        if (!user) return;
                        setIsCreating(true);
                        try {
                            const res = await api.post(
                                '/agents',
                                {
                                    templateId: id,
                                    userId: user.id,
                                    model,
                                },
                                {headers: {'x-user-id': user.id}}
                            );
                            navigate(`/agents/${res.data.id}`);
                        } catch (err) {
                            setIsCreating(false);
                            if (axios.isAxiosError(err) && err.response?.data?.error) {
                                toast.show(err.response.data.error);
                            } else {
                                toast.show('Failed to start agent');
                            }
                        }
                    }}
                >
                    Start Agent
                </button>
            </div>
        </div>
    );
}
