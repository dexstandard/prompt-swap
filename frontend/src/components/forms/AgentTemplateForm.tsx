import {useEffect} from 'react';
import {useNavigate} from 'react-router-dom';
import {Controller, useForm} from 'react-hook-form';
import {z} from 'zod';
import {zodResolver} from '@hookform/resolvers/zod';
import {useQueryClient} from '@tanstack/react-query';
import api from '../../lib/axios';
import {useUser} from '../../lib/useUser';
import {normalizeAllocations} from '../../lib/allocations';
import TokenSelect from './TokenSelect';
import TextInput from './TextInput';
import SelectInput from './SelectInput';
import FormField from './FormField';
import RiskDisplay from '../RiskDisplay';
import axios from 'axios';
import { useToast } from '../Toast';
import Button from '../ui/Button';

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
        reviewInterval: z.enum(['1h', '3h', '5h', '12h', '24h', '3d', '1w']),
    })
    .refine((data) => data.tokenA !== data.tokenB, {
        message: 'Tokens must be different',
        path: ['tokenB'],
    });

type FormValues = z.infer<typeof schema>;

const tokens = [
    {value: 'BTC', label: 'BTC'},
    {value: 'ETH', label: 'ETH'},
    {value: 'SOL', label: 'SOL'},
    {value: 'USDT', label: 'USDT'},
];

const riskOptions = [
    {value: 'low', label: <RiskDisplay risk="low" />},
    {value: 'medium', label: <RiskDisplay risk="medium" />},
    {value: 'high', label: <RiskDisplay risk="high" />},
];

const reviewIntervalOptions = [
    {value: '1h', label: '1 Hour'},
    {value: '3h', label: '3 Hours'},
    {value: '5h', label: '5 Hours'},
    {value: '12h', label: '12 Hours'},
    {value: '24h', label: '1 Day'},
    {value: '3d', label: '3 Days'},
    {value: '1w', label: '1 Week'},
];

const DEFAULT_AGENT_INSTRUCTIONS =
    'Manage this index based on the configured parameters, actively monitoring real-time market data and relevant news to dynamically adjust positions, aiming to capture local highs for exits and local lows for entries to maximize performance within the defined allocation strategy.';

const defaultValues: FormValues = {
    tokenA: 'USDT',
    tokenB: 'SOL',
    targetAllocation: 20,
    minTokenAAllocation: 0,
    minTokenBAllocation: 30,
    risk: 'low',
    reviewInterval: '1h',
};

