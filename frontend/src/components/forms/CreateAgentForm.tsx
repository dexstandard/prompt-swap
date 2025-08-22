import {useEffect} from 'react';
import {useNavigate} from 'react-router-dom';
import {Controller, useForm} from 'react-hook-form';
import {z} from 'zod';
import {zodResolver} from '@hookform/resolvers/zod';
import {useUser} from '../../lib/useUser';
import {normalizeAllocations} from '../../lib/allocations';
import TokenSelect from './TokenSelect';
import TextInput from './TextInput';
import SelectInput from './SelectInput';
import FormField from './FormField';
import RiskDisplay from '../RiskDisplay';
import Button from '../ui/Button';

const schema = z
    .object({
        tokenA: z.string().min(1, 'Token A is required'),
        tokenB: z.string().min(1, 'Token B is required'),
        minTokenAAllocation: z
            .number()
            .min(0, 'Must be at least 0')
            .max(95, 'Must be 95 or less'),
        minTokenBAllocation: z
            .number()
            .min(0, 'Must be at least 0')
            .max(95, 'Must be 95 or less'),
        risk: z.enum(['low', 'medium', 'high']),
        reviewInterval: z.enum(['1h', '3h', '5h', '12h', '24h', '3d', '1w']),
    })
    .refine((data) => data.tokenA !== data.tokenB, {
        message: 'Tokens must be different',
        path: ['tokenB'],
    })
    .refine(
        (data) => data.minTokenAAllocation + data.minTokenBAllocation <= 95,
        {
            message: 'Min allocations must leave at least 5% unallocated',
            path: ['minTokenBAllocation'],
        }
    );

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
    minTokenAAllocation: 0,
    minTokenBAllocation: 30,
    risk: 'low',
    reviewInterval: '1h',
};

export default function CreateAgentForm({
                                      onTokensChange,
                                  }: {
    onTokensChange?: (tokenA: string, tokenB: string) => void;
}) {
    const {user} = useUser();
    const {
        handleSubmit,
        watch,
        setValue,
        control,
        formState: {isSubmitting},
    } = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues,
    });

    const tokenA = watch('tokenA');
    const tokenB = watch('tokenB');
    const minTokenAAllocation = watch('minTokenAAllocation');
    const minTokenBAllocation = watch('minTokenBAllocation');

    

    useEffect(() => {
        onTokensChange?.(tokenA, tokenB);
        // onTokensChange is stable via useCallback in parent
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tokenA, tokenB]);

    useEffect(() => {
        const currentMinA = Number.isFinite(minTokenAAllocation)
            ? minTokenAAllocation
            : 0;
        const currentMinB = Number.isFinite(minTokenBAllocation)
            ? minTokenBAllocation
            : 0;
        const normalized = normalizeAllocations(currentMinA, currentMinB);
        if (
            normalized.minTokenAAllocation !== currentMinA ||
            normalized.minTokenBAllocation !== currentMinB
        ) {
            setValue('minTokenAAllocation', normalized.minTokenAAllocation);
            setValue('minTokenBAllocation', normalized.minTokenBAllocation);
        }
    }, [minTokenAAllocation, minTokenBAllocation, setValue]);

    const navigate = useNavigate();

    const onSubmit = handleSubmit(async (values) => {
        if (!user) return;
        const normalized = normalizeAllocations(
            values.minTokenAAllocation,
            values.minTokenBAllocation
        );
        const previewData = {
            name: `${values.tokenA.toUpperCase()} / ${values.tokenB.toUpperCase()}`,
            tokenA: values.tokenA.toUpperCase(),
            tokenB: values.tokenB.toUpperCase(),
            minTokenAAllocation: normalized.minTokenAAllocation,
            minTokenBAllocation: normalized.minTokenBAllocation,
            risk: values.risk,
            reviewInterval: values.reviewInterval,
            agentInstructions: DEFAULT_AGENT_INSTRUCTIONS,
        };
        navigate('/agent-preview', {state: previewData});
    });

    return (
        <>
            <form
                onSubmit={onSubmit}
                className="bg-white shadow-md border border-gray-200 rounded p-6 space-y-4 w-full max-w-[30rem]"
            >
                <h2 className="text-xl font-bold">Create Agent</h2>
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
                                    max={95}
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
                                    max={95}
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
                <Button
                    type="submit"
                    className="w-full"
                    disabled={!user}
                    loading={isSubmitting}
                >
                    Preview
                </Button>
            </form>
        </>
    );
}
