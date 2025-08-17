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
    {value: 'low', label: 'Low'},
    {value: 'medium', label: 'Medium'},
    {value: 'high', label: 'High'},
];

const rebalanceOptions = [
    {value: '1h', label: '1 hour'},
    {value: '3h', label: '3 hours'},
    {value: '5h', label: '5 hours'},
    {value: '12h', label: '12 hours'},
    {value: '24h', label: '1 day'},
    {value: '3d', label: '3 days'},
    {value: '1w', label: '1 week'},
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
    rebalance: '1h',
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
        rebalance: string;
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
                rebalance: template.rebalance as any,
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

    const onSubmit = handleSubmit(async (values) => {
        if (!user) return;
        if (template) {
            await api.put(
                `/agent-templates/${template.id}`,
                {
                    userId: user.id,
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
    });

    return (
        <>
            <form
                onSubmit={onSubmit}
                className="bg-white shadow-md border border-gray-200 rounded p-6 space-y-4 w-full max-w-[30rem]"
            >
                <h2 className="text-xl font-bold">{template ? 'Edit Agent Template' : 'Create Agent Template'}</h2>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1" htmlFor="tokenA">
                            Token A
                        </label>
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
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1" htmlFor="tokenB">
                            Token B
                        </label>
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
                            {...register('targetAllocation', {valueAsNumber: true})}
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
                            Min {tokenA.toUpperCase()} allocation
                        </label>
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
                    </div>
                    <div>
                        <label
                            className="block text-sm font-medium mb-1"
                            htmlFor="minTokenBAllocation"
                        >
                            Min {tokenB.toUpperCase()} allocation
                        </label>
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
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1" htmlFor="risk">
                            Risk Tolerance
                        </label>
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
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1" htmlFor="rebalance">
                            Rebalance Frequency
                        </label>
                        <Controller
                            name="rebalance"
                            control={control}
                            render={({field}) => (
                                <SelectInput
                                    id="rebalance"
                                    value={field.value}
                                    onChange={field.onChange}
                                    options={rebalanceOptions}
                                />
                            )}
                        />
                    </div>
                </div>
                {!user && (
                    <p className="text-sm text-gray-600 mb-2">Log in to continue</p>
                )}
                {template ? (
                    <div className="flex gap-2">
                        <button
                            type="submit"
                            className={`flex-1 py-2 rounded border border-transparent ${
                                user && !isSubmitting
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                            disabled={!user || isSubmitting}
                        >
                            Update
                        </button>
                        <button
                            type="button"
                            className="flex-1 py-2 rounded border border-gray-300"
                            onClick={onCancel}
                        >
                            Cancel
                        </button>
                    </div>
                ) : (
                    <button
                        type="submit"
                        className={`w-full py-2 rounded border border-transparent ${
                            user && !isSubmitting
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                        disabled={!user || isSubmitting}
                    >
                        Save Template
                    </button>
                )}
            </form>
        </>
    );
}
