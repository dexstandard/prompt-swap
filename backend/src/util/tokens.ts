export const STABLECOINS = ['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'USDP'] as const;
export function isStablecoin(sym: string): boolean {
  return STABLECOINS.includes(sym.toUpperCase() as any);
}
