import {useEffect} from 'react';
import {useNavigate} from 'react-router-dom';
import {Controller, useForm} from 'react-hook-form';
import {z} from 'zod';
import {zodResolver} from '@hookform/resolvers/zod';
import api from '../../lib/axios';
import {useUser} from '../../lib/useUser';
import {normalizeAllocations} from '../../lib/allocations';
import TokenSelect from './TokenSelect';

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
    {value: 'BTC', label: 'BTC'},
    {value: 'ETH', label: 'ETH'},
    {value: 'SOL', label: 'SOL'},
    {value: 'USDT', label: 'USDT'},
];

export default function IndexForm({
                                      onTokensChange,
                                  }: {
    onTokensChange?: (tokenA: string, tokenB: string) => void;
}) {
    const {user} = useUser();
    const {
        register,
        handleSubmit,
        watch,
        setValue,
        control,
        formState: {isSubmitting},
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
            agentInstructions:
                'Manage this index based on the configured parameters, actively monitoring real-time market data and relevant news to dynamically adjust positions, aiming to capture local highs for exits and local lows for entries to maximize performance within the defined allocation strategy.',
        },
    });

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
                className="bg-white shadow-md rounded p-6 space-y-4 w-full max-w-[30rem]"
            >
                <h2 className="text-xl font-bold">Create Index</h2>
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
                        <input
                            id="minTokenAAllocation"
                            type="number"
                            {...register('minTokenAAllocation', {valueAsNumber: true})}
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
                            Min {tokenB.toUpperCase()} allocation
                        </label>
                        <input
                            id="minTokenBAllocation"
                            type="number"
                            {...register('minTokenBAllocation', {valueAsNumber: true})}
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
                {!user && (
                    <p className="text-sm text-gray-600 mb-2">Log in to continue</p>
                )}
                <button
                    type="submit"
                    className={`w-full py-2 rounded ${
                        user && !isSubmitting
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                    disabled={!user || isSubmitting}
                >
                    Save template
                </button>
            </form>
        </>
    );
}
