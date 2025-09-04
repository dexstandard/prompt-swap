import TokenSelect from './forms/TokenSelect';
import TextInput from './forms/TextInput';
import SelectInput from './forms/SelectInput';
import FormField from './forms/FormField';
import { tokens, riskOptions, reviewIntervalOptions } from '../lib/constants';

interface StrategyData {
  tokens: { token: string; minAllocation: number }[];
  risk: string;
  reviewInterval: string;
}

interface Props {
  data: StrategyData;
  onChange: <K extends keyof StrategyData>(key: K, value: StrategyData[K]) => void;
  disabled?: boolean;
}


export default function StrategyForm({ data, onChange, disabled = false }: Props) {
  const { tokens: tokenData, risk, reviewInterval } = data;
  const tokenA = tokenData[0];
  const tokenB = tokenData[1];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Token 1" htmlFor="token1">
          <TokenSelect
            id="token1"
            value={tokenA.token}
            onChange={(v) =>
              onChange('tokens', [
                { ...tokenA, token: v },
                tokenB,
              ])
            }
            options={tokens.filter(
              (t) => t.value === tokenA.token || t.value !== tokenB.token,
            )}
            disabled={disabled}
          />
        </FormField>
        <FormField label="Token 2" htmlFor="token2">
          <TokenSelect
            id="token2"
            value={tokenB.token}
            onChange={(v) =>
              onChange('tokens', [
                tokenA,
                { ...tokenB, token: v },
              ])
            }
            options={tokens.filter(
              (t) => t.value === tokenB.token || t.value !== tokenA.token,
            )}
            disabled={disabled}
          />
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField
          label={`Min ${tokenA.token.toUpperCase()} allocation`}
          htmlFor="minToken1Allocation"
        >
          <TextInput
            id="minToken1Allocation"
            type="number"
            min={0}
            max={95}
            value={tokenA.minAllocation}
            onChange={(e) =>
              onChange('tokens', [
                { ...tokenA, minAllocation: Number(e.target.value) },
                tokenB,
              ])
            }
            disabled={disabled}
          />
        </FormField>
        <FormField
          label={`Min ${tokenB.token.toUpperCase()} allocation`}
          htmlFor="minToken2Allocation"
        >
          <TextInput
            id="minToken2Allocation"
            type="number"
            min={0}
            max={95}
            value={tokenB.minAllocation}
            onChange={(e) =>
              onChange('tokens', [
                tokenA,
                { ...tokenB, minAllocation: Number(e.target.value) },
              ])
            }
            disabled={disabled}
          />
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Risk Tolerance" htmlFor="risk">
          <SelectInput
            id="risk"
            value={risk}
            onChange={(v) => onChange('risk', v)}
            options={riskOptions}
            disabled={disabled}
          />
        </FormField>
        <FormField
          label="Review Interval"
          htmlFor="reviewInterval"
          tooltip="How often the agent will review the portfolio; it may not rebalance every time."
        >
          <SelectInput
            id="reviewInterval"
            value={reviewInterval}
            onChange={(v) => onChange('reviewInterval', v)}
            options={reviewIntervalOptions}
            disabled={disabled}
          />
        </FormField>
      </div>
    </div>
  );
}

