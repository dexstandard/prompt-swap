import RiskDisplay from './RiskDisplay';
import TokenDisplay from './TokenDisplay';
import EditableText from './EditableText';
import TokenSelect from './forms/TokenSelect';
import SelectInput from './forms/SelectInput';

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

const reviewIntervalMap: Record<string, string> = {
  '1h': '1 Hour',
  '3h': '3 Hours',
  '5h': '5 Hours',
  '12h': '12 Hours',
  '24h': '1 Day',
  '3d': '3 Days',
  '1w': '1 Week',
};

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

export default function AgentStrategy({ data, onChange }: Props) {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1">
        <strong>Tokens:</strong>
        <EditableText
          value={data.tokenA}
          onChange={(v) => onChange('tokenA', v)}
          renderDisplay={(v) => <TokenDisplay token={v} />}
          renderEditor={(local, setLocal, finish) => (
            <TokenSelect
              id="tokenA"
              value={local}
              onChange={(v) => {
                setLocal(v);
                finish();
              }}
              options={tokens.filter(
                (t) => t.value === data.tokenA || t.value !== data.tokenB
              )}
            />
          )}
        />
        <span>/</span>
        <EditableText
          value={data.tokenB}
          onChange={(v) => onChange('tokenB', v)}
          renderDisplay={(v) => <TokenDisplay token={v} />}
          renderEditor={(local, setLocal, finish) => (
            <TokenSelect
              id="tokenB"
              value={local}
              onChange={(v) => {
                setLocal(v);
                finish();
              }}
              options={tokens.filter(
                (t) => t.value === data.tokenB || t.value !== data.tokenA
              )}
            />
          )}
        />
      </p>
      <p className="flex items-center gap-1">
        <strong>Target Allocation:</strong>
        <EditableText
          value={String(data.targetAllocation)}
          onChange={(v) => onChange('targetAllocation', Number(v))}
          renderDisplay={(v) => (
            <span className="flex items-center gap-2">
              <span className="w-24 text-right">
                {v}% {data.tokenA.toUpperCase()}
              </span>
              <span className="w-24">
                {100 - Number(v)}% {data.tokenB.toUpperCase()}
              </span>
            </span>
          )}
          renderEditor={(local, setLocal, finish) => (
            <span className="flex items-center gap-2">
              <span className="w-24 text-right">
                {local}% {data.tokenA.toUpperCase()}
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={Number(local)}
                onChange={(e) => setLocal(e.target.value)}
                onMouseUp={finish}
                onBlur={finish}
                className="flex-1"
              />
              <span className="w-24">
                {100 - Number(local)}% {data.tokenB.toUpperCase()}
              </span>
            </span>
          )}
        />
      </p>
      <p>
        <strong>Minimum {data.tokenA.toUpperCase()} Allocation:</strong>{' '}
        <EditableText
          value={String(data.minTokenAAllocation)}
          onChange={(v) => onChange('minTokenAAllocation', Number(v))}
          renderDisplay={(v) => `${v}%`}
        />
      </p>
      <p>
        <strong>Minimum {data.tokenB.toUpperCase()} Allocation:</strong>{' '}
        <EditableText
          value={String(data.minTokenBAllocation)}
          onChange={(v) => onChange('minTokenBAllocation', Number(v))}
          renderDisplay={(v) => `${v}%`}
        />
      </p>
      <p className="flex items-center gap-1">
        <strong>Risk Tolerance:</strong>
        <EditableText
          value={data.risk}
          onChange={(v) => onChange('risk', v)}
          renderDisplay={(v) => <RiskDisplay risk={v as any} />}
          renderEditor={(local, setLocal, finish) => (
            <SelectInput
              id="risk"
              value={local}
              onChange={(v) => {
                setLocal(v);
                finish();
              }}
              options={riskOptions}
            />
          )}
        />
      </p>
      <p className="flex items-center gap-1">
        <strong>Review Interval:</strong>
        <EditableText
          value={data.reviewInterval}
          onChange={(v) => onChange('reviewInterval', v)}
          renderDisplay={(v) => reviewIntervalMap[v] ?? v}
          renderEditor={(local, setLocal, finish) => (
            <SelectInput
              id="reviewInterval"
              value={local}
              onChange={(v) => {
                setLocal(v);
                finish();
              }}
              options={reviewIntervalOptions}
            />
          )}
        />
      </p>
    </div>
  );
}

