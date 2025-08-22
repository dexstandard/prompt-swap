export function validateAllocations(
  minTokenAAllocation: number,
  minTokenBAllocation: number,
) {
  if (
    minTokenAAllocation < 0 ||
    minTokenBAllocation < 0 ||
    minTokenAAllocation > 95 ||
    minTokenBAllocation > 95 ||
    minTokenAAllocation + minTokenBAllocation > 95
  ) {
    throw new Error('invalid minimum allocations');
  }
  return {
    minTokenAAllocation,
    minTokenBAllocation,
  };
}
