import TokenSelect from './forms/TokenSelect';
import TextInput from './forms/TextInput';
import SelectInput from './forms/SelectInput';
import FormField from './forms/FormField';
import { tokens, riskOptions, reviewIntervalOptions } from '../lib/constants';

interface StrategyData {
  tokenA: string;
  tokenB: string;
  minTokenAAllocation: number;
  minTokenBAllocation: number;
  risk: string;
  reviewInterval: string;
}

interface Props {
  data: StrategyData;
  onChange: <K extends keyof StrategyData>(key: K, value: StrategyData[K]) => void;
  disabled?: boolean;
}


export default function StrategyForm({ data, onChange, disabled = false }: Props) {
  const {
    tokenA,
    tokenB,
    minTokenAAllocation,
    minTokenBAllocation,
    risk,
    reviewInterval,
  } = data;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Token A" htmlFor="tokenA">
          <TokenSelect
            id="tokenA"
            value={tokenA}
            onChange={(v) => onChange('tokenA', v)}
            options={tokens.filter((t) => t.value === tokenA || t.value !== tokenB)}
            disabled={disabled}
          />
        </FormField>
        <FormField label="Token B" htmlFor="tokenB">
          <TokenSelect
            id="tokenB"
            value={tokenB}
            onChange={(v) => onChange('tokenB', v)}
            options={tokens.filter((t) => t.value === tokenB || t.value !== tokenA)}
            disabled={disabled}
          />
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField label={`Min ${tokenA.toUpperCase()} allocation`} htmlFor="minTokenAAllocation">
          <TextInput
            id="minTokenAAllocation"
            type="number"
            min={0}
            max={95}
            value={minTokenAAllocation}
            onChange={(e) => onChange('minTokenAAllocation', Number(e.target.value))}
            disabled={disabled}
          />
        </FormField>
        <FormField label={`Min ${tokenB.toUpperCase()} allocation`} htmlFor="minTokenBAllocation">
          <TextInput
            id="minTokenBAllocation"
            type="number"
            min={0}
            max={95}
            value={minTokenBAllocation}
            onChange={(e) => onChange('minTokenBAllocation', Number(e.target.value))}
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

