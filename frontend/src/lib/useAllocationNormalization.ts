import {useEffect} from 'react';
import {normalizeAllocations} from './allocations';

type SetAllocationValue = (index: 0 | 1, value: number) => void;

export default function useAllocationNormalization(
    minTokenAAllocation: number,
    minTokenBAllocation: number,
    setValue: SetAllocationValue,
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
            setValue(0, normalized.minTokenAAllocation);
            setValue(1, normalized.minTokenBAllocation);
        }
    }, [minTokenAAllocation, minTokenBAllocation, setValue]);
}