export default function AgentTemplateForm({
                                      onTokensChange,
                                      template,
                                      onSubmitSuccess,
                                      onCancel,
                                  }: {
    onTokensChange?: (tokenA: string, tokenB: string) => void;
    template?: {
        id: string;
        tokenA: string;
        tokenB: string;
        targetAllocation: number;
        minTokenAAllocation: number;
        minTokenBAllocation: number;
        risk: string;
        reviewInterval: string;
        agentInstructions: string;
    };
    onSubmitSuccess?: () => void;
    onCancel?: () => void;
}) {
    const {user} = useUser();
    const queryClient = useQueryClient();
    const {
        register,
        handleSubmit,
        watch,
        setValue,
        control,
        reset,
        formState: {isSubmitting},
    } = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues,
    });

    useEffect(() => {
        if (template) {
            reset({
                tokenA: template.tokenA,
                tokenB: template.tokenB,
                targetAllocation: template.targetAllocation,
                minTokenAAllocation: template.minTokenAAllocation,
                minTokenBAllocation: template.minTokenBAllocation,
                risk: template.risk as any,
                reviewInterval: template.reviewInterval as any,
            });
        } else {
            reset(defaultValues);
        }
    }, [template, reset]);

    const tokenA = watch('tokenA');
    const tokenB = watch('tokenB');
    const targetAllocation = watch('targetAllocation');
    const minTokenAAllocation = watch('minTokenAAllocation');
    const minTokenBAllocation = watch('minTokenBAllocation');

    

    useEffect(() => {
        onTokensChange?.(tokenA, tokenB);
        // onTokensChange is stable via useCallback in parent
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tokenA, tokenB]);

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
    const toast = useToast();

    const onSubmit = handleSubmit(async (values) => {
        if (!user) return;
        try {
            const {targetAllocation} = normalizeAllocations(
                values.targetAllocation,
                values.minTokenAAllocation,
                values.minTokenBAllocation
            );
            const name = `${values.tokenA.toUpperCase()} ${targetAllocation} / ${values.tokenB.toUpperCase()} ${100 - targetAllocation}`;
            if (template) {
                await api.put(
                    `/agent-templates/${template.id}`,
                    {
                        userId: user.id,
                        name,
                        ...values,
                        tokenA: values.tokenA.toUpperCase(),
                        tokenB: values.tokenB.toUpperCase(),
                        agentInstructions: template.agentInstructions,
                    },
                    {headers: {'x-user-id': user.id}}
                );
                queryClient.invalidateQueries({queryKey: ['agent-templates']});
                onSubmitSuccess?.();
            } else {
                const res = await api.post(
                    '/agent-templates',
                    {
                        userId: user.id,
                        name,
                        ...values,
                        tokenA: values.tokenA.toUpperCase(),
                        tokenB: values.tokenB.toUpperCase(),
                        agentInstructions: DEFAULT_AGENT_INSTRUCTIONS,
                    },
                    {headers: {'x-user-id': user.id}}
                );
                queryClient.invalidateQueries({queryKey: ['agent-templates']});
                navigate(`/agent-templates/${res.data.id}`);
            }
        } catch (err) {
            if (axios.isAxiosError(err) && err.response?.data?.error) {
                toast.show(err.response.data.error);
            } else {
                toast.show('Failed to save template');
            }
        }
    });

    return (
        <>
            <form
                onSubmit={onSubmit}
                className="bg-white shadow-md border border-gray-200 rounded p-6 space-y-4 w-full max-w-[30rem]"
            >
                <h2 className="text-xl font-bold">{template ? 'Edit Agent Template' : 'Create Agent Template'}</h2>
                <div className="grid grid-cols-2 gap-4">
                    <FormField label="Token A" htmlFor="tokenA">
                        <Controller
                            name="tokenA"
                            control={control}
                            render={({field}) => (
                                <TokenSelect
                                    id="tokenA"
                                    value={field.value}
                                    onChange={field.onChange}
                                    options={tokens.filter(
                                        (t) => t.value === tokenA || t.value !== tokenB
                                    )}
                                />
                            )}
                        />
                    </FormField>
                    <FormField label="Token B" htmlFor="tokenB">
                        <Controller
                            name="tokenB"
                            control={control}
                            render={({field}) => (
                                <TokenSelect
                                    id="tokenB"
                                    value={field.value}
                                    onChange={field.onChange}
                                    options={tokens.filter(
                                        (t) => t.value === tokenB || t.value !== tokenA
                                    )}
                                />
                            )}
                        />
                    </FormField>
                </div>
                <FormField label="Target Allocation" htmlFor="targetAllocation">
                    <div className="flex items-center gap-2">
          <span className="w-24 text-right">
            {targetAllocation}% {tokenA.toUpperCase()}
          </span>
                        <input
                            id="targetAllocation"
                            type="range"
                            min={0}
                            max={100}
                            {...register('targetAllocation', {valueAsNumber: true})}
                            value={targetAllocation}
                            className="flex-1"
                        />
                        <span className="w-24">
            {100 - targetAllocation}% {tokenB.toUpperCase()}
          </span>
                    </div>
                </FormField>
                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        label={`Min ${tokenA.toUpperCase()} allocation`}
                        htmlFor="minTokenAAllocation"
                    >
                        <Controller
                            name="minTokenAAllocation"
                            control={control}
                            render={({field}) => (
                                <TextInput
                                    id="minTokenAAllocation"
                                    type="number"
                                    min={0}
                                    max={100}
                                    {...field}
                                    onChange={(e) =>
                                        field.onChange(
                                            e.target.value === ''
                                                ? ''
                                                : Number(e.target.value)
                                        )
                                    }
                                />
                            )}
                        />
                    </FormField>
                    <FormField
                        label={`Min ${tokenB.toUpperCase()} allocation`}
                        htmlFor="minTokenBAllocation"
                    >
                        <Controller
                            name="minTokenBAllocation"
                            control={control}
                            render={({field}) => (
                                <TextInput
                                    id="minTokenBAllocation"
                                    type="number"
                                    min={0}
                                    max={100}
                                    {...field}
                                    onChange={(e) =>
                                        field.onChange(
                                            e.target.value === ''
                                                ? ''
                                                : Number(e.target.value)
                                        )
                                    }
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
                            render={({field}) => (
                                <SelectInput
                                    id="risk"
                                    value={field.value}
                                    onChange={field.onChange}
                                    options={riskOptions}
                                />
                            )}
                        />
                    </FormField>
                    <FormField
                        label="Review Interval"
                        htmlFor="reviewInterval"
                        tooltip="How often the agent will review the portfolio; it may not rebalance every time."
                    >
                        <Controller
                            name="reviewInterval"
                            control={control}
                            render={({field}) => (
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
                {!user && (
                    <p className="text-sm text-gray-600 mb-2">Log in to continue</p>
                )}
                {template ? (
                    <div className="flex gap-2">
                        <Button
                            type="submit"
                            className="flex-1"
                            disabled={!user}
                            loading={isSubmitting}
                        >
                            Update
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            className="flex-1"
                            onClick={onCancel}
                        >
                            Cancel
                        </Button>
                    </div>
                ) : (
                    <Button
                        type="submit"
                        className="w-full"
                        disabled={!user}
                        loading={isSubmitting}
                    >
                        Save Template
                    </Button>
                )}
            </form>
        </>
    );
}
