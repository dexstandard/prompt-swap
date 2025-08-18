import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import api from '../../lib/axios';
import { useUser } from '../../lib/useUser';
import { normalizeAllocations } from '../../lib/allocations';
import TokenSelect from './TokenSelect';
import TextInput from './TextInput';
import SelectInput from './SelectInput';
import FormField from './FormField';
import RiskDisplay from '../RiskDisplay';
import Button from '../ui/Button';
import { useToast } from '../Toast';

const schema = z
  .object({
    name: z.string().max(50).optional(),
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
    reviewInterval: z.enum(['1h', '3h', '5h', '12h', '24h', '3d', '1w']),
    agentInstructions: z.string().max(2000).optional(),
  })
  .refine((data) => data.tokenA !== data.tokenB, {
    message: 'Tokens must be different',
    path: ['tokenB'],
  });

export type AgentFormValues = z.infer<typeof schema>;

const tokens = [
  { value: 'BTC', label: 'BTC' },
  { value: 'ETH', label: 'ETH' },
  { value: 'SOL', label: 'SOL' },
  { value: 'USDT', label: 'USDT' },
];

const riskOptions = [
  { value: 'low', label: <RiskDisplay risk="low" /> },
  { value: 'medium', label: <RiskDisplay risk="medium" /> },
  { value: 'high', label: <RiskDisplay risk="high" /> },
];

const reviewIntervalOptions = [
  { value: '1h', label: '1 Hour' },
  { value: '3h', label: '3 Hours' },
  { value: '5h', label: '5 Hours' },
  { value: '12h', label: '12 Hours' },
  { value: '24h', label: '1 Day' },
  { value: '3d', label: '3 Days' },
  { value: '1w', label: '1 Week' },
];

const DEFAULT_AGENT_INSTRUCTIONS =
  'Manage this index based on the configured parameters, actively monitoring real-time market data and relevant news to dynamically adjust positions, aiming to capture local highs for exits and local lows for entries to maximize performance within the defined allocation strategy.';

const defaultValues: AgentFormValues = {
  name: '',
  tokenA: 'USDT',
  tokenB: 'SOL',
  targetAllocation: 20,
  minTokenAAllocation: 0,
  minTokenBAllocation: 30,
  risk: 'low',
  reviewInterval: '1h',
  agentInstructions: DEFAULT_AGENT_INSTRUCTIONS,
};

interface AgentFormProps {
  agent?: { id: string } & Partial<AgentFormValues>;
  onTokensChange?: (a: string, b: string) => void;
  onSubmitSuccess?: () => void;
  onCancel?: () => void;
}

export default function AgentForm({
  agent,
  onTokensChange,
  onSubmitSuccess,
  onCancel,
}: AgentFormProps) {
  const { user } = useUser();
  const toast = useToast();
  const queryClient = useQueryClient();
  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { isSubmitting },
  } = useForm<AgentFormValues>({
    resolver: zodResolver(schema),
    defaultValues: agent ? { ...defaultValues, ...agent } : defaultValues,
  });

  const tokenAWatch = watch('tokenA');
  const tokenBWatch = watch('tokenB');

  useEffect(() => {
    onTokensChange?.(tokenAWatch, tokenBWatch);
  }, [tokenAWatch, tokenBWatch, onTokensChange]);

  return (
    <form
      className="flex flex-col gap-4 w-full max-w-md"
      onSubmit={handleSubmit(async (values) => {
        if (!user) return;
        const payload = normalizeAllocations({
          ...values,
          userId: user.id,
          status: 'inactive',
          draft: true,
        });
        try {
          if (agent) {
            await api.put(`/agents/${agent.id}`, payload);
          } else {
            await api.post('/agents', payload);
            reset(defaultValues);
          }
          await queryClient.invalidateQueries({ queryKey: ['agents'] });
          onSubmitSuccess?.();
        } catch (err) {
          if (axios.isAxiosError(err) && err.response?.data?.error) {
            toast.show(err.response.data.error);
          } else {
            toast.show('Failed to save agent');
          }
        }
      })}
    >
      <FormField label="Name" htmlFor="name">
        <Controller
          name="name"
          control={control}
          render={({ field }) => (
            <TextInput id="name" {...field} placeholder="My Agent" />
          )}
        />
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Token A" htmlFor="tokenA">
          <Controller
            name="tokenA"
            control={control}
            render={({ field }) => (
              <TokenSelect id="tokenA" value={field.value} onChange={field.onChange} options={tokens} />
            )}
          />
        </FormField>
        <FormField label="Token B" htmlFor="tokenB">
          <Controller
            name="tokenB"
            control={control}
            render={({ field }) => (
              <TokenSelect id="tokenB" value={field.value} onChange={field.onChange} options={tokens} />
            )}
          />
        </FormField>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <FormField label="Target %" htmlFor="targetAllocation">
          <Controller
            name="targetAllocation"
            control={control}
            render={({ field }) => (
              <TextInput
                id="targetAllocation"
                type="number"
                value={field.value}
                onChange={(e) => field.onChange(Number(e.target.value))}
              />
            )}
          />
        </FormField>
        <FormField label="Min Token A %" htmlFor="minTokenAAllocation">
          <Controller
            name="minTokenAAllocation"
            control={control}
            render={({ field }) => (
              <TextInput
                id="minTokenAAllocation"
                type="number"
                value={field.value}
                onChange={(e) => field.onChange(Number(e.target.value))}
              />
            )}
          />
        </FormField>
        <FormField label="Min Token B %" htmlFor="minTokenBAllocation">
          <Controller
            name="minTokenBAllocation"
            control={control}
            render={({ field }) => (
              <TextInput
                id="minTokenBAllocation"
                type="number"
                value={field.value}
                onChange={(e) => field.onChange(Number(e.target.value))}
              />
            )}
          />
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Risk Tolerance" htmlFor="risk">
          <Controller
            name="risk"
            control={control}
            render={({ field }) => (
              <SelectInput id="risk" value={field.value} onChange={field.onChange} options={riskOptions} />
            )}
          />
        </FormField>
        <FormField label="Review Interval" htmlFor="reviewInterval">
          <Controller
            name="reviewInterval"
            control={control}
            render={({ field }) => (
              <SelectInput
                id="reviewInterval"
                value={field.value}
                onChange={field.onChange}
                options={reviewIntervalOptions}
              />
            )}
          />
        </FormField>
      </div>
      <FormField label="Instructions" htmlFor="agentInstructions">
        <Controller
          name="agentInstructions"
          control={control}
          render={({ field }) => (
            <textarea
              id="agentInstructions"
              className="border rounded p-2 w-full"
              rows={4}
              {...field}
            />
          )}
        />
      </FormField>
      {!user && <p className="text-sm text-gray-600">Log in to continue</p>}
      <div className="flex gap-2">
        <Button type="submit" className="flex-1" disabled={!user} loading={isSubmitting}>
          {agent ? 'Update Draft' : 'Save Draft'}
        </Button>
        {agent && onCancel && (
          <Button type="button" variant="secondary" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
