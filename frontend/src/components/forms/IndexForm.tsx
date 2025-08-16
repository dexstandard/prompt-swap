import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import api from '../../lib/axios';
import { useUser } from '../../lib/user';
import { normalizeAllocations } from '../../lib/allocations';
import KeySection from './KeySection';
import BinanceKeySection from './BinanceKeySection';

const schema = z
  .object({
    tokenA: z.string().min(1, 'Token A is required'),
    tokenB: z.string().min(1, 'Token B is required'),
    targetAllocation: z
      .number()
      .min(0, 'Must be at least 0')
      .max(100, 'Must be 100 or less'),
    minTokenAAllocation: z
      .number()
      .min(0, 'Must be at least 0')
      .max(100, 'Must be 100 or less'),
    minTokenBAllocation: z
      .number()
      .min(0, 'Must be at least 0')
      .max(100, 'Must be 100 or less'),
    risk: z.enum(['low', 'medium', 'high']),
    rebalance: z.enum(['1h', '3h', '5h', '12h', '24h', '3d', '1w']),
    model: z.string().min(1, 'Model is required'),
    agentInstructions: z
      .string()
      .min(1, 'Trading agent instructions are required'),
  })
  .refine((data) => data.tokenA !== data.tokenB, {
    message: 'Tokens must be different',
    path: ['tokenB'],
  });

type FormValues = z.infer<typeof schema>;

const tokens = [
  { value: 'BTC', label: 'BTC' },
  { value: 'ETH', label: 'ETH' },
  { value: 'SOL', label: 'SOL' },
  { value: 'USDT', label: 'USDT' },
];

