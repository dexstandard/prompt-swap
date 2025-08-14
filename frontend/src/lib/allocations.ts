export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function normalizeAllocations(
  targetAllocation: number,
  minTokenAAllocation: number,
  minTokenBAllocation: number
) {
  let minA = clamp(minTokenAAllocation, 0, 100);
  let minB = clamp(minTokenBAllocation, 0, 100);

  if (minA + minB > 100) {
    const excess = minA + minB - 100;
    if (minA >= minB) {
      minA -= excess;
    } else {
      minB -= excess;
    }
  }

  const target = clamp(targetAllocation, minA, 100 - minB);

  return {
    targetAllocation: target,
    minTokenAAllocation: minA,
    minTokenBAllocation: minB,
  };
}

