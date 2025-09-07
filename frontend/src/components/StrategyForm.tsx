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
  const token1 = tokenData[0];
  const token2 = tokenData[1];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Token 1" htmlFor="token1">
          <TokenSelect
            id="token1"
            value={token1.token}
            onChange={(v) =>
              onChange('tokens', [
                { ...token1, token: v },
                token2,
              ])
            }
            options={tokens.filter(
              (t) => t.value === token1.token || t.value !== token2.token,
            )}
            disabled={disabled}
          />
        </FormField>
        <FormField label="Token 2" htmlFor="token2">
          <TokenSelect
            id="token2"
            value={token2.token}
            onChange={(v) =>
              onChange('tokens', [
                token1,
                { ...token2, token: v },
              ])
            }
            options={tokens.filter(
              (t) => t.value === token2.token || t.value !== token1.token,
            )}
            disabled={disabled}
          />
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField
          label={`Min ${token1.token.toUpperCase()} allocation`}
          htmlFor="minToken1Allocation"
        >
          <TextInput
            id="minToken1Allocation"
            type="number"
            min={0}
            max={95}
            value={token1.minAllocation}
            onChange={(e) =>
              onChange('tokens', [
                { ...token1, minAllocation: Number(e.target.value) },
                token2,
              ])
            }
            disabled={disabled}
          />
        </FormField>
        <FormField
          label={`Min ${token2.token.toUpperCase()} allocation`}
          htmlFor="minToken2Allocation"
        >
          <TextInput
            id="minToken2Allocation"
            type="number"
            min={0}
            max={95}
            value={token2.minAllocation}
            onChange={(e) =>
              onChange('tokens', [
                token1,
                { ...token2, minAllocation: Number(e.target.value) },
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