export default function IndexForm({
  onTokensChange,
}: {
  onTokensChange?: (tokenA: string, tokenB: string) => void;
}) {
  const { user } = useUser();
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
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      tokenA: 'USDT',
      tokenB: 'SOL',
      targetAllocation: 20,
      minTokenAAllocation: 0,
      minTokenBAllocation: 30,
      risk: 'low',
      rebalance: '1h',
      model: '',
      agentInstructions:
        'Manage this index using the defined parameters. Use news and real market data to catch lows and highs.',
    },
  });

  const tokenA = watch('tokenA');
  const tokenB = watch('tokenB');
  const targetAllocation = watch('targetAllocation');
  const minTokenAAllocation = watch('minTokenAAllocation');
  const minTokenBAllocation = watch('minTokenBAllocation');

  const modelsQuery = useQuery<string[]>({
    queryKey: ['openai-models', user?.id],
    enabled: !!user && hasOpenAIKey,
    queryFn: async () => {
      const res = await api.get(`/users/${user!.id}/models`);
      return res.data.models as string[];
    },
  });

  const hasModels = !!modelsQuery.data?.length;

  useEffect(() => {
    if (modelsQuery.data && modelsQuery.data.length) {
      setValue('model', modelsQuery.data[0]);
    }
  }, [modelsQuery.data, setValue]);

  useEffect(() => {
    onTokensChange?.(tokenA, tokenB);
  }, [tokenA, tokenB, onTokensChange]);

  useEffect(() => {
    const currentTarget = Number.isFinite(targetAllocation) ? targetAllocation : 0;
    const currentMinA = Number.isFinite(minTokenAAllocation)
      ? minTokenAAllocation
      : 0;
    const currentMinB = Number.isFinite(minTokenBAllocation)
      ? minTokenBAllocation
      : 0;
    const normalized = normalizeAllocations(
      currentTarget,
      currentMinA,
      currentMinB
    );
    if (
      normalized.targetAllocation !== currentTarget ||
      normalized.minTokenAAllocation !== currentMinA ||
      normalized.minTokenBAllocation !== currentMinB
    ) {
      setValue('targetAllocation', normalized.targetAllocation);
      setValue('minTokenAAllocation', normalized.minTokenAAllocation);
      setValue('minTokenBAllocation', normalized.minTokenBAllocation);
    }
  }, [
    targetAllocation,
    minTokenAAllocation,
    minTokenBAllocation,
    setValue,
  ]);

  const navigate = useNavigate();

  const onSubmit = handleSubmit(async (values) => {
    if (!user) return;
    const res = await api.post('/index-templates', {
      userId: user.id,
      ...values,
      tokenA: values.tokenA.toUpperCase(),
      tokenB: values.tokenB.toUpperCase(),
    });
    navigate(`/index-templates/${res.data.id}`);
  });

  return (
    <>
      <form
        onSubmit={onSubmit}
        className="bg-white shadow-md rounded p-6 space-y-4 w-96"
      >
        <h2 className="text-xl font-bold">Create Index</h2>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="tokenA">
            Token A
          </label>
          <select id="tokenA" {...register('tokenA')} className="w-full border rounded p-2">
            <option value="" disabled>
              Select a token
            </option>
            {tokens
              .filter((t) => t.value === tokenA || t.value !== tokenB)
              .map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="tokenB">
            Token B
          </label>
          <select id="tokenB" {...register('tokenB')} className="w-full border rounded p-2">
            <option value="" disabled>
              Select a token
            </option>
            {tokens
              .filter((t) => t.value === tokenB || t.value !== tokenA)
              .map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="targetAllocation">
          Target Allocation
        </label>
        <div className="flex items-center gap-2">
          <span className="w-24 text-right">
            {targetAllocation}% {tokenA.toUpperCase()}
          </span>
          <input
            id="targetAllocation"
            type="range"
            min={0}
            max={100}
            {...register('targetAllocation', { valueAsNumber: true })}
            value={targetAllocation}
            className="flex-1"
          />
          <span className="w-24">
            {100 - targetAllocation}% {tokenB.toUpperCase()}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            className="block text-sm font-medium mb-1"
            htmlFor="minTokenAAllocation"
          >
            Minimum {tokenA.toUpperCase()} allocation
          </label>
          <input
            id="minTokenAAllocation"
            type="number"
            {...register('minTokenAAllocation', { valueAsNumber: true })}
            min={0}
            max={100}
            className="w-full border rounded p-2"
          />
        </div>
        <div>
          <label
            className="block text-sm font-medium mb-1"
            htmlFor="minTokenBAllocation"
          >
            Minimum {tokenB.toUpperCase()} allocation
          </label>
          <input
            id="minTokenBAllocation"
            type="number"
            {...register('minTokenBAllocation', { valueAsNumber: true })}
            min={0}
            max={100}
            className="w-full border rounded p-2"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="risk">
            Risk Tolerance
          </label>
          <select
            id="risk"
            {...register('risk')}
            className="w-full border rounded p-2"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="rebalance">
            Rebalance Frequency
          </label>
          <select
            id="rebalance"
            {...register('rebalance')}
            className="w-full border rounded p-2"
          >
            <option value="1h">1 hour</option>
            <option value="3h">3 hours</option>
            <option value="5h">5 hours</option>
            <option value="12h">12 hours</option>
            <option value="24h">1 day</option>
            <option value="3d">3 days</option>
            <option value="1w">1 week</option>
          </select>
        </div>
      </div>
      {modelsQuery.data && modelsQuery.data.length ? (
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="model">
            Model
          </label>
          <select
            id="model"
            {...register('model')}
            className="w-full border rounded p-2"
          >
            {modelsQuery.data.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium mb-1">
            OpenAI key is required
          </label>
          {user && !hasOpenAIKey && <KeySection label="" />}
        </div>
      )}
      <div>
        <label
          className="block text-sm font-medium mb-1"
          htmlFor="agentInstructions"
        >
          Trading Agent Instructions
        </label>
        <textarea
          id="agentInstructions"
          {...register('agentInstructions')}
          className="w-full border rounded p-2 h-32"
        />
      </div>
      {!hasBinanceKey && (
        <div>
          <label className="block text-sm font-medium mb-1">
            Binance keys are required
          </label>
          {user && <BinanceKeySection label="" />}
        </div>
      )}
      {!user && (
        <p className="text-sm text-gray-600 mb-2">Log in to continue</p>
      )}
      <button
        type="submit"
        className={`w-full py-2 rounded ${
          user && hasModels && hasBinanceKey && !isSubmitting
            ? 'bg-blue-600 text-white'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        }`}
        disabled={!user || !hasModels || !hasBinanceKey || isSubmitting}
      >
        Save
      </button>
    </form>
    </>
  );
}
