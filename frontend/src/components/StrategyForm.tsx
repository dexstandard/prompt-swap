import RiskDisplay from './RiskDisplay';
import TokenSelect from './forms/TokenSelect';
import TextInput from './forms/TextInput';
import SelectInput from './forms/SelectInput';
import FormField from './forms/FormField';

interface StrategyData {
  tokenA: string;
  tokenB: string;
  targetAllocation: number;
  minTokenAAllocation: number;
  minTokenBAllocation: number;
  risk: string;
  reviewInterval: string;
}

interface Props {
  data: StrategyData;
  onChange: <K extends keyof StrategyData>(key: K, value: StrategyData[K]) => void;
}

const tokens = [
  { value: 'BTC' },
  { value: 'ETH' },
  { value: 'SOL' },
  { value: 'USDT' },
];

const riskOptions = [
  { value: 'low', label: <RiskDisplay risk="low" /> },
  { value: 'medium', label: <RiskDisplay risk="medium" /> },
  { value: 'high', label: <RiskDisplay risk="high" /> },
];

const reviewIntervalOptions = [
  { value: '1h', label: '1 Hour' },
  { value: '3h', label: '3 Hours' },
  { value: '5h', label: '5 Hours' },
  { value: '12h', label: '12 Hours' },
  { value: '24h', label: '1 Day' },
  { value: '3d', label: '3 Days' },
  { value: '1w', label: '1 Week' },
];

export default function StrategyForm({ data, onChange }: Props) {
  const {
    tokenA,
    tokenB,
    targetAllocation,
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
          />
        </FormField>
        <FormField label="Token B" htmlFor="tokenB">
          <TokenSelect
            id="tokenB"
            value={tokenB}
            onChange={(v) => onChange('tokenB', v)}
            options={tokens.filter((t) => t.value === tokenB || t.value !== tokenA)}
          />
        </FormField>
      </div>
      <FormField label="Target Allocation" htmlFor="targetAllocation">
        <div className="flex items-center gap-2">
          <span className="w-24 text-right">
            {targetAllocation}% {tokenA.toUpperCase()}
          </span>
          <input
            id="targetAllocation"
            type="range"
            min={minTokenAAllocation}
            max={100 - minTokenBAllocation}
            value={targetAllocation}
            onChange={(e) => onChange('targetAllocation', Number(e.target.value))}
            className="flex-1"
          />
          <span className="w-24">
            {100 - targetAllocation}% {tokenB.toUpperCase()}
          </span>
        </div>
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField label={`Min ${tokenA.toUpperCase()} allocation`} htmlFor="minTokenAAllocation">
          <TextInput
            id="minTokenAAllocation"
            type="number"
            min={0}
            max={100}
            value={minTokenAAllocation}
            onChange={(e) => onChange('minTokenAAllocation', Number(e.target.value))}
          />
        </FormField>
        <FormField label={`Min ${tokenB.toUpperCase()} allocation`} htmlFor="minTokenBAllocation">
          <TextInput
            id="minTokenBAllocation"
            type="number"
            min={0}
            max={100}
            value={minTokenBAllocation}
            onChange={(e) => onChange('minTokenBAllocation', Number(e.target.value))}
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
          />
        </FormField>
      </div>
    </div>
  );
}

