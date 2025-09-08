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
    stableCoins,
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
    onTokensChange?: (tokens: string[]) => void;
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

    const token1 = watch('tokens.0.token');
    const token2 = watch('tokens.1.token');
    const minToken1Allocation = watch('tokens.0.minAllocation');
    const minToken2Allocation = watch('tokens.1.minAllocation');

    useEffect(() => {
        onTokensChange?.([token1, token2]);
        // onTokensChange is stable via useCallback in parent
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token1, token2]);

    useAllocationNormalization(
        minToken1Allocation,
        minToken2Allocation,
        (index, value) =>
            setValue(`tokens.${index}.minAllocation` as const, value)
    );

    const navigate = useNavigate();
    const [mobileOpen, setMobileOpen] = useState(false);

    const onSubmit = handleSubmit(async (values) => {
        if (!user) return;
        const previewData = {
            name: values.tokens.map((t) => t.token.toUpperCase()).join(' / '),
            tokens: values.tokens.map((t) => ({
                token: t.token.toUpperCase(),
                minAllocation: t.minAllocation,
            })),
            risk: values.risk,
            reviewInterval: values.reviewInterval,
            agentInstructions: DEFAULT_AGENT_INSTRUCTIONS,
            manualRebalance: false,
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
                    <FormField label="Token 1" htmlFor="token1">
                        <Controller
                            name="tokens.0.token"
                            control={control}
                            render={({field}) => (
                                <TokenSelect
                                    id="token1"
                                    value={field.value}
                                    onChange={field.onChange}
                                    options={tokens.filter(
                                        (t) =>
                                            t.value === token1 ||
                                            (t.value !== token2 &&
                                                !(stableCoins.includes(t.value) &&
                                                    stableCoins.includes(token2)))
                                    )}
                                />
                            )}
                        />
                    </FormField>
                    <FormField label="Token 2" htmlFor="token2">
                        <Controller
                            name="tokens.1.token"
                            control={control}
                            render={({field}) => (
                                <TokenSelect
                                    id="token2"
                                    value={field.value}
                                    onChange={field.onChange}
                                    options={tokens.filter(
                                        (t) =>
                                            t.value === token2 ||
                                            (t.value !== token1 &&
                                                !(stableCoins.includes(t.value) &&
                                                    stableCoins.includes(token1)))
                                    )}
                                />
                            )}
                        />
                    </FormField>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        label={`Min ${token1.toUpperCase()} allocation`}
                        htmlFor="minToken1Allocation"
                    >
                        <Controller
                            name="tokens.0.minAllocation"
                            control={control}
                            render={({field}) => (
                                <TextInput
                                    id="minToken1Allocation"
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
                        label={`Min ${token2.toUpperCase()} allocation`}
                        htmlFor="minToken2Allocation"
                    >
                        <Controller
                            name="tokens.1.minAllocation"
                            control={control}
                            render={({field}) => (
                                <TextInput
                                    id="minToken2Allocation"
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
