import {useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {Controller, useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {useUser} from '../../lib/useUser';
import {
    DEFAULT_AGENT_INSTRUCTIONS,
    createAgentDefaults,
    createAgentSchema,
    type CreateAgentFormValues,
    riskOptions,
    reviewIntervalOptions,
    tokens,
} from '../../lib/constants';
import useAllocationNormalization from '../../lib/useAllocationNormalization';
import TokenSelect from './TokenSelect';
import TextInput from './TextInput';
import SelectInput from './SelectInput';
import FormField from './FormField';
import Button from '../ui/Button';

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
    } = useForm<CreateAgentFormValues>({
        resolver: zodResolver(createAgentSchema),
        defaultValues: createAgentDefaults,
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

    useAllocationNormalization(
        minTokenAAllocation,
        minTokenBAllocation,
        setValue
    );

    const navigate = useNavigate();
    const [mobileOpen, setMobileOpen] = useState(false);

    const onSubmit = handleSubmit(async (values) => {
        if (!user) return;
        const previewData = {
            name: `${values.tokenA.toUpperCase()} / ${values.tokenB.toUpperCase()}`,
            tokenA: values.tokenA.toUpperCase(),
            tokenB: values.tokenB.toUpperCase(),
            minTokenAAllocation: values.minTokenAAllocation,
            minTokenBAllocation: values.minTokenBAllocation,
            risk: values.risk,
            reviewInterval: values.reviewInterval,
            agentInstructions: DEFAULT_AGENT_INSTRUCTIONS,
        };
        navigate('/agent-preview', {state: previewData});
    });

    return (
        <>
            {!mobileOpen && (
                <Button
                    type="button"
                    className="w-full md:hidden"
                    onClick={() => setMobileOpen(true)}
                >
                    Create Agent
                </Button>
            )}
            <form
                onSubmit={onSubmit}
                className={`bg-white shadow-md border border-gray-200 rounded p-6 space-y-4 w-full max-w-[30rem] ${mobileOpen ? '' : 'hidden'} md:block`}
            >
                <h2 className="text-lg md:text-xl font-bold">Create Agent</h2>
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
