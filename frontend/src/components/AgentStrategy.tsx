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
    <dl className="grid grid-cols-[max-content,1fr] gap-x-2 gap-y-2">
      <dt className="font-semibold flex items-center">Tokens:</dt>
      <dd className="flex items-center gap-1">
        <EditableText
          value={data.tokenA}
          onChange={(v) => onChange('tokenA', v)}
          textClassName="px-0"
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
          textClassName="px-0"
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
      </dd>

      <dt className="font-semibold flex items-center">Target Allocation:</dt>
      <dd>
        <EditableText
          value={String(data.targetAllocation)}
          onChange={(v) => onChange('targetAllocation', Number(v))}
          textClassName="p-0"
          renderDisplay={(v) => (
            <span className="flex items-center gap-2">
              <span className="w-20 text-right">
                {v}% {data.tokenA.toUpperCase()}
              </span>
              <span>/</span>
              <span className="w-20">
                {100 - Number(v)}% {data.tokenB.toUpperCase()}
              </span>
            </span>
          )}
          renderEditor={(local, setLocal, finish) => (
            <span className="flex items-center gap-2">
              <span className="w-20 text-right">
                {local}% {data.tokenA.toUpperCase()}
              </span>
              <input
                type="range"
                min={data.minTokenAAllocation}
                max={100 - data.minTokenBAllocation}
                value={Number(local)}
                onChange={(e) => setLocal(e.target.value)}
                onMouseUp={finish}
                onBlur={finish}
                className="flex-1"
              />
              <span className="w-20">
                {100 - Number(local)}% {data.tokenB.toUpperCase()}
              </span>
            </span>
          )}
        />
      </dd>

      <dt className="font-semibold flex items-center">
        Min {data.tokenA.toUpperCase()} Allocation:
      </dt>
      <dd>
        <EditableText
          value={String(data.minTokenAAllocation)}
          onChange={(v) => onChange('minTokenAAllocation', Number(v))}
          renderDisplay={(v) => `${v}%`}
        />
      </dd>

      <dt className="font-semibold flex items-center">
        Min {data.tokenB.toUpperCase()} Allocation:
      </dt>
      <dd>
        <EditableText
          value={String(data.minTokenBAllocation)}
          onChange={(v) => onChange('minTokenBAllocation', Number(v))}
          renderDisplay={(v) => `${v}%`}
        />
      </dd>

      <dt className="font-semibold flex items-center">Risk Tolerance:</dt>
      <dd className="flex items-center gap-1">
        <EditableText
          value={data.risk}
          onChange={(v) => onChange('risk', v)}
          className="w-40"
          textClassName="w-full px-0"
          renderDisplay={(v) => <RiskDisplay risk={v as any} />}
          renderEditor={(local, setLocal, finish) => (
            <div className="flex-1">
              <SelectInput
                id="risk"
                value={local}
                onChange={(v) => {
                  setLocal(v);
                  finish();
                }}
                options={riskOptions}
              />
            </div>
          )}
        />
      </dd>

      <dt className="font-semibold flex items-center">Review Interval:</dt>
      <dd className="flex items-center gap-1">
        <EditableText
          value={data.reviewInterval}
          onChange={(v) => onChange('reviewInterval', v)}
          className="w-40"
          textClassName="w-full px-0"
          renderDisplay={(v) => reviewIntervalMap[v] ?? v}
          renderEditor={(local, setLocal, finish) => (
            <div className="flex-1">
              <SelectInput
                id="reviewInterval"
                value={local}
                onChange={(v) => {
                  setLocal(v);
                  finish();
                }}
                options={reviewIntervalOptions}
              />
            </div>
          )}
        />
      </dd>
    </dl>
  );
}

