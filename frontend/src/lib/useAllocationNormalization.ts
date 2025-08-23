import {useEffect} from 'react';
import {normalizeAllocations} from './allocations';

type SetAllocationValue = (
    field: 'minTokenAAllocation' | 'minTokenBAllocation',
    value: number
) => void;

export default function useAllocationNormalization(
    minTokenAAllocation: number,
    minTokenBAllocation: number,
    setValue: SetAllocationValue
) {
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
}

